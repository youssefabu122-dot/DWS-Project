const service = require('../services/circles.service');
const {isOrganizer} = require('../middleware/auth');
module.exports = {
  // D9: members only see the circles they belong to.
  list: async (req,res) => res.json(await service.list(isOrganizer(req) ? undefined : req.user.id)),
  get: async (req,res) => res.json(await service.get(req.resourceId)),
  create: async (req,res) => {const row = await service.create(req.validated); res.location('/circles/' + row.circle_id).status(201).json(row);},
  update: async (req,res) => res.json(await service.update(req.resourceId,req.validated)),
  remove: async (req,res) => {await service.remove(req.resourceId);res.status(204).end();}
};
// D9 confidentiality: members see other members' names, but not their e-mail addresses.
module.exports.getMembers = async (req,res) => {
  const rows = await service.getMembers(req.resourceId);
  res.json(isOrganizer(req) ? rows : rows.map(({email, ...rest}) => rest));
};
module.exports.getCycles = async (req,res) => res.json(await service.getCycles(req.resourceId));
module.exports.createCycle = async (req,res) => res.status(201).json(await service.createCycle(req.resourceId));
