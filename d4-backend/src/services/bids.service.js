const transaction = require('../db/transaction');
const bids = require('../db/bids.repository');
const cycles = require('../db/cycles.repository');
module.exports = {
  create: (id, body) => transaction(db => bids.create(db,id,body)),
  ranking: id => transaction(async db => { await cycles.lock(db,id); return bids.ranking(db,id); }),
  async closeReadyCycles() {
    for (const row of await bids.openIds()) {
      await transaction(async db => bids.closeIfReady(db, await cycles.lock(db,row.cycle_id)));
    }
  }
};
