-- Database-level 0-50% limit for bid rates, added only if missing and no existing row breaks
-- it, so historical bids are never changed and the migration cannot fail on old data.
SET @ok := (SELECT COUNT(*) = 0 FROM Bid WHERE discount_rate < 0 OR discount_rate > 50)
  AND (SELECT COUNT(*) = 0 FROM information_schema.TABLE_CONSTRAINTS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Bid' AND CONSTRAINT_NAME = 'chk_bid_rate_range');
SET @sql := IF(@ok, 'ALTER TABLE Bid ADD CONSTRAINT chk_bid_rate_range CHECK (discount_rate BETWEEN 0 AND 50)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ok := (SELECT COUNT(*) = 0 FROM BidHistory WHERE discount_rate < 0 OR discount_rate > 50)
  AND (SELECT COUNT(*) = 0 FROM information_schema.TABLE_CONSTRAINTS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'BidHistory' AND CONSTRAINT_NAME = 'chk_bidhistory_rate_range');
SET @sql := IF(@ok, 'ALTER TABLE BidHistory ADD CONSTRAINT chk_bidhistory_rate_range CHECK (discount_rate BETWEEN 0 AND 50)', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
