// Organizer bidding actions (extend, reopen, new_cycle, random_winner). Each runs in one
// transaction under the Circle -> Cycle locks, so it cannot overlap a bid, a contribution
// or the scanner, and the UNIQUE(cycle_id, round_no) decision row makes it execute once.
const {randomInt} = require('node:crypto');
const transaction = require('../db/transaction');
const cycles = require('../db/cycles.repository');
const bids = require('../db/bids.repository');
const outbox = require('../db/outbox');
const {ApiError} = require('../middleware/errors');

const ORGANIZER = {role: 'organizer'};

function draw(candidates, pick = randomInt) {
  const draw_index = pick(candidates.length);
  return {draw_index, member_id: candidates[draw_index]};
}

async function recordDecision(db, cycle, user, action, details = null) {
  const [r] = await db.execute('INSERT INTO CycleDecision (cycle_id, round_no, action, decided_by, details) VALUES (?, ?, ?, ?, ?)',
    [cycle.cycle_id, cycle.bidding_round, action, user.id, details && JSON.stringify(details)]);
  await outbox.add(db, {type: 'cycle.decision', circle_id: cycle.circle_id, cycle_id: cycle.cycle_id, actor: ORGANIZER,
    data: {seq_no: cycle.seq_no, round: cycle.bidding_round, option: action, decision_id: r.insertId, ...(details && {audit: details})}});
  return r.insertId;
}

async function act(cycleId, user, {action, minutes}) {
  return transaction(async db => {
    let cycle = await cycles.lock(db, cycleId);
    // Apply what the deadline already implies first, so the organizer acts on the current state.
    await bids.closeIfReady(db, cycle);
    cycle = await cycles.lock(db, cycleId);
    const [paid] = await db.execute('SELECT 1 FROM Payout WHERE cycle_id = ?', [cycleId]);
    if (paid.length || cycle.status === 'closed') throw new ApiError(409, 'This cycle is already settled; bidding decisions can no longer change');
    if (cycle.status === 'pending' || cycle.status === 'expired') throw new ApiError(409, `This cycle is ${cycle.status}`);
    const waiting = cycle.status === 'awaiting_decision';

    if (action === 'extend') {
      if (cycle.status !== 'open' || cycle.bidding_expired) throw new ApiError(409, 'Bidding is not open; after the deadline use reopen');
      const [u] = await db.execute(`UPDATE Cycle SET bid_closes_at = TIMESTAMPADD(MINUTE, ?, bid_closes_at)
        WHERE cycle_id = ? AND status = 'open' AND bid_closes_at > UTC_TIMESTAMP(3)`, [minutes, cycleId]);
      if (!u.affectedRows) throw new ApiError(409, 'The bidding deadline has passed');
      const after = await cycles.lock(db, cycleId);
      await outbox.add(db, {type: 'bidding.extended', circle_id: cycle.circle_id, cycle_id: cycleId, actor: ORGANIZER,
        data: {seq_no: cycle.seq_no, round: cycle.bidding_round, minutes, previous_closes_at: cycle.bid_closes_at, bid_closes_at: after.bid_closes_at}});
      return {action, cycle_id: cycleId, status: after.status, bid_closes_at: after.bid_closes_at, bidding_round: after.bidding_round};
    }

    if (action === 'reopen') {
      if (!waiting && !(cycle.status === 'open' && cycle.bidding_expired)) throw new ApiError(409, 'Bidding is still open; use extend');
      await recordDecision(db, cycle, user, 'reopen', {minutes});
      await db.execute(`UPDATE Cycle SET status = 'open', bidding_round = bidding_round + 1,
        bid_closes_at = TIMESTAMPADD(MINUTE, ?, UTC_TIMESTAMP(3)) WHERE cycle_id = ?`, [minutes, cycleId]);
      const after = await cycles.lock(db, cycleId);
      await outbox.add(db, {type: 'bidding.reopened', circle_id: cycle.circle_id, cycle_id: cycleId, actor: ORGANIZER,
        data: {seq_no: cycle.seq_no, round: after.bidding_round, minutes, bid_closes_at: after.bid_closes_at}});
      return {action, cycle_id: cycleId, status: after.status, bid_closes_at: after.bid_closes_at, bidding_round: after.bidding_round};
    }

    if (!waiting) throw new ApiError(409, 'This option is only available when the deadline passed without any bid');

    if (action === 'new_cycle') {
      await recordDecision(db, cycle, user, 'new_cycle');
      // 'expired' does not count toward total_cycles; cycles.open carries its contributions over.
      await db.execute('UPDATE Cycle SET status = ? WHERE cycle_id = ?', ['expired', cycleId]);
      await outbox.add(db, {type: 'cycle.expired', circle_id: cycle.circle_id, cycle_id: cycleId, actor: ORGANIZER,
        data: {seq_no: cycle.seq_no, reason: 'organizer_started_new_cycle'}});
      const next = await cycles.open(db, cycle.circle_id);
      return {action, cycle_id: cycleId, status: 'expired', next_cycle: next};
    }

    if (action === 'random_winner') {
      if ((await bids.unfunded(db, cycle)).length) throw new ApiError(409, 'All contributions for this cycle must be recorded before a winner is drawn');
      const candidates = (await bids.eligible(db, cycle)).map(m => m.member_id);
      if (!candidates.length) throw new ApiError(409, 'No eligible member is left in this circle');
      const result = draw(candidates);
      const audit = {method: 'crypto.randomInt', candidates, draw_index: result.draw_index, winner_member_id: result.member_id};
      const decisionId = await recordDecision(db, cycle, user, 'random_winner', audit);
      await bids.settle(db, cycle, {member_id: result.member_id, discount_rate: '0.00'}, {selection: 'random_draw', decision_id: decisionId});
      return {action, cycle_id: cycleId, status: 'closed', winner_member_id: result.member_id, audit};
    }
    throw new ApiError(400, 'Unknown action');
  });
}

module.exports = {act, draw};
