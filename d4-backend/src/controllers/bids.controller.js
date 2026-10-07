const service = require('../services/bids.service');
module.exports = {
  create: async (req,res) => res.status(201).json(await service.create(req.resourceId,req.validated)),

  ranking: async (req,res) => res.json(await service.ranking(req.resourceId))
};
