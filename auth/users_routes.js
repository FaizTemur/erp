const express = require('express');
const router = express.Router();
const dbMod = require('../db/db');
const { ah } = require('../utils/asyncHandler');
const { hashPassword, makeSalt } = require('../auth/password');

router.get('/users', ah(async (req, res) => {
  res.json(await dbMod.all('SELECT user_id, username, full_name, role, is_active, created_at FROM users ORDER BY user_id'));
}));

router.post('/users', ah(async (req, res) => {
  const { username, password, full_name, role } = req.body;
  if (!username || !password || !full_name) {
    return res.status(400).json({ error: 'username, password, and full_name are required' });
  }
  const existing = await dbMod.get('SELECT user_id FROM users WHERE username = ?', [username]);
  if (existing) return res.status(409).json({ error: 'Username already exists' });

  const salt = makeSalt();
  const password_hash = hashPassword(password, salt);
  const id = await dbMod.run(
    `INSERT INTO users (username, password_hash, salt, full_name, role) VALUES (?, ?, ?, ?, ?)`,
    [username, password_hash, salt, full_name, role || 'staff']
  );
  res.status(201).json(await dbMod.get('SELECT user_id, username, full_name, role, is_active FROM users WHERE user_id = ?', [id]));
}));

router.put('/users/:id/toggle-active', ah(async (req, res) => {
  const user = await dbMod.get('SELECT * FROM users WHERE user_id = ?', [req.params.id]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  await dbMod.run('UPDATE users SET is_active = ? WHERE user_id = ?', [user.is_active ? 0 : 1, req.params.id]);
  res.json(await dbMod.get('SELECT user_id, username, full_name, role, is_active FROM users WHERE user_id = ?', [req.params.id]));
}));

module.exports = router;
