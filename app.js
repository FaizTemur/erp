const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { initDb } = require('./db/db');
const { router: authRouter, requireAuth } = require('./auth/routes');

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Auth routes are NOT protected (login/setup must be reachable while logged out)
app.use('/api/auth', authRouter);

// Everything else under /api requires a valid JWT cookie
app.use('/api', requireAuth);
app.use('/api', require('./routes/plots'));
app.use('/api', require('./routes/customers'));
app.use('/api', require('./routes/sales'));
app.use('/api', require('./routes/documents'));
app.use('/api', require('./routes/accounting'));
app.use('/api', require('./routes/brokers'));
app.use('/api', require('./routes/charges'));
app.use('/api', require('./routes/noc'));
app.use('/api', require('./routes/resale'));
app.use('/api', require('./routes/landlords'));
app.use('/api', require('./routes/simulated'));
app.use('/api', require('./auth/users_routes'));
app.use('/api', require('./routes/migration'));

let dbReady = null;
function ensureDb() {
  if (!dbReady) dbReady = initDb();
  return dbReady;
}

module.exports = { app, ensureDb };
