const serverless = require('serverless-http');
const { app, ensureDb } = require('../../app');

const handler = serverless(app);

// Netlify Functions may run in a fresh container per invocation, so we
// make sure the database connection/schema is ready before handling any
// request. ensureDb() caches the promise, so this only does real work once
// per warm container, not on every single call.
exports.handler = async (event, context) => {
  await ensureDb();
  return handler(event, context);
};
