const repo = require('../db/contributions.repository');
const transaction = require('../db/transaction');
const cycles = require('../db/cycles.repository');
const bids = require('../db/bids.repository');
const {ApiError} = require('../middleware/errors');
async function write(id, body) {
  return transaction(async db => {
    const old = id ? await repo.get(id,db) : null;
    const ids = [...new Set([body.cycle_id, ...(old ? [old.cycle_id] : [])])].sort((a,b)=>a-b);


    // Lock all parent circles first to avoid cross-circle move deadlocks.
    for (const cid of ids) {
      const [r] = await db.execute('SELECT circle_id FROM Cycle WHERE cycle_id = ?', [cid]);
      if (!r.length) throw new ApiError(404,'Cycle not found');
    }


    const [parents] = await db.execute('SELECT circle_id FROM Cycle WHERE cycle_id IN (?, ?) ORDER BY circle_id', [ids[0],ids[1] || ids[0]]);
    for (const circleId of [...new Set(parents.map(r=>r.circle_id))]) await db.execute('SELECT circle_id FROM Circle WHERE circle_id = ? FOR UPDATE', [circleId]);
    const locked = new Map();


    for (const cid of ids) locked.set(cid,await cycles.lock(db,cid));
    const cycle = locked.get(body.cycle_id);

    if (old) {
      const current = await repo.get(id,db,true);
      if (current.cycle_id !== old.cycle_id) throw new ApiError(409,'Contribution changed; retry');
    }

    for (const cid of ids) {
      const [paid] = await db.execute('SELECT cycle_id FROM Payout WHERE cycle_id = ?', [cid]);
      if (paid.length) throw new ApiError(409,'Cannot change contributions after payout');
    }
    
    await cycles.membership(db,cycle,body.member_id);
    const result = id ? await repo.update(id,body,db) : await repo.create(body,db);
    await bids.closeIfReady(db,cycle); return result;
  });
}
module.exports = {list:repo.list,get:repo.get,create:body=>write(null,body),update:write,
  remove:id=>transaction(async db=>{
    const old = await repo.get(id,db); await cycles.lock(db,old.cycle_id);
    const current = await repo.get(id,db,true);
    if (current.cycle_id !== old.cycle_id) throw new ApiError(409,'Contribution changed; retry');
    const [paid] = await db.execute('SELECT cycle_id FROM Payout WHERE cycle_id = ?', [old.cycle_id]);
    if (paid.length) throw new ApiError(409,'Cannot delete contributions after payout');
    await repo.remove(id,db);
  })};
