const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const dbMod = require('../db/db');
const { ah } = require('../utils/asyncHandler');
const { hashPassword, makeSalt, verifyPassword } = require('./password');

// Netlify Functions don't keep server-side session state between requests
// (each invocation can run in a different container), so instead of
// express-session we sign a JWT and store it in an httpOnly cookie. The
// cookie itself carries the identity - no server-side session store needed.
const JWT_SECRET = process.env.JWT_SECRET;
const COOKIE_NAME = 'hs_erp_token';
const TOKEN_MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8 hours

function requireJwtSecret() {
  if (!JWT_SECRET) {
    throw new Error(
      'JWT_SECRET is not set. Set a long random string as the JWT_SECRET environment ' +
      'variable in your Netlify site settings (see DEPLOY.md).'
    );
  }
}

function signToken(user) {
  requireJwtSecret();
  return jwt.sign(
    { user_id: user.user_id, username: user.username, full_name: user.full_name, role: user.role },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
}

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: TOKEN_MAX_AGE_MS,
    path: '/'
  });
}

// One-time setup: only works if no users exist yet
router.post('/setup', ah(async (req, res) => {
  const existing = await dbMod.get('SELECT COUNT(*) as cnt FROM users');
  if (existing.cnt > 0) {
    return res.status(403).json({ error: 'Setup already completed. Use /login instead.' });
  }
  const { username, password, full_name } = req.body;
  if (!username || !password || !full_name) {
    return res.status(400).json({ error: 'username, password, and full_name are required' });
  }
  const salt = makeSalt();
  const password_hash = hashPassword(password, salt);
  const id = await dbMod.run(
    `INSERT INTO users (username, password_hash, salt, full_name, role) VALUES (?, ?, ?, ?, 'admin')`,
    [username, password_hash, salt, full_name]
  );
  const user = { user_id: id, username, full_name, role: 'admin' };
  setAuthCookie(res, signToken(user));
  res.status(201).json(user);
}));

router.get('/setup/status', ah(async (req, res) => {
  const existing = await dbMod.get('SELECT COUNT(*) as cnt FROM users');
  res.json({ setup_complete: existing.cnt > 0 });
}));

router.post('/login', ah(async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username and password are required' });

  const user = await dbMod.get('SELECT * FROM users WHERE username = ? AND is_active = 1', [username]);
  if (!user || !verifyPassword(password, user.salt, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const payload = { user_id: user.user_id, username: user.username, full_name: user.full_name, role: user.role };
  setAuthCookie(res, signToken(payload));
  res.json(payload);
}));

router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
});

router.get('/me', requireAuth, ah(async (req, res) => {
  const user = await dbMod.get('SELECT user_id, username, full_name, role FROM users WHERE user_id = ?', [req.user.user_id]);
  if (!user) return res.status(401).json({ error: 'Not logged in' });
  res.json(user);
}));

// Middleware to protect other API routes - verifies the JWT cookie and
// attaches the decoded identity to req.user (replaces req.session.userId)
function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Not logged in' });
  try {
    requireJwtSecret();
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Session expired, please sign in again' });
  }
}

module.exports = { router, requireAuth };
