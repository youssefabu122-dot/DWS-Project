const repository = require('./crud.repository')('Member', 'member_id', ["name", "email"], true);
module.exports = repository;
