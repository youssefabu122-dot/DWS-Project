// D9: POST /login (public). Compares the password with the stored bcrypt hash
// and returns a short-lived JWT. Same message for unknown e-mail and wrong password.
const router = require('express').Router();
const bcrypt = require('bcrypt');
const {rateLimit} = require('express-rate-limit');
const pool = require('../db/connection');
const {body} = require('../middleware/validate');
const {sign} = require('../middleware/auth');
const {ApiError} = require('../middleware/errors');

// Against login guessing: at most 10 failed attempts per IP per 15 minutes.
const limiter = rateLimit({windowMs: 15 * 60 * 1000, limit: 10, skipSuccessfulRequests: true,
  standardHeaders: 'draft-8', legacyHeaders: false, message: {error: 'Too many login attempts; try again later'}});

// Compared when the e-mail is unknown, so both cases take the same time.
const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEeO5tN0nDVDBNO4c2D7XyQkS1Jg4bQ6nZW';

router.post('/', limiter, body('login'), async (req, res) => {
  const {email, password} = req.validated;
  const [rows] = await pool.execute('SELECT member_id, name, password_hash, role FROM Member WHERE email = ?', [email]);
  const ok = await bcrypt.compare(password, rows.length ? rows[0].password_hash : DUMMY_HASH);
  if (!rows.length || !ok) throw new ApiError(401, 'Invalid credentials');
  const user = rows[0];
  res.json({token: sign(user), member_id: user.member_id, name: user.name, role: user.role});
});

module.exports = router;
