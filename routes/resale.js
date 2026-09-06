const express = require('express');
const router = express.Router();
const dbMod = require('../db/db');
const { ah } = require('../utils/asyncHandler');

// Record a buy-back (society repurchases the plot from current owner)
router.post('/plots/:plotId/buyback', ah(async (req, res) => {
  const { amount, txn_date } = req.body;
  if (!amount || !txn_date) return res.status(400).json({ error: 'amount and txn_date are required' });

  const currentOwnership = await dbMod.get(
    'SELECT * FROM ownership_history WHERE plot_id = ? AND is_current = 1',
    [req.params.plotId]
  );
  if (!currentOwnership) return res.status(404).json({ error: 'No current owner to buy back from' });

  // Close the ownership period
  await dbMod.run('UPDATE ownership_history SET is_current = 0, end_date = ? WHERE ownership_id = ?',
    [txn_date, currentOwnership.ownership_id]);
  await dbMod.run('UPDATE plots SET status = ? WHERE plot_id = ?', ['bought_back', req.params.plotId]);

  const txnId = await dbMod.run(
    `INSERT INTO buyback_resale (plot_id, txn_type, txn_date, amount, related_ownership_id)
     VALUES (?, 'buy_back', ?, ?, ?)`,
    [req.params.plotId, txn_date, amount, currentOwnership.ownership_id]
  );

  res.status(201).json(await dbMod.get('SELECT * FROM buyback_resale WHERE txn_id = ?', [txnId]));
}));

// Resell a bought-back plot to a new customer, auto-computing and posting profit/loss
router.post('/plots/:plotId/resale', ah(async (req, res) => {
  const { new_customer_id, amount, txn_date } = req.body;
  if (!new_customer_id || !amount || !txn_date) {
    return res.status(400).json({ error: 'new_customer_id, amount, and txn_date are required' });
  }

  const lastBuyback = await dbMod.get(
    `SELECT * FROM buyback_resale WHERE plot_id = ? AND txn_type = 'buy_back' ORDER BY txn_id DESC LIMIT 1`,
    [req.params.plotId]
  );
  if (!lastBuyback) return res.status(409).json({ error: 'This plot was never bought back — nothing to resell.' });

  const profitLoss = amount - lastBuyback.amount;

  // Open new ownership period for the buyer
  const newOwnershipId = await dbMod.run(
    `INSERT INTO ownership_history (plot_id, customer_id, start_date, is_current, acquisition_type)
     VALUES (?, ?, ?, 1, 'resale')`,
    [req.params.plotId, new_customer_id, txn_date]
  );
  await dbMod.run('UPDATE plots SET status = ? WHERE plot_id = ?', ['sold', req.params.plotId]);

  // Post the profit/loss to the ledger automatically
  const voucherNo = `RSL-${Date.now()}`;
  const voucherId = await dbMod.run(
    `INSERT INTO vouchers (voucher_type, voucher_no, voucher_date, narration)
     VALUES ('journal', ?, ?, ?)`,
    [voucherNo, txn_date, `Resale of plot #${req.params.plotId}: bought back at ${lastBuyback.amount}, resold at ${amount}`]
  );

  const cashAccount = await dbMod.get(`SELECT account_id FROM chart_of_accounts WHERE account_code = '1100'`);
  const plAccount = profitLoss >= 0
    ? await dbMod.get(`SELECT account_id FROM chart_of_accounts WHERE account_code = '4200'`)
    : await dbMod.get(`SELECT account_id FROM chart_of_accounts WHERE account_code = '5200'`);

  await dbMod.run('INSERT INTO voucher_entries (voucher_id, account_id, debit, credit) VALUES (?, ?, ?, ?)',
    [voucherId, cashAccount.account_id, Math.abs(profitLoss), 0]);
  await dbMod.run('INSERT INTO voucher_entries (voucher_id, account_id, debit, credit) VALUES (?, ?, ?, ?)',
    [voucherId, plAccount.account_id, 0, Math.abs(profitLoss)]);

  const txnId = await dbMod.run(
    `INSERT INTO buyback_resale (plot_id, txn_type, txn_date, amount, related_ownership_id, profit_loss_amount, voucher_id)
     VALUES (?, 'resale', ?, ?, ?, ?, ?)`,
    [req.params.plotId, txn_date, amount, newOwnershipId, profitLoss, voucherId]
  );

  res.status(201).json({
    ...await dbMod.get('SELECT * FROM buyback_resale WHERE txn_id = ?', [txnId]),
    posted_to_voucher: voucherNo
  });
}));

router.get('/plots/:plotId/buyback-history', ah(async (req, res) => {
  res.json(await dbMod.all('SELECT * FROM buyback_resale WHERE plot_id = ? ORDER BY txn_id', [req.params.plotId]));
}));

module.exports = router;
