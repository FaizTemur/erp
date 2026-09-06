-- ============================================================
-- HOUSING SOCIETY / REAL ESTATE ERP - CORE DATABASE SCHEMA
-- Engine: PostgreSQL (adjust types slightly for MySQL if needed)
-- ============================================================

-- ------------------------------------------------------------
-- 1. USERS, ROLES & PERMISSIONS
-- ------------------------------------------------------------

CREATE TABLE roles (
    role_id         SERIAL PRIMARY KEY,
    role_name       VARCHAR(100) NOT NULL UNIQUE,
    description     TEXT
);

CREATE TABLE users (
    user_id         SERIAL PRIMARY KEY,
    username        VARCHAR(100) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    full_name       VARCHAR(200) NOT NULL,
    phone           VARCHAR(30),
    role_id         INT REFERENCES roles(role_id),
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Fine-grained permission per form/report, per role
CREATE TABLE permissions (
    permission_id   SERIAL PRIMARY KEY,
    role_id         INT REFERENCES roles(role_id),
    module_key      VARCHAR(100) NOT NULL,   -- e.g. 'plots', 'installments', 'accounting.vouchers'
    can_view        BOOLEAN DEFAULT FALSE,
    can_create      BOOLEAN DEFAULT FALSE,
    can_edit        BOOLEAN DEFAULT FALSE,
    can_delete      BOOLEAN DEFAULT FALSE,
    UNIQUE(role_id, module_key)
);

-- ------------------------------------------------------------
-- 2. PROJECTS, BLOCKS, PLOTS / UNITS
-- ------------------------------------------------------------

CREATE TABLE projects (
    project_id      SERIAL PRIMARY KEY,
    project_name    VARCHAR(200) NOT NULL,
    location        TEXT,
    description     TEXT,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE blocks (
    block_id        SERIAL PRIMARY KEY,
    project_id      INT REFERENCES projects(project_id),
    block_name      VARCHAR(50) NOT NULL
);

CREATE TABLE plot_types (
    plot_type_id    SERIAL PRIMARY KEY,
    type_name       VARCHAR(100) NOT NULL   -- Residential, Commercial, Shop, Apartment
);

-- Permanent plot record. plot_code NEVER changes, regardless of transfers.
CREATE TABLE plots (
    plot_id         SERIAL PRIMARY KEY,
    plot_code       VARCHAR(50) NOT NULL UNIQUE,   -- e.g. '2130' - permanent identity
    project_id      INT REFERENCES projects(project_id),
    block_id        INT REFERENCES blocks(block_id),
    plot_type_id    INT REFERENCES plot_types(plot_type_id),
    plot_number      VARCHAR(50),
    khasra_number    VARCHAR(100),
    width_ft         DECIMAL(10,2),
    length_ft        DECIMAL(10,2),
    marla            DECIMAL(10,4),
    square_feet      DECIMAL(12,2),
    category         VARCHAR(50),        -- corner, park-facing, main-road etc.
    base_price       DECIMAL(15,2),
    status           VARCHAR(30) DEFAULT 'available',  -- available, sold, transferred, bought_back
    created_at        TIMESTAMP DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 3. CUSTOMERS & NOMINEES
-- ------------------------------------------------------------

CREATE TABLE customers (
    customer_id     SERIAL PRIMARY KEY,
    full_name       VARCHAR(200) NOT NULL,
    father_name     VARCHAR(200),
    cnic            VARCHAR(20) UNIQUE,
    phone           VARCHAR(30),
    whatsapp_number VARCHAR(30),
    address         TEXT,
    photo_path      TEXT,               -- captured live photo
    biometric_ref   TEXT,               -- pointer/ID into biometric device storage
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE nominees (
    nominee_id      SERIAL PRIMARY KEY,
    customer_id     INT REFERENCES customers(customer_id),
    full_name       VARCHAR(200),
    relation        VARCHAR(100),
    cnic            VARCHAR(20),
    phone           VARCHAR(30)
);

-- ------------------------------------------------------------
-- 4. BROKERS / SALES AGENTS
-- ------------------------------------------------------------

CREATE TABLE brokers (
    broker_id       SERIAL PRIMARY KEY,
    full_name       VARCHAR(200) NOT NULL,
    phone           VARCHAR(30),
    cnic            VARCHAR(20),
    commission_rate DECIMAL(6,3),        -- default %, can be overridden per contract
    account_id      INT                  -- FK to chart_of_accounts, set below
);

-- ------------------------------------------------------------
-- 5. OWNERSHIP HISTORY  (this is the key design for your requirement #3)
-- ------------------------------------------------------------
-- A plot can pass through many owners. plot_code stays fixed.
-- Each row = one ownership period. is_current flags the active owner.

CREATE TABLE ownership_history (
    ownership_id    SERIAL PRIMARY KEY,
    plot_id         INT REFERENCES plots(plot_id),
    customer_id     INT REFERENCES customers(customer_id),
    broker_id       INT REFERENCES brokers(broker_id),
    start_date      DATE NOT NULL,
    end_date        DATE,                -- NULL while still current owner
    is_current      BOOLEAN DEFAULT TRUE,
    acquisition_type VARCHAR(30) DEFAULT 'sale',  -- sale, transfer, buy_back, resale
    sale_contract_id INT                 -- FK set below after sale_contracts is created
);

-- ------------------------------------------------------------
-- 6. SALE CONTRACTS & INSTALLMENT PLANS
-- ------------------------------------------------------------

CREATE TABLE sale_contracts (
    contract_id     SERIAL PRIMARY KEY,
    plot_id         INT REFERENCES plots(plot_id),
    ownership_id    INT REFERENCES ownership_history(ownership_id),
    total_price     DECIMAL(15,2) NOT NULL,
    down_payment    DECIMAL(15,2) DEFAULT 0,
    contract_date   DATE NOT NULL,
    plan_type       VARCHAR(30) NOT NULL,  -- one_time, monthly, quarterly, semi_annual, annual, custom
    number_of_installments INT,
    installment_amount DECIMAL(15,2),
    status          VARCHAR(30) DEFAULT 'active',  -- active, completed, defaulted, cancelled
    urdu_clause_text TEXT,               -- optional Urdu text block for the printed agreement
    english_clause_text TEXT,
    created_at      TIMESTAMP DEFAULT NOW()
);

ALTER TABLE ownership_history
    ADD CONSTRAINT fk_ownership_contract
    FOREIGN KEY (sale_contract_id) REFERENCES sale_contracts(contract_id);

CREATE TABLE installment_schedule (
    installment_id  SERIAL PRIMARY KEY,
    contract_id     INT REFERENCES sale_contracts(contract_id),
    due_date        DATE NOT NULL,
    due_amount      DECIMAL(15,2) NOT NULL,
    paid_amount     DECIMAL(15,2) DEFAULT 0,
    paid_date       DATE,
    status          VARCHAR(30) DEFAULT 'pending',  -- pending, paid, partial, overdue
    payment_mode    VARCHAR(30),          -- cash, bank
    received_by     INT REFERENCES users(user_id)
);

-- Price adjustments / renegotiations against a contract
CREATE TABLE price_adjustments (
    adjustment_id   SERIAL PRIMARY KEY,
    contract_id     INT REFERENCES sale_contracts(contract_id),
    adjustment_date DATE,
    old_price       DECIMAL(15,2),
    new_price       DECIMAL(15,2),
    reason          TEXT
);

-- ------------------------------------------------------------
-- 7. CHARGES (development, WASA, WAPDA, society)
-- ------------------------------------------------------------

CREATE TABLE charge_types (
    charge_type_id  SERIAL PRIMARY KEY,
    charge_name     VARCHAR(100) NOT NULL   -- Development, WASA, WAPDA, Society
);

CREATE TABLE plot_charges (
    plot_charge_id  SERIAL PRIMARY KEY,
    plot_id         INT REFERENCES plots(plot_id),
    charge_type_id  INT REFERENCES charge_types(charge_type_id),
    amount          DECIMAL(15,2) NOT NULL,
    basis           VARCHAR(50),           -- flat, per_marla, per_sqft
    applied_date    DATE DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 8. ACCOUNTING MODULE (4-level chart of accounts)
-- ------------------------------------------------------------

CREATE TABLE chart_of_accounts (
    account_id      SERIAL PRIMARY KEY,
    account_code    VARCHAR(30) NOT NULL UNIQUE,
    account_name    VARCHAR(200) NOT NULL,
    parent_account_id INT REFERENCES chart_of_accounts(account_id),
    level           INT NOT NULL,          -- 1=Main Group ... 4=Detail account
    account_type    VARCHAR(30),           -- asset, liability, income, expense, equity
    is_active       BOOLEAN DEFAULT TRUE
);

CREATE TABLE vouchers (
    voucher_id      SERIAL PRIMARY KEY,
    voucher_type    VARCHAR(30) NOT NULL,  -- cash_receipt, cash_payment, bank_receipt, bank_payment, journal
    voucher_no      VARCHAR(50) NOT NULL UNIQUE,
    voucher_date    DATE NOT NULL,
    narration       TEXT,
    contract_id     INT REFERENCES sale_contracts(contract_id),  -- nullable, links payments to a contract
    installment_id  INT REFERENCES installment_schedule(installment_id),
    created_by      INT REFERENCES users(user_id),
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE voucher_entries (
    entry_id        SERIAL PRIMARY KEY,
    voucher_id      INT REFERENCES vouchers(voucher_id),
    account_id      INT REFERENCES chart_of_accounts(account_id),
    debit           DECIMAL(15,2) DEFAULT 0,
    credit          DECIMAL(15,2) DEFAULT 0
);

-- ------------------------------------------------------------
-- 9. TRANSFERS, RESALE & BUY-BACK (profit/loss tracking)
-- ------------------------------------------------------------

CREATE TABLE transfers (
    transfer_id     SERIAL PRIMARY KEY,
    plot_id         INT REFERENCES plots(plot_id),
    from_ownership_id INT REFERENCES ownership_history(ownership_id),
    to_ownership_id   INT REFERENCES ownership_history(ownership_id),
    transfer_date   DATE NOT NULL,
    transfer_fee    DECIMAL(15,2) DEFAULT 0,
    original_agreement_received BOOLEAN DEFAULT FALSE,  -- gates new file generation (req #12)
    agreement_received_date DATE,
    remarks         TEXT
);

CREATE TABLE buyback_resale (
    txn_id          SERIAL PRIMARY KEY,
    plot_id         INT REFERENCES plots(plot_id),
    txn_type        VARCHAR(20) NOT NULL,   -- buy_back, resale
    txn_date        DATE NOT NULL,
    amount          DECIMAL(15,2) NOT NULL,
    related_ownership_id INT REFERENCES ownership_history(ownership_id),
    profit_loss_amount DECIMAL(15,2),       -- computed: resale price - buy-back cost
    voucher_id      INT REFERENCES vouchers(voucher_id)  -- posts P/L into main ledger
);

-- ------------------------------------------------------------
-- 10. NOC (No Objection Certificate)
-- ------------------------------------------------------------

CREATE TABLE noc_certificates (
    noc_id          SERIAL PRIMARY KEY,
    plot_id         INT REFERENCES plots(plot_id),
    ownership_id    INT REFERENCES ownership_history(ownership_id),
    issue_date      DATE,
    outstanding_balance_at_issue DECIMAL(15,2),  -- must be 0 to issue (enforced in app logic)
    issued_by       INT REFERENCES users(user_id),
    document_path   TEXT
);

-- ------------------------------------------------------------
-- 11. LANDLORDS (from whom raw land was purchased)
-- ------------------------------------------------------------

CREATE TABLE landlords (
    landlord_id     SERIAL PRIMARY KEY,
    full_name       VARCHAR(200) NOT NULL,
    cnic            VARCHAR(20),
    phone           VARCHAR(30),
    address         TEXT,
    land_area       DECIMAL(15,2),
    purchase_price  DECIMAL(15,2),
    purchase_date   DATE
);

CREATE TABLE landlord_documents (
    doc_id          SERIAL PRIMARY KEY,
    landlord_id     INT REFERENCES landlords(landlord_id),
    doc_title       VARCHAR(200),
    file_path       TEXT NOT NULL,
    uploaded_at     TIMESTAMP DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 12. DOCUMENTS: allotment letters, agreements, witnesses
-- ------------------------------------------------------------

CREATE TABLE agreement_documents (
    document_id     SERIAL PRIMARY KEY,
    contract_id     INT REFERENCES sale_contracts(contract_id),
    document_type   VARCHAR(50),          -- allotment_letter, agreement_form, noc
    allottee_photo_path TEXT,
    witness1_name   VARCHAR(200),
    witness1_photo_path TEXT,
    witness1_biometric_ref TEXT,
    witness2_name   VARCHAR(200),
    witness2_photo_path TEXT,
    witness2_biometric_ref TEXT,
    generated_pdf_path TEXT,
    generated_at    TIMESTAMP DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 13. NOTIFICATIONS LOG (SMS / WhatsApp)
-- ------------------------------------------------------------

CREATE TABLE notification_log (
    notification_id SERIAL PRIMARY KEY,
    customer_id     INT REFERENCES customers(customer_id),
    installment_id  INT REFERENCES installment_schedule(installment_id),
    channel         VARCHAR(20),          -- sms, whatsapp
    message_text    TEXT,
    status          VARCHAR(20),          -- sent, failed, pending
    sent_at         TIMESTAMP DEFAULT NOW()
);

-- ------------------------------------------------------------
-- INDEXES for common lookups
-- ------------------------------------------------------------

CREATE INDEX idx_plots_code ON plots(plot_code);
CREATE INDEX idx_ownership_plot_current ON ownership_history(plot_id, is_current);
CREATE INDEX idx_installments_contract ON installment_schedule(contract_id);
CREATE INDEX idx_installments_status ON installment_schedule(status);
CREATE INDEX idx_customers_cnic ON customers(cnic);
