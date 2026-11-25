const service = require('../services/next-payout.service');
const {ApiError} = require('../middleware/errors');

module.exports.get = async (req, res) => {
  const value = req.query.cycle_id;
  let cycleId;
  if (Object.keys(req.query).some(key => key !== 'cycle_id')) {
    throw new ApiError(400, 'Only cycle_id is supported');
  }
  if (value !== undefined) {
    if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || Number(value) > 2147483647) {
      throw new ApiError(400, 'cycle_id must be a positive 32-bit integer');
    }
    cycleId = Number(value);
  }
  res.json(await service.get(req.resourceId, cycleId));
};
