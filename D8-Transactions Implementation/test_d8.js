#!/usr/bin/env node
// Usage: node test_d8.js /path/to/schema_v2.sql -- --login-path=d8
// Requires the MySQL CLI and access to create/drop a disposable database
// and read performance_schema.data_locks and data_lock_waits.
const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');

const [schemaFile, separator, ...clientOptions] = process.argv.slice(2);
const mysql = process.env.MYSQL_BIN || 'mysql';
const database = 'd8_test_' + randomBytes(6).toString('hex');
const session = "SET time_zone='+00:00', autocommit=1, innodb_lock_wait_timeout=15;\n";
const trials = 20;

function options(selectDatabase) {
  return [
    ...clientOptions, '--batch', '--skip-column-names', '--unbuffered',
    ...(selectDatabase ? [`--database=${database}`] : []),
  ];
}

function query(sql, { selectDatabase = true, expectedError } = {}) {
  const result = spawnSync(mysql, options(selectDatabase), {
    input: session + sql, encoding: 'utf8', timeout: 25000,
  });
  if (result.error) throw result.error;
  if (expectedError) {
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, expectedError);
    return result.stderr.trim();
  }
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function client() {
  const child = spawn(mysql, options(true));
  let stderr = '';
  child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; });
  child.stdin.on('error', () => {}); // The client may have already exited.
  const closed = new Promise(resolve => {
    child.on('error', error => { stderr += error.message; });
    child.on('close', status => resolve({ status, error: stderr.trim() }));
  });
  const timer = setTimeout(() => child.kill(), 25000);
  closed.then(() => clearTimeout(timer));
  return { child, closed };
}

async function race(circle, cycle) {
  const gate = client();
  const workers = [];
  try {
    let ready = false;
    gate.child.stdout.once('data', chunk => {
      ready = chunk.toString().trim() === String(circle);
    });
    gate.child.stdin.write(session + 'START TRANSACTION;\n' +
      `SELECT circle_id FROM Circle WHERE circle_id=${circle} FOR UPDATE;\n`);
    for (let i = 0; !ready && i < 100; i++) await delay(30);
    assert.ok(ready, 'Could not acquire the gate lock');

    for (let i = 0; i < 2; i++) {
      const worker = client();
      workers.push(worker);
      worker.child.stdin.end(session + `CALL d8_close_cycle(${cycle},4,NULL);\n`);
    }

    let waiters = 0;
    const deadline = Date.now() + 8000;
    while (waiters !== 2 && Date.now() < deadline) {
      waiters = Number(query(`
        SELECT COUNT(DISTINCT w.REQUESTING_THREAD_ID)
        FROM performance_schema.data_lock_waits AS w
        JOIN performance_schema.data_locks AS l
          ON l.ENGINE_LOCK_ID=w.REQUESTING_ENGINE_LOCK_ID AND l.ENGINE=w.ENGINE
        WHERE l.OBJECT_SCHEMA='${database}' AND LOWER(l.OBJECT_NAME)='circle';
      `));
      if (waiters !== 2) await delay(30);
    }
    assert.equal(waiters, 2, 'Both close requests must be waiting on the circle');
    gate.child.stdin.end('COMMIT;\n');
    assert.equal((await gate.closed).status, 0, 'Could not release the gate lock');

    const outcomes = await Promise.allSettled(workers.map(async worker => {
      const result = await worker.closed;
      if (result.status !== 0) throw new Error(result.error);
    }));
    const rejected = outcomes.filter(result => result.status === 'rejected');
    assert.equal(rejected.length, 1);
    assert.match(rejected[0].reason.message, /ERROR 1644 .*D8_CYCLE_NOT_OPEN/);
    return { waiters, outcomes: outcomes.map(result => result.status),
      error: rejected[0].reason.message };
  } finally {
    const clients = [gate, ...workers];
    for (const { child } of clients) {
      if (child.exitCode === null && child.signalCode === null) child.kill();
    }
    await Promise.all(clients.map(({ closed }) => closed));
  }
}

function state(circle, cycle) {
  const [status, bid] = query(
    `SELECT status,d8_winning_bid_id FROM Cycle WHERE cycle_id=${cycle};`
  ).split('\t');
  const rows = sql => query(sql).split('\n').filter(Boolean);
  return {
    status, bid: bid === 'NULL' ? null : Number(bid),
    contributions: rows(`SELECT member_id,payment_status FROM Contribution
      WHERE cycle_id=${cycle} ORDER BY member_id;`).map(row => row.replace('\t', '=')),
    paid_total: query(`SELECT paid_total FROM v_CyclePot WHERE cycle_id=${cycle};`),
    payout: rows(`SELECT member_id FROM Payout WHERE cycle_id=${cycle};`).map(Number),
    shares: rows(`SELECT member_id,amount FROM DiscountShare
      WHERE payout_cycle_id=${cycle} ORDER BY member_id;`).map(row => row.replace('\t', '=')),
    'turns/eligible': rows(`SELECT member_id,d8_payout_turns,eligible FROM v_D8Eligibility
      WHERE circle_id=${circle} ORDER BY member_id;`).map(row => row.replaceAll('\t', '/')),
  };
}

function fixture() {
  query(`
    INSERT INTO Member (member_id,name,email) VALUES
      (1,'M1','m1@example.test'),(2,'M2','m2@example.test'),
      (3,'M3','m3@example.test'),(4,'M4','m4@example.test');
    INSERT INTO Circle (circle_id,name,contribution_amount,start_date)
      VALUES (1,'Track A',100.00,UTC_DATE()-INTERVAL 5 DAY);
    INSERT INTO Membership (member_id,circle_id,joined_on)
      SELECT member_id,1,UTC_DATE()-INTERVAL 5 DAY FROM Member;
    INSERT INTO Cycle (cycle_id,circle_id,seq_no,status) VALUES (11,1,1,'open');
    INSERT INTO Contribution (member_id,cycle_id,payment_status) VALUES
      (1,11,'paid'),(2,11,'unpaid'),(3,11,'unknown');
  `);
  for (const circle of [2, ...Array.from({ length: trials }, (_, i) => i + 10)]) {
    const previous = circle * 10 + 1;
    const cycle = previous + 1;
    query(`
      INSERT INTO Circle (circle_id,name,contribution_amount,start_date,
          interval_value,interval_unit,discount_unit,discount_share_rule)
        VALUES (${circle},'Track B',100.00,UTC_DATE()-INTERVAL 5 DAY,1,'DAY',
          'PERCENT','EQUAL_NON_WINNERS');
      INSERT INTO Membership (member_id,circle_id,joined_on)
        SELECT member_id,${circle},UTC_DATE()-INTERVAL 5 DAY FROM Member;
      INSERT INTO Cycle (cycle_id,circle_id,seq_no,status,bidding_closes_at) VALUES
        (${previous},${circle},1,'closed',NULL),
        (${cycle},${circle},2,'open',UTC_TIMESTAMP()-INTERVAL 1 DAY);
      INSERT INTO Payout (cycle_id,member_id,paid_at)
        VALUES (${previous},1,UTC_TIMESTAMP()-INTERVAL 3 DAY);
      INSERT INTO Contribution (member_id,cycle_id,payment_status)
        VALUES (1,${cycle},'paid'),(2,${cycle},'paid'),(3,${cycle},'paid');
      INSERT INTO Bid (bid_id,member_id,cycle_id,discount_rate,submitted_at) VALUES
        (${cycle+1},1,${cycle},99.00,UTC_TIMESTAMP()-INTERVAL 2 DAY),
        (${cycle+2},2,${cycle},12.34,UTC_TIMESTAMP()-INTERVAL 2 DAY),
        (${cycle+3},3,${cycle},12.34,UTC_TIMESTAMP()-INTERVAL 2 DAY+INTERVAL 1 SECOND),
        (${cycle+4},4,${cycle},90.00,UTC_TIMESTAMP());
    `);
  }
}

function rollback(label, circle, cycle, winner, expectedError) {
  const before = state(circle, cycle);
  const error = query(`CALL d8_close_cycle(${cycle},4,${winner});`, { expectedError });
  const after = state(circle, cycle);
  console.log(label, '\nBEFORE', JSON.stringify(before), '\nERROR ', error,
    '\nAFTER ', JSON.stringify(after));
  assert.deepEqual(after, before);
  console.log('PASS: before and after match.');
}

async function run() {
  assert.ok(schemaFile && (!separator || separator === '--'),
    'Usage: node test_d8.js /path/to/schema_v2.sql -- --login-path=d8');
  const schema = readFileSync(schemaFile, 'utf8');
  const implementation = readFileSync(join(__dirname, 'd8_transactions.sql'), 'utf8');
  console.log('MySQL', query('SELECT VERSION();', { selectDatabase: false }));
  query(`CREATE DATABASE ${database};`, { selectDatabase: false });
  try {
    query(schema);
    fixture();
    query(implementation);
    rollback('Pot not funded', 1, 11, 1, /ERROR 1644 .*D8_POT_NOT_FUNDED/);
    query('CALL d8_record_paid(11,2); CALL d8_record_paid(11,3); CALL d8_close_cycle(11,4,1);');
    const trackA = state(1, 11);
    assert.deepEqual(trackA, {
      status: 'closed', bid: null, paid_total: '400.00',
      contributions: ['1=paid', '2=paid', '3=paid', '4=paid'],
      payout: [1], shares: [], 'turns/eligible': ['1/1/0', '2/0/1', '3/0/1', '4/0/1'],
    });
    console.log('PASS: Track A committed.');
    // Add a conflicting payout after backfilling legitimate payout history.
    query('INSERT INTO Payout VALUES (22,3,UTC_TIMESTAMP());');
    rollback('Duplicate payout', 2, 22, 'NULL', /ERROR 1062 .*Duplicate entry/);

    for (let circle = 10; circle < 10 + trials; circle++) {
      const cycle = circle * 10 + 2;
      assert.deepEqual(state(circle, cycle), {
        status: 'open', bid: null, paid_total: '300.00',
        contributions: ['1=paid', '2=paid', '3=paid'], payout: [], shares: [],
        'turns/eligible': ['1/1/0', '2/0/1', '3/0/1', '4/0/1'],
      });
      const result = await race(circle, cycle);
      const after = state(circle, cycle);
      assert.deepEqual(after, {
        status: 'closed', bid: cycle + 2, paid_total: '400.00',
        contributions: ['1=paid', '2=paid', '3=paid', '4=paid'],
        payout: [2], shares: ['1=16.46', '3=16.45', '4=16.45'],
        'turns/eligible': ['1/1/0', '2/1/0', '3/0/1', '4/0/1'],
      });
      const total = query(`SELECT SUM(amount) FROM DiscountShare WHERE payout_cycle_id=${cycle};`);
      const net = query(`SELECT winner_amount FROM v_PayoutAmounts WHERE cycle_id=${cycle};`);
      assert.equal(total, '49.36');
      assert.equal(net, '350.64');
      console.log(`cycle=${cycle} waiters=${result.waiters} outcomes=${result.outcomes.join(',')}`);
      if (circle === 10) {
        console.log('Sample rejection:', result.error);
        console.log('Sample committed state:', JSON.stringify(after));
      }
    }
    console.log(`PASS: ${trials} commits, ${trials} rejections, ${trials}/${trials} state checks.`);
  } finally {
    query(`DROP DATABASE ${database};`, { selectDatabase: false });
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
