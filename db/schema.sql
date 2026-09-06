-- Core tables for Module 1 (Projects/Plots) and Module 2 (Customers/Sales/Installments)
-- Mirrors the full design in schema.sql, adapted for SQLite syntax.

CREATE TABLE IF NOT EXISTS projects (
    project_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    project_name    TEXT NOT NULL,
    location        TEXT,
    description     TEXT,
    created_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS blocks (
    block_id        INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id      INTEGER REFERENCES projects(project_id),
    block_name      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS plot_types (
    plot_type_id    INTEGER PRIMARY KEY AUTOINCREMENT,
    type_name       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS plots (
    plot_id         INTEGER PRIMARY KEY AUTOINCREMENT,
    plot_code       TEXT NOT NULL UNIQUE,
    project_id      INTEGER REFERENCES projects(project_id),
    block_id        INTEGER REFERENCES blocks(block_id),
    plot_type_id    INTEGER REFERENCES plot_types(plot_type_id),
    plot_number     TEXT,
    khasra_number   TEXT,
    width_ft        REAL,
    length_ft       REAL,
    marla           REAL,
    square_feet     REAL,
    category        TEXT,
    base_price      REAL,
    status          TEXT DEFAULT 'available',
    created_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS customers (
    customer_id     INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name       TEXT NOT NULL,
    father_name     TEXT,
    cnic            TEXT UNIQUE,
    phone           TEXT,
    whatsapp_number TEXT,
    address         TEXT,
    photo_path      TEXT,
    biometric_ref   TEXT,
    created_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS brokers (
    broker_id       INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name       TEXT NOT NULL,
    phone           TEXT,
    cnic            TEXT,
    commission_rate REAL
);

CREATE TABLE IF NOT EXISTS ownership_history (
    ownership_id    INTEGER PRIMARY KEY AUTOINCREMENT,
    plot_id         INTEGER REFERENCES plots(plot_id),
    customer_id     INTEGER REFERENCES customers(customer_id),
    broker_id       INTEGER REFERENCES brokers(broker_id),
    start_date      TEXT NOT NULL,
    end_date        TEXT,
    is_current      INTEGER DEFAULT 1,
    acquisition_type TEXT DEFAULT 'sale',
    sale_contract_id INTEGER
);

CREATE TABLE IF NOT EXISTS sale_contracts (
    contract_id     INTEGER PRIMARY KEY AUTOINCREMENT,
    plot_id         INTEGER REFERENCES plots(plot_id),
    ownership_id    INTEGER REFERENCES ownership_history(ownership_id),
    total_price     REAL NOT NULL,
    down_payment    REAL DEFAULT 0,
    contract_date   TEXT NOT NULL,
    plan_type       TEXT NOT NULL,
    number_of_installments INTEGER,
    installment_amount REAL,
    status          TEXT DEFAULT 'active',
    urdu_clause_text TEXT,
    english_clause_text TEXT,
    created_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS installment_schedule (
    installment_id  INTEGER PRIMARY KEY AUTOINCREMENT,
    contract_id     INTEGER REFERENCES sale_contracts(contract_id),
    due_date        TEXT NOT NULL,
    due_amount      REAL NOT NULL,
    paid_amount     REAL DEFAULT 0,
    paid_date       TEXT,
    status          TEXT DEFAULT 'pending',
    payment_mode    TEXT
);

CREATE TABLE IF NOT EXISTS users (
    user_id         INTEGER PRIMARY KEY AUTOINCREMENT,
    username        TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    salt            TEXT NOT NULL,
    full_name       TEXT NOT NULL,
    role            TEXT DEFAULT 'admin',   -- admin for now; expand to full role table in phase 2
    is_active       INTEGER DEFAULT 1,
    created_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_plots_code ON plots(plot_code);
CREATE INDEX IF NOT EXISTS idx_ownership_plot_current ON ownership_history(plot_id, is_current);
CREATE INDEX IF NOT EXISTS idx_installments_contract ON installment_schedule(contract_id);

-- ============================================================
-- PHASE 2 MODULES
-- ============================================================

-- ---------- Brokers ----------
CREATE TABLE IF NOT EXISTS brokers (
    broker_id       INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name       TEXT NOT NULL,
    phone           TEXT,
    cnic            TEXT,
    commission_rate REAL DEFAULT 1.0,
    created_at      TEXT DEFAULT (datetime('now'))
);

-- ---------- Accounting: 4-level chart of accounts ----------
CREATE TABLE IF NOT EXISTS chart_of_accounts (
    account_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    account_code    TEXT NOT NULL UNIQUE,
    account_name    TEXT NOT NULL,
    parent_account_id INTEGER REFERENCES chart_of_accounts(account_id),
    level           INTEGER NOT NULL,
    account_type    TEXT,
    is_active       INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS vouchers (
    voucher_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    voucher_type    TEXT NOT NULL,
    voucher_no      TEXT NOT NULL UNIQUE,
    voucher_date    TEXT NOT NULL,
    narration       TEXT,
    contract_id     INTEGER REFERENCES sale_contracts(contract_id),
    installment_id  INTEGER REFERENCES installment_schedule(installment_id),
    created_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS voucher_entries (
    entry_id        INTEGER PRIMARY KEY AUTOINCREMENT,
    voucher_id      INTEGER REFERENCES vouchers(voucher_id),
    account_id      INTEGER REFERENCES chart_of_accounts(account_id),
    debit           REAL DEFAULT 0,
    credit          REAL DEFAULT 0
);

-- ---------- Charges ----------
CREATE TABLE IF NOT EXISTS charge_types (
    charge_type_id  INTEGER PRIMARY KEY AUTOINCREMENT,
    charge_name     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS plot_charges (
    plot_charge_id  INTEGER PRIMARY KEY AUTOINCREMENT,
    plot_id         INTEGER REFERENCES plots(plot_id),
    charge_type_id  INTEGER REFERENCES charge_types(charge_type_id),
    amount          REAL NOT NULL,
    applied_date    TEXT DEFAULT (datetime('now'))
);

-- ---------- NOC ----------
CREATE TABLE IF NOT EXISTS noc_certificates (
    noc_id          INTEGER PRIMARY KEY AUTOINCREMENT,
    plot_id         INTEGER REFERENCES plots(plot_id),
    ownership_id    INTEGER REFERENCES ownership_history(ownership_id),
    issue_date      TEXT,
    issued_by       INTEGER REFERENCES users(user_id)
);

-- ---------- Resale / Buy-back ----------
CREATE TABLE IF NOT EXISTS buyback_resale (
    txn_id          INTEGER PRIMARY KEY AUTOINCREMENT,
    plot_id         INTEGER REFERENCES plots(plot_id),
    txn_type        TEXT NOT NULL,
    txn_date        TEXT NOT NULL,
    amount          REAL NOT NULL,
    related_ownership_id INTEGER REFERENCES ownership_history(ownership_id),
    profit_loss_amount REAL,
    voucher_id      INTEGER REFERENCES vouchers(voucher_id)
);

-- ---------- Landlords ----------
CREATE TABLE IF NOT EXISTS landlords (
    landlord_id     INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name       TEXT NOT NULL,
    cnic            TEXT,
    phone           TEXT,
    address         TEXT,
    land_area       REAL,
    purchase_price  REAL,
    purchase_date   TEXT
);

CREATE TABLE IF NOT EXISTS landlord_documents (
    doc_id          INTEGER PRIMARY KEY AUTOINCREMENT,
    landlord_id     INTEGER REFERENCES landlords(landlord_id),
    doc_title       TEXT,
    file_path       TEXT NOT NULL,
    uploaded_at     TEXT DEFAULT (datetime('now'))
);

-- ---------- Simulated notification log (WhatsApp/SMS demo) ----------
CREATE TABLE IF NOT EXISTS notification_log (
    notification_id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id     INTEGER REFERENCES customers(customer_id),
    channel         TEXT,
    message_text    TEXT,
    status          TEXT DEFAULT 'simulated',
    sent_at         TEXT DEFAULT (datetime('now'))
);

-- ---------- Legacy migration: raw historical ledger from old software ----------
CREATE TABLE IF NOT EXISTS legacy_ledger (
    entry_id        INTEGER PRIMARY KEY AUTOINCREMENT,
    plot_id         INTEGER REFERENCES plots(plot_id),
    entry_date      TEXT,
    particular      TEXT,
    entry_type      TEXT,
    voucher_no      TEXT,
    debit           REAL DEFAULT 0,
    credit          REAL DEFAULT 0,
    running_balance REAL,
    payment_mode    TEXT
);
CREATE INDEX IF NOT EXISTS idx_legacy_ledger_plot ON legacy_ledger(plot_id);

CREATE TABLE IF NOT EXISTS migration_log (
    migration_id    INTEGER PRIMARY KEY AUTOINCREMENT,
    run_at          TEXT DEFAULT (datetime('now')),
    accounts_imported INTEGER,
    accounts_skipped INTEGER,
    ledger_entries_imported INTEGER,
    notes           TEXT
);

INSERT INTO charge_types (charge_name) SELECT 'Development' WHERE NOT EXISTS (SELECT 1 FROM charge_types WHERE charge_name='Development');
INSERT INTO charge_types (charge_name) SELECT 'WASA' WHERE NOT EXISTS (SELECT 1 FROM charge_types WHERE charge_name='WASA');
INSERT INTO charge_types (charge_name) SELECT 'WAPDA' WHERE NOT EXISTS (SELECT 1 FROM charge_types WHERE charge_name='WAPDA');
INSERT INTO charge_types (charge_name) SELECT 'Society' WHERE NOT EXISTS (SELECT 1 FROM charge_types WHERE charge_name='Society');

INSERT INTO chart_of_accounts (account_code, account_name, level, account_type) SELECT '1000','ASSETS',1,'asset' WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE account_code='1000');
INSERT INTO chart_of_accounts (account_code, account_name, level, account_type) SELECT '1100','Cash in Hand',2,'asset' WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE account_code='1100');
INSERT INTO chart_of_accounts (account_code, account_name, level, account_type) SELECT '1200','Bank Account',2,'asset' WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE account_code='1200');
INSERT INTO chart_of_accounts (account_code, account_name, level, account_type) SELECT '4000','INCOME',1,'income' WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE account_code='4000');
INSERT INTO chart_of_accounts (account_code, account_name, level, account_type) SELECT '4100','Plot Sale Income',2,'income' WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE account_code='4100');
INSERT INTO chart_of_accounts (account_code, account_name, level, account_type) SELECT '4200','Resale Profit',2,'income' WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE account_code='4200');
INSERT INTO chart_of_accounts (account_code, account_name, level, account_type) SELECT '5000','EXPENSES',1,'expense' WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE account_code='5000');
INSERT INTO chart_of_accounts (account_code, account_name, level, account_type) SELECT '5100','Broker Commission',2,'expense' WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE account_code='5100');
INSERT INTO chart_of_accounts (account_code, account_name, level, account_type) SELECT '5200','Resale Loss',2,'expense' WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE account_code='5200');
INSERT INTO chart_of_accounts (account_code, account_name, level, account_type) SELECT '2000','LIABILITIES',1,'liability' WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE account_code='2000');
INSERT INTO chart_of_accounts (account_code, account_name, level, account_type) SELECT '2100','Buy-back Payable',2,'liability' WHERE NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE account_code='2100');

INSERT INTO plot_types (type_name) SELECT 'Residential' WHERE NOT EXISTS (SELECT 1 FROM plot_types);
INSERT INTO plot_types (type_name) SELECT 'Commercial' WHERE NOT EXISTS (SELECT 1 FROM plot_types WHERE type_name='Commercial');
INSERT INTO plot_types (type_name) SELECT 'Shop' WHERE NOT EXISTS (SELECT 1 FROM plot_types WHERE type_name='Shop');
INSERT INTO plot_types (type_name) SELECT 'Apartment' WHERE NOT EXISTS (SELECT 1 FROM plot_types WHERE type_name='Apartment');
