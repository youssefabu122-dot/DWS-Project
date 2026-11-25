const pool = require('./connection');
const cycles = require('./cycles.repository');
const deadline = require('./bid-deadline.repository');
const outbox = require('./outbox');
const {ApiError} = require('../middleware/errors');

const money = cents => `${cents/100n}.${String(cents%100n).padStart(2,'0')}`;

// Highest discount first. Ties go to the earliest effective bid: effective_seq is the
// BidHistory row of the latest submit or raise, so a raise moves the bid to the back.
async function ranking(db, id) {
  const [rows] = await db.execute(`SELECT b.bid_id, b.member_id, b.cycle_id, b.discount_rate, m.name,
      CONCAT(LEFT(DATE_FORMAT(h.created_at, '%Y-%m-%dT%H:%i:%s.%f'), 23), 'Z') AS placed_at,
      (SELECT COUNT(*) - 1 FROM BidHistory x WHERE x.bid_id = b.bid_id) AS raise_count
    FROM Bid b JOIN Member m ON m.member_id = b.member_id
    LEFT JOIN BidHistory h ON h.history_id = b.effective_seq
    WHERE b.cycle_id = ? ORDER BY b.discount_rate DESC, b.effective_seq ASC, b.bid_id ASC`,[id]);
  return rows.map((row,i) => ({rank:i+1,...row, raise_count:Math.max(0,Number(row.raise_count))}));
}

async function history(db, id) {
  const [rows] = await db.execute(`SELECT h.history_id, h.bid_id, h.member_id, m.name, h.action, h.discount_rate, h.previous_rate,
      CONCAT(LEFT(DATE_FORMAT(h.created_at, '%Y-%m-%dT%H:%i:%s.%f'), 23), 'Z') AS created_at
    FROM BidHistory h JOIN Member m ON m.member_id = h.member_id
    WHERE h.cycle_id = ? ORDER BY h.history_id`,[id]);
  return rows;
}

async function eligible(db, cycle) {
  const [rows] = await db.execute(`SELECT ms.member_id FROM Membership ms
    WHERE ms.circle_id = ? AND NOT EXISTS (
      SELECT 1 FROM Payout p JOIN Cycle c ON c.cycle_id = p.cycle_id
      WHERE c.circle_id = ? AND p.member_id = ms.member_id)
    ORDER BY ms.member_id`,[cycle.circle_id,cycle.circle_id]);
  return rows;
}

async function unfunded(db, cycle) {
  const [rows] = await db.execute(`SELECT ms.member_id FROM Membership ms
    LEFT JOIN Contribution co ON co.member_id = ms.member_id AND co.cycle_id = ?
    WHERE ms.circle_id = ? AND co.contribution_id IS NULL`,[cycle.cycle_id,cycle.circle_id]);
  return rows;
}

// Settlement in integer cents: equal discount shares, leftover cents to the lowest IDs.
// The caller holds the Circle -> Cycle locks and has verified funding.
async function settle(db, cycle, winner, extra = {}) {
  await db.execute('INSERT INTO Payout (cycle_id, member_id, paid_at) VALUES (?, ?, UTC_TIMESTAMP())',[cycle.cycle_id,winner.member_id]);
  const [circle] = await db.execute('SELECT contribution_amount FROM Circle WHERE circle_id = ?', [cycle.circle_id]);
  const [allMembers] = await db.execute('SELECT member_id FROM Membership WHERE circle_id = ? ORDER BY member_id', [cycle.circle_id]);
  const cents = BigInt(String(circle[0].contribution_amount).replace('.',''));
  const rate = BigInt(Math.round(Number(winner.discount_rate)*100));
  const discount = (cents * BigInt(allMembers.length) * rate + 5000n) / 10000n;
  const recipients = allMembers.filter(m => m.member_id !== winner.member_id);
  const shares = [];
  if (recipients.length && discount > 0n) {
    const base = discount / BigInt(recipients.length), remainder = discount % BigInt(recipients.length);
    for (let i=0;i<recipients.length;i++) {
      const share = base + (BigInt(i) < remainder ? 1n : 0n);
      if (share > 9999999999n) throw new ApiError(409,'Discount share exceeds schema capacity');
      const amount = money(share);
      await db.execute('INSERT INTO DiscountShare (payout_cycle_id, member_id, amount) VALUES (?, ?, ?)',[cycle.cycle_id,recipients[i].member_id,amount]);
      shares.push({member_id: recipients[i].member_id, amount});
    }
  }
  await db.execute('UPDATE Cycle SET status = ? WHERE cycle_id = ?', ['closed',cycle.cycle_id]);
  const {name} = await outbox.member(db, winner.member_id);
  const [[{n}]] = await db.execute('SELECT COUNT(*) AS n FROM Bid WHERE cycle_id = ?', [cycle.cycle_id]);
  await outbox.add(db, {type: 'cycle.closed', circle_id: cycle.circle_id, cycle_id: cycle.cycle_id, actor: {role: 'system'},
    data: {seq_no: cycle.seq_no, winner: {member_id: winner.member_id, name},
      winning_discount_rate: Number(winner.discount_rate).toFixed(2), pot_amount: money(cents * BigInt(allMembers.length)),
      discount_total: money(discount), bid_count: Number(n), discount_shares: shares, ...extra}});
}

// Called after every change that can complete a cycle. With two or more eligible members
// nothing settles before the deadline; then the top bid wins once funded, and no bids at
// all means 'awaiting_decision' (the organizer decides). The last member gets the full pot.
async function closeIfReady(db, cycle) {
  if (cycle.status !== 'open') return false;
  const members = await eligible(db,cycle);
  if (!members.length) return false;
  const bids = await ranking(db,cycle.cycle_id);
  const eligibleIds = new Set(members.map(m => m.member_id));
  const eligibleBids = bids.filter(bid => eligibleIds.has(bid.member_id));
  const timing = await deadline.clock(db, cycle.cycle_id);
  if (members.length > 1) {
    if (!timing.expired) return false;
    if (!eligibleBids.length) {
      await db.execute('UPDATE Cycle SET status = ? WHERE cycle_id = ?', ['awaiting_decision', cycle.cycle_id]);
      await outbox.add(db, {type: 'cycle.awaiting_decision', circle_id: cycle.circle_id, cycle_id: cycle.cycle_id,
        actor: {role: 'system'}, data: {seq_no: cycle.seq_no, round: cycle.bidding_round, reason: 'no_bids_before_deadline',
          bid_closes_at: timing.closes_at}});
      return false;
    }
  }
  if ((await unfunded(db,cycle)).length) return false;
  const winner = members.length === 1
    ? {member_id: members[0].member_id, discount_rate: '0.00'}
    : eligibleBids[0];
  await settle(db, cycle, winner, members.length === 1 ? {final_member: true} : {});
  return true;
}

async function create(db, id, body) {
  const cycle = await cycles.lock(db,id);
  if (cycle.status !== 'open') throw new ApiError(409,'Bidding is closed');
  if (cycle.bidding_expired) throw new ApiError(409,'The bidding deadline has passed');
  await cycles.membership(db,cycle,body.member_id);
  const members = await eligible(db,cycle);
  if (members.length === 1 && members[0].member_id === body.member_id) throw new ApiError(409,'The final member receives the full pot automatically; no bid is required');

  if (!members.some(m => m.member_id === body.member_id)) {
    throw new ApiError(
      409,
      'Member has already received a payout in this circle and cannot bid again here. You can bid in another circle if you are a member and eligible.'
    );
  }

  const rate = Number(body.discount_rate).toFixed(2);
  const [existing] = await db.execute('SELECT bid_id, discount_rate FROM Bid WHERE cycle_id = ? AND member_id = ? FOR UPDATE', [id, body.member_id]);
  let bidId, action;
  if (existing.length) {
    if (Number(rate) <= Number(existing[0].discount_rate)) {
      throw new ApiError(409, `Bids can only be raised: your current bid is ${existing[0].discount_rate}%`);
    }
    bidId = existing[0].bid_id; action = 'raised';
    const [u] = await db.execute(
      `UPDATE Bid b JOIN Cycle c ON c.cycle_id = b.cycle_id SET b.discount_rate = ?
       WHERE b.bid_id = ? AND c.status = 'open' AND c.bid_closes_at > UTC_TIMESTAMP(3)`, [rate, bidId]);
    if (!u.affectedRows) throw new ApiError(409,'The bidding deadline has passed');
  } else {
    action = 'placed';
    const [result] = await db.execute(
      `INSERT INTO Bid (member_id, cycle_id, discount_rate)
       SELECT ?, ?, ? FROM Cycle
       WHERE cycle_id = ? AND status = 'open' AND bid_closes_at > UTC_TIMESTAMP(3)`,
      [body.member_id,id,rate,id]
    );
    if (!result.affectedRows) throw new ApiError(409,'The bidding deadline has passed');
    bidId = result.insertId;
  }
  const [h] = await db.execute('INSERT INTO BidHistory (bid_id, cycle_id, member_id, action, discount_rate, previous_rate) VALUES (?, ?, ?, ?, ?, ?)',
    [bidId, id, body.member_id, action, rate, existing.length ? existing[0].discount_rate : null]);
  await db.execute('UPDATE Bid SET effective_seq = ? WHERE bid_id = ?', [h.insertId, bidId]);
  await outbox.add(db, {type: action === 'raised' ? 'bid.raised' : 'bid.placed', circle_id: cycle.circle_id, cycle_id: id,
    actor: await outbox.member(db, body.member_id),
    data: {seq_no: cycle.seq_no, round: cycle.bidding_round, discount_rate: rate,
      ...(existing.length ? {previous_rate: existing[0].discount_rate} : {})}});

  const closed = await closeIfReady(db,cycle);
  const [rows] = await db.execute('SELECT bid_id, member_id, cycle_id, discount_rate FROM Bid WHERE bid_id = ?', [bidId]);
  return {...rows[0], action, cycle_status:closed ? 'closed' : 'open'};
}

async function openIds() {
  const [rows] = await pool.execute('SELECT cycle_id FROM Cycle WHERE status = ? ORDER BY circle_id, cycle_id',['open']);
  return rows;
}

module.exports = {ranking, history, eligible, unfunded, settle, closeIfReady, create, openIds};
