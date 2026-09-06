const express = require('express');
const router = express.Router();
const dbMod = require('../db/db');
const { ah } = require('../utils/asyncHandler');

router.get('/accounts', ah(async (req, res) => {
  res.json(await dbMod.all('SELECT * FROM chart_of_accounts ORDER BY account_code'));
}));

router.post('/accounts', ah(async (req, res) => {
  const { account_code, account_name, parent_account_id, level, account_type } = req.body;
  if (!account_code || !account_name || !level) {
    return res.status(400).json({ error: 'account_code, account_name, and level are required' });
  }
  const id = await dbMod.run(
    `INSERT INTO chart_of_accounts (account_code, account_name, parent_account_id, level, account_type)
     VALUES (?, ?, ?, ?, ?)`,
    [account_code, account_name, parent_account_id || null, level, account_type || null]
  );
  res.status(201).json(await dbMod.get('SELECT * FROM chart_of_accounts WHERE account_id = ?', [id]));
}));

// Create a voucher with balanced debit/credit entries
router.post('/vouchers', ah(async (req, res) => {
  const { voucher_type, voucher_date, narration, entries, contract_id, installment_id } = req.body;
  if (!voucher_type || !voucher_date || !Array.isArray(entries) || entries.length < 2) {
    return res.status(400).json({ error: 'voucher_type, voucher_date, and at least 2 entries are required' });
  }
  const totalDebit = entries.reduce((s, e) => s + (Number(e.debit) || 0), 0);
  const totalCredit = entries.reduce((s, e) => s + (Number(e.credit) || 0), 0);
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    return res.status(400).json({ error: `Voucher does not balance: debit ${totalDebit} vs credit ${totalCredit}` });
  }

  const voucher_no = `${voucher_type.toUpperCase().slice(0, 3)}-${Date.now()}`;
  const voucherId = await dbMod.run(
    `INSERT INTO vouchers (voucher_type, voucher_no, voucher_date, narration, contract_id, installment_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [voucher_type, voucher_no, voucher_date, narration || null, contract_id || null, installment_id || null]
  );

  for (const e of entries) {
    await dbMod.run(
      'INSERT INTO voucher_entries (voucher_id, account_id, debit, credit) VALUES (?, ?, ?, ?)',
      [voucherId, e.account_id, e.debit || 0, e.credit || 0]
    );
  }

  res.status(201).json({ voucher_id: voucherId, voucher_no });
}));

router.get('/vouchers', ah(async (req, res) => {
  const vouchers = await dbMod.all('SELECT * FROM vouchers ORDER BY voucher_id DESC LIMIT 100');
  res.json(vouchers);
}));

router.get('/vouchers/:id', ah(async (req, res) => {
  const voucher = await dbMod.get('SELECT * FROM vouchers WHERE voucher_id = ?', [req.params.id]);
  if (!voucher) return res.status(404).json({ error: 'Voucher not found' });
  const entries = await dbMod.all(
    `SELECT ve.*, coa.account_name, coa.account_code
     FROM voucher_entries ve JOIN chart_of_accounts coa ON ve.account_id = coa.account_id
     WHERE ve.voucher_id = ?`,
    [req.params.id]
  );
  res.json({ ...voucher, entries });
}));

// Trial balance: sum debit/credit per account across all vouchers
router.get('/reports/trial-balance', ah(async (req, res) => {
  const rows = await dbMod.all(`
    SELECT coa.account_id, coa.account_code, coa.account_name, coa.account_type,
           COALESCE(SUM(ve.debit), 0) as total_debit,
           COALESCE(SUM(ve.credit), 0) as total_credit
    FROM chart_of_accounts coa
    LEFT JOIN voucher_entries ve ON ve.account_id = coa.account_id
    GROUP BY coa.account_id
    ORDER BY coa.account_code
  `);
  const totals = rows.reduce((acc, r) => {
    acc.debit += r.total_debit;
    acc.credit += r.total_credit;
    return acc;
  }, { debit: 0, credit: 0 });
  res.json({ accounts: rows, totals });
}));

// Account statement: all voucher entries for one account
router.get('/accounts/:id/statement', ah(async (req, res) => {
  const entries = await dbMod.all(`
    SELECT v.voucher_no, v.voucher_date, v.narration, ve.debit, ve.credit
    FROM voucher_entries ve JOIN vouchers v ON ve.voucher_id = v.voucher_id
    WHERE ve.account_id = ?
    ORDER BY v.voucher_date
  `, [req.params.id]);
  res.json(entries);
}));

module.exports = router;
