-- Transactional outbox for the MongoDB activity feed: written in the same transaction as the
-- financial change, then copied to MongoDB by the backend worker. Idempotent (runs on every
-- `docker compose up`) and never changes existing data.

CREATE TABLE IF NOT EXISTS ActivityOutbox (
    outbox_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    event_id VARCHAR(64) NOT NULL UNIQUE,
    event_type VARCHAR(50) NOT NULL,
    circle_id INT NOT NULL,
    cycle_id INT NULL,
    payload JSON NOT NULL,
    occurred_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    published_at DATETIME(3) NULL,
    attempts INT NOT NULL DEFAULT 0,
    next_attempt_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    last_error VARCHAR(200) NULL,
    INDEX idx_outbox_pending (published_at, next_attempt_at, outbox_id)
);

-- One-time backfill of pre-D10 history, only while the outbox is empty; fixed event IDs
-- and INSERT IGNORE make a repeated run harmless. Open-cycle bids use the migration time.
SET @fresh := (SELECT COUNT(*) = 0 FROM ActivityOutbox);

INSERT IGNORE INTO ActivityOutbox (event_id, event_type, circle_id, cycle_id, payload, occurred_at)
SELECT CONCAT('backfill-cycle-closed-', c.cycle_id), 'cycle.closed', c.circle_id, c.cycle_id,
  JSON_OBJECT(
    'actor', JSON_OBJECT('role', 'system'),
    'data', JSON_OBJECT(
      'seq_no', c.seq_no,
      'winner', JSON_OBJECT('member_id', p.member_id, 'name', m.name),
      'winning_discount_rate', COALESCE(
        (SELECT CAST(b.discount_rate AS CHAR) FROM Bid b WHERE b.cycle_id = c.cycle_id AND b.member_id = p.member_id), '0.00'),
      'pot_amount', CAST(ci.contribution_amount * (SELECT COUNT(*) FROM Membership ms WHERE ms.circle_id = c.circle_id) AS CHAR),
      'bid_count', (SELECT COUNT(*) FROM Bid b WHERE b.cycle_id = c.cycle_id),
      'discount_shares', COALESCE(
        (SELECT JSON_ARRAYAGG(JSON_OBJECT('member_id', d.member_id, 'amount', CAST(d.amount AS CHAR)))
         FROM DiscountShare d WHERE d.payout_cycle_id = c.cycle_id), JSON_ARRAY()),
      'backfilled', TRUE)),
  p.paid_at
FROM Payout p
JOIN Cycle c ON c.cycle_id = p.cycle_id
JOIN Circle ci ON ci.circle_id = c.circle_id
JOIN Member m ON m.member_id = p.member_id
WHERE @fresh
ORDER BY p.paid_at, c.cycle_id;

INSERT IGNORE INTO ActivityOutbox (event_id, event_type, circle_id, cycle_id, payload, occurred_at)
SELECT CONCAT('backfill-cycle-expired-', c.cycle_id), 'cycle.expired', c.circle_id, c.cycle_id,
  JSON_OBJECT('actor', JSON_OBJECT('role', 'system'),
    'data', JSON_OBJECT('seq_no', c.seq_no, 'reason', 'no_valid_bids_before_deadline', 'backfilled', TRUE)),
  COALESCE(c.bid_closes_at, UTC_TIMESTAMP(3))
FROM Cycle c
WHERE @fresh AND c.status = 'expired'
ORDER BY c.cycle_id;

INSERT IGNORE INTO ActivityOutbox (event_id, event_type, circle_id, cycle_id, payload, occurred_at)
SELECT CONCAT('backfill-bid-', b.bid_id), 'bid.placed', c.circle_id, c.cycle_id,
  JSON_OBJECT('actor', JSON_OBJECT('role', 'member', 'member_id', m.member_id, 'name', m.name),
    'data', JSON_OBJECT('seq_no', c.seq_no, 'discount_rate', CAST(b.discount_rate AS CHAR),
      'backfilled', TRUE, 'time_is_approximate', TRUE)),
  UTC_TIMESTAMP(3)
FROM Bid b
JOIN Cycle c ON c.cycle_id = b.cycle_id
JOIN Member m ON m.member_id = b.member_id
WHERE @fresh AND c.status = 'open'
ORDER BY b.bid_id;
