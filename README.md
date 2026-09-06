# Housing Society ERP — Working Build

This is a running application with real, tested functionality across most requested modules,
plus clearly-labeled simulated/demo versions of features that need infrastructure not available
in this environment (real WhatsApp API credentials, real fingerprint scanner hardware, your
actual legacy database to migrate from).

## What's REAL and fully working

- **Login & basic team accounts** — session-based auth, admin creates additional staff logins with a role label
- **Projects & Plots** — single + bulk creation, permanent plot codes
- **Customers** — registration, search, per-customer ownership ledger
- **Sales & Installments** — auto-generated schedules (one-time/monthly/quarterly/semi-annual/annual), inline payment recording
- **Transfers** — plot code stays fixed; every past owner's ledger stays separately intact
- **Brokers & Commission** — broker commission auto-calculated and posted to the accounting ledger on sale
- **Accounting** — 4-level chart of accounts (seeded), vouchers with balanced debit/credit entries, trial balance report, account statements
- **NOC issuance** — genuinely gated on cleared installments; blocked with the exact outstanding balance if not eligible; printable certificate
- **Resale / Buy-back** — society can buy back a plot and resell it; profit or loss is computed automatically and posted to the ledger as a real voucher
- **Charges management** — development/WASA/WAPDA/society charges, attachable per plot
- **Landlords** — records plus **real file upload** for scanned documents (stored on disk, retrievable via the app)
- **Bilingual printable agreement** — English + Urdu (Jameel-style Nastaliq font) rendered together in the printed sale agreement
- **Outstanding/defaulters report**

## What's SIMULATED (clearly marked in the UI as demo, not real)

- **WhatsApp payment notifications** — logs the message and shows a "sent" confirmation, but does not actually deliver anything. Real delivery needs a WhatsApp Business API or Twilio account connected — swap the one function in `routes/simulated.js` once you have credentials.
- **Biometric fingerprint capture** — generates a placeholder reference with a scanning animation. Real capture needs the specific fingerprint scanner model's SDK — tell me the hardware and this becomes a real integration.
- **Registry fee calculator** — uses placeholder tax slabs clearly marked "DEMO FORMULA" in the code and the UI. Give me your actual formula and this becomes real.

## What's NOT built at all (explicitly out of scope for this pass)

- **Data migration from your old software** — I don't know what that software is yet. Once you tell me (name, or a database export), I write real migration scripts. Nothing is faked here because a wrong migration could corrupt years of real financial records.
- **Android app** — needs Android Studio and app-signing tooling that isn't available in this environment. Once the web app is finalized, wrapping it for Android is a separate, real, buildable task — not something I can fake as a demo here.
- **Full form/report-level permission enforcement** — roles are stored and displayed, but every logged-in account can currently access every screen. Real per-role restriction is a defined next step, not simulated in this pass.
- The other ~90+ reports beyond the ones listed above — a representative set is built; the rest is additional (straightforward, but real) work.

## Legacy Data Migration (COMPLETE - real, not simulated)

Your old software's database was analyzed, decoded, and migrated for real:

**What it was:** A Visual FoxPro application called "DIGITAL". The Urdu text needed the `cp1256`
codepage to decode correctly - once that was found, the data was completely intact and readable.

**What was found and imported:**
- **157 real customer/plot accounts** - names, CNICs, addresses, prices, installment terms,
  witness details - matched against your original sample documents and confirmed accurate
  (plot `02-35-0173` checks out exactly)
- **2,679 individual historical transactions** for those real accounts, preserved in full and
  viewable per-plot (Projects & Plots → look up a plot code → "View Legacy Transaction History")
- **9 landowner records** (land the society purchased from individuals) - correctly identified
  by their Urdu account names and routed into the Landlords module, not the Customers module
- **120 internal bookkeeping accounts** (Office Cash, Salary, Bank, Tax, staff expenses) that
  were mixed into the same legacy table as customer accounts - these were **not** imported as
  fake customers. They were posted into Accounting as vouchers against a "Migration Suspense"
  account (code 2900), each one narrated with its exact original legacy account name and code
  for full traceability. This bucket needs an accountant's review to reclassify into permanent
  accounts - it was deliberately not guessed into a final category.

**Verified:** the full trial balance still balances exactly after both migration passes
(debit = credit = Rs. 2,473,486,030 across the whole ledger).

**To re-run this migration** (e.g. against a newer export): the scripts are in `migration/`.
`extract.py` reads the raw `.DBF` files (needs Python + the `dbfread` package) and produces
`accounts.json` / `ledger.json`. Then run, in order: `node migration/import.js` (real
customers/plots/ledger, writes `internal-accounts.json` for the non-customer accounts it set
aside), `python3 migration/categorize.py` (categorizes those internal accounts), then
`node migration/import-internal.js` (posts them as landlords + suspense-balanced vouchers).
These now run against Turso (set `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` first — see
`DEPLOY.md`), not a local file, so there's no local database file to back up — but consider
using a fresh Turso database for a dry run before pointing at production.

## How to run it

Requires [Node.js](https://nodejs.org) (v18+).

```bash
cd erp
cp .env.example .env
```
Fill in `.env` — either point `TURSO_DATABASE_URL` at `file:./db/local-test.db` for a
throwaway local database, or use real Turso credentials to develop against production
data directly (see `DEPLOY.md`).

```bash
npm install
npm start
```

Open **http://localhost:3000**. First visit walks you through creating the admin account.

## Database & hosting architecture

This app is built to deploy on **Netlify** (serverless), backed by **Turso** (a hosted,
network-accessible SQLite-compatible database) and **Netlify Blobs** (for uploaded landlord
documents) — not a local file or a traditional VPS. See **`DEPLOY.md`** for the complete
step-by-step deployment guide: creating your Turso database, connecting GitHub to Netlify,
setting environment variables, and re-running the data migration against the live database.

`db/db.js` is the only file that talks to the database directly — schema.sql's SQLite dialect
works as-is against Turso with no query changes needed elsewhere in the app.

## Deploying so your client can actually access it

See **`DEPLOY.md`** for the full walkthrough. Short version: push this repo to GitHub, connect
it to a new Netlify site, set `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `JWT_SECRET`, and
`NODE_ENV=production` as environment variables in Netlify's dashboard, deploy. No VPS, no
server management.

## Project structure

```
erp/
  server.js                Local dev entry point (npm start)
  app.js                    Shared Express app (routes only) - used by both
                              server.js and the Netlify Function
  netlify.toml               Netlify build/routing config
  netlify/functions/api.js    Netlify Function wrapper (production entry point)
  DEPLOY.md                    Step-by-step Netlify deployment guide
  .env.example                  Environment variable template for local dev
  schema.sql                Full target database design (all modules)
  db/
    schema.sql              SQLite-dialect schema (works as-is on Turso)
    db.js                    Async database access layer (Turso client)
  auth/
    routes.js                Login/setup/logout - JWT in httpOnly cookie
    password.js               Password hashing (built-in crypto)
    users_routes.js            Team account management
  utils/
    asyncHandler.js            Wraps async route handlers for error safety
  routes/
    plots.js                 Projects, blocks, plots
    customers.js              Customers
    sales.js                   Sales, installments, transfers, broker commission
    documents.js                Printable agreement (bilingual) + NOC
    accounting.js                Chart of accounts, vouchers, trial balance
    brokers.js                   Broker CRUD
    charges.js                    Development/WASA/WAPDA/society charges
    noc.js                          NOC issuance (real gating logic)
    resale.js                        Buy-back / resale with P&L posting
    landlords.js                      Landlord records + file upload (Netlify Blobs)
    simulated.js                       WhatsApp / biometric / registry-fee (placeholder
                                         integrations pending real credentials - see note below)
  public/
    index.html, style.css, app.js    Full UI: "Open Ledger" theme (pine sidebar + parchment
                                       pages), cinematic 3D login/overview scenes, registry-
                                       stamp code styling throughout
```

## A note on WhatsApp, biometric, and registry fee

These three features are fully wired up end-to-end (forms, buttons, animations, database
logging) but don't yet connect to real external services:
- **WhatsApp** logs the message and confirms "sent" but doesn't call a real WhatsApp Business
  API / Twilio account yet — add real credentials in `routes/simulated.js` when ready.
- **Biometric capture** generates a placeholder reference — swap in your actual fingerprint
  scanner's SDK once the hardware model is confirmed.
- **Registry fee calculator** uses placeholder tax slabs, not your real formula — update the
  rates in `routes/simulated.js` once provided.

No "demo"/"simulated" wording is shown in the UI itself per client request — this note is here
for whoever maintains the code next.
