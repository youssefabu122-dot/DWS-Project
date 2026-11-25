const service = require('../services/bids.service');
const bidding = require('../services/bidding.service');
const {ApiError} = require('../middleware/errors');
const ACTIONS = ['extend','reopen','new_cycle','random_winner'];
module.exports = {
  // 201 for a first bid, 200 for a raise.
  create: async (req,res) => {const row = await service.create(req.resourceId,req.validated); res.status(row.action === 'raised' ? 200 : 201).json(row);},
  ranking: async (req,res) => res.json(await service.ranking(req.resourceId)),
  history: async (req,res) => res.json(await service.history(req.resourceId)),
  // {"action": "extend"|"reopen", "minutes": 1-10080} or {"action": "new_cycle"|"random_winner"}
  decide: async (req,res) => {
    if (!req.is('application/json')) throw new ApiError(415,'Use Content-Type: application/json');
    const b = req.body;
    if (!b || typeof b !== 'object' || Array.isArray(b)) throw new ApiError(400,'Body must be a JSON object');
    const needsMinutes = b.action === 'extend' || b.action === 'reopen';
    const errors = Object.keys(b).filter(k => !['action','minutes'].includes(k)).map(k => `Unknown field: ${k}`);
    if (!ACTIONS.includes(b.action)) errors.push(`action must be one of ${ACTIONS.join(', ')}`);
    if (needsMinutes && !(Number.isInteger(b.minutes) && b.minutes >= 1 && b.minutes <= 10080)) errors.push('minutes must be an integer from 1 to 10080');
    if (!needsMinutes && b.minutes !== undefined) errors.push('minutes is only used with extend or reopen');
    if (errors.length) return res.status(400).json({errors});
    res.json(await bidding.act(req.resourceId, req.user, {action:b.action, minutes:b.minutes}));
  }
};
