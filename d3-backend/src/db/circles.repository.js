const pool = require('./connection');

async function getMembersByCircle(circleId) {
  const [rows] = await pool.query(
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
  const [rows] = await pool.query(
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

module.exports = {
  getMembersByCircle,
  getCyclesByCircle
};