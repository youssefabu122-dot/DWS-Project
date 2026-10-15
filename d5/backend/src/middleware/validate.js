const {ApiError} = require('./errors');
const integer = v => typeof v === 'number' && Number.isInteger(v) && v > 0 && v <= 2147483647;
const text = (v, max) => typeof v === 'string' && v.trim().length > 0 && [...v.trim()].length <= max;
const money = (v, max) => (typeof v === 'number' || typeof v === 'string') && /^\d+(\.\d{1,2})?$/.test(String(v)) && Number(v) > 0 && Number(v) <= max;
function date(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number(v.slice(0,4)) < 1000) return false;
  const d = new Date(v + 'T00:00:00Z'); return !isNaN(d) && d.toISOString().slice(0,10) === v;
}
const rules = {
  name: v => text(v,100),
  email: v => text(v,150) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()),
  contribution_amount: v => money(v,99999999.99), start_date: date,
  member_id: integer, cycle_id: integer,
  discount_rate: v => money(v,100),
  paid_at: v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(v) && date(v.slice(0,10)) && Number(v.slice(11,13)) < 24 && Number(v.slice(14,16)) < 60 && Number(v.slice(17,19)) < 60
};
const fields = {
  members: ['name','email'], circles: ['name','contribution_amount','start_date'],
  contributions: ['member_id','cycle_id'], payouts: ['cycle_id','member_id','paid_at'],
  bids: ['member_id','discount_rate']
};
function id(req,res,next) {
  if (!/^[1-9]\d*$/.test(req.params.id) || !integer(Number(req.params.id))) return next(new ApiError(400,'id must be a positive 32-bit integer'));
  req.resourceId = Number(req.params.id); next();
}
function body(resource) {
  return (req,res,next) => {
    if (!req.is('application/json')) return next(new ApiError(415,'Use Content-Type: application/json'));
    const b = req.body;
    if (!b || typeof b !== 'object' || Array.isArray(b)) return next(new ApiError(400,'Body must be a JSON object'));
    const allowed = fields[resource];
    const errors = Object.keys(b).filter(k => !allowed.includes(k)).map(k => `Unknown field: ${k}`);
    for (const k of allowed) if (!rules[k](b[k])) errors.push(`Missing or invalid ${k}`);
    if (resource === 'payouts' && req.method === 'PUT' && b.cycle_id !== req.resourceId) errors.push('cycle_id must match URL id');
    if (errors.length) return res.status(400).json({errors});
    req.validated = Object.fromEntries(allowed.map(k => [k,typeof b[k] === 'string' ? b[k].trim() : b[k]])); next();
  };
}
module.exports = {id, body};
