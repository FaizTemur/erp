const express = require('express');
const router = express.Router();
const dbMod = require('../db/db');
const { ah } = require('../utils/asyncHandler');

// Add N months to a YYYY-MM-DD date string
function addMonths(dateStr, months) {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function planIntervalMonths(plan_type) {
  switch (plan_type) {
    case 'monthly': return 1;
    case 'quarterly': return 3;
    case 'semi_annual': return 6;
    case 'annual': return 12;
    default: return 1; // custom / one_time handled separately
  }
}

// ---------- SELL A PLOT (creates ownership_history + sale_contract + schedule) ----------

router.post('/sales', ah(async (req, res) => {
  const {
    plot_id, customer_id, broker_id, total_price, down_payment,
    contract_date, plan_type, number_of_installments,
    urdu_clause_text, english_clause_text
  } = req.body;

  if (!plot_id || !customer_id || !total_price || !contract_date || !plan_type) {
    return res.status(400).json({ error: 'plot_id, customer_id, total_price, contract_date, plan_type are required' });
  }

  const plot = await dbMod.get('SELECT * FROM plots WHERE plot_id = ?', [plot_id]);
  if (!plot) return res.status(404).json({ error: 'Plot not found' });
  if (plot.status !== 'available') {
    return res.status(409).json({ error: `Plot ${plot.plot_code} is not available (status: ${plot.status})` });
  }

  // 1. Create ownership record
  const ownershipId = await dbMod.run(
    `INSERT INTO ownership_history (plot_id, customer_id, broker_id, start_date, is_current, acquisition_type)
     VALUES (?, ?, ?, ?, 1, 'sale')`,
    [plot_id, customer_id, broker_id || null, contract_date]
  );

  // 2. Calculate installment amount
  const principal = total_price - (down_payment || 0);
  const numInstallments = plan_type === 'one_time' ? 1 : (number_of_installments || 1);
  const installmentAmount = Math.round((principal / numInstallments) * 100) / 100;

  // 3. Create the sale contract
  const contractId = await dbMod.run(
    `INSERT INTO sale_contracts
     (plot_id, ownership_id, total_price, down_payment, contract_date, plan_type,
      number_of_installments, installment_amount, urdu_clause_text, english_clause_text)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [plot_id, ownershipId, total_price, down_payment || 0, contract_date, plan_type,
     numInstallments, installmentAmount, urdu_clause_text || null, english_clause_text || null]
  );

  await dbMod.run('UPDATE ownership_history SET sale_contract_id = ? WHERE ownership_id = ?', [contractId, ownershipId]);

  // 4. Generate installment schedule
  const intervalMonths = planIntervalMonths(plan_type);
  for (let i = 0; i < numInstallments; i++) {
    const dueDate = plan_type === 'one_time' ? contract_date : addMonths(contract_date, intervalMonths * (i + 1));
    await dbMod.run(
      `INSERT INTO installment_schedule (contract_id, due_date, due_amount, status)
       VALUES (?, ?, ?, 'pending')`,
      [contractId, dueDate, installmentAmount]
    );
  }

  // 5. Mark plot as sold
  await dbMod.run('UPDATE plots SET status = ? WHERE plot_id = ?', ['sold', plot_id]);

  // 6. If a broker is involved, auto-post their commission to the ledger
  if (broker_id) {
    const broker = await dbMod.get('SELECT * FROM brokers WHERE broker_id = ?', [broker_id]);
    if (broker) {
      const commissionAmount = Math.round(total_price * (broker.commission_rate / 100) * 100) / 100;
      const voucherNo = `COM-${Date.now()}`;
      const voucherId = await dbMod.run(
        `INSERT INTO vouchers (voucher_type, voucher_no, voucher_date, narration, contract_id)
         VALUES ('journal', ?, ?, ?, ?)`,
        [voucherNo, contract_date, `Commission for ${broker.full_name} on contract #${contractId}`, contractId]
      );
      const commissionAccount = await dbMod.get(`SELECT account_id FROM chart_of_accounts WHERE account_code = '5100'`);
      const cashAccount = await dbMod.get(`SELECT account_id FROM chart_of_accounts WHERE account_code = '1100'`);
      if (commissionAccount && cashAccount) {
        await dbMod.run('INSERT INTO voucher_entries (voucher_id, account_id, debit, credit) VALUES (?, ?, ?, ?)',
          [voucherId, commissionAccount.account_id, commissionAmount, 0]);
        await dbMod.run('INSERT INTO voucher_entries (voucher_id, account_id, debit, credit) VALUES (?, ?, ?, ?)',
          [voucherId, cashAccount.account_id, 0, commissionAmount]);
      }
    }
  }

  res.status(201).json(await dbMod.get('SELECT * FROM sale_contracts WHERE contract_id = ?', [contractId]));
}));

router.get('/sales/:contractId', ah(async (req, res) => {
  const contract = await dbMod.get('SELECT * FROM sale_contracts WHERE contract_id = ?', [req.params.contractId]);
  if (!contract) return res.status(404).json({ error: 'Contract not found' });
  const schedule = await dbMod.all(
    'SELECT * FROM installment_schedule WHERE contract_id = ? ORDER BY due_date',
    [req.params.contractId]
  );
  res.json({ ...contract, schedule });
}));

// ---------- RECORD A PAYMENT ----------

router.post('/installments/:id/pay', ah(async (req, res) => {
  const { paid_amount, paid_date, payment_mode } = req.body;
  if (!paid_amount || !paid_date) {
    return res.status(400).json({ error: 'paid_amount and paid_date are required' });
  }

  const inst = await dbMod.get('SELECT * FROM installment_schedule WHERE installment_id = ?', [req.params.id]);
  if (!inst) return res.status(404).json({ error: 'Installment not found' });

  const newPaid = (inst.paid_amount || 0) + paid_amount;
  const status = newPaid >= inst.due_amount ? 'paid' : 'partial';

  await dbMod.run(
    `UPDATE installment_schedule SET paid_amount = ?, paid_date = ?, payment_mode = ?, status = ?
     WHERE installment_id = ?`,
    [newPaid, paid_date, payment_mode || 'cash', status, req.params.id]
  );

  // Check if entire contract is now fully paid -> mark completed
  const remaining = await dbMod.get(
    `SELECT COUNT(*) as cnt FROM installment_schedule WHERE contract_id = ? AND status != 'paid'`,
    [inst.contract_id]
  );
  if (remaining.cnt === 0) {
    await dbMod.run('UPDATE sale_contracts SET status = ? WHERE contract_id = ?', ['completed', inst.contract_id]);
  }

  res.json(await dbMod.get('SELECT * FROM installment_schedule WHERE installment_id = ?', [req.params.id]));
}));

// ---------- OUTSTANDING / DEFAULTERS REPORT ----------

router.get('/reports/outstanding', ah(async (req, res) => {
  const rows = await dbMod.all(`
    SELECT c.customer_id, c.full_name, c.phone, p.plot_code, sc.contract_id,
           SUM(CASE WHEN i.status != 'paid' THEN (i.due_amount - i.paid_amount) ELSE 0 END) AS outstanding,
           SUM(CASE WHEN i.status != 'paid' AND date(i.due_date) < date('now') THEN 1 ELSE 0 END) AS overdue_count
    FROM sale_contracts sc
    JOIN ownership_history oh ON sc.ownership_id = oh.ownership_id
    JOIN customers c ON oh.customer_id = c.customer_id
    JOIN plots p ON sc.plot_id = p.plot_id
    JOIN installment_schedule i ON i.contract_id = sc.contract_id
    GROUP BY sc.contract_id
    HAVING outstanding > 0
    ORDER BY overdue_count DESC
  `);
  res.json(rows);
}));

// ---------- TRANSFER A PLOT (new owner, keeps plot_code, closes old ownership) ----------

router.post('/plots/:plotId/transfer', ah(async (req, res) => {
  const { new_customer_id, broker_id, transfer_date, transfer_fee } = req.body;
  if (!new_customer_id || !transfer_date) {
    return res.status(400).json({ error: 'new_customer_id and transfer_date are required' });
  }

  const plotId = req.params.plotId;
  const currentOwnership = await dbMod.get(
    'SELECT * FROM ownership_history WHERE plot_id = ? AND is_current = 1',
    [plotId]
  );
  if (!currentOwnership) return res.status(404).json({ error: 'No current owner found for this plot' });

  // Close old ownership period
  await dbMod.run(
    'UPDATE ownership_history SET is_current = 0, end_date = ? WHERE ownership_id = ?',
    [transfer_date, currentOwnership.ownership_id]
  );

  // Open new ownership period (plot_code on the plots table is untouched)
  const newOwnershipId = await dbMod.run(
    `INSERT INTO ownership_history (plot_id, customer_id, broker_id, start_date, is_current, acquisition_type)
     VALUES (?, ?, ?, ?, 1, 'transfer')`,
    [plotId, new_customer_id, broker_id || null, transfer_date]
  );

  await dbMod.run('UPDATE plots SET status = ? WHERE plot_id = ?', ['transferred', plotId]);

  res.status(201).json({
    plot_id: plotId,
    closed_ownership_id: currentOwnership.ownership_id,
    new_ownership_id: newOwnershipId,
    transfer_fee: transfer_fee || 0
  });
}));

module.exports = router;
