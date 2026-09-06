const express = require('express');
const router = express.Router();
const dbMod = require('../db/db');
const { ah } = require('../utils/asyncHandler');

router.get('/charge-types', ah(async (req, res) => {
  res.json(await dbMod.all('SELECT * FROM charge_types'));
}));

router.get('/plots/:plotId/charges', ah(async (req, res) => {
  const charges = await dbMod.all(
    `SELECT pc.*, ct.charge_name FROM plot_charges pc
     JOIN charge_types ct ON pc.charge_type_id = ct.charge_type_id
     WHERE pc.plot_id = ?`,
    [req.params.plotId]
  );
  res.json(charges);
}));

router.post('/plots/:plotId/charges', ah(async (req, res) => {
  const { charge_type_id, amount } = req.body;
  if (!charge_type_id || !amount) return res.status(400).json({ error: 'charge_type_id and amount are required' });
  const id = await dbMod.run(
    'INSERT INTO plot_charges (plot_id, charge_type_id, amount) VALUES (?, ?, ?)',
    [req.params.plotId, charge_type_id, amount]
  );
  res.status(201).json(await dbMod.get('SELECT * FROM plot_charges WHERE plot_charge_id = ?', [id]));
}));

module.exports = router;
