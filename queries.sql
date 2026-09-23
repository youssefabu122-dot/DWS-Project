-- Query 1: Who received the payout in each completed cycle?
SELECT
    c.seq_no,
    m.name AS payout_recipient,
    p.paid_at
FROM Cycle c
JOIN Payout p
    ON c.cycle_id = p.cycle_id
JOIN Member m
    ON p.member_id = m.member_id
ORDER BY c.seq_no;


-- Query 2: How many members contributed in each cycle?
SELECT
    c.seq_no,
    COUNT(co.contribution_id) AS number_of_contributors
FROM Cycle c
LEFT JOIN Contribution co
    ON c.cycle_id = co.cycle_id
GROUP BY c.cycle_id, c.seq_no
ORDER BY c.seq_no;


-- Query 3: What is the total pot collected in each cycle?
SELECT
    c.seq_no,
    COUNT(co.contribution_id) * ci.contribution_amount AS total_pot
FROM Cycle c
JOIN Circle ci
    ON c.circle_id = ci.circle_id
JOIN Contribution co
    ON c.cycle_id = co.cycle_id
GROUP BY c.cycle_id, c.seq_no, ci.contribution_amount
ORDER BY c.seq_no;


-- Query 4: Which members have never received a payout?
SELECT
    m.member_id,
    m.name
FROM Member m
WHERE m.member_id NOT IN (
    SELECT p.member_id
    FROM Payout p
)
ORDER BY m.member_id;


-- Query 5: Which member submitted the highest bid in each cycle that has bids?
SELECT
    c.seq_no,
    m.name,
    b.discount_rate
FROM Bid b
JOIN Member m
    ON b.member_id = m.member_id
JOIN Cycle c
    ON b.cycle_id = c.cycle_id
WHERE b.discount_rate = (
    SELECT MAX(b2.discount_rate)
    FROM Bid b2
    WHERE b2.cycle_id = b.cycle_id
)
ORDER BY c.seq_no;


-- Query 6: How much discount share has each member received in total?
SELECT
    m.member_id,
    m.name,
    SUM(ds.amount) AS total_discount_share
FROM Member m
JOIN DiscountShare ds
    ON m.member_id = ds.member_id
GROUP BY m.member_id, m.name
ORDER BY m.member_id;