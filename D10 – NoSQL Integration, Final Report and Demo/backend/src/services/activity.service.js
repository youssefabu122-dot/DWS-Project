const mongo = require('../db/mongo');
const {ApiError} = require('../middleware/errors');

// Open bidding: members see bidder names and rates, as in the D9 ranking (circleAccess
// already checked membership). Only discount shares are confidential: a member sees just
// their own share, the organizer sees all.
function redact(doc, user) {
  if (user.role === 'organizer' || !Array.isArray(doc.data?.discount_shares)) return doc;
  return {...doc, data: {...doc.data, discount_shares: doc.data.discount_shares.filter(s => s.member_id === user.id)}};
}

async function list(circleId, user, {limit, before}) {
  const filter = {circle_id: circleId};
  if (before) filter.occurred_at = {$lt: before};
  let docs;
  try {
    docs = await mongo.events().find(filter, {projection: {stored_at: 0}})
      .sort({occurred_at: -1, seq: -1}).limit(limit).toArray();
  } catch {
    // Only the feed becomes unavailable; every MySQL route keeps working.
    throw new ApiError(503, 'Activity feed is temporarily unavailable');
  }
  return docs.map(doc => redact(doc, user));
}

module.exports = {list, redact};
