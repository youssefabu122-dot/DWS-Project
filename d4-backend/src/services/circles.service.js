const repo = require('../db/circles.repository');
const transaction = require('../db/transaction');
const {ApiError} = require('../middleware/errors');
async function get(id, db) {
  const rows = await repo.progress(id, db);
  if (!rows.length) throw new ApiError(404, 'Circle not found');
  return rows[0];
}
module.exports = {
  list: () => repo.progress(),
  get,
  create: body => transaction(async db => {
    const row = await repo.create(body, db);
    return get(row.circle_id, db);
  }),
  update: (id, body) => transaction(async db => {
    await repo.update(id, body, db);
    return get(id, db);
  }),
  remove: id => transaction(db => repo.remove(id, db)),
  getMembers: async id => {await repo.get(id); return repo.getMembersByCircle(id);},
  getCycles: async id => {await repo.get(id); return repo.getCyclesByCircle(id);}
};
