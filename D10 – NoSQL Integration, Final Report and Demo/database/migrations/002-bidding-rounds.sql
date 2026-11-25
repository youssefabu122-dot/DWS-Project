-- Bid history and raises, bidding rounds, organizer decisions. Idempotent; never changes
-- existing values. history_id is a bid's effective order: a raise gets a new, later row.
CREATE TABLE IF NOT EXISTS BidHistory (
    history_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    bid_id INT NOT NULL,
    cycle_id INT NOT NULL,
    member_id INT NOT NULL,
    action VARCHAR(10) NOT NULL CHECK (action IN ('placed', 'raised')),
    discount_rate NUMERIC(5,2) NOT NULL,
    previous_rate NUMERIC(5,2) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    INDEX idx_bidhistory_cycle (cycle_id, history_id),
    CONSTRAINT fk_bidhistory_bid FOREIGN KEY (bid_id) REFERENCES Bid(bid_id)
);

CREATE TABLE IF NOT EXISTS CycleDecision (
    decision_id INT AUTO_INCREMENT PRIMARY KEY,
    cycle_id INT NOT NULL,
    round_no INT NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('reopen', 'new_cycle', 'random_winner')),
    decided_by INT NOT NULL,
    decided_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    details JSON NULL,
    UNIQUE (cycle_id, round_no),
    CONSTRAINT fk_decision_cycle FOREIGN KEY (cycle_id) REFERENCES Cycle(cycle_id),
    CONSTRAINT fk_decision_member FOREIGN KEY (decided_by) REFERENCES Member(member_id)
);

-- MySQL has no ADD COLUMN IF NOT EXISTS, hence the guarded statements.
SET @add := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'Bid' AND COLUMN_NAME = 'effective_seq') = 0,
  'ALTER TABLE Bid ADD COLUMN effective_seq BIGINT NULL', 'DO 0');
PREPARE stmt FROM @add; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @add := IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'Cycle' AND COLUMN_NAME = 'bidding_round') = 0,
  'ALTER TABLE Cycle ADD COLUMN bidding_round INT NOT NULL DEFAULT 1', 'DO 0');
PREPARE stmt FROM @add; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Existing bids get one history row each in bid_id order, keeping the old tie rule exactly.
INSERT INTO BidHistory (bid_id, cycle_id, member_id, action, discount_rate)
SELECT b.bid_id, b.cycle_id, b.member_id, 'placed', b.discount_rate
FROM Bid b
WHERE NOT EXISTS (SELECT 1 FROM BidHistory h WHERE h.bid_id = b.bid_id)
ORDER BY b.bid_id;

UPDATE Bid b
JOIN (SELECT bid_id, MAX(history_id) AS last_id FROM BidHistory GROUP BY bid_id) h ON h.bid_id = b.bid_id
SET b.effective_seq = h.last_id
WHERE b.effective_seq IS NULL;
