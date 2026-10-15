const {ApiError} = require('../middleware/errors');
const cycles = require('./cycles.repository');
const bids = require('./bids.repository');
const deadline = require('./bid-deadline.repository');

async function get(db, circleId, cycleId) {
  // Same Circle -> Cycle lock order as the existing financial writes.
  const [circles] = await db.execute(
    'SELECT circle_id FROM Circle WHERE circle_id = ? FOR UPDATE', [circleId]
  );
  if (!circles.length) throw new ApiError(404, 'Circle not found');

  const [allCycles] = await db.execute(
    'SELECT cycle_id, circle_id, seq_no, status FROM Cycle WHERE circle_id = ? ORDER BY seq_no',
    [circleId]
  );
  const selected = cycleId === undefined
    ? allCycles.find(cycle => cycle.status === 'open') || allCycles.at(-1)
    : allCycles.find(cycle => cycle.cycle_id === cycleId);
  if (cycleId !== undefined && !selected) {
    throw new ApiError(404, 'Cycle not found in this circle');
  }
  const [members] = await db.execute(
    `SELECT m.member_id, m.name FROM Member m
     JOIN Membership ms ON ms.member_id = m.member_id
     WHERE ms.circle_id = ? ORDER BY m.member_id`, [circleId]
  );
  if (!selected) {
    return {circle_id: circleId, cycle: null, state: 'no_cycle', recipient: null,
      payout: null, eligible_members: members, paid_member_ids: [], member_count: members.length,
      contribution_count: 0, eligible_bid_count: 0};
  }

  const cycle = await cycles.lock(db, selected.cycle_id);
  // Reuse the exact eligibility rule used by automatic settlement.
  const eligibleIds = new Set((await bids.eligible(db, cycle)).map(m => m.member_id));
  const eligible = members.filter(member => eligibleIds.has(member.member_id));
  const ranking = await bids.ranking(db, cycle.cycle_id);
  const [payments] = await db.execute(
    'SELECT member_id FROM Contribution WHERE cycle_id = ?', [cycle.cycle_id]
  );
  const paidIds = new Set(payments.map(payment => payment.member_id));
  const paid = members.filter(member => paidIds.has(member.member_id)).map(member => member.member_id);
  const [payouts] = await db.execute(
    `SELECT p.cycle_id, p.member_id, p.paid_at, m.name
     FROM Payout p JOIN Member m ON m.member_id = p.member_id
     WHERE p.cycle_id = ?`, [cycle.cycle_id]
  );
  const payout = payouts[0] || null;
  const timing = await deadline.clock(db, cycle.cycle_id);
  const leader = ranking.find(bid => eligibleIds.has(bid.member_id));
  let state;
  let recipient = null;

  if (payout) {
    state = 'confirmed';
    recipient = {member_id: payout.member_id, name: payout.name};
  } else if (cycle.status === 'expired' ||
    (cycle.status === 'open' && timing.expired && eligible.length > 1 && !leader)) {
    state = 'expired_no_bids';
  } else if (cycle.status !== 'open') {
    state = 'closed_without_payout';
  } else if (!members.length) {
    state = 'no_members';
  } else if (!eligible.length) {
    state = 'complete';
  } else if (eligible.length === 1) {
    state = 'final_member';
    recipient = eligible[0];
  } else if (leader) {
    state = timing.expired
      ? (paid.length < members.length ? 'awaiting_funding' : 'awaiting_settlement')
      : 'provisional';
    recipient = {member_id: leader.member_id, name: leader.name};
  } else {
    state = 'awaiting_bids';
  }

  return {circle_id: circleId, cycle, state, recipient, payout,
    closes_at: timing.closes_at, server_now: timing.server_now,
    bidding_open: cycle.status === 'open' && !timing.expired,
    bidding_status: cycle.status === 'open' && !timing.expired ? 'open' : 'closed',
    eligible_members: eligible, paid_member_ids: paid, member_count: members.length,
    contribution_count: paid.length,
    eligible_bid_count: eligible.filter(member => ranking.some(bid => bid.member_id === member.member_id)).length};
}

module.exports = {get};
