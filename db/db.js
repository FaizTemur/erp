/**
 * Database layer backed by Turso (libSQL) - a hosted, network-accessible
 * SQLite-compatible database. This replaces the old sql.js file-based
 * approach because serverless functions (Netlify Functions) have no
 * persistent local disk - every function invocation may run in a fresh
 * container, so anything written to a local file would vanish.
 *
 * Turso speaks the same SQLite dialect our schema.sql already uses
 * (AUTOINCREMENT, datetime('now'), etc.) so almost nothing in schema.sql
 * needed to change.
 *
 * Required environment variables (set in Netlify site settings):
 *   TURSO_DATABASE_URL  - e.g. libsql://your-db-name.turso.io
 *   TURSO_AUTH_TOKEN    - from `turso db tokens create your-db-name`
 */
const { createClient } = require('@libsql/client');
const fs = require('fs');
const path = require('path');

let client = null;
let initialized = false;

function getClient() {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!url) {
      throw new Error(
        'TURSO_DATABASE_URL is not set. Create a Turso database and set TURSO_DATABASE_URL ' +
        'and TURSO_AUTH_TOKEN as environment variables (see DEPLOY.md).'
      );
    }
    client = createClient({ url, authToken });
  }
  return client;
}

async function initDb() {
  if (initialized) return;
  const db = getClient();
  // When Netlify bundles the function, __dirname no longer points at db/, so
  // look in every place schema.sql can end up (see included_files in netlify.toml).
  const candidates = [
    path.join(__dirname, 'schema.sql'),
    path.join(__dirname, 'db', 'schema.sql'),
    path.join(process.cwd(), 'db', 'schema.sql'),
    process.env.LAMBDA_TASK_ROOT && path.join(process.env.LAMBDA_TASK_ROOT, 'db', 'schema.sql'),
  ].filter(Boolean);
  const schemaPath = candidates.find(f => fs.existsSync(f));
  if (!schemaPath) {
    throw new Error('schema.sql not found. Looked in: ' + candidates.join(', '));
  }
  const schema = fs.readFileSync(schemaPath, 'utf8');

  // Split on semicolons at statement boundaries and run each one.
  // (libSQL's execute() runs one statement at a time, unlike sql.js which
  // could run a whole multi-statement script in one call.)
  // Strip inline `-- comment` text (which may itself contain semicolons,
  // e.g. "role TEXT -- admin for now; expand later" - that embedded
  // semicolon would otherwise be mistaken for a statement boundary) before
  // splitting into individual statements.
  const cleanedSchema = schema
    .split('\n')
    .map(line => {
      const idx = line.indexOf('--');
      return idx === -1 ? line : line.slice(0, idx);
    })
    .join('\n');

  const statements = cleanedSchema
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const stmt of statements) {
    await db.execute(stmt);
  }
  initialized = true;
}

// Run a write query (INSERT/UPDATE/DELETE). Returns the last inserted row id.
async function run(sql, params = []) {
  const db = getClient();
  const result = await db.execute({ sql, args: params });
  return result.lastInsertRowid !== undefined && result.lastInsertRowid !== null
    ? Number(result.lastInsertRowid)
    : null;
}

// Run a read query, return array of row objects
async function all(sql, params = []) {
  const db = getClient();
  const result = await db.execute({ sql, args: params });
  return result.rows.map(row => {
    const obj = {};
    result.columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
}

// Run a read query, return single row object or null
async function get(sql, params = []) {
  const rows = await all(sql, params);
  return rows.length ? rows[0] : null;
}

// Run multiple writes as a single batch (Turso supports this natively -
// much faster than sequential awaits for bulk imports, and it's a real
// transaction so a failure partway through rolls everything back).
async function runBatch(statements) {
  const db = getClient();
  await db.batch(
    statements.map(({ sql, args }) => ({ sql, args: args || [] })),
    'write'
  );
}

module.exports = { initDb, run, all, get, runBatch };
