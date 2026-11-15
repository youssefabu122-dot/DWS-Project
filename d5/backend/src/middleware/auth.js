// D9: authentication (JWT) and role-based authorization (RBAC), as in Lecture 11.
const jwt = require('jsonwebtoken');
const pool = require('../db/connection');
const {ApiError} = require('./errors');

const SECRET = process.env.JWT_SECRET;
if (!SECRET || SECRET.length < 32 || SECRET.startsWith('replace_with')) {
  throw new Error('JWT_SECRET must be set to a private random value (at least 32 characters)');
}
const ROLES = ['organizer', 'member'];

const sign = member => jwt.sign({sub: String(member.member_id), role: member.role},
  SECRET, {algorithm: 'HS256', expiresIn: '1h'});

// 401 unless a valid, unexpired token signed with our secret is sent.
// The role is taken from the database row, never from the request body.
async function authenticate(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  let payload;
  try {
    payload = jwt.verify(token, SECRET, {algorithms: ['HS256']}); // throws if invalid or expired
  } catch {
    return next(new ApiError(401, 'Unauthenticated')); // fail-safe: deny
  }
  // Fail-safe: a deleted account or a changed role invalidates old tokens.
  const [rows] = await pool.execute('SELECT member_id, role FROM Member WHERE member_id = ?', [Number(payload.sub)]);
  if (!rows.length || rows[0].role !== payload.role || !ROLES.includes(rows[0].role)) {
    return next(new ApiError(401, 'Unauthenticated'));
  }
  req.user = {id: rows[0].member_id, role: rows[0].role};
  next();
}

function requireRole(role) {
  return (req, res, next) =>
    req.user && req.user.role === role ? next() : next(new ApiError(403, 'Forbidden'));
}

const isOrganizer = req => req.user.role === 'organizer';

// Broken-access-control defence: members may only reach their own circles.
async function assertCircleAccess(req, circleId) {
  if (isOrganizer(req)) return;
  const [m] = await pool.execute('SELECT 1 FROM Membership WHERE circle_id = ? AND member_id = ?', [circleId, req.user.id]);
  if (!m.length) throw new ApiError(403, 'Forbidden');
}

// Route guards built on the checks above (URL :id already validated by validate.id).
const circleAccess = async (req, res, next) => { await assertCircleAccess(req, req.resourceId); next(); };

const cycleAccess = async (req, res, next) => {
  const [c] = await pool.execute('SELECT circle_id FROM Cycle WHERE cycle_id = ?', [req.resourceId]);
  if (!c.length) throw new ApiError(isOrganizer(req) ? 404 : 403, isOrganizer(req) ? 'Cycle not found' : 'Forbidden');
  await assertCircleAccess(req, c[0].circle_id);
  next();
};

const selfOrOrganizer = (req, res, next) =>
  isOrganizer(req) || req.user.id === req.resourceId ? next() : next(new ApiError(403, 'Forbidden'));

// A member may only act for themselves (own bid, own contribution).
const ownMemberId = (req, res, next) =>
  isOrganizer(req) || req.validated.member_id === req.user.id ? next() : next(new ApiError(403, 'Forbidden'));

module.exports = {sign, authenticate, requireRole, isOrganizer, assertCircleAccess,
  circleAccess, cycleAccess, selfOrOrganizer, ownMemberId};
