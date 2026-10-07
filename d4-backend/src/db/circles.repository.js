const pool = require('./connection');
const repository = require('./crud.repository')('Circle', 'circle_id', ["name", "contribution_amount", "start_date"], true);


async function getMembersByCircle(circleId) {
  const [rows] = await pool.execute(
    `SELECT
       m.member_id,
       m.name,
       m.email,
       ms.joined_on
     FROM Member m
     JOIN Membership ms
       ON ms.member_id = m.member_id
     WHERE ms.circle_id = ?
     ORDER BY m.member_id`,
    [circleId]
  );

  return rows;
}

async function getCyclesByCircle(circleId) {
  const [rows] = await pool.execute(
    `SELECT
       cycle_id,
       seq_no,
       status
     FROM Cycle
     WHERE circle_id = ?
     ORDER BY seq_no`,
    [circleId]
  );

  return rows;
}


// Derived progress keeps the original Circle schema unchanged.
async function progress(id, db = pool) {
  const [rows] = await db.execute(`SELECT c.circle_id, c.name, c.contribution_amount, c.start_date,
    (SELECT COUNT(*) FROM Membership ms WHERE ms.circle_id = c.circle_id) AS member_count,
    (SELECT COUNT(*) FROM Membership ms WHERE ms.circle_id = c.circle_id AND EXISTS (
      SELECT 1 FROM Payout p JOIN Cycle cy ON cy.cycle_id = p.cycle_id
      WHERE cy.circle_id = c.circle_id AND p.member_id = ms.member_id
    )) AS paid_member_count
    FROM Circle c ${id === undefined ? '' : 'WHERE c.circle_id = ?'} ORDER BY c.circle_id`,
    id === undefined ? [] : [id]);
    
  return rows.map(row => {
    const memberCount = Number(row.member_count);
    const paidCount = Number(row.paid_member_count);
    return {...row, member_count: memberCount, paid_member_count: paidCount,
      remaining_member_count: memberCount - paidCount,
      status: memberCount === 0 ? 'pending' : paidCount === memberCount ? 'closed' : 'active'};
  });
}
module.exports = {...repository, getMembersByCircle, getCyclesByCircle, progress};
