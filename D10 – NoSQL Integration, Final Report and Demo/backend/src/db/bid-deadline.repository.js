const duration = Number(process.env.BID_DURATION_MINUTES || 30);
if (!Number.isSafeInteger(duration) || duration <= 0 || duration > 10080) {
  throw new Error('BID_DURATION_MINUTES must be an integer from 1 to 10080');
}

async function clock(db, cycleId) {
  const [rows] = await db.execute(
    `SELECT CONCAT(LEFT(DATE_FORMAT(bid_closes_at, '%Y-%m-%dT%H:%i:%s.%f'), 23), 'Z') AS closes_at,
      CONCAT(LEFT(DATE_FORMAT(UTC_TIMESTAMP(3), '%Y-%m-%dT%H:%i:%s.%f'), 23), 'Z') AS server_now,
      (bid_closes_at <= UTC_TIMESTAMP(3)) AS expired
     FROM Cycle WHERE cycle_id = ?`, [cycleId]
  );
  return {...rows[0], expired: Boolean(rows[0].expired)};
}

async function ensure(db, cycle) {
  if (cycle.status === 'open' && !cycle.bid_closes_at) {
    // Persist once. Polling and server restarts must never reset the deadline.
    await db.execute(
      `UPDATE Cycle SET bid_closes_at = TIMESTAMPADD(MINUTE, ?, UTC_TIMESTAMP(3))
       WHERE cycle_id = ? AND status = 'open' AND bid_closes_at IS NULL`,
      [duration, cycle.cycle_id]
    );
  }
  return clock(db, cycle.cycle_id);
}

module.exports = {clock, ensure};
