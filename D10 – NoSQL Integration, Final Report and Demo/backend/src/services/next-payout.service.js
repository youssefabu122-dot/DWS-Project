const transaction = require('../db/transaction');
const repository = require('../db/next-payout.repository');

module.exports.get = (circleId, cycleId) =>
  transaction(db => repository.get(db, circleId, cycleId));
