/**
 * Local development entry point. This is NOT what runs on Netlify -
 * Netlify runs netlify/functions/api.js instead, and serves public/
 * directly via its CDN. This file exists so you can still run
 * `npm start` on your own machine and test everything at localhost:3000
 * exactly like before, against the same Turso database Netlify will use.
 */
require('dotenv').config();
const express = require('express');
const path = require('path');
const { app: apiApp, ensureDb } = require('./app');

const server = express();
server.use(express.static(path.join(__dirname, 'public')));
server.use(apiApp);

const PORT = process.env.PORT || 3000;

ensureDb().then(() => {
  server.listen(PORT, () => {
    console.log(`Housing Society ERP running at http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
