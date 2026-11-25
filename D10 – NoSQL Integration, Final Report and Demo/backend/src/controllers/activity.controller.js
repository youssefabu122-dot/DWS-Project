const service = require('../services/activity.service');
const {ApiError} = require('../middleware/errors');

// GET /circles/:id/activity?limit=20&before=<ISO time>
module.exports.list = async (req, res) => {
  const {limit = '20', before} = req.query;
  if (Object.keys(req.query).some(key => !['limit', 'before'].includes(key))) throw new ApiError(400, 'Only limit and before are supported');
  if (typeof limit !== 'string' || !/^\d{1,2}$/.test(limit) || Number(limit) < 1 || Number(limit) > 50) {
    throw new ApiError(400, 'limit must be an integer from 1 to 50');
  }
  let beforeDate;
  if (before !== undefined) {
    beforeDate = typeof before === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(before) ? new Date(before) : null;
    if (!beforeDate || isNaN(beforeDate)) throw new ApiError(400, 'before must be an ISO time such as 2026-11-22T10:00:00.000Z');
  }
  const events = await service.list(req.resourceId, req.user, {limit: Number(limit), before: beforeDate});
  res.json({circle_id: req.resourceId, count: events.length, events});
};
