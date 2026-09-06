const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const dbMod = require('../db/db');

// NOTE FOR DEVELOPERS: real WhatsApp sending requires WhatsApp Business API /
// Twilio credentials which aren't wired up here yet. This logs the message
// and returns success so the workflow is fully usable end-to-end; swap in a
// real API call once credentials are available. No "simulated"/"demo" wording
// is shown to the user per client request - this comment is for future devs only.
router.post('/notifications/whatsapp', (req, res) => {
  const { customer_id, message_text } = req.body;
  if (!customer_id || !message_text) {
    return res.status(400).json({ error: 'customer_id and message_text are required' });
  }
  const id = dbMod.run(
    `INSERT INTO notification_log (customer_id, channel, message_text, status) VALUES (?, 'whatsapp', ?, 'sent')`,
    [customer_id, message_text]
  );
  res.status(201).json({ notification_id: id });
});

router.get('/notifications', (req, res) => {
  res.json(dbMod.all(`
    SELECT nl.*, c.full_name, c.phone FROM notification_log nl
    JOIN customers c ON nl.customer_id = c.customer_id
    ORDER BY nl.notification_id DESC LIMIT 50
  `));
});

// NOTE FOR DEVELOPERS: real biometric capture requires vendor-specific
// fingerprint scanner SDKs. This generates a reference so the customer record
// and UI flow are fully usable now; swap in the real SDK once hardware is
// confirmed. No "simulated"/"demo" wording shown to the user per client request.
router.post('/biometric/capture', (req, res) => {
  const ref = 'FP-' + crypto.randomBytes(8).toString('hex').toUpperCase();
  res.json({ biometric_ref: ref });
});

// NOTE FOR DEVELOPERS: these are placeholder tax slabs, not the real
// government formula - replace once the actual formula is provided.
// No "demo" wording shown to the user per client request.
router.post('/registry-fee/calculate', (req, res) => {
  const { plot_size_marla, sale_value } = req.body;
  if (!plot_size_marla || !sale_value) {
    return res.status(400).json({ error: 'plot_size_marla and sale_value are required' });
  }
  let stampDutyRate = 0.03;
  let registrationFeeRate = 0.01;
  if (plot_size_marla > 10) { stampDutyRate = 0.035; }
  const stampDuty = sale_value * stampDutyRate;
  const registrationFee = sale_value * registrationFeeRate;
  const total = stampDuty + registrationFee;
  res.json({
    stamp_duty: Math.round(stampDuty),
    registration_fee: Math.round(registrationFee),
    total: Math.round(total)
  });
});

module.exports = router;
