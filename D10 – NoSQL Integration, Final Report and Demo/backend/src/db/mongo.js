// The driver connects lazily and reconnects by itself, so the API keeps serving
// the MySQL routes even while MongoDB (activity feed only) is down.
const {MongoClient} = require('mongodb');
require('dotenv').config();

const {MONGO_HOST, MONGO_PORT = '27017', MONGO_USER, MONGO_PASSWORD, MONGO_DB = 'rosca_feed'} = process.env;
if (!MONGO_HOST || !MONGO_USER || !MONGO_PASSWORD) throw new Error('MONGO_HOST, MONGO_USER and MONGO_PASSWORD must be set');

const url = `mongodb://${encodeURIComponent(MONGO_USER)}:${encodeURIComponent(MONGO_PASSWORD)}@${MONGO_HOST}:${Number(MONGO_PORT)}/${MONGO_DB}?authSource=${MONGO_DB}`;
const client = new MongoClient(url, {serverSelectionTimeoutMS: 2000, connectTimeoutMS: 2000, appName: 'rosca-backend'});

module.exports = {
  client,
  events: () => client.db(MONGO_DB).collection('activity_events')
};
