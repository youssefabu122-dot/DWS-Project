const repository = require('./crud.repository')('Contribution', 'contribution_id', ["member_id", "cycle_id"], true);
module.exports = repository;
