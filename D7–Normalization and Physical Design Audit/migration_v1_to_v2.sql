
DELIMITER $$
CREATE PROCEDURE d7_migrate_v1_to_v2()
BEGIN
 DECLARE n INT;
 DECLARE shape TEXT;
 DECLARE v_before_count BIGINT;
 DECLARE v_after_count BIGINT;
 DECLARE v_changed_count BIGINT;
 IF DATABASE() IS NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Select the v1 database first'; END IF;
 SELECT COUNT(*) INTO n FROM information_schema.tables
 WHERE table_schema=DATABASE() AND table_type='BASE TABLE' AND engine='InnoDB'
 AND table_name IN ('Member','Circle','Membership','Cycle','Contribution','Bid','Payout','DiscountShare');
 IF n<>8 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Expected eight v1 InnoDB tables'; END IF;
 SELECT COUNT(*) INTO n FROM information_schema.columns WHERE table_schema=DATABASE() AND
 ((table_name='Circle' AND column_name IN ('interval_value','interval_unit','discount_unit','discount_share_rule'))
 OR (table_name='Cycle' AND column_name='bidding_closes_at')
 OR (table_name='Contribution' AND column_name='payment_status')
 OR (table_name='Bid' AND column_name='submitted_at'));
 IF n<>0 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Not pristine v1: a full/partial migration already exists'; END IF;
 SELECT COUNT(*) INTO n FROM information_schema.tables WHERE table_schema=DATABASE()
 AND table_name IN ('v_CycleSchedule','v_ContributionLedger','v_CycleObligations','v_CyclePot','v_LegacyBidReview','v_PayoutAmounts');
 IF n<>0 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='A target view name is already in use'; END IF;
 CREATE TEMPORARY TABLE d7_before_Member AS SELECT * FROM `Member`;
 CREATE TEMPORARY TABLE d7_before_Circle AS SELECT * FROM `Circle`;
 CREATE TEMPORARY TABLE d7_before_Membership AS SELECT * FROM `Membership`;
 CREATE TEMPORARY TABLE d7_before_Cycle AS SELECT * FROM `Cycle`;
 CREATE TEMPORARY TABLE d7_before_Contribution AS SELECT * FROM `Contribution`;
 CREATE TEMPORARY TABLE d7_before_Bid AS SELECT * FROM `Bid`;
 CREATE TEMPORARY TABLE d7_before_Payout AS SELECT * FROM `Payout`;
 CREATE TEMPORARY TABLE d7_before_DiscountShare AS SELECT * FROM `DiscountShare`;
 SELECT COUNT(*),GROUP_CONCAT(CONCAT(column_name,':',COALESCE(sub_part,0),':',COALESCE(collation,'')) ORDER BY seq_in_index SEPARATOR ',') INTO n,shape
 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='Bid' AND index_name='idx_bid_cycle_discount_member';
 IF n<>0 AND (n<>3 OR shape<>'cycle_id:0:A,discount_rate:0:A,member_id:0:A') THEN
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Conflicting proposed index name'; END IF;
 ALTER TABLE `Circle` ADD COLUMN interval_value INT NULL,
   ADD COLUMN interval_unit VARCHAR(5) NULL,
   ADD COLUMN discount_unit VARCHAR(7) NULL,
   ADD COLUMN discount_share_rule VARCHAR(100) NULL,
   ADD CONSTRAINT ck_circle_interval CHECK ((interval_value IS NULL AND interval_unit IS NULL) OR (interval_value IS NOT NULL AND interval_unit IS NOT NULL AND interval_value>0 AND interval_unit IN ('DAY','MONTH'))),
   ADD CONSTRAINT ck_circle_discount_unit CHECK (discount_unit IS NULL OR discount_unit='PERCENT');
 ALTER TABLE `Cycle` ADD COLUMN bidding_closes_at DATETIME NULL;
 ALTER TABLE `Contribution` ADD COLUMN payment_status VARCHAR(7) NOT NULL DEFAULT 'unknown',
   ADD CONSTRAINT ck_contribution_payment CHECK (payment_status IN ('unknown','unpaid','paid'));
 ALTER TABLE `Bid` ADD COLUMN submitted_at DATETIME NULL;
 IF n=0 THEN CREATE INDEX idx_bid_cycle_discount_member ON Bid(cycle_id,discount_rate,member_id); END IF;
 -- Separate statements: MySQL cannot reopen a TEMPORARY table twice in one query.
 SELECT COUNT(*) INTO v_before_count FROM d7_before_Member;
 SELECT COUNT(*) INTO v_after_count FROM `Member`;
 IF v_before_count<>v_after_count THEN
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Original row count verification failed: Member'; END IF;
 SELECT COUNT(*) INTO v_changed_count
 FROM d7_before_Member a LEFT JOIN `Member` b ON a.`member_id`<=>b.`member_id`
 WHERE b.`member_id` IS NULL OR NOT(CAST(a.`member_id` AS BINARY)<=>CAST(b.`member_id` AS BINARY) AND CAST(a.`name` AS BINARY)<=>CAST(b.`name` AS BINARY) AND CAST(a.`email` AS BINARY)<=>CAST(b.`email` AS BINARY));
 IF v_changed_count<>0 THEN
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Original row verification failed: Member'; END IF;
 -- Separate statements: MySQL cannot reopen a TEMPORARY table twice in one query.
 SELECT COUNT(*) INTO v_before_count FROM d7_before_Circle;
 SELECT COUNT(*) INTO v_after_count FROM `Circle`;
 IF v_before_count<>v_after_count THEN
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Original row count verification failed: Circle'; END IF;
 SELECT COUNT(*) INTO v_changed_count
 FROM d7_before_Circle a LEFT JOIN `Circle` b ON a.`circle_id`<=>b.`circle_id`
 WHERE b.`circle_id` IS NULL OR NOT(CAST(a.`circle_id` AS BINARY)<=>CAST(b.`circle_id` AS BINARY) AND CAST(a.`name` AS BINARY)<=>CAST(b.`name` AS BINARY) AND CAST(a.`contribution_amount` AS BINARY)<=>CAST(b.`contribution_amount` AS BINARY) AND CAST(a.`start_date` AS BINARY)<=>CAST(b.`start_date` AS BINARY));
 IF v_changed_count<>0 THEN
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Original row verification failed: Circle'; END IF;
 -- Separate statements: MySQL cannot reopen a TEMPORARY table twice in one query.
 SELECT COUNT(*) INTO v_before_count FROM d7_before_Membership;
 SELECT COUNT(*) INTO v_after_count FROM `Membership`;
 IF v_before_count<>v_after_count THEN
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Original row count verification failed: Membership'; END IF;
 SELECT COUNT(*) INTO v_changed_count
 FROM d7_before_Membership a LEFT JOIN `Membership` b ON a.`member_id`<=>b.`member_id` AND a.`circle_id`<=>b.`circle_id`
 WHERE b.`member_id` IS NULL OR NOT(CAST(a.`member_id` AS BINARY)<=>CAST(b.`member_id` AS BINARY) AND CAST(a.`circle_id` AS BINARY)<=>CAST(b.`circle_id` AS BINARY) AND CAST(a.`joined_on` AS BINARY)<=>CAST(b.`joined_on` AS BINARY));
 IF v_changed_count<>0 THEN
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Original row verification failed: Membership'; END IF;
 -- Separate statements: MySQL cannot reopen a TEMPORARY table twice in one query.
 SELECT COUNT(*) INTO v_before_count FROM d7_before_Cycle;
 SELECT COUNT(*) INTO v_after_count FROM `Cycle`;
 IF v_before_count<>v_after_count THEN
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Original row count verification failed: Cycle'; END IF;
 SELECT COUNT(*) INTO v_changed_count
 FROM d7_before_Cycle a LEFT JOIN `Cycle` b ON a.`cycle_id`<=>b.`cycle_id`
 WHERE b.`cycle_id` IS NULL OR NOT(CAST(a.`cycle_id` AS BINARY)<=>CAST(b.`cycle_id` AS BINARY) AND CAST(a.`circle_id` AS BINARY)<=>CAST(b.`circle_id` AS BINARY) AND CAST(a.`seq_no` AS BINARY)<=>CAST(b.`seq_no` AS BINARY) AND CAST(a.`status` AS BINARY)<=>CAST(b.`status` AS BINARY));
 IF v_changed_count<>0 THEN
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Original row verification failed: Cycle'; END IF;
 -- Separate statements: MySQL cannot reopen a TEMPORARY table twice in one query.
 SELECT COUNT(*) INTO v_before_count FROM d7_before_Contribution;
 SELECT COUNT(*) INTO v_after_count FROM `Contribution`;
 IF v_before_count<>v_after_count THEN
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Original row count verification failed: Contribution'; END IF;
 SELECT COUNT(*) INTO v_changed_count
 FROM d7_before_Contribution a LEFT JOIN `Contribution` b ON a.`contribution_id`<=>b.`contribution_id`
 WHERE b.`contribution_id` IS NULL OR NOT(CAST(a.`contribution_id` AS BINARY)<=>CAST(b.`contribution_id` AS BINARY) AND CAST(a.`member_id` AS BINARY)<=>CAST(b.`member_id` AS BINARY) AND CAST(a.`cycle_id` AS BINARY)<=>CAST(b.`cycle_id` AS BINARY));
 IF v_changed_count<>0 THEN
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Original row verification failed: Contribution'; END IF;
 -- Separate statements: MySQL cannot reopen a TEMPORARY table twice in one query.
 SELECT COUNT(*) INTO v_before_count FROM d7_before_Bid;
 SELECT COUNT(*) INTO v_after_count FROM `Bid`;
 IF v_before_count<>v_after_count THEN
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Original row count verification failed: Bid'; END IF;
 SELECT COUNT(*) INTO v_changed_count
 FROM d7_before_Bid a LEFT JOIN `Bid` b ON a.`bid_id`<=>b.`bid_id`
 WHERE b.`bid_id` IS NULL OR NOT(CAST(a.`bid_id` AS BINARY)<=>CAST(b.`bid_id` AS BINARY) AND CAST(a.`member_id` AS BINARY)<=>CAST(b.`member_id` AS BINARY) AND CAST(a.`cycle_id` AS BINARY)<=>CAST(b.`cycle_id` AS BINARY) AND CAST(a.`discount_rate` AS BINARY)<=>CAST(b.`discount_rate` AS BINARY));
 IF v_changed_count<>0 THEN
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Original row verification failed: Bid'; END IF;
 -- Separate statements: MySQL cannot reopen a TEMPORARY table twice in one query.
 SELECT COUNT(*) INTO v_before_count FROM d7_before_Payout;
 SELECT COUNT(*) INTO v_after_count FROM `Payout`;
 IF v_before_count<>v_after_count THEN
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Original row count verification failed: Payout'; END IF;
 SELECT COUNT(*) INTO v_changed_count
 FROM d7_before_Payout a LEFT JOIN `Payout` b ON a.`cycle_id`<=>b.`cycle_id`
 WHERE b.`cycle_id` IS NULL OR NOT(CAST(a.`cycle_id` AS BINARY)<=>CAST(b.`cycle_id` AS BINARY) AND CAST(a.`member_id` AS BINARY)<=>CAST(b.`member_id` AS BINARY) AND CAST(a.`paid_at` AS BINARY)<=>CAST(b.`paid_at` AS BINARY));
 IF v_changed_count<>0 THEN
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Original row verification failed: Payout'; END IF;
 -- Separate statements: MySQL cannot reopen a TEMPORARY table twice in one query.
 SELECT COUNT(*) INTO v_before_count FROM d7_before_DiscountShare;
 SELECT COUNT(*) INTO v_after_count FROM `DiscountShare`;
 IF v_before_count<>v_after_count THEN
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Original row count verification failed: DiscountShare'; END IF;
 SELECT COUNT(*) INTO v_changed_count
 FROM d7_before_DiscountShare a LEFT JOIN `DiscountShare` b ON a.`share_id`<=>b.`share_id`
 WHERE b.`share_id` IS NULL OR NOT(CAST(a.`share_id` AS BINARY)<=>CAST(b.`share_id` AS BINARY) AND CAST(a.`payout_cycle_id` AS BINARY)<=>CAST(b.`payout_cycle_id` AS BINARY) AND CAST(a.`member_id` AS BINARY)<=>CAST(b.`member_id` AS BINARY) AND CAST(a.`amount` AS BINARY)<=>CAST(b.`amount` AS BINARY));
 IF v_changed_count<>0 THEN
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Original row verification failed: DiscountShare'; END IF;
 DROP TEMPORARY TABLE d7_before_Member;
 DROP TEMPORARY TABLE d7_before_Circle;
 DROP TEMPORARY TABLE d7_before_Membership;
 DROP TEMPORARY TABLE d7_before_Cycle;
 DROP TEMPORARY TABLE d7_before_Contribution;
 DROP TEMPORARY TABLE d7_before_Bid;
 DROP TEMPORARY TABLE d7_before_Payout;
 DROP TEMPORARY TABLE d7_before_DiscountShare;
 SELECT 'All original columns, rows and IDs preserved in eight tables' AS verification;
END$$
DELIMITER ;
CALL d7_migrate_v1_to_v2();
DROP PROCEDURE d7_migrate_v1_to_v2;

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


-- Legacy review: six previous-winner bids for the supplied seed; all are retained.
SELECT * FROM v_LegacyBidReview ORDER BY cycle_id,member_id;
-- Required configuration remains unresolved until supplied from project records.
SELECT circle_id,interval_value,interval_unit,discount_unit,discount_share_rule FROM Circle;
SELECT cycle_id,bidding_closes_at FROM Cycle WHERE status<>'closed';
SELECT payment_status,COUNT(*) AS records FROM Contribution GROUP BY payment_status;
