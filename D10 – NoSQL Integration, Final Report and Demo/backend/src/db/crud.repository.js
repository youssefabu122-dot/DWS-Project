const pool = require('./connection');
const {ApiError} = require('../middleware/errors');

module.exports = function repository(table, key, columns, autoId = true) {

  const projection = [key, ...columns.filter(c => c !== key)].join(', ');

  async function get(id, db = pool, lock = false) {

    const [rows] = await db.execute(`SELECT ${projection} FROM ${table} WHERE ${key} = ?${lock ? ' FOR UPDATE' : ''}`, [id]);
    
    if (!rows.length) throw new ApiError(404, `${table} not found`);
    return rows[0];

  }
  return {

    get,
    async list() { const [rows] = await pool.execute(`SELECT ${projection} FROM ${table} ORDER BY ${key}`, []); return rows; },
    async create(body, db = pool) {

      const [result] = await db.execute(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`, columns.map(c => body[c]));
      return get(autoId ? result.insertId : body[key], db);

    },
    async update(id, body, db = pool) {

      await get(id,db,true);
      const mutable = columns.filter(c => c !== key);

      await db.execute(`UPDATE ${table} SET ${mutable.map(c => `${c} = ?`).join(', ')} WHERE ${key} = ?`, [...mutable.map(c => body[c]), id]);
      
      return get(id, db);
    },
    async remove(id, db = pool) {

      const [r] = await db.execute(`DELETE FROM ${table} WHERE ${key} = ?`, [id]);

      if (!r.affectedRows) throw new ApiError(404, `${table} not found`);
    }
  };
};
