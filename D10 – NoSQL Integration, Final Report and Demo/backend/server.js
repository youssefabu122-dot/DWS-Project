require('dotenv').config();
const app = require('./src/app');
const pool = require('./src/db/connection');
const mongo = require('./src/db/mongo');
const bids = require('./src/services/bids.service');
const outbox = require('./src/services/outbox.worker');
let timer, running = false;
async function scan() {
  if (running) return;
  running = true;
  try {await bids.closeReadyCycles();}
  catch (err) {console.error('Bid scan failed:',err.code || err.name);}
  finally {running = false;}
}
// Outbox worker: a failure only delays the feed; rows are retried later.
let feedTimer, publishing = false;
async function publishFeed() {
  if (publishing) return;
  publishing = true;
  try {await outbox.publishPending();}
  catch (err) {console.error('Feed publish failed:',err.code || err.name);}
  finally {publishing = false;}
}
async function start() {
  await pool.execute('SELECT 1',[]);
  const server = app.listen(Number(process.env.PORT || 3000),()=>console.log('Server running'));
  await scan();
  timer = setInterval(scan,Number(process.env.BID_SCAN_INTERVAL_MS || 1000));
  timer.unref();
  feedTimer = setInterval(publishFeed,Number(process.env.OUTBOX_INTERVAL_MS || 1000));
  feedTimer.unref();
  let stopping = false;
  const shutdown = () => {
    if (stopping) return; stopping = true; clearInterval(timer); clearInterval(feedTimer);
    server.close(async ()=>{while(running || publishing) await new Promise(resolve=>setTimeout(resolve,50));await pool.end();await mongo.client.close();});
  };
  process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
}
start().catch(err=>{console.error('Startup failed:',err.code || err.name);process.exitCode=1;pool.end();mongo.client.close();});
