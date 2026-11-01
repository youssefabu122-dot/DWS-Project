
-- Schema file for creating tables 

CREATE TABLE Member (
    member_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL
) ENGINE=InnoDB;

CREATE TABLE Circle (
    circle_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    contribution_amount NUMERIC(10,2) NOT NULL
        CHECK (contribution_amount > 0),
    start_date DATE NOT NULL,
    interval_value INT NULL,
    interval_unit VARCHAR(5) NULL,
    discount_unit VARCHAR(7) NULL,
    discount_share_rule VARCHAR(100) NULL,
    CONSTRAINT ck_circle_interval CHECK ((interval_value IS NULL AND interval_unit IS NULL) OR (interval_value IS NOT NULL AND interval_unit IS NOT NULL AND interval_value>0 AND interval_unit IN ('DAY','MONTH'))),
    CONSTRAINT ck_circle_discount_unit CHECK (discount_unit IS NULL OR discount_unit='PERCENT')
) ENGINE=InnoDB;

CREATE TABLE Membership (
    member_id INT NOT NULL,
    circle_id INT NOT NULL,
    joined_on DATE NOT NULL,
    PRIMARY KEY (member_id, circle_id),
    CONSTRAINT fk_membership_member FOREIGN KEY (member_id) REFERENCES Member(member_id) ON DELETE CASCADE,
    CONSTRAINT fk_membership_circle FOREIGN KEY (circle_id) REFERENCES Circle(circle_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE Cycle (
    cycle_id INT AUTO_INCREMENT PRIMARY KEY,
    circle_id INT NOT NULL,
    seq_no INT NOT NULL,
    status VARCHAR(20) NOT NULL,
    bidding_closes_at DATETIME NULL,
    UNIQUE (circle_id, seq_no),
    CONSTRAINT fk_cycle_circle FOREIGN KEY (circle_id) REFERENCES Circle(circle_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE Contribution (
    contribution_id INT AUTO_INCREMENT PRIMARY KEY,
    member_id INT NOT NULL,
    cycle_id INT NOT NULL,
    payment_status VARCHAR(7) NOT NULL DEFAULT 'unknown',
    UNIQUE (member_id, cycle_id),
    CONSTRAINT fk_contribution_member FOREIGN KEY (member_id) REFERENCES Member(member_id),
    CONSTRAINT fk_contribution_cycle FOREIGN KEY (cycle_id) REFERENCES Cycle(cycle_id),
    CONSTRAINT ck_contribution_payment CHECK (payment_status IN ('unknown','unpaid','paid'))
) ENGINE=InnoDB;

CREATE TABLE Bid (
    bid_id INT AUTO_INCREMENT PRIMARY KEY,
    member_id INT NOT NULL,
    cycle_id INT NOT NULL,
    discount_rate NUMERIC(5,2) NOT NULL,
    submitted_at DATETIME NULL,
    UNIQUE (member_id, cycle_id),
    CONSTRAINT fk_bid_member FOREIGN KEY (member_id) REFERENCES Member(member_id),
    CONSTRAINT fk_bid_cycle FOREIGN KEY (cycle_id) REFERENCES Cycle(cycle_id)
) ENGINE=InnoDB;

CREATE TABLE Payout (
    cycle_id INT PRIMARY KEY,
    member_id INT NOT NULL,
    paid_at DATETIME NOT NULL,
    CONSTRAINT fk_payout_cycle FOREIGN KEY (cycle_id) REFERENCES Cycle(cycle_id),
    CONSTRAINT fk_payout_member FOREIGN KEY (member_id) REFERENCES Member(member_id)
) ENGINE=InnoDB;

CREATE TABLE DiscountShare (
    share_id INT AUTO_INCREMENT PRIMARY KEY,
    payout_cycle_id INT NOT NULL,
    member_id INT NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    UNIQUE (payout_cycle_id, member_id),
    CONSTRAINT fk_discountshare_payout FOREIGN KEY (payout_cycle_id) REFERENCES Payout(cycle_id),
    CONSTRAINT fk_discountshare_member FOREIGN KEY (member_id) REFERENCES Member(member_id)
) ENGINE=InnoDB;
CREATE INDEX idx_bid_cycle_discount_member ON Bid(cycle_id,discount_rate,member_id);

-- Derived values are views: no redundant pot, scheduled date or payout amount columns.
CREATE VIEW v_CycleSchedule AS
SELECT c.cycle_id, c.circle_id, c.seq_no,
 CASE cr.interval_unit
  WHEN 'DAY' THEN DATE_ADD(cr.start_date, INTERVAL ((c.seq_no-1)*cr.interval_value) DAY)
  WHEN 'MONTH' THEN DATE_ADD(cr.start_date, INTERVAL ((c.seq_no-1)*cr.interval_value) MONTH)
  ELSE NULL END AS scheduled_on,
 c.bidding_closes_at
FROM Cycle c JOIN Circle cr ON cr.circle_id=c.circle_id;

CREATE VIEW v_ContributionLedger AS
SELECT x.contribution_id, x.member_id, x.cycle_id,
       cr.contribution_amount AS amount, x.payment_status
FROM Contribution x JOIN Cycle c ON c.cycle_id=x.cycle_id
JOIN Circle cr ON cr.circle_id=c.circle_id;

-- Obligations for every current member/cycle, including future cycles without receipts.
CREATE VIEW v_CycleObligations AS
SELECT m.member_id,c.cycle_id,cr.contribution_amount AS amount,
 x.contribution_id,COALESCE(x.payment_status,'unknown') AS payment_status
FROM Membership m JOIN Cycle c ON c.circle_id=m.circle_id
JOIN Circle cr ON cr.circle_id=c.circle_id
LEFT JOIN Contribution x ON x.member_id=m.member_id AND x.cycle_id=c.cycle_id;

CREATE VIEW v_CyclePot AS
SELECT c.cycle_id, COUNT(x.contribution_id) AS contribution_count,
 COALESCE(SUM(l.amount),0) AS recorded_total,
 COALESCE(SUM(CASE WHEN l.payment_status='paid' THEN l.amount ELSE 0 END),0) AS paid_total,
 COALESCE(SUM(CASE WHEN l.payment_status='unknown' THEN 1 ELSE 0 END),0) AS unknown_payment_count
FROM Cycle c LEFT JOIN Contribution x ON x.cycle_id=c.cycle_id
LEFT JOIN v_ContributionLedger l ON l.contribution_id=x.contribution_id
GROUP BY c.cycle_id;

-- Historical review, NOT a certification that other legacy bids are valid.
-- Uses payout sequence, since the old Bid table contains no submission timestamps.
CREATE VIEW v_LegacyBidReview AS
SELECT b.bid_id,b.member_id,b.cycle_id,b.discount_rate,
 CASE WHEN NOT EXISTS (
   SELECT 1 FROM Membership m WHERE m.circle_id=c.circle_id AND m.member_id=b.member_id
 ) THEN 'not_circle_member'
 WHEN (SELECT COUNT(*) FROM Payout p JOIN Cycle pc ON pc.cycle_id=p.cycle_id
       WHERE pc.circle_id=c.circle_id AND pc.seq_no<c.seq_no AND p.member_id=b.member_id)
 > (SELECT MIN(w.n) FROM (
      SELECT mm.circle_id,mm.member_id,cc.cycle_id AS target_cycle_id,
       (SELECT COUNT(*) FROM Payout pp JOIN Cycle cp ON cp.cycle_id=pp.cycle_id
        WHERE cp.circle_id=mm.circle_id AND cp.seq_no<cc.seq_no AND pp.member_id=mm.member_id) AS n
      FROM Membership mm JOIN Cycle cc ON cc.circle_id=mm.circle_id
    ) w WHERE w.target_cycle_id=c.cycle_id)
 THEN 'previous_winner_not_eligible'
 ELSE 'timing_and_payment_unverified' END AS review_reason
FROM Bid b JOIN Cycle c ON c.cycle_id=b.cycle_id
WHERE b.submitted_at IS NULL;

CREATE VIEW v_PayoutAmounts AS
SELECT p.cycle_id,p.member_id,p.paid_at,k.recorded_total AS gross_pot,
 b.discount_rate,
 CASE WHEN cr.discount_unit='PERCENT' THEN ROUND(k.recorded_total*b.discount_rate/100,2) ELSE NULL END AS discount_amount,
 CASE WHEN cr.discount_unit='PERCENT' THEN k.recorded_total-ROUND(k.recorded_total*b.discount_rate/100,2) ELSE NULL END AS winner_amount,
 (SELECT COALESCE(SUM(s.amount),0) FROM DiscountShare s WHERE s.payout_cycle_id=p.cycle_id) AS distributed_amount
FROM Payout p JOIN Cycle c ON c.cycle_id=p.cycle_id
JOIN Circle cr ON cr.circle_id=c.circle_id JOIN v_CyclePot k ON k.cycle_id=p.cycle_id
LEFT JOIN Bid b ON b.cycle_id=p.cycle_id AND b.member_id=p.member_id;

