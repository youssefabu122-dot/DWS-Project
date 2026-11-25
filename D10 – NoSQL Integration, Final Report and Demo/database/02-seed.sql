-- Seed file for inserting sample data

-- Insert one circle
-- Ten members, so the organizer set ten cycles (one payout per member).
INSERT INTO Circle (name, contribution_amount, start_date, total_cycles)
VALUES ('Savings Circle', 1000.00, '2026-01-01', 10);

-- Ten members plus one organizer account (member 11, not part of any circle).
-- D9: only bcrypt hashes are stored (cost 12, unique salt per account).
-- Demo password for every seed account: RoscaDemo#2026 (local testing only).
INSERT INTO Member (name, email, password_hash, role) VALUES
('Ahmed Ali', 'ahmed@example.com', '$2b$12$yV/uUlAHDlyY7VP0coJTGeAe3lZ3J/jDq6FDVcXT6gEIkLyJW6NI6', 'member'),
('Mohamed Hassan', 'mohamed@example.com', '$2b$12$lmF.wux02B0sVYfIws.ereT4EYXls0mNU1s55M5wP.Amff6Jw3ani', 'member'),
('Omar Khaled', 'omar@example.com', '$2b$12$pnwh4I0chn5y8WAjlhsV2.gwVt25IqogoabvGDYNwmeMZf6EX72Ty', 'member'),
('Youssef Adel', 'youssef@example.com', '$2b$12$taLCCsnDUV7Zsm3y4e/fZ..L7Ccf0AKPT.O8o5tz5eArKFYQCA3Z.', 'member'),
('Ali Samir', 'ali@example.com', '$2b$12$UrQdLAxGAj9D8JuLj4/SUOzG1hWR0okuDYnaSfKZmEluxE6xwHNuW', 'member'),
('Mahmoud Tarek', 'mahmoud@example.com', '$2b$12$OPEPA5PJgd96zQU.3ZtcROf.UiHweop2hwxb6g4uX5F5kgCJcRNc.', 'member'),
('Hassan Ibrahim', 'hassan@example.com', '$2b$12$gg.vggUvSnQViONSg6zPN.qsy2tNkY1OV1yPm5v1iAEVAfnpV76za', 'member'),
('Karim Mostafa', 'karim@example.com', '$2b$12$m6dfgqTifmwAKkrzA7T7PutOoBdcaEkEIWzbqlOl8hPPBEKNH4g1a', 'member'),
('Amr Nabil', 'amr@example.com', '$2b$12$5A0CPbzf05/HtyVFU13JI.7nGmnQCXd6xiTtOy.ocFysMBVwzbTDK', 'member'),
('Abdo Ahmed', 'Abdo@example.com', '$2b$12$pI8T.CeMWpEYiHM5NK6a5.cTQYO6BsyjWECDfArmLjGQpQBg29EWq', 'member'),
('Circle Organizer', 'organizer@example.com', '$2b$12$u1WzdRK0tgMRb4L883arb.UVYbJiJ6DGyqUpzM3znSKCJ06vGtu9O', 'organizer');

-- Add all members to the circle
INSERT INTO Membership (member_id, circle_id, joined_on) VALUES
(1, 1, '2026-01-01'),
(2, 1, '2026-01-01'),
(3, 1, '2026-01-01'),
(4, 1, '2026-01-01'),
(5, 1, '2026-01-01'),
(6, 1, '2026-01-01'),
(7, 1, '2026-01-01'),
(8, 1, '2026-01-01'),
(9, 1, '2026-01-01'),
(10, 1, '2026-01-01');

-- Six cycles (Track B rules: highest discount > 0% wins; ties go to the
-- earliest submitted bid; members who were already paid cannot bid again).
-- 1-3 closed with payouts, 4 expired with no bids, 5 created by the
-- organizer after the expiry and open for bidding, 6 created in advance and pending.
-- Cycle 4 does not count toward the 10 required cycles, so the organizer
-- will create five more (seq 7-11) to complete the circle.
INSERT INTO Cycle (circle_id, seq_no, status, bid_closes_at) VALUES
(1, 1, 'closed',  '2026-01-31 12:00:00'),
(1, 2, 'closed',  '2026-02-28 12:00:00'),
(1, 3, 'closed',  '2026-03-31 12:00:00'),
(1, 4, 'expired', '2026-04-30 12:00:00'),
(1, 5, 'open',    NULL),  -- deadline is set when the backend starts
(1, 6, 'pending', NULL);

-- Contributions: cycles 1-3 fully funded by all ten members.
INSERT INTO Contribution (member_id, cycle_id) VALUES
(1,1),(2,1),(3,1),(4,1),(5,1),(6,1),(7,1),(8,1),(9,1),(10,1),
(1,2),(2,2),(3,2),(4,2),(5,2),(6,2),(7,2),(8,2),(9,2),(10,2),
(1,3),(2,3),(3,3),(4,3),(5,3),(6,3),(7,3),(8,3),(9,3),(10,3);

-- Cycle 4 expired, so its contributions were carried over to cycle 5.
-- Members 9 and 10 have not paid yet.
INSERT INTO Contribution (member_id, cycle_id) VALUES
(1,5),(2,5),(3,5),(4,5),(5,5),(6,5),(7,5),(8,5);

-- Cycle 1: Mohamed Hassan (member 2) wins with 10%.
INSERT INTO Bid (member_id, cycle_id, discount_rate) VALUES
(1, 1, 5.00),
(2, 1, 10.00),
(3, 1, 7.00),
(4, 1, 3.00),
(5, 1, 2.00);

-- Cycle 2: members 4 and 5 tie at 9%; member 4 bid first and wins.
INSERT INTO Bid (member_id, cycle_id, discount_rate) VALUES
(3, 2, 6.00),
(4, 2, 9.00),
(5, 2, 9.00),
(6, 2, 3.00);

-- Cycle 3: Ali Samir (member 5) wins with 8%.
INSERT INTO Bid (member_id, cycle_id, discount_rate) VALUES
(5, 3, 8.00),
(6, 3, 5.00),
(7, 3, 2.00),
(3, 3, 4.00);

-- Cycle 4: no bids before the deadline -> expired, no payout.

-- Cycle 5 (open): eligible members are 1, 3, 6, 7, 8, 9, 10.
-- Members 7 and 8 tie at 6%; member 7 bid first and currently leads.
INSERT INTO Bid (member_id, cycle_id, discount_rate) VALUES
(7, 5, 6.00),
(1, 5, 4.50),
(8, 5, 6.00);

-- Payouts for the closed cycles.
INSERT INTO Payout (cycle_id, member_id, paid_at) VALUES
(1, 2, '2026-01-31 12:05:00'),
(2, 4, '2026-02-28 12:05:00'),
(3, 5, '2026-03-31 12:05:00');

-- Discount shares: pot 10,000.00; the discount is split equally among the
-- other nine members, with leftover cents going to the lowest member IDs.
-- Cycle 1: 10% = 1,000.00
INSERT INTO DiscountShare (payout_cycle_id, member_id, amount) VALUES
(1, 1, 111.12),
(1, 3, 111.11),
(1, 4, 111.11),
(1, 5, 111.11),
(1, 6, 111.11),
(1, 7, 111.11),
(1, 8, 111.11),
(1, 9, 111.11),
(1, 10, 111.11);

-- Cycle 2: 9% = 900.00
INSERT INTO DiscountShare (payout_cycle_id, member_id, amount) VALUES
(2, 1, 100.00),
(2, 2, 100.00),
(2, 3, 100.00),
(2, 5, 100.00),
(2, 6, 100.00),
(2, 7, 100.00),
(2, 8, 100.00),
(2, 9, 100.00),
(2, 10, 100.00);

-- Cycle 3: 8% = 800.00
INSERT INTO DiscountShare (payout_cycle_id, member_id, amount) VALUES
(3, 1, 88.89),
(3, 2, 88.89),
(3, 3, 88.89),
(3, 4, 88.89),
(3, 6, 88.89),
(3, 7, 88.89),
(3, 8, 88.89),
(3, 9, 88.89),
(3, 10, 88.88);
