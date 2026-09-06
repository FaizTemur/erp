const express = require('express');
const router = express.Router();
const dbMod = require('../db/db');
const { ah } = require('../utils/asyncHandler');

router.get('/migration/summary', ah(async (req, res) => {
  const logs = await dbMod.all('SELECT * FROM migration_log ORDER BY migration_id');
  const realCustomers = await dbMod.get('SELECT COUNT(*) as cnt FROM customers');
  const realPlots = await dbMod.get('SELECT COUNT(*) as cnt FROM plots');
  const legacyLedgerCount = await dbMod.get('SELECT COUNT(*) as cnt FROM legacy_ledger');
  const landlordCount = await dbMod.get('SELECT COUNT(*) as cnt FROM landlords');
  const suspenseAccount = await dbMod.get(`SELECT account_id FROM chart_of_accounts WHERE account_code = '2900'`);
  let suspenseBalance = null;
  if (suspenseAccount) {
    const sums = await dbMod.get(
      'SELECT COALESCE(SUM(debit),0) as d, COALESCE(SUM(credit),0) as c FROM voucher_entries WHERE account_id = ?',
      [suspenseAccount.account_id]
    );
    suspenseBalance = sums.c - sums.d;
  }
  const migrationVouchers = await dbMod.get(`SELECT COUNT(*) as cnt FROM vouchers WHERE voucher_no LIKE 'MIG-%'`);

  res.json({
    logs,
    totals: {
      customers: realCustomers.cnt,
      plots: realPlots.cnt,
      legacy_ledger_entries: legacyLedgerCount.cnt,
      landlords: landlordCount.cnt,
      migration_vouchers_pending_review: migrationVouchers.cnt,
      migration_suspense_balance: suspenseBalance
    }
  });
}));

module.exports = router;
