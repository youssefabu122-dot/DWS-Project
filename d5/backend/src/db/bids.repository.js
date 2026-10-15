const pool = require('./connection');

const cycles = require('./cycles.repository');
const deadline = require('./bid-deadline.repository');

const {ApiError} = require('../middleware/errors');

async function ranking(db, id) {

  const [rows] = await db.execute(`SELECT b.bid_id, b.member_id, b.cycle_id, b.discount_rate, m.name
    FROM Bid b JOIN Member m ON m.member_id = b.member_id
    WHERE b.cycle_id = ? ORDER BY b.discount_rate DESC, b.bid_id ASC`,[id]);
  return rows.map((row,i) => ({rank:i+1,...row}));
}

async function eligible(db, cycle) {
  const [rows] = await db.execute(`SELECT ms.member_id FROM Membership ms
    WHERE ms.circle_id = ? AND NOT EXISTS (
      SELECT 1 FROM Payout p JOIN Cycle c ON c.cycle_id = p.cycle_id
      WHERE c.circle_id = ? AND p.member_id = ms.member_id)
    ORDER BY ms.member_id`,[cycle.circle_id,cycle.circle_id]);
  return rows;
}

async function closeIfReady(db, cycle) {

  if (cycle.status !== 'open') return false;
  const members = await eligible(db,cycle);

  if (!members.length) return false;
  const bids = await ranking(db,cycle.cycle_id);

  const eligibleIds = new Set(members.map(m => m.member_id));
  const eligibleBids = bids.filter(bid => eligibleIds.has(bid.member_id));
  const timing = await deadline.clock(db, cycle.cycle_id);

  if (members.length > 1) {
    if (timing.expired) {
      if (!eligibleBids.length) {
        // No winner: stop this cycle without creating a payout.
        await db.execute('UPDATE Cycle SET status = ? WHERE cycle_id = ?', ['expired', cycle.cycle_id]);
        return false;
      }
    } else if (!members.every(m => eligibleBids.some(b => b.member_id === m.member_id))) {
      return false;
    }
  }
  const [funding] = await db.execute(`SELECT ms.member_id FROM Membership ms
    LEFT JOIN Contribution co ON co.member_id = ms.member_id AND co.cycle_id = ?
    WHERE ms.circle_id = ? AND co.contribution_id IS NULL`,[cycle.cycle_id,cycle.circle_id]);

  if (funding.length) return false;
  // The last unpaid member receives the full pot, even if old bids exist.

  const winner = members.length === 1
    ? {member_id: members[0].member_id, discount_rate: '0.00'}
    : eligibleBids[0];

  await db.execute('INSERT INTO Payout (cycle_id, member_id, paid_at) VALUES (?, ?, UTC_TIMESTAMP())',[cycle.cycle_id,winner.member_id]);
  const [circle] = await db.execute('SELECT contribution_amount FROM Circle WHERE circle_id = ?', [cycle.circle_id]);
  const [allMembers] = await db.execute('SELECT member_id FROM Membership WHERE circle_id = ? ORDER BY member_id', [cycle.circle_id]);

  // Integer cents avoid cumulative floating-point rounding. Final cents go to lowest IDs.
  const cents = BigInt(String(circle[0].contribution_amount).replace('.',''));

  const rate = BigInt(Math.round(Number(winner.discount_rate)*100));

  const discount = (cents * BigInt(allMembers.length) * rate + 5000n) / 10000n;

  const recipients = allMembers.filter(m => m.member_id !== winner.member_id);

  if (recipients.length && discount > 0n) {
    const base = discount / BigInt(recipients.length), remainder = discount % BigInt(recipients.length);
    for (let i=0;i<recipients.length;i++) {
      const share = base + (BigInt(i) < remainder ? 1n : 0n);
      if (share > 9999999999n) throw new ApiError(409,'Discount share exceeds schema capacity');
      const amount = `${share/100n}.${String(share%100n).padStart(2,'0')}`;
      await db.execute('INSERT INTO DiscountShare (payout_cycle_id, member_id, amount) VALUES (?, ?, ?)',[cycle.cycle_id,recipients[i].member_id,amount]);
    }
  }
  await db.execute('UPDATE Cycle SET status = ? WHERE cycle_id = ?', ['closed',cycle.cycle_id]);
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

  const [result] = await db.execute(
    `INSERT INTO Bid (member_id, cycle_id, discount_rate)
     SELECT ?, ?, ? FROM Cycle
     WHERE cycle_id = ? AND status = 'open' AND bid_closes_at > UTC_TIMESTAMP(3)`,
    [body.member_id,id,body.discount_rate,id]
  );
  if (!result.affectedRows) throw new ApiError(409,'The bidding deadline has passed');
  
  const closed = await closeIfReady(db,cycle);


  const [rows] = await db.execute('SELECT bid_id, member_id, cycle_id, discount_rate FROM Bid WHERE bid_id = ?', [result.insertId]);
  return {...rows[0], cycle_status:closed ? 'closed' : 'open'};
}


async function openIds() {
  const [rows] = await pool.execute('SELECT cycle_id FROM Cycle WHERE status = ? ORDER BY circle_id, cycle_id',['open']); return rows;
}
module.exports = {ranking, eligible, closeIfReady, create, openIds};
