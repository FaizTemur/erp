const express = require('express');
const router = express.Router();
const dbMod = require('../db/db');
const { ah } = require('../utils/asyncHandler');

router.get('/brokers', ah(async (req, res) => {
  res.json(await dbMod.all('SELECT * FROM brokers ORDER BY broker_id DESC'));
}));

router.post('/brokers', ah(async (req, res) => {
  const { full_name, phone, cnic, commission_rate } = req.body;
  if (!full_name) return res.status(400).json({ error: 'full_name is required' });
  const id = await dbMod.run(
    'INSERT INTO brokers (full_name, phone, cnic, commission_rate) VALUES (?, ?, ?, ?)',
    [full_name, phone || null, cnic || null, commission_rate || 1.0]
  );
  res.status(201).json(await dbMod.get('SELECT * FROM brokers WHERE broker_id = ?', [id]));
}));

module.exports = router;
