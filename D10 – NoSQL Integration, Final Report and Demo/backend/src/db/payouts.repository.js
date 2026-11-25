const repository = require('./crud.repository')('Payout', 'cycle_id', ["cycle_id", "member_id", "paid_at"], false);
module.exports = repository;
