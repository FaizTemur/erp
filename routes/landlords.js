const express = require('express');
const router = express.Router();
const multer = require('multer');
const crypto = require('crypto');
const dbMod = require('../db/db');
const { ah } = require('../utils/asyncHandler');
const { getStore } = require('@netlify/blobs');

// Netlify Functions have no persistent local disk - files must go to
// external storage. Netlify Blobs is Netlify's own built-in storage,
// so no separate third-party account/credentials are needed.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function docsStore() {
  // Inside a real Netlify Function, getStore() auto-detects everything it
  // needs. Running locally via `node server.js` (not `netlify dev`), it
  // needs to be told explicitly - set NETLIFY_SITE_ID and NETLIFY_BLOBS_TOKEN
  // if you want to test file uploads outside of Netlify's own tooling.
  if (process.env.NETLIFY_SITE_ID && process.env.NETLIFY_BLOBS_TOKEN) {
    return getStore({
      name: 'landlord-docs',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_BLOBS_TOKEN
    });
  }
  return getStore('landlord-docs');
}

router.get('/landlords', ah(async (req, res) => {
  res.json(await dbMod.all('SELECT * FROM landlords ORDER BY landlord_id DESC'));
}));

router.post('/landlords', ah(async (req, res) => {
  const { full_name, cnic, phone, address, land_area, purchase_price, purchase_date } = req.body;
  if (!full_name) return res.status(400).json({ error: 'full_name is required' });
  const id = await dbMod.run(
    `INSERT INTO landlords (full_name, cnic, phone, address, land_area, purchase_price, purchase_date)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [full_name, cnic || null, phone || null, address || null, land_area || null, purchase_price || null, purchase_date || null]
  );
  res.status(201).json(await dbMod.get('SELECT * FROM landlords WHERE landlord_id = ?', [id]));
}));

router.get('/landlords/:id', ah(async (req, res) => {
  const landlord = await dbMod.get('SELECT * FROM landlords WHERE landlord_id = ?', [req.params.id]);
  if (!landlord) return res.status(404).json({ error: 'Landlord not found' });
  const documents = await dbMod.all('SELECT * FROM landlord_documents WHERE landlord_id = ?', [req.params.id]);
  res.json({ ...landlord, documents });
}));

router.post('/landlords/:id/documents', upload.single('file'), ah(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const blobKey = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${req.file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
  await docsStore().set(blobKey, req.file.buffer, {
    metadata: { contentType: req.file.mimetype, originalName: req.file.originalname }
  });

  // file_path stores the blob key; the /api/documents/file/:key route below serves it
  const id = await dbMod.run(
    'INSERT INTO landlord_documents (landlord_id, doc_title, file_path) VALUES (?, ?, ?)',
    [req.params.id, req.body.doc_title || req.file.originalname, `/api/documents/file/${blobKey}`]
  );
  res.status(201).json(await dbMod.get('SELECT * FROM landlord_documents WHERE doc_id = ?', [id]));
}));

// Serve an uploaded document back out of Netlify Blobs
router.get('/documents/file/:key', ah(async (req, res) => {
  const store = docsStore();
  const blob = await store.get(req.params.key, { type: 'arrayBuffer' });
  if (!blob) return res.status(404).json({ error: 'File not found' });
  const meta = await store.getMetadata(req.params.key);
  res.setHeader('Content-Type', meta?.metadata?.contentType || 'application/octet-stream');
  res.send(Buffer.from(blob));
}));

module.exports = router;
