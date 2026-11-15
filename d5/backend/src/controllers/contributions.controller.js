const service = require('../services/contributions.service');
const {isOrganizer} = require('../middleware/auth');
const {ApiError} = require('../middleware/errors');
module.exports = {
  // D9: members only see their own contribution records.
  list: async (req,res) => {
    const rows = await service.list();
    res.json(isOrganizer(req) ? rows : rows.filter(r => r.member_id === req.user.id));
  },
  get: async (req,res) => {
    const row = await service.get(req.resourceId);
    if (!isOrganizer(req) && row.member_id !== req.user.id) throw new ApiError(403,'Forbidden');
    res.json(row);
  },
  create: async (req,res) => {const row = await service.create(req.validated); res.location('/contributions/' + row.contribution_id).status(201).json(row);},
  update: async (req,res) => res.json(await service.update(req.resourceId,req.validated)),
  remove: async (req,res) => {await service.remove(req.resourceId);res.status(204).end();}
};
