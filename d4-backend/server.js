require('dotenv').config();
const app = require('./src/app');
const pool = require('./src/db/connection');
const bids = require('./src/services/bids.service');
let timer, running = false;
async function scan() {
  if (running) return;
  running = true;
  try {await bids.closeReadyCycles();}
  catch (err) {console.error('Bid scan failed:',err.code || err.name);}
  finally {running = false;}
}
async function start() {
  await pool.execute('SELECT 1',[]);
  const server = app.listen(Number(process.env.PORT || 3000),()=>console.log('Server running'));
  await scan();
  timer = setInterval(scan,Number(process.env.BID_SCAN_INTERVAL_MS || 30000));
  timer.unref();
  let stopping = false;
  const shutdown = () => {
    if (stopping) return; stopping = true; clearInterval(timer);
    server.close(async ()=>{while(running) await new Promise(resolve=>setTimeout(resolve,50));await pool.end();});
  };
  process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
}
start().catch(err=>{console.error('Startup failed:',err.code || err.name);process.exitCode=1;pool.end();});
