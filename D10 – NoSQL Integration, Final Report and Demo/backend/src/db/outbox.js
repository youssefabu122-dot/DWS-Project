// Transactional outbox: call add() with the running transaction's connection, so the event
// commits or rolls back together with the financial change.
const {randomUUID} = require('node:crypto');

async function add(db, {type, circle_id, cycle_id = null, actor, data}) {
  await db.execute(
    'INSERT INTO ActivityOutbox (event_id, event_type, circle_id, cycle_id, payload) VALUES (?, ?, ?, ?, ?)',
    [randomUUID(), type, circle_id, cycle_id, JSON.stringify({actor, data})]);
}

// Only the public name goes into the feed, never the e-mail (D9 privacy).
async function member(db, memberId) {
  const [rows] = await db.execute('SELECT name FROM Member WHERE member_id = ?', [memberId]);
  return {role: 'member', member_id: memberId, name: rows[0]?.name ?? null};
}

module.exports = {add, member};
