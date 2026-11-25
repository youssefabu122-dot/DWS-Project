// Runs once when the MongoDB volume is first created: the activity feed collection, its index
// and a least-privilege app account. The validator checks only the envelope; `data` may hold
// any nested objects and arrays without a schema change.
const feed = db.getSiblingDB('rosca_feed');

feed.createCollection('activity_events', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['_id', 'schema_version', 'type', 'circle_id', 'occurred_at', 'seq', 'actor', 'data'],
      properties: {
        _id: {bsonType: 'string', description: 'event_id from the MySQL outbox'},
        schema_version: {bsonType: 'int'},
        type: {bsonType: 'string', pattern: '^[a-z]+\\.[a-z_]+$'},
        circle_id: {bsonType: ['int', 'long']},
        cycle_id: {bsonType: ['int', 'long']},
        occurred_at: {bsonType: 'date'},
        seq: {bsonType: ['int', 'long']},
        actor: {bsonType: 'object', required: ['role'], properties: {role: {enum: ['member', 'organizer', 'system']}}},
        data: {bsonType: 'object'}
      }
    }
  },
  validationLevel: 'strict',
  validationAction: 'error'
});

feed.activity_events.createIndex({circle_id: 1, occurred_at: -1, seq: -1}, {name: 'circle_newest_first'});

feed.createRole({
  role: 'feedWriter',
  privileges: [{resource: {db: 'rosca_feed', collection: 'activity_events'}, actions: ['find', 'insert', 'update']}],
  roles: []
});
feed.createUser({user: 'rosca_feed', pwd: process.env.MONGO_APP_PASSWORD, roles: [{role: 'feedWriter', db: 'rosca_feed'}]});
