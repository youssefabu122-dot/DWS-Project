const service = require('../services/payouts.service');
module.exports = {
  list: async (req,res) => res.json(await service.list()),
  get: async (req,res) => res.json(await service.get(req.resourceId)),
  create: async (req,res) => {const row = await service.create(req.validated); res.location('/payouts/' + row.cycle_id).status(201).json(row);},
  update: async (req,res) => res.json(await service.update(req.resourceId,req.validated)),
  remove: async (req,res) => {await service.remove(req.resourceId);res.status(204).end();}
};
