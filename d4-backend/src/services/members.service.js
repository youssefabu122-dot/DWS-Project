const repo = require('../db/members.repository');
const transaction = require('../db/transaction');
module.exports = {list: repo.list, get: repo.get, create: body => repo.create(body), update: (id,body) => transaction(db => repo.update(id,body,db)), remove: id => transaction(db => repo.remove(id,db))};
