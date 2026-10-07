const {ApiError} = require('../middleware/errors');
// Every mutation affecting bidding locks Circle then Cycle in this order.
async function lock(db, id) {
  const [rows] = await db.execute('SELECT circle_id FROM Cycle WHERE cycle_id = ?', [id]);
  if (!rows.length) throw new ApiError(404,'Cycle not found');

  const [circles] = await db.execute('SELECT circle_id FROM Circle WHERE circle_id = ? FOR UPDATE',[rows[0].circle_id]);
  if (!circles.length) throw new ApiError(404,'Circle not found');

  const [cycles] = await db.execute('SELECT cycle_id, circle_id, seq_no, status FROM Cycle WHERE cycle_id = ? FOR UPDATE',[id]);
  if (!cycles.length) throw new ApiError(404,'Cycle not found');
  return cycles[0];
}
async function membership(db, cycle, memberId) {

  const [members] = await db.execute('SELECT member_id FROM Member WHERE member_id = ?', [memberId]);
  if (!members.length) throw new ApiError(404,'Member not found');

  const [rows] = await db.execute('SELECT member_id FROM Membership WHERE circle_id = ? AND member_id = ?', [cycle.circle_id, memberId]);
  if (!rows.length) throw new ApiError(409,'Member does not belong to this circle');
}

module.exports = {lock, membership};
