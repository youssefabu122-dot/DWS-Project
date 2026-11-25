// Track B analytics for one circle, computed from MySQL only (never from the MongoDB feed).
const pool = require('../db/connection');
const {ApiError} = require('../middleware/errors');
const calc = require('./analytics.calc');

async function forCircle(circleId) {
  const [[circle]] = await pool.execute(
    `SELECT c.circle_id, c.contribution_amount, (SELECT COUNT(*) FROM Membership m WHERE m.circle_id = c.circle_id) AS members
     FROM Circle c WHERE c.circle_id = ?`, [circleId]);
  if (!circle) throw new ApiError(404, 'Circle not found');
  const members = Number(circle.members);

  // Bid holds each member's final rate, so a raised bid counts once.
  const [bids] = await pool.execute(
    `SELECT c.cycle_id, c.seq_no, c.status, b.discount_rate
     FROM Bid b JOIN Cycle c ON c.cycle_id = b.cycle_id WHERE c.circle_id = ? ORDER BY c.seq_no, b.bid_id`, [circleId]);
  const completed = bids.filter(b => b.status === 'closed');
  const perCycle = [...new Map(completed.map(b => [b.cycle_id, b])).values()].map(c => {
    const rates = completed.filter(b => b.cycle_id === c.cycle_id).map(b => b.discount_rate);
    return {cycle_id: c.cycle_id, seq_no: c.seq_no, bid_count: rates.length, average_rate: calc.averageRate(rates)};
  });
  const open = bids.filter(b => b.status === 'open');

  const [payouts] = await pool.execute(
    `SELECT c.cycle_id, c.seq_no, p.member_id, m.name, p.paid_at,
       (SELECT b.discount_rate FROM Bid b WHERE b.cycle_id = c.cycle_id AND b.member_id = p.member_id) AS bid_rate,
       EXISTS (SELECT 1 FROM CycleDecision d WHERE d.cycle_id = c.cycle_id AND d.action = 'random_winner') AS random_draw,
       COALESCE((SELECT SUM(s.amount) FROM DiscountShare s WHERE s.payout_cycle_id = c.cycle_id), 0) AS discount
     FROM Payout p JOIN Cycle c ON c.cycle_id = p.cycle_id JOIN Member m ON m.member_id = p.member_id
     WHERE c.circle_id = ? ORDER BY c.seq_no`, [circleId]);
  const winners = payouts.map((p, i) => {
    const selection = Number(p.random_draw) ? 'random_draw' : p.bid_rate !== null ? 'bid' : 'final_member';
    const winning_rate = selection === 'bid' ? Number(p.bid_rate).toFixed(2) : '0.00';
    return {cycle_id: p.cycle_id, seq_no: p.seq_no, winner: {member_id: p.member_id, name: p.name}, paid_at: p.paid_at,
      selection, winning_rate,
      cost: calc.costOfCredit({members, contribution: circle.contribution_amount, position: i + 1, discount: p.discount})};
  });
  const borrowers = winners.filter(w => w.cost.per_cycle_rate_pct !== null);
  const avg = list => list.length ? (Math.round(list.reduce((s, v) => s + Number(v) * 100, 0) / list.length) / 100).toFixed(2) : null;

  return {
    circle_id: circleId, members, contribution_amount: circle.contribution_amount,
    pot_amount: (members * Math.round(Number(circle.contribution_amount) * 100) / 100).toFixed(2),
    average_discount: {
      rate: calc.averageRate(completed.map(b => b.discount_rate)),
      bid_count: completed.length, cycle_count: perCycle.length, per_cycle: perCycle,
      current: open.length ? {cycle_id: open[0].cycle_id, seq_no: open[0].seq_no, bid_count: open.length,
        average_rate: calc.averageRate(open.map(b => b.discount_rate))} : null
    },
    winning_bids: {
      completed_cycles: winners.length,
      counts: Object.fromEntries(calc.SELECTIONS.map(s => [s, winners.filter(w => w.selection === s).length])),
      average_winning_rate: avg(winners.filter(w => w.selection === 'bid').map(w => w.winning_rate)),
      distribution: calc.distribution(winners),
      cycles: winners.map(({cost, ...w}) => w)
    },
    cost_of_credit: {
      average_per_cycle_rate_pct: avg(borrowers.map(w => w.cost.per_cycle_rate_pct)),
      average_total_cost_pct: avg(borrowers.map(w => w.cost.total_cost_pct)),
      total_discount_paid: (winners.reduce((s, w) => s + Math.round(Number(w.cost.discount_amount) * 100), 0) / 100).toFixed(2),
      payouts: winners.map(w => ({cycle_id: w.cycle_id, seq_no: w.seq_no, winner: w.winner, selection: w.selection,
        winning_rate: w.winning_rate, ...w.cost}))
    }
  };
}

module.exports = {forCircle};
