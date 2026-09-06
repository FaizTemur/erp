/**
 * Second migration pass: imports the legacy "internal accounts" that are
 * NOT real customers (Office Cash, Salary, Bank, Tax, staff expenses, and
 * landowner land-purchase accounts) discovered in the DIGITAL software's MDS
 * table. Landowner accounts go into the Landlords module. Everything else is
 * posted into Accounting via a journal voucher against a "Migration Suspense"
 * clearing account, so:
 *   - The exact original debit/credit totals from the legacy ledger are
 *     preserved exactly (no guessing which side is "right")
 *   - Every voucher is narrated with the original legacy account code + name
 *     so it's fully traceable back to the source
 *   - The trial balance still balances by construction (suspense absorbs
 *     the counter-entry)
 *   - Nothing is silently classified as final - an accountant reviews and
 *     reclassifies out of Migration Suspense over time
 *
 * Run migration/categorize.py first to produce internal-accounts-categorized.json.
 *
 * Usage: node migration/import-internal.js
 * Requires TURSO_DATABASE_URL and TURSO_AUTH_TOKEN environment variables set.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const dbMod = require('../db/db');

const NEW_ACCOUNTS = [
  ['1300', 'Land Held for Development', '1000', 2, 'asset'],
  ['5300', 'Salary Expense', '5000', 2, 'expense'],
  ['5400', 'Tax Expense', '5000', 2, 'expense'],
  ['5500', 'General & Administrative Expense', '5000', 2, 'expense'],
  ['5600', 'Construction & Development Expense', '5000', 2, 'expense'],
  ['5700', 'Marketing Expense', '5000', 2, 'expense'],
  ['5800', 'Utilities Expense', '5000', 2, 'expense'],
  ['5900', 'Legal & Professional Fees', '5000', 2, 'expense'],
  ['2900', 'Migration Suspense (pending accountant review)', '2000', 2, 'liability'],
];

async function run() {
  await dbMod.initDb();

  const accounts = JSON.parse(fs.readFileSync(path.join(__dirname, 'internal-accounts-categorized.json'), 'utf8'));
  console.log(`Loaded ${accounts.length} internal legacy accounts to import.`);

  let landlordsImported = 0;
  let skippedAlready = 0;
  let vouchersImported = 0;
  const migrationDate = new Date().toISOString().slice(0, 10);

  // Ensure the new chart-of-accounts entries exist
  for (const [code, name, parentCode, level, type] of NEW_ACCOUNTS) {
    const existing = await dbMod.get('SELECT account_id FROM chart_of_accounts WHERE account_code = ?', [code]);
    if (!existing) {
      const parent = await dbMod.get('SELECT account_id FROM chart_of_accounts WHERE account_code = ?', [parentCode]);
      await dbMod.run(
        'INSERT INTO chart_of_accounts (account_code, account_name, parent_account_id, level, account_type) VALUES (?, ?, ?, ?, ?)',
        [code, name, parent ? parent.account_id : null, level, type]
      );
    }
  }

  const suspenseAccount = await dbMod.get(`SELECT account_id FROM chart_of_accounts WHERE account_code = '2900'`);

  for (const acc of accounts) {
    if (acc.matched_category_code === 'LANDLORD') {
      const existingLandlord = await dbMod.get('SELECT landlord_id FROM landlords WHERE full_name = ?', [acc.customer_name]);
      if (existingLandlord) {
        skippedAlready++;
        continue;
      }
      await dbMod.run(
        `INSERT INTO landlords (full_name, purchase_price, purchase_date)
         VALUES (?, ?, ?)`,
        [acc.customer_name, acc.computed_total_debit || null, acc.contract_date || null]
      );
      landlordsImported++;
      continue;
    }

    const voucherNo = `MIG-${acc.plot_code}`;
    const existingVoucher = await dbMod.get('SELECT voucher_id FROM vouchers WHERE voucher_no = ?', [voucherNo]);
    if (existingVoucher) {
      skippedAlready++;
      continue;
    }

    const categoryAccount = await dbMod.get('SELECT account_id FROM chart_of_accounts WHERE account_code = ?', [acc.matched_category_code]);
    if (!categoryAccount || !suspenseAccount) continue;

    const debit = acc.computed_total_debit || 0;
    const credit = acc.computed_total_credit || 0;
    if (debit === 0 && credit === 0) continue;

    const voucherId = await dbMod.run(
      `INSERT INTO vouchers (voucher_type, voucher_no, voucher_date, narration)
       VALUES ('journal', ?, ?, ?)`,
      [voucherNo, migrationDate,
       `LEGACY MIGRATION (pending review) - Original account [${acc.plot_code}] "${acc.customer_name}" - ${acc.ledger_entry_count} historical transactions carried forward as a single balance.`]
    );

    await dbMod.runBatch([
      {
        sql: 'INSERT INTO voucher_entries (voucher_id, account_id, debit, credit) VALUES (?, ?, ?, ?)',
        args: [voucherId, categoryAccount.account_id, debit, credit]
      },
      {
        sql: 'INSERT INTO voucher_entries (voucher_id, account_id, debit, credit) VALUES (?, ?, ?, ?)',
        args: [voucherId, suspenseAccount.account_id, credit, debit]
      }
    ]);

    vouchersImported++;
  }

  await dbMod.run(
    `INSERT INTO migration_log (accounts_imported, accounts_skipped, ledger_entries_imported, notes)
     VALUES (?, ?, ?, ?)`,
    [landlordsImported + vouchersImported, 0, 0, 'Internal accounts pass: landlords + suspense-balanced vouchers']
  );

  console.log(`\n=== Internal accounts migration complete ===`);
  console.log(`Landowner accounts imported into Landlords module: ${landlordsImported}`);
  console.log(`Other internal accounts posted as vouchers (pending review): ${vouchersImported}`);
  console.log(`Already imported previously, skipped: ${skippedAlready}`);
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
