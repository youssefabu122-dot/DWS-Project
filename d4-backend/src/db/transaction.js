const pool = require('./connection');
module.exports = async function transaction(fn) {
  const db = await pool.getConnection();
  try {

    await db.execute('SET TRANSACTION ISOLATION LEVEL READ COMMITTED', []);
    await db.beginTransaction(); const result = await fn(db); await db.commit(); return result; 
  }
  catch (err) { 
    await db.rollback(); throw err; 
  }
  finally {
     db.release(); 
    }
};
