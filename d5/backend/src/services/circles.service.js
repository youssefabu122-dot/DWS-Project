const repo = require('../db/circles.repository');
const transaction = require('../db/transaction');
const pool = require('../db/connection');
const cycles = require('../db/cycles.repository');
const {ApiError} = require('../middleware/errors');
async function get(id, db) {
  const rows = await repo.progress(id, db);
  if (!rows.length) throw new ApiError(404, 'Circle not found');
  return rows[0];
}
module.exports = {
  list: async memberId => {
    const rows = await repo.progress();
    if (memberId === undefined) return rows;
    const [own] = await pool.execute('SELECT circle_id FROM Membership WHERE member_id = ?', [memberId]);
    const ids = new Set(own.map(r => r.circle_id));
    return rows.filter(r => ids.has(r.circle_id));
  },
  get,
  create: body => transaction(async db => {
    const row = await repo.create(body, db);
    return get(row.circle_id, db);
  }),
  update: (id, body) => transaction(async db => {
    await repo.get(id, db, true);
    const [[{used}]] = await db.execute(
      `SELECT COUNT(*) AS used FROM Cycle WHERE circle_id = ? AND status <> 'expired'`, [id]);
    if (body.total_cycles < Number(used)) throw new ApiError(409, 'total_cycles cannot be less than the existing non-expired cycles');
    await repo.update(id, body, db);
    return get(id, db);
  }),
  remove: id => transaction(db => repo.remove(id, db)),
  getMembers: async id => {await repo.get(id); return repo.getMembersByCircle(id);},
  getCycles: async id => {await repo.get(id); return repo.getCyclesByCircle(id);},
  createCycle: id => transaction(db => cycles.open(db, id))
};
