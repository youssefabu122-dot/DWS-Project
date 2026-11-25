-- At most one payout per member per circle, enforced in the database as well as the API.
-- The triggers only check new or changed rows and are recreated on every run.
DROP TRIGGER IF EXISTS trg_payout_once_insert;
DROP TRIGGER IF EXISTS trg_payout_once_update;

DELIMITER //
CREATE TRIGGER trg_payout_once_insert BEFORE INSERT ON Payout FOR EACH ROW
BEGIN
  IF EXISTS (SELECT 1 FROM Payout p JOIN Cycle c ON c.cycle_id = p.cycle_id
             WHERE p.member_id = NEW.member_id
               AND c.circle_id = (SELECT circle_id FROM Cycle WHERE cycle_id = NEW.cycle_id)) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Member already received a payout in this circle';
  END IF;
END//
CREATE TRIGGER trg_payout_once_update BEFORE UPDATE ON Payout FOR EACH ROW
BEGIN
  IF NEW.member_id <> OLD.member_id AND EXISTS (
       SELECT 1 FROM Payout p JOIN Cycle c ON c.cycle_id = p.cycle_id
       WHERE p.member_id = NEW.member_id AND p.cycle_id <> OLD.cycle_id
         AND c.circle_id = (SELECT circle_id FROM Cycle WHERE cycle_id = NEW.cycle_id)) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Member already received a payout in this circle';
  END IF;
END//
DELIMITER ;
