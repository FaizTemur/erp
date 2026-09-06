# Deploying to Netlify — Step by Step

This app now runs as a Netlify Function (the Express backend) + static frontend,
backed by Turso (a hosted SQLite-compatible database) and Netlify Blobs (for
uploaded landlord documents). None of this needs a local file system, so it's
safe to run on Netlify's serverless infrastructure.

Budget about 30-45 minutes for the full setup the first time.

---

## Part 1 — Create your Turso database

1. Install the Turso CLI:
   ```bash
   curl -sSfL https://get.tur.so/install.sh | bash
   ```
2. Sign up / log in:
   ```bash
   turso auth signup
   ```
   (or `turso auth login` if you already have an account)
3. Create the database:
   ```bash
   turso db create housing-society-erp
   ```
4. Get the connection URL:
   ```bash
   turso db show housing-society-erp --url
   ```
   Copy this — it looks like `libsql://housing-society-erp-yourname.turso.io`
5. Create an auth token:
   ```bash
   turso db tokens create housing-society-erp
   ```
   Copy this too — it's a long string, this is your `TURSO_AUTH_TOKEN`.

Turso's free tier is generous (500 databases, 9GB storage, 1 billion row reads/month)
— you will not need to pay anything for a single housing society's data.

---

## Part 2 — Push this project to GitHub

Netlify deploys from a Git repository, not a direct file upload.

1. Create a new repository on GitHub (private is fine).
2. From inside the unzipped `erp` folder:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```
   (The `.gitignore` already excludes `node_modules`, `.env`, and local database files.)

---

## Part 3 — Create the Netlify site

1. Go to [app.netlify.com](https://app.netlify.com) and log in (or sign up — free).
2. Click **Add new site → Import an existing project**.
3. Choose GitHub, authorize Netlify, and select your repository.
4. Netlify should auto-detect the settings from `netlify.toml` (publish
   directory `public`, functions directory `netlify/functions`). Leave the
   build command blank — there's nothing to build, it's plain HTML/CSS/JS.
5. **Before clicking Deploy**, go to **Site settings → Environment variables**
   and add:

   | Key | Value |
   |---|---|
   | `TURSO_DATABASE_URL` | the `libsql://...` URL from Part 1 |
   | `TURSO_AUTH_TOKEN` | the token from Part 1 |
   | `JWT_SECRET` | any long random string (e.g. run `openssl rand -hex 32`) |
   | `NODE_ENV` | `production` |

6. Click **Deploy site**.

---

## Part 4 — First run

1. Once the deploy finishes, Netlify gives you a URL like `https://random-name-123.netlify.app`.
2. Open it. You should see the login screen (with the cinematic 3D scene).
3. It will prompt you to create the first admin account — do that with a real
   password, not a test one, since this connects straight to your real database.
4. You're in. Try creating a project and a plot to confirm everything's wired up.

If you want a custom domain instead of the netlify.app one, that's under
**Site settings → Domain management** — free to add, Netlify handles the SSL certificate.

---

## Part 5 — Migrate your real data (127 customers, Rs. 2.47B ledger)

This moves the customer/plot/ledger data already extracted from your old
software (`migration/accounts.json`, `migration/ledger.json`, etc.) into the
live Turso database, instead of the local SQLite file it used to use.

From your own machine (not on Netlify — this is a one-time script you run yourself):

```bash
cd erp
npm install
export TURSO_DATABASE_URL="libsql://housing-society-erp-yourname.turso.io"
export TURSO_AUTH_TOKEN="your-token-here"

node migration/import.js
python3 migration/categorize.py
node migration/import-internal.js
```

Watch the output — `import.js` will confirm real customers/plots/ledger
entries imported, and `import-internal.js` will confirm the landowner
records and Migration Suspense vouchers. This is the same process that
already ran successfully once before (293 legacy accounts → 157 real
customers + 9 landlords + 120 internal accounts, trial balance verified
balanced) — you're just re-pointing it at Turso instead of the local file.

---

## Local development after this change

```bash
cp .env.example .env
```
Fill in `.env` with your real Turso URL/token and a JWT secret (or point
`TURSO_DATABASE_URL` at `file:./db/local-test.db` to develop against a throwaway
local database instead of touching production data — this is what I used to
test everything before handing this off).

```bash
npm install
npm start
```
Same as before — `localhost:3000`.

**One feature won't work locally without extra setup**: landlord document
uploads use Netlify Blobs, which auto-configures itself inside Netlify's own
infrastructure (`netlify dev` or the real deployed site) but not under plain
`node server.js`. If you want to test that specific feature locally, add
`NETLIFY_SITE_ID` and `NETLIFY_BLOBS_TOKEN` to your `.env` (find them in
Site settings → General on Netlify), or just test it on the deployed site
directly. Everything else works identically either way.

---

## What changed under the hood (for your own reference)

- **Database**: local SQLite file → Turso (same SQL dialect, network-accessible,
  survives serverless function restarts)
- **Login sessions**: server-side sessions → JWT in an httpOnly cookie (stateless,
  works across serverless invocations)
- **File uploads**: local disk → Netlify Blobs
- **Server**: `node server.js` long-running process → wrapped as a Netlify
  Function (`netlify/functions/api.js`) for production, while `server.js`
  still works for local development against the same database

Nothing about the actual business logic (plot codes, ownership history,
accounting, NOC gating, migration data) changed — only how it's hosted.
