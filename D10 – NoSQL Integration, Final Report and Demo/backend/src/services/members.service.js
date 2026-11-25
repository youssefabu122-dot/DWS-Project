const bcrypt = require('bcrypt');
const repo = require('../db/members.repository');
const transaction = require('../db/transaction');
const pool = require('../db/connection');
// D9 registration: store only the bcrypt hash (cost 12); the role is always set by the server.
async function create(body) {
  const hash = await bcrypt.hash(body.password, 12);
  const [r] = await pool.execute('INSERT INTO Member (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
    [body.name, body.email, hash, 'member']);
  return repo.get(r.insertId);
}
module.exports = {list: repo.list, get: repo.get, create, update: (id,body) => transaction(db => repo.update(id,body,db)), remove: id => transaction(db => repo.remove(id,db))};
