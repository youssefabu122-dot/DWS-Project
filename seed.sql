-- Seed file for inserting sample data

-- Insert one circle
INSERT INTO Circle (name, contribution_amount, start_date)
VALUES ('Savings Circle', 1000.00, '2026-01-01');


-- Insert ten members
INSERT INTO Member (name, email) VALUES
('Ahmed Ali', 'ahmed@example.com'),
('Mohamed Hassan', 'mohamed@example.com'),
('Omar Khaled', 'omar@example.com'),
('Youssef Adel', 'youssef@example.com'),
('Ali Samir', 'ali@example.com'),
('Mahmoud Tarek', 'mahmoud@example.com'),
('Hassan Ibrahim', 'hassan@example.com'),
('Karim Mostafa', 'karim@example.com'),
('Amr Nabil', 'amr@example.com'),
('Abdo Ahmed', 'Abdo@example.com');


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


--  six cycles
INSERT INTO Cycle (circle_id, seq_no, status) VALUES
(1, 1, 'closed'),
(1, 2, 'closed'),
(1, 3, 'closed'),
(1, 4, 'closed'),
(1, 5, 'closed'),
(1, 6, 'open');


-- Insert contributions for Cycle 1
INSERT INTO Contribution (member_id, cycle_id) VALUES
(1,1),(2,1),(3,1),(4,1),(5,1),
(6,1),(7,1),(8,1),(9,1),(10,1);

-- Insert contributions for Cycle 2
INSERT INTO Contribution (member_id, cycle_id) VALUES
(1,2),(2,2),(3,2),(4,2),(5,2),
(6,2),(7,2),(8,2),(9,2),(10,2);

-- Insert contributions for Cycle 3
INSERT INTO Contribution (member_id, cycle_id) VALUES
(1,3),(2,3),(3,3),(4,3),(5,3),
(6,3),(7,3),(8,3),(9,3),(10,3);

-- Insert contributions for Cycle 4
INSERT INTO Contribution (member_id, cycle_id) VALUES
(1,4),(2,4),(3,4),(4,4),(5,4),
(6,4),(7,4),(8,4),(9,4),(10,4);

-- Insert contributions for Cycle 5
INSERT INTO Contribution (member_id, cycle_id) VALUES
(1,5),(2,5),(3,5),(4,5),(5,5),
(6,5),(7,5),(8,5),(9,5),(10,5);

-- Insert contributions for Cycle 6
INSERT INTO Contribution (member_id, cycle_id) VALUES
(1,6),(2,6),(3,6),(4,6),(5,6),
(6,6),(7,6),(8,6),(9,6),(10,6);


-- Insert bids for Cycle 1
INSERT INTO Bid (member_id, cycle_id, discount_rate) VALUES
(1, 1, 5.00),
(2, 1, 10.00),
(3, 1, 7.00),
(4, 1, 3.00),
(5, 1, 2.00);

-- Insert bids for Cycle 2
INSERT INTO Bid (member_id, cycle_id, discount_rate) VALUES
(2, 2, 4.00),
(3, 2, 6.00),
(4, 2, 9.00),
(5, 2, 5.00),
(6, 2, 3.00);

-- Insert bids for Cycle 3
INSERT INTO Bid (member_id, cycle_id, discount_rate) VALUES
(3, 3, 4.00),
(4, 3, 6.00),
(5, 3, 8.00),
(6, 3, 5.00),
(7, 3, 2.00);

-- Insert bids for Cycle 4
INSERT INTO Bid (member_id, cycle_id, discount_rate) VALUES
(4, 4, 3.00),
(5, 4, 5.00),
(6, 4, 7.00),
(7, 4, 9.00),
(8, 4, 4.00);

-- Insert bids for Cycle 5
INSERT INTO Bid (member_id, cycle_id, discount_rate) VALUES
(5, 5, 2.00),
(6, 5, 4.00),
(7, 5, 6.00),
(8, 5, 8.00),
(9, 5, 10.00);


-- Insert one payout for each closed cycle
INSERT INTO Payout (cycle_id, member_id, paid_at) VALUES
(1, 2, '2026-01-31 12:00:00'),
(2, 4, '2026-02-28 12:00:00'),
(3, 5, '2026-03-31 12:00:00'),
(4, 7, '2026-04-30 12:00:00'),
(5, 9, '2026-05-31 12:00:00');


-- Insert discount shares for Cycle 1 payout
INSERT INTO DiscountShare (payout_cycle_id, member_id, amount) VALUES
(1, 1, 111.11),
(1, 3, 111.11),
(1, 4, 111.11),
(1, 5, 111.11),
(1, 6, 111.11),
(1, 7, 111.11),
(1, 8, 111.11),
(1, 9, 111.11),
(1, 10, 111.12);


-- Insert discount shares for Cycle 2 payout
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


-- Insert discount shares for Cycle 3 payout
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


-- Insert discount shares for Cycle 4 payout
INSERT INTO DiscountShare (payout_cycle_id, member_id, amount) VALUES
(4, 1, 100.00),
(4, 2, 100.00),
(4, 3, 100.00),
(4, 4, 100.00),
(4, 5, 100.00),
(4, 6, 100.00),
(4, 8, 100.00),
(4, 9, 100.00),
(4, 10, 100.00);


-- Insert discount shares for Cycle 5 payout
INSERT INTO DiscountShare (payout_cycle_id, member_id, amount) VALUES
(5, 1, 111.11),
(5, 2, 111.11),
(5, 3, 111.11),
(5, 4, 111.11),
(5, 5, 111.11),
(5, 6, 111.11),
(5, 7, 111.11),
(5, 8, 111.11),
(5, 10, 111.12);