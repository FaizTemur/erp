const express = require('express');
const router = express.Router();
const dbMod = require('../db/db');
const { ah } = require('../utils/asyncHandler');

router.post('/plots/:plotId/noc', ah(async (req, res) => {
  const currentOwnership = await dbMod.get(
    'SELECT * FROM ownership_history WHERE plot_id = ? AND is_current = 1',
    [req.params.plotId]
  );
  if (!currentOwnership) return res.status(404).json({ error: 'No current owner for this plot' });

  const contract = await dbMod.get(
    'SELECT * FROM sale_contracts WHERE ownership_id = ? ORDER BY contract_id DESC LIMIT 1',
    [currentOwnership.ownership_id]
  );
  if (!contract) return res.status(404).json({ error: 'No sale contract found for this plot' });

  const outstanding = await dbMod.get(
    `SELECT COALESCE(SUM(due_amount - paid_amount), 0) as balance
     FROM installment_schedule WHERE contract_id = ?`,
    [contract.contract_id]
  );

  if (outstanding.balance > 0.01) {
    return res.status(409).json({
      error: `Cannot issue NOC. Outstanding balance is Rs. ${outstanding.balance.toLocaleString()}. All installments must be cleared first.`,
      outstanding_balance: outstanding.balance
    });
  }

  const nocId = await dbMod.run(
    `INSERT INTO noc_certificates (plot_id, ownership_id, issue_date, issued_by)
     VALUES (?, ?, ?, ?)`,
    [req.params.plotId, currentOwnership.ownership_id, req.body.issue_date || new Date().toISOString().slice(0, 10), req.user.user_id]
  );

  res.status(201).json(await dbMod.get('SELECT * FROM noc_certificates WHERE noc_id = ?', [nocId]));
}));

router.get('/plots/:plotId/noc-status', ah(async (req, res) => {
  const currentOwnership = await dbMod.get(
    'SELECT * FROM ownership_history WHERE plot_id = ? AND is_current = 1',
    [req.params.plotId]
  );
  if (!currentOwnership) return res.json({ eligible: false, reason: 'No current owner' });

  const contract = await dbMod.get(
    'SELECT * FROM sale_contracts WHERE ownership_id = ? ORDER BY contract_id DESC LIMIT 1',
    [currentOwnership.ownership_id]
  );
  if (!contract) return res.json({ eligible: false, reason: 'No sale contract found' });

  const outstanding = await dbMod.get(
    `SELECT COALESCE(SUM(due_amount - paid_amount), 0) as balance
     FROM installment_schedule WHERE contract_id = ?`,
    [contract.contract_id]
  );

  const existingNoc = await dbMod.get(
    'SELECT * FROM noc_certificates WHERE ownership_id = ? ORDER BY noc_id DESC LIMIT 1',
    [currentOwnership.ownership_id]
  );

  res.json({
    eligible: outstanding.balance <= 0.01,
    outstanding_balance: outstanding.balance,
    already_issued: !!existingNoc,
    noc: existingNoc || null
  });
}));

module.exports = router;
