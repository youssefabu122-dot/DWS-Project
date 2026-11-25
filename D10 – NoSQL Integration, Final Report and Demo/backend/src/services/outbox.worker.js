// Copies committed outbox rows into MongoDB, at least once: a row stays pending until
// MongoDB accepts it, and the upsert keyed by event_id means a retry never makes a copy.
const pool = require('../db/connection');
const mongo = require('../db/mongo');

const BATCH = 100;

function toDocument(row) {
  const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
  const doc = {
    _id: row.event_id,
    schema_version: 1,
    type: row.event_type,
    circle_id: row.circle_id,
    occurred_at: new Date(row.occurred_at.replace(' ', 'T') + 'Z'),
    seq: Number(row.outbox_id),
    actor: payload.actor,
    data: payload.data,
    source: {database: 'mysql', table: 'ActivityOutbox', outbox_id: Number(row.outbox_id)}
  };
  if (row.cycle_id !== null) doc.cycle_id = row.cycle_id;
  return doc;
}

async function publish(row) {
  const {_id, ...fields} = toDocument(row);
  try {
    await mongo.events().updateOne({_id}, {$setOnInsert: {...fields, stored_at: new Date()}}, {upsert: true});
  } catch (err) {
    if (err.code !== 11000) throw err; // 11000: a parallel upsert already stored it
  }
}

async function publishPending() {
  const [rows] = await pool.execute(
    `SELECT outbox_id, event_id, event_type, circle_id, cycle_id, payload, occurred_at
     FROM ActivityOutbox WHERE published_at IS NULL AND next_attempt_at <= UTC_TIMESTAMP(3)
     ORDER BY outbox_id LIMIT ${BATCH}`, []);
  let published = 0;
  for (const row of rows) {
    try {
      await publish(row);
    } catch (err) {
      // Backoff 2, 4, 8 ... 60 s. MySQL assigns left to right, so attempts is already incremented.
      await pool.execute(
        `UPDATE ActivityOutbox SET attempts = attempts + 1, last_error = ?,
           next_attempt_at = TIMESTAMPADD(SECOND, LEAST(60, 1 << LEAST(attempts, 6)), UTC_TIMESTAMP(3))
         WHERE outbox_id = ?`, [String(err.codeName || err.name || 'Error').slice(0, 200), row.outbox_id]);
      break; // keep the remaining rows, in order, for the next run
    }
    await pool.execute('UPDATE ActivityOutbox SET published_at = UTC_TIMESTAMP(3), last_error = NULL WHERE outbox_id = ?', [row.outbox_id]);
    published++;
  }
  return published;
}

module.exports = {publishPending, toDocument};
