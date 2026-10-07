require('dotenv').config();
const express = require('express');
const cors = require('cors');
const {rateLimit} = require('express-rate-limit');
const {ApiError,errorHandler} = require('./middleware/errors');
const app = express();

app.disable('x-powered-by');


const origins = (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map(s=>s.trim()).filter(Boolean);
for (const origin of origins) {
  const url = new URL(origin);
  if (!['http:','https:'].includes(url.protocol) || url.origin !== origin) throw new Error('CORS_ORIGINS must contain exact HTTP origins');
}


for (const key of ['RATE_LIMIT_WINDOW_MS','RATE_LIMIT_MAX','BID_SCAN_INTERVAL_MS','PORT','DB_PORT']) {
  if (process.env[key] !== undefined && (!Number.isSafeInteger(Number(process.env[key])) || Number(process.env[key]) <= 0)) throw new Error(`Invalid ${key}`);
}


if (origins.includes('*')) throw new Error('CORS_ORIGINS must list explicit origins');


app.use(cors({origin(origin,callback) {
  if (!origin || origins.includes(origin)) return callback(null,true);
  callback(new ApiError(403,'Origin is not allowed'));
}, methods:['GET','POST','PUT','DELETE','OPTIONS'],allowedHeaders:['Content-Type'],exposedHeaders:['Location']}));


app.use(rateLimit({windowMs:Number(process.env.RATE_LIMIT_WINDOW_MS || 60000),limit:Number(process.env.RATE_LIMIT_MAX || 100),standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Too many requests; try again later'}}));
app.use(express.json({limit:'16kb'}));
app.use('/members',require('./routes/members.routes'));
app.use('/circles',require('./routes/circles.routes'));

app.use('/contributions',require('./routes/contributions.routes'));
app.use('/payouts',require('./routes/payouts.routes'));
app.use('/cycles',require('./routes/bids.routes'));
app.use((req,res)=>res.status(404).json({error:'Route not found'}));
app.use(errorHandler);
module.exports = app;
