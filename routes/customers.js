const express = require('express');
const router = express.Router();
const dbMod = require('../db/db');
const { ah } = require('../utils/asyncHandler');

router.get('/customers', ah(async (req, res) => {
  const { search } = req.query;
  if (search) {
    res.json(await dbMod.all(
      `SELECT * FROM customers WHERE full_name LIKE ? OR cnic LIKE ? OR phone LIKE ?
       ORDER BY customer_id DESC`,
      [`%${search}%`, `%${search}%`, `%${search}%`]
    ));
  } else {
    res.json(await dbMod.all('SELECT * FROM customers ORDER BY customer_id DESC'));
  }
}));

router.get('/customers/:id', ah(async (req, res) => {
  const customer = await dbMod.get('SELECT * FROM customers WHERE customer_id = ?', [req.params.id]);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });

  // Customer's full ledger across all plots/ownership periods they've held
  const ownerships = await dbMod.all(
    `SELECT oh.*, p.plot_code, p.plot_number
     FROM ownership_history oh
     JOIN plots p ON oh.plot_id = p.plot_id
     WHERE oh.customer_id = ?`,
    [req.params.id]
  );

  res.json({ ...customer, ownership_history: ownerships });
}));

router.post('/customers', ah(async (req, res) => {
  const { full_name, father_name, cnic, phone, whatsapp_number, address, photo_path, biometric_ref } = req.body;
  if (!full_name) return res.status(400).json({ error: 'full_name is required' });

  const id = await dbMod.run(
    `INSERT INTO customers (full_name, father_name, cnic, phone, whatsapp_number, address, photo_path, biometric_ref)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [full_name, father_name || null, cnic || null, phone || null, whatsapp_number || null,
     address || null, photo_path || null, biometric_ref || null]
  );
  res.status(201).json(await dbMod.get('SELECT * FROM customers WHERE customer_id = ?', [id]));
}));

router.put('/customers/:id', ah(async (req, res) => {
  const fields = ['full_name', 'father_name', 'cnic', 'phone', 'whatsapp_number', 'address', 'photo_path', 'biometric_ref'];
  const updates = [];
  const params = [];
  fields.forEach(f => {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      params.push(req.body[f]);
    }
  });
  if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
  params.push(req.params.id);
  await dbMod.run(`UPDATE customers SET ${updates.join(', ')} WHERE customer_id = ?`, params);
  res.json(await dbMod.get('SELECT * FROM customers WHERE customer_id = ?', [req.params.id]));
}));

module.exports = router;
