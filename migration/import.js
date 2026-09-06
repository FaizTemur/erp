/**
 * One-time migration runner.
 * Reads accounts.json and ledger.json (produced by extract.py from the legacy
 * Visual FoxPro "DIGITAL" database) and imports them into the real ERP database.
 *
 * Now runs against Turso (network database) instead of a local file, so
 * calls are async. Ledger entries are batched per-plot (one network
 * round-trip per plot instead of one per row) since there are ~39,000 of
 * them and a call-per-row approach would be extremely slow over a network
 * connection.
 *
 * Usage: node migration/import.js
 * Requires TURSO_DATABASE_URL and TURSO_AUTH_TOKEN environment variables set.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const dbMod = require('../db/db');

async function run() {
  await dbMod.initDb();

  const accounts = JSON.parse(fs.readFileSync(path.join(__dirname, 'accounts.json'), 'utf8'));
  const ledgerByPlot = JSON.parse(fs.readFileSync(path.join(__dirname, 'ledger.json'), 'utf8'));

  console.log(`Loaded ${accounts.length} accounts and ledger data for ${Object.keys(ledgerByPlot).length} plots.`);

  let project = await dbMod.get(`SELECT * FROM projects WHERE project_name = 'Elite Gardens (Migrated)'`);
  let projectId;
  if (!project) {
    projectId = await dbMod.run(
      `INSERT INTO projects (project_name, location, description) VALUES (?, ?, ?)`,
      ['Elite Gardens (Migrated)', 'Sahiwal', 'Imported from legacy DIGITAL software (Visual FoxPro), migrated on ' + new Date().toISOString().slice(0, 10)]
    );
  } else {
    projectId = project.project_id;
  }

  let imported = 0;
  let skipped = 0;
  let ledgerImported = 0;
  const skipReasons = [];
  const internalAccounts = [];
  const blockCache = {};

  for (const acc of accounts) {
    try {
      const looksLikeRealEstate = !!(acc.plot_description || acc.total_price);
      if (!looksLikeRealEstate) {
        internalAccounts.push(acc);
        continue;
      }

      const existingPlot = await dbMod.get('SELECT plot_id FROM plots WHERE plot_code = ?', [acc.plot_code]);
      if (existingPlot) {
        skipped++;
        skipReasons.push({ plot_code: acc.plot_code, reason: 'already imported' });
        continue;
      }

      const blockName = acc.plot_code.split('-').slice(0, 2).join('-');
      let blockId = blockCache[blockName];
      if (!blockId) {
        const existingBlock = await dbMod.get('SELECT block_id FROM blocks WHERE project_id = ? AND block_name = ?', [projectId, blockName]);
        blockId = existingBlock
          ? existingBlock.block_id
          : await dbMod.run('INSERT INTO blocks (project_id, block_name) VALUES (?, ?)', [projectId, blockName]);
        blockCache[blockName] = blockId;
      }

      const plotId = await dbMod.run(
        `INSERT INTO plots (plot_code, project_id, block_id, plot_number, marla, square_feet, category, base_price, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          acc.plot_code, projectId, blockId, null,
          acc.marla || null, acc.square_feet || null, acc.plot_description || null,
          acc.total_price || null,
          acc.total_price ? 'sold' : 'available'
        ]
      );

      let customerId;
      const existingCustomer = acc.cnic
        ? await dbMod.get('SELECT customer_id FROM customers WHERE cnic = ?', [acc.cnic])
        : null;
      if (existingCustomer) {
        customerId = existingCustomer.customer_id;
      } else {
        customerId = await dbMod.run(
          `INSERT INTO customers (full_name, father_name, cnic, phone, address)
           VALUES (?, ?, ?, ?, ?)`,
          [acc.customer_name, acc.father_name || null, acc.cnic || null, acc.phone || null, acc.address || null]
        );
      }

      if (acc.total_price) {
        const ownershipId = await dbMod.run(
          `INSERT INTO ownership_history (plot_id, customer_id, start_date, is_current, acquisition_type)
           VALUES (?, ?, ?, 1, 'sale')`,
          [plotId, customerId, acc.contract_date || '2018-01-01']
        );

        const planType = acc.installment_count > 1 ? 'monthly' : 'one_time';
        const contractId = await dbMod.run(
          `INSERT INTO sale_contracts
           (plot_id, ownership_id, total_price, down_payment, contract_date, plan_type,
            number_of_installments, installment_amount, status, english_clause_text)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            plotId, ownershipId, acc.total_price, acc.advance_or_received || 0,
            acc.contract_date || '2018-01-01', planType,
            acc.installment_count || 1, acc.installment_amount || null,
            acc.computed_outstanding > 0 ? 'active' : 'completed',
            acc.remarks || null
          ]
        );
        await dbMod.run('UPDATE ownership_history SET sale_contract_id = ? WHERE ownership_id = ?', [contractId, ownershipId]);

        const outstanding = Math.max(0, acc.computed_outstanding || 0);
        await dbMod.run(
          `INSERT INTO installment_schedule (contract_id, due_date, due_amount, paid_amount, status)
           VALUES (?, ?, ?, ?, ?)`,
          [
            contractId,
            new Date().toISOString().slice(0, 10),
            acc.total_price,
            acc.total_price - outstanding,
            outstanding > 0.01 ? 'partial' : 'paid'
          ]
        );
      }

      // Batch this plot's ledger entries into one round-trip instead of one call per row
      const entries = ledgerByPlot[acc.plot_code] || [];
      if (entries.length) {
        const statements = entries.map(e => ({
          sql: `INSERT INTO legacy_ledger (plot_id, entry_date, particular, entry_type, voucher_no, debit, credit, running_balance, payment_mode)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [plotId, e.date, e.particular, e.type, e.voucher_no, e.debit || 0, e.credit || 0, e.balance, e.mode]
        }));
        await dbMod.runBatch(statements);
        ledgerImported += entries.length;
      }

      imported++;
      if (imported % 20 === 0) console.log(`  ...${imported} accounts imported so far`);
    } catch (err) {
      skipped++;
      skipReasons.push({ plot_code: acc.plot_code, reason: err.message });
    }
  }

  await dbMod.run(
    `INSERT INTO migration_log (accounts_imported, accounts_skipped, ledger_entries_imported, notes)
     VALUES (?, ?, ?, ?)`,
    [imported, skipped, ledgerImported, 'Migrated from legacy DIGITAL (Visual FoxPro) software']
  );

  console.log(`\n=== Migration complete ===`);
  console.log(`Real customer/plot accounts imported: ${imported}`);
  console.log(`Accounts skipped (already existed): ${skipped}`);
  console.log(`Ledger entries imported: ${ledgerImported}`);
  console.log(`Internal bookkeeping accounts set aside (NOT imported as customers/plots): ${internalAccounts.length}`);
  if (internalAccounts.length) {
    const totalInternal = internalAccounts.reduce((s, a) => s + (a.computed_outstanding > 0 ? a.computed_outstanding : 0), 0);
    fs.writeFileSync(path.join(__dirname, 'internal-accounts.json'), JSON.stringify(internalAccounts, null, 2));
    console.log(`  Combined balance on these: Rs. ${Math.round(totalInternal).toLocaleString()}`);
    console.log(`  Written to migration/internal-accounts.json - run import-internal.js next.`);
  }
  if (skipReasons.length) {
    fs.writeFileSync(path.join(__dirname, 'skip-reasons.json'), JSON.stringify(skipReasons, null, 2));
    console.log(`Skip reasons written to migration/skip-reasons.json`);
  }
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
