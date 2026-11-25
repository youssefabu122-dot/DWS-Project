const {ApiError} = require('../middleware/errors');
const deadline = require('./bid-deadline.repository');
const outbox = require('./outbox');

// Every mutation affecting bidding locks Circle then Cycle in this order.
async function lock(db, id) {
  const [rows] = await db.execute('SELECT circle_id FROM Cycle WHERE cycle_id = ?', [id]);
  if (!rows.length) throw new ApiError(404,'Cycle not found');

  const [circles] = await db.execute('SELECT circle_id FROM Circle WHERE circle_id = ? FOR UPDATE',[rows[0].circle_id]);
  if (!circles.length) throw new ApiError(404,'Circle not found');

  const [cycles] = await db.execute('SELECT cycle_id, circle_id, seq_no, status, bid_closes_at, bidding_round FROM Cycle WHERE cycle_id = ? FOR UPDATE',[id]);
  if (!cycles.length) throw new ApiError(404,'Cycle not found');
  const cycle = cycles[0];
  const timing = await deadline.ensure(db, cycle);
  return {...cycle, bid_closes_at: timing.closes_at,
    server_now: timing.server_now, bidding_expired: timing.expired};
}

async function membership(db, cycle, memberId) {
  const [members] = await db.execute('SELECT member_id FROM Member WHERE member_id = ?', [memberId]);
  if (!members.length) throw new ApiError(404,'Member not found');

  const [rows] = await db.execute('SELECT member_id FROM Membership WHERE circle_id = ? AND member_id = ?', [cycle.circle_id, memberId]);
  if (!rows.length) throw new ApiError(409,'Member does not belong to this circle');
}

// Open the earliest pending cycle or create the next one (expired cycles do not count toward
// total_cycles). Contributions left on expired cycles move to it, so nobody pays twice.
async function open(db, circleId) {
  const [circles] = await db.execute('SELECT circle_id, total_cycles FROM Circle WHERE circle_id = ? FOR UPDATE', [circleId]);
  if (!circles.length) throw new ApiError(404,'Circle not found');

  const [current] = await db.execute('SELECT cycle_id FROM Cycle WHERE circle_id = ? AND status = ? LIMIT 1', [circleId, 'open']);
  if (current.length) throw new ApiError(409,'This circle already has an open cycle');
  const [waiting] = await db.execute('SELECT cycle_id FROM Cycle WHERE circle_id = ? AND status = ? LIMIT 1', [circleId, 'awaiting_decision']);
  if (waiting.length) throw new ApiError(409,'A cycle is awaiting the organizer decision; choose reopen, new_cycle or random_winner for it');

  const [pending] = await db.execute(
    'SELECT cycle_id FROM Cycle WHERE circle_id = ? AND status = ? ORDER BY seq_no LIMIT 1 FOR UPDATE', [circleId, 'pending']);
  let cycleId;
  if (pending.length) {
    cycleId = pending[0].cycle_id;
    await db.execute('UPDATE Cycle SET status = ? WHERE cycle_id = ?', ['open', cycleId]);
  } else {
    const [[{used}]] = await db.execute(
      `SELECT COUNT(*) AS used FROM Cycle WHERE circle_id = ? AND status <> 'expired'`, [circleId]);
    if (Number(used) >= circles[0].total_cycles) throw new ApiError(409,'This circle already has all of its cycles');
    const [created] = await db.execute(
      `INSERT INTO Cycle (circle_id, seq_no, status)
       SELECT ?, COALESCE(MAX(seq_no), 0) + 1, 'open' FROM Cycle WHERE circle_id = ?`, [circleId, circleId]);
    cycleId = created.insertId;
  }

  // IGNORE skips a member who already has a contribution in the new cycle.
  const [moved] = await db.execute(
    `UPDATE IGNORE Contribution co JOIN Cycle c ON c.cycle_id = co.cycle_id
     SET co.cycle_id = ? WHERE c.circle_id = ? AND c.status = 'expired'`, [cycleId, circleId]);

  const cycle = await lock(db, cycleId); // also sets the bidding deadline
  await outbox.add(db, {type: 'cycle.opened', circle_id: circleId, cycle_id: cycle.cycle_id, actor: {role: 'organizer'},
    data: {seq_no: cycle.seq_no, bid_closes_at: cycle.bid_closes_at,
      ...(moved.affectedRows ? {carried_over_contributions: moved.affectedRows} : {})}});
  return {cycle_id: cycle.cycle_id, circle_id: cycle.circle_id, seq_no: cycle.seq_no,
    status: cycle.status, bid_closes_at: cycle.bid_closes_at};
}

module.exports = {lock, membership, open};
