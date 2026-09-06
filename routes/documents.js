const express = require('express');
const router = express.Router();
const dbMod = require('../db/db');
const { ah } = require('../utils/asyncHandler');

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Printable HTML agreement for a sale contract
router.get('/documents/agreement/:contractId', ah(async (req, res) => {
  const contract = await dbMod.get('SELECT * FROM sale_contracts WHERE contract_id = ?', [req.params.contractId]);
  if (!contract) return res.status(404).send('Contract not found');

  const plot = await dbMod.get('SELECT * FROM plots WHERE plot_id = ?', [contract.plot_id]);
  const ownership = await dbMod.get('SELECT * FROM ownership_history WHERE ownership_id = ?', [contract.ownership_id]);
  const customer = await dbMod.get('SELECT * FROM customers WHERE customer_id = ?', [ownership.customer_id]);
  const schedule = await dbMod.all(
    'SELECT * FROM installment_schedule WHERE contract_id = ? ORDER BY due_date',
    [contract.contract_id]
  );

  const scheduleRows = schedule.map((s, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${s.due_date}</td>
      <td>${Number(s.due_amount).toLocaleString()}</td>
      <td>${s.status}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Agreement - Plot ${escapeHtml(plot.plot_code)}</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 20mm; }
  body { font-family: 'Georgia', serif; color: #1a1a1a; line-height: 1.6; }
  .urdu-block { font-family: 'Noto Nastaliq Urdu', serif; font-size: 17px; line-height: 2.1; }
  .letterhead { text-align: center; border-bottom: 2px solid #0F3D3E; padding-bottom: 14px; margin-bottom: 24px; }
  .letterhead h1 { font-size: 22px; color: #0F3D3E; margin: 0; letter-spacing: 2px; }
  .letterhead .sub { font-size: 11px; color: #666; margin-top: 4px; }
  h2 { font-size: 15px; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-top: 28px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12.5px; }
  td, th { padding: 6px 8px; border: 1px solid #ccc; text-align: left; }
  .meta-table td:first-child { font-weight: bold; width: 200px; background: #F7F5F0; }
  .signatures { display: flex; justify-content: space-between; margin-top: 60px; }
  .sign-block { width: 30%; text-align: center; border-top: 1px solid #333; padding-top: 6px; font-size: 12px; }
  .no-print { text-align: center; margin-top: 24px; }
  @media print { .no-print { display: none; } }
</style>
</head>
<body>
  <div class="letterhead">
    <h1>SALE AGREEMENT</h1>
    <div class="sub">Contract #${contract.contract_id} &middot; Generated ${new Date().toLocaleDateString()}</div>
  </div>

  <h2>Plot Details</h2>
  <table class="meta-table">
    <tr><td>Plot Code</td><td>${escapeHtml(plot.plot_code)}</td></tr>
    <tr><td>Plot Number</td><td>${escapeHtml(plot.plot_number) || '-'}</td></tr>
    <tr><td>Marla / Sq. Ft.</td><td>${plot.marla || '-'} marla / ${plot.square_feet || '-'} sq. ft.</td></tr>
    <tr><td>Category</td><td>${escapeHtml(plot.category) || '-'}</td></tr>
  </table>

  <h2>Purchaser Details</h2>
  <table class="meta-table">
    <tr><td>Name</td><td>${escapeHtml(customer.full_name)}</td></tr>
    <tr><td>Father's Name</td><td>${escapeHtml(customer.father_name) || '-'}</td></tr>
    <tr><td>CNIC</td><td>${escapeHtml(customer.cnic) || '-'}</td></tr>
    <tr><td>Phone</td><td>${escapeHtml(customer.phone) || '-'}</td></tr>
    <tr><td>Address</td><td>${escapeHtml(customer.address) || '-'}</td></tr>
  </table>

  <h2>Payment Terms</h2>
  <table class="meta-table">
    <tr><td>Total Price</td><td>Rs. ${Number(contract.total_price).toLocaleString()}</td></tr>
    <tr><td>Down Payment</td><td>Rs. ${Number(contract.down_payment).toLocaleString()}</td></tr>
    <tr><td>Plan Type</td><td>${contract.plan_type}</td></tr>
    <tr><td>Number of Installments</td><td>${contract.number_of_installments}</td></tr>
    <tr><td>Installment Amount</td><td>Rs. ${Number(contract.installment_amount).toLocaleString()}</td></tr>
    <tr><td>Contract Date</td><td>${contract.contract_date}</td></tr>
  </table>

  ${contract.english_clause_text ? `<h2>Additional Terms</h2><p>${escapeHtml(contract.english_clause_text)}</p>` : ''}
  ${contract.urdu_clause_text ? `<h2 style="direction:rtl;">اضافی شرائط</h2><p class="urdu-block" dir="rtl">${escapeHtml(contract.urdu_clause_text)}</p>` : ''}

  <h2>Installment Schedule</h2>
  <table>
    <thead><tr><th>#</th><th>Due Date</th><th>Amount (Rs.)</th><th>Status</th></tr></thead>
    <tbody>${scheduleRows}</tbody>
  </table>

  <div class="signatures">
    <div class="sign-block">Purchaser</div>
    <div class="sign-block">Witness 1</div>
    <div class="sign-block">Manager / Office</div>
  </div>

  <div class="no-print">
    <button onclick="window.print()">Print this agreement</button>
  </div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
}));

// Printable NOC document
router.get('/documents/noc/:nocId', ah(async (req, res) => {
  const noc = await dbMod.get('SELECT * FROM noc_certificates WHERE noc_id = ?', [req.params.nocId]);
  if (!noc) return res.status(404).send('NOC not found');

  const plot = await dbMod.get('SELECT * FROM plots WHERE plot_id = ?', [noc.plot_id]);
  const ownership = await dbMod.get('SELECT * FROM ownership_history WHERE ownership_id = ?', [noc.ownership_id]);
  const customer = await dbMod.get('SELECT * FROM customers WHERE customer_id = ?', [ownership.customer_id]);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>NOC - Plot ${escapeHtml(plot.plot_code)}</title>
<style>
  @page { size: A4; margin: 20mm; }
  body { font-family: 'Georgia', serif; color: #1a1a1a; line-height: 1.8; }
  .letterhead { text-align: center; border-bottom: 2px solid #0F3D3E; padding-bottom: 14px; margin-bottom: 32px; }
  .letterhead h1 { font-size: 22px; color: #0F3D3E; margin: 0; letter-spacing: 2px; }
  .body-text { font-size: 14px; margin-bottom: 40px; }
  .signatures { display: flex; justify-content: flex-end; margin-top: 80px; }
  .sign-block { width: 220px; text-align: center; border-top: 1px solid #333; padding-top: 6px; font-size: 12px; }
  .no-print { text-align: center; margin-top: 24px; }
  @media print { .no-print { display: none; } }
</style>
</head>
<body>
  <div class="letterhead">
    <h1>NO OBJECTION CERTIFICATE</h1>
    <div style="font-size:11px;color:#666;">Issued ${noc.issue_date}</div>
  </div>
  <p class="body-text">
    This is to certify that <strong>${escapeHtml(customer.full_name)}</strong>
    ${customer.father_name ? `S/O ${escapeHtml(customer.father_name)}` : ''}, CNIC
    ${escapeHtml(customer.cnic) || '-'}, holder of Plot No. <strong>${escapeHtml(plot.plot_code)}</strong>,
    has cleared all outstanding installments in full as of the date of this certificate.
    There is no financial objection on record, and the holder is free to transfer or sell this
    plot to any third party, subject to the standard transfer process of this office.
  </p>
  <div class="signatures">
    <div class="sign-block">Authorized Signatory / Manager</div>
  </div>
  <div class="no-print"><button onclick="window.print()">Print this NOC</button></div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
}));

module.exports = router;
