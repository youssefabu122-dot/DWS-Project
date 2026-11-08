-- D8 Track B. Select the existing D7 v2 schema

ALTER TABLE Membership
    ADD COLUMN d8_payout_turns BIGINT UNSIGNED NOT NULL DEFAULT 0;

UPDATE Membership AS m
JOIN (
    SELECT c.circle_id, p.member_id, COUNT(*) AS turns
    FROM Payout AS p JOIN Cycle AS c ON c.cycle_id = p.cycle_id
    GROUP BY c.circle_id, p.member_id
) AS history ON history.circle_id = m.circle_id AND history.member_id = m.member_id
SET m.d8_payout_turns = history.turns;

ALTER TABLE Cycle
    ADD COLUMN d8_winning_bid_id INT NULL,
    ADD CONSTRAINT fk_d8_cycle_winning_bid
        FOREIGN KEY (d8_winning_bid_id) REFERENCES Bid(bid_id);

-- Current eligibility is circle-scoped. A new round starts automatically
-- once everyone has received the same number of payouts.
CREATE VIEW v_D8Eligibility AS
SELECT member_id, circle_id, d8_payout_turns,
       d8_payout_turns = MIN(d8_payout_turns) OVER (PARTITION BY circle_id) AS eligible
FROM Membership;
-- MySQL InnoDB. Public routines own the transaction on a dedicated connection.
-- Invoke with autocommit enabled and no active transaction.
DELIMITER $$

-- Internal. All writers take Circle -> Cycle before reading or changing
-- circle state. Cycle.circle_id is immutable for the application.
CREATE PROCEDURE d8_lock_open_cycle(
    IN p_cycle INT, OUT p_circle INT, OUT p_deadline DATETIME
)
SQL SECURITY DEFINER
BEGIN
    DECLARE v_locked_circle INT DEFAULT NULL;
    DECLARE v_cycle_circle INT DEFAULT NULL;
    DECLARE v_seq INT;
    DECLARE v_status VARCHAR(20);

    IF @@session.time_zone <> '+00:00' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'D8_UTC_SESSION_REQUIRED';
    END IF;
    SET p_circle = NULL;
    SELECT circle_id INTO p_circle FROM Cycle WHERE cycle_id = p_cycle;
    IF p_circle IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'D8_CYCLE_NOT_FOUND';
    END IF;
    SELECT circle_id INTO v_locked_circle FROM Circle
    WHERE circle_id = p_circle FOR UPDATE;
    SELECT circle_id, status, seq_no, bidding_closes_at
    INTO v_cycle_circle, v_status, v_seq, p_deadline
    FROM Cycle WHERE cycle_id = p_cycle FOR UPDATE;

    IF v_locked_circle IS NULL OR v_cycle_circle IS NULL OR v_cycle_circle <> p_circle THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'D8_CYCLE_CHANGED';
    END IF;
    IF v_status <> 'open' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'D8_CYCLE_NOT_OPEN';
    END IF;
    IF v_seq < 1 OR EXISTS (
        SELECT 1 FROM Cycle AS c LEFT JOIN Payout AS p ON p.cycle_id = c.cycle_id
        WHERE c.circle_id = p_circle AND (
            (c.seq_no < v_seq AND (c.status <> 'closed' OR p.cycle_id IS NULL))
            OR (c.seq_no > v_seq AND (c.status = 'closed' OR p.cycle_id IS NOT NULL))
        )
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'D8_CYCLE_OUT_OF_ORDER';
    END IF;
END$$

-- Internal. Call only under the parent locks with a verified payment receipt.
CREATE PROCEDURE d8_mark_paid_locked(IN p_cycle INT, IN p_circle INT, IN p_member INT)
SQL SECURITY DEFINER
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM Membership WHERE circle_id = p_circle AND member_id = p_member
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'D8_PAYER_NOT_IN_CIRCLE';
    END IF;
    INSERT INTO Contribution (member_id, cycle_id, payment_status)
    VALUES (p_member, p_cycle, 'paid')
    ON DUPLICATE KEY UPDATE payment_status = 'paid';
END$$

-- Public. Record an already verified, full fixed-amount payment.
CREATE PROCEDURE d8_record_paid(IN p_cycle INT, IN p_member INT)
SQL SECURITY DEFINER
BEGIN
    DECLARE v_circle INT;
    DECLARE v_deadline DATETIME;

    SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
    START TRANSACTION;
    BEGIN
        DECLARE EXIT HANDLER FOR SQLEXCEPTION
        BEGIN
            ROLLBACK AND NO CHAIN NO RELEASE;
            RESIGNAL;
        END;
        CALL d8_lock_open_cycle(p_cycle, v_circle, v_deadline);
        CALL d8_mark_paid_locked(p_cycle, v_circle, p_member);
        COMMIT AND NO CHAIN NO RELEASE;
    END;
END$$

-- Public. One bid per member/cycle. All DATETIME values here are UTC.
CREATE PROCEDURE d8_submit_bid(IN p_cycle INT, IN p_member INT, IN p_rate DECIMAL(5,2))
SQL SECURITY DEFINER
BEGIN
    DECLARE v_circle INT;
    DECLARE v_deadline DATETIME;
    DECLARE v_now DATETIME;
    DECLARE v_scheduled DATE;

    SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
    START TRANSACTION;
    BEGIN
        DECLARE EXIT HANDLER FOR SQLEXCEPTION
        BEGIN
            ROLLBACK AND NO CHAIN NO RELEASE;
            RESIGNAL;
        END;
        CALL d8_lock_open_cycle(p_cycle, v_circle, v_deadline);
        -- SYSDATE is evaluated after any lock wait. Set UTC for this connection
        -- (see README), and leave sysdate_is_now disabled.
        SET v_now = SYSDATE();
        SELECT scheduled_on INTO v_scheduled FROM v_CycleSchedule WHERE cycle_id = p_cycle;
        IF v_scheduled IS NULL OR DATE(v_now) < v_scheduled THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'D8_BIDDING_NOT_STARTED';
        END IF;
        IF v_deadline IS NULL OR v_now >= v_deadline THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'D8_BIDDING_ENDED';
        END IF;
        IF p_rate IS NULL OR p_rate < 0 OR p_rate > 100 OR NOT EXISTS (
            SELECT 1 FROM Circle WHERE circle_id = v_circle
              AND discount_unit = 'PERCENT' AND discount_share_rule = 'EQUAL_NON_WINNERS'
        ) THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'D8_INVALID_BID_OR_RULE';
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM v_D8Eligibility
            WHERE circle_id = v_circle AND member_id = p_member AND eligible = 1
        ) THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'D8_BIDDER_NOT_ELIGIBLE';
        END IF;
        INSERT INTO Bid (member_id, cycle_id, discount_rate, submitted_at)
        VALUES (p_member, p_cycle, p_rate, v_now);
        COMMIT AND NO CHAIN NO RELEASE;
    END;
END$$

-- Public. NULL p_track_a_winner selects Track B. A non-NULL value supplies
-- the scheduled/authorized Track A winner for a non-auction cycle.
CREATE PROCEDURE d8_close_cycle(IN p_cycle INT, IN p_final_payer INT, IN p_track_a_winner INT)
SQL SECURITY DEFINER
BEGIN
    DECLARE v_circle INT;
    DECLARE v_deadline DATETIME;
    DECLARE v_now DATETIME;
    DECLARE v_scheduled DATE;
    DECLARE v_fee DECIMAL(10,2);
    DECLARE v_unit VARCHAR(7);
    DECLARE v_rule VARCHAR(100);
    DECLARE v_member_count BIGINT;
    DECLARE v_paid_count BIGINT;
    DECLARE v_min_turns BIGINT UNSIGNED;
    DECLARE v_winner INT DEFAULT NULL;
    DECLARE v_bid INT DEFAULT NULL;
    DECLARE v_rate DECIMAL(5,2);
    DECLARE v_gross DECIMAL(30,2);
    DECLARE v_discount_cents DECIMAL(30,0) DEFAULT 0;
    DECLARE v_base_cents DECIMAL(30,0) DEFAULT 0;
    DECLARE v_extra_cents BIGINT DEFAULT 0;

    SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
    START TRANSACTION;
    BEGIN
        DECLARE EXIT HANDLER FOR SQLEXCEPTION
        BEGIN
            ROLLBACK AND NO CHAIN NO RELEASE;
            RESIGNAL;
        END;

        CALL d8_lock_open_cycle(p_cycle, v_circle, v_deadline);
        SET v_now = SYSDATE();
        SELECT contribution_amount, discount_unit, discount_share_rule
        INTO v_fee, v_unit, v_rule FROM Circle WHERE circle_id = v_circle;

        CALL d8_mark_paid_locked(p_cycle, v_circle, p_final_payer);
        SELECT COUNT(*), MIN(d8_payout_turns) INTO v_member_count, v_min_turns
        FROM Membership WHERE circle_id = v_circle;
        SELECT COUNT(*) INTO v_paid_count
        FROM Membership AS m JOIN Contribution AS r ON r.member_id = m.member_id
        WHERE m.circle_id = v_circle AND r.cycle_id = p_cycle AND r.payment_status = 'paid';

        IF v_paid_count <> v_member_count THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'D8_POT_NOT_FUNDED';
        END IF;
        IF EXISTS (
            SELECT 1 FROM Contribution AS r LEFT JOIN Membership AS m
              ON m.circle_id = v_circle AND m.member_id = r.member_id
            WHERE r.cycle_id = p_cycle AND m.member_id IS NULL
        ) THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'D8_OUTSIDER_CONTRIBUTION';
        END IF;
        SET v_gross = v_member_count * v_fee;

        IF p_track_a_winner IS NULL THEN
            IF v_unit IS NULL OR v_unit <> 'PERCENT'
                OR v_rule IS NULL OR v_rule <> 'EQUAL_NON_WINNERS' THEN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'D8_AUCTION_RULE_REQUIRED';
            END IF;
            SELECT scheduled_on INTO v_scheduled FROM v_CycleSchedule WHERE cycle_id = p_cycle;
            IF v_scheduled IS NULL OR v_deadline IS NULL
                OR v_deadline <= CAST(v_scheduled AS DATETIME) OR v_now < v_deadline THEN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'D8_AUCTION_DEADLINE_NOT_REACHED';
            END IF;

            -- B1. Close bidding under the lock. State is tentative until commit.
            UPDATE Cycle SET status = 'closed' WHERE cycle_id = p_cycle;

            -- B2. Highest valid eligible bid, then earliest submission, then bid ID.
            SELECT b.bid_id, b.member_id, b.discount_rate
            INTO v_bid, v_winner, v_rate
            FROM Bid AS b JOIN Membership AS m
              ON m.circle_id = v_circle AND m.member_id = b.member_id
            WHERE b.cycle_id = p_cycle AND m.d8_payout_turns = v_min_turns
              AND b.discount_rate BETWEEN 0 AND 100
              AND b.submitted_at >= CAST(v_scheduled AS DATETIME) AND b.submitted_at < v_deadline
            ORDER BY b.discount_rate DESC, b.submitted_at ASC, b.bid_id ASC
            LIMIT 1;
            IF v_bid IS NULL THEN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'D8_NO_VALID_ELIGIBLE_BID';
            END IF;
            UPDATE Cycle SET d8_winning_bid_id = v_bid WHERE cycle_id = p_cycle;

            -- Plan B3 before recording B4. A percent of the pot, in whole cents.
            SET v_discount_cents = ROUND(v_gross * v_rate, 0);
            IF v_member_count = 1 AND v_discount_cents > 0 THEN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'D8_NO_SHARE_RECIPIENTS';
            END IF;
            IF v_member_count > 1 THEN
                SET v_extra_cents = MOD(v_discount_cents, v_member_count - 1);
                SET v_base_cents = (v_discount_cents - v_extra_cents) / (v_member_count - 1);
            END IF;
        ELSE
            IF v_deadline IS NOT NULL OR v_unit IS NOT NULL OR v_rule IS NOT NULL
               OR EXISTS (SELECT 1 FROM Bid WHERE cycle_id = p_cycle) THEN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'D8_TRACK_A_REQUIRES_NON_AUCTION';
            END IF;
            IF NOT EXISTS (
                SELECT 1 FROM Membership WHERE circle_id = v_circle
                    AND member_id = p_track_a_winner AND d8_payout_turns = v_min_turns
            ) THEN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'D8_WINNER_NOT_ELIGIBLE';
            END IF;
            SET v_winner = p_track_a_winner;
            UPDATE Cycle SET status = 'closed' WHERE cycle_id = p_cycle;
        END IF;

        -- B4 / Track A. D7 Payout PK also catches a duplicate payout.
        INSERT INTO Payout (cycle_id, member_id, paid_at) VALUES (p_cycle, v_winner, v_now);

        -- Persist B3 after B4 because DiscountShare references Payout.
        IF v_bid IS NOT NULL THEN
            INSERT INTO DiscountShare (payout_cycle_id, member_id, amount)
            SELECT p_cycle, ranked.member_id,
                (v_base_cents + (ranked.position_no <= v_extra_cents)) * 0.01
            FROM (
                SELECT member_id, ROW_NUMBER() OVER (ORDER BY member_id) AS position_no
                FROM Membership WHERE circle_id = v_circle AND member_id <> v_winner
            ) AS ranked;
        END IF;

        -- B5 / Track A. The winner cannot receive again before everyone
        -- completes this round. The last award opens the next round.
        UPDATE Membership SET d8_payout_turns = d8_payout_turns + 1
        WHERE circle_id = v_circle AND member_id = v_winner;

        COMMIT AND NO CHAIN NO RELEASE;
    END;
END$$

DELIMITER ;
