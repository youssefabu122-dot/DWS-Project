const repo = require('../db/payouts.repository');
const transaction = require('../db/transaction');
const cycles = require('../db/cycles.repository');
const bids = require('../db/bids.repository');
const {ApiError} = require('../middleware/errors');
async function write(id,body) {
  return transaction(async db=>{
    const cycle = await cycles.lock(db,body.cycle_id);
    await cycles.membership(db,cycle,body.member_id);
    if (!id && cycle.status !== 'closed') throw new ApiError(409,'Open cycles are settled by automatic bid closing');
    if (id) {
      const old = await repo.get(id,db,true);
      const [shares] = await db.execute('SELECT share_id FROM DiscountShare WHERE payout_cycle_id = ? LIMIT 1',[id]);
      if (shares.length && old.member_id !== body.member_id) throw new ApiError(409,'Cannot change recipient with existing discount shares');
    }
    const [previous] = await db.execute(`SELECT p.cycle_id FROM Payout p JOIN Cycle c ON c.cycle_id=p.cycle_id
      WHERE c.circle_id = ? AND p.member_id = ? AND p.cycle_id <> ? LIMIT 1`,[cycle.circle_id,body.member_id,body.cycle_id]);
    if (previous.length) throw new ApiError(409,'Member already received a payout in this circle');
    const [missing] = await db.execute(`SELECT ms.member_id FROM Membership ms LEFT JOIN Contribution co
      ON co.member_id=ms.member_id AND co.cycle_id=? WHERE ms.circle_id=? AND co.contribution_id IS NULL`,[body.cycle_id,cycle.circle_id]);
    if (missing.length) throw new ApiError(409,'Cycle is not fully funded');
    const ranked = await bids.ranking(db,body.cycle_id);
    const [eligible] = await db.execute(`SELECT ms.member_id FROM Membership ms WHERE ms.circle_id=? AND NOT EXISTS
      (SELECT 1 FROM Payout p JOIN Cycle c ON c.cycle_id=p.cycle_id WHERE c.circle_id=? AND p.member_id=ms.member_id AND p.cycle_id<>?)`,[cycle.circle_id,cycle.circle_id,body.cycle_id]);
    const winner = eligible.length === 1
      ? {member_id:eligible[0].member_id}
      : ranked.find(b=>eligible.some(m=>m.member_id===b.member_id));
    if (!winner || winner.member_id !== body.member_id) throw new ApiError(409,'Payout recipient must be the highest eligible bidder');
    const result = id ? await repo.update(id,body,db) : await repo.create(body,db);
    await db.execute('UPDATE Cycle SET status = ? WHERE cycle_id = ?', ['closed',body.cycle_id]);
    return result;
  });
}
module.exports = {list:repo.list,get:repo.get,create:body=>write(null,body),update:write,
  remove:id=>transaction(async db=>{await cycles.lock(db,id);await repo.remove(id,db);})};
