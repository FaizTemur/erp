// ============================================================
// LANGUAGE / TRANSLATION SYSTEM
// ============================================================

const TRANSLATIONS = {
  en: {
    // Login screen
    housing_registry: 'Housing Society Registry',
    sign_in: 'Sign in',
    create_admin_account: 'Create admin account',
    enter_credentials: 'Enter your credentials to continue.',
    setup_subtitle: 'This is a one-time setup. This account will have full access.',
    full_name: 'Full Name',
    username: 'Username',
    password: 'Password',
    sign_in_btn: 'Sign in',
    create_and_sign_in: 'Create account & sign in',

    // Sidebar
    erp_console: 'ERP Console',
    nav_overview: 'Overview',
    nav_projects: 'Projects & Plots',
    nav_customers: 'Customers',
    nav_sales: 'Sell a Plot',
    nav_recovery: 'Recovery',
    nav_transfer: 'Transfer',
    nav_noc: 'NOC & Resale',
    nav_accounting: 'Accounting',
    nav_brokers: 'Brokers',
    nav_landlords: 'Landlords',
    nav_team: 'Team',
    nav_tools: 'Utilities',
    nav_migration: 'Migration Report',
    logout: 'Log out',

    // Topbar
    plot_lookup_placeholder: 'Look up plot by code (e.g. 2130)',
    find: 'Find',

    // Overview
    live_portfolio: 'Live Portfolio',
    hero_headline: 'Every plot, every rupee,<br>one console.',
    active_projects: 'Active Projects',
    total_plots: 'Total Plots',
    customers_label: 'Customers',
    overdue_accounts: 'Overdue Accounts',
    plot_status_breakdown: 'Plot Status Breakdown',

    // Projects & Plots
    projects: 'Projects',
    new_project: '+ New Project',
    plots: 'Plots',
    new_plot: '+ Add Plot',
    bulk_create: 'Bulk Create',
    th_code: 'Code',
    th_block: 'Block',
    th_type: 'Type',
    th_marla: 'Marla',
    th_base_price: 'Base Price',
    th_status: 'Status',

    // Customers
    customers_title: 'Customers',
    search_customer_placeholder: 'Search name / CNIC / phone',
    new_customer: '+ New Customer',
    th_name: 'Name',
    th_father_name: "Father's Name",
    th_cnic: 'CNIC',
    th_phone: 'Phone',
    customer_ledger: 'Customer Ledger',

    // Sell a Plot
    sell_a_plot: 'Sell a Plot',
    plot_code_label: 'Plot Code',
    customer_label: 'Customer',
    total_price: 'Total Price',
    down_payment: 'Down Payment',
    contract_date: 'Contract Date',
    plan_type: 'Plan Type',
    plan_one_time: 'One-time',
    plan_monthly: 'Monthly',
    plan_quarterly: 'Quarterly',
    plan_semi_annual: 'Semi-annual',
    plan_annual: 'Annual',
    number_of_installments: 'Number of Installments',
    english_clause: 'English Clause (optional)',
    create_sale_contract: 'Create Sale Contract',

    // Recovery
    outstanding_defaulters: 'Outstanding & Defaulters',
    refresh: 'Refresh',
    th_customer: 'Customer',
    th_plot: 'Plot',
    th_outstanding: 'Outstanding',
    th_overdue_installments: 'Overdue Installments',
    record_a_payment: 'Record a Payment',
    installment_id: 'Installment ID',
    paid_amount: 'Paid Amount',
    paid_date: 'Paid Date',
    mode: 'Mode',
    cash: 'Cash',
    bank: 'Bank',
    record_payment: 'Record Payment',

    // Transfer
    transfer_ownership_title: 'Transfer Plot Ownership',
    transfer_hint: "Plot code stays the same. The new owner becomes current; the previous owner's ledger is preserved in history.",
    new_owner: 'New Owner',
    transfer_date: 'Transfer Date',
    transfer_fee: 'Transfer Fee',
    transfer_ownership_btn: 'Transfer Ownership',

    // NOC & Resale
    noc_status_issuance: 'NOC Status & Issuance',
    check_status: 'Check Status',
    buyback_a_plot: 'Buy-back a Plot',
    buyback_hint: 'Society repurchases the plot from its current owner.',
    buyback_amount: 'Buy-back Amount',
    date_label: 'Date',
    record_buyback: 'Record Buy-back',
    resell_bought_back: 'Resell a Bought-back Plot',
    resale_hint: 'Profit or loss vs. the buy-back price posts to the ledger automatically.',
    new_buyer: 'New Buyer',
    resale_amount: 'Resale Amount',
    record_resale: 'Record Resale',

    // Accounting
    trial_balance: 'Trial Balance',
    th_account: 'Account',
    th_debit: 'Debit',
    th_credit: 'Credit',
    recent_vouchers: 'Recent Vouchers',
    th_no: 'No.',
    th_date: 'Date',
    th_narration: 'Narration',

    // Brokers
    brokers_agents: 'Brokers & Sales Agents',
    new_broker: '+ New Broker',
    th_commission_rate: 'Commission Rate',

    // Landlords
    landlords_title: 'Landlords',
    new_landlord: '+ New Landlord',
    th_land_area: 'Land Area',
    th_purchase_price: 'Purchase Price',
    documents: 'Documents',

    // Team
    team_accounts: 'Team Accounts',
    new_team_member: '+ New Team Member',
    team_hint: 'Roles are labels for now — every logged-in account currently has full access. Per-role restrictions are a planned next step.',
    th_username: 'Username',
    th_role: 'Role',

    // Migration report
    migration_report_title: 'What Was Imported From Your Legacy Software',

    // Utilities
    whatsapp_notification: 'WhatsApp Payment Notification',
    message_label: 'Message',
    send: 'Send',
    biometric_capture: 'Biometric Capture',
    scan_fingerprint: 'Scan Fingerprint',
    registry_fee_calculator: 'Registry Fee Calculator',
    plot_size_marla: 'Plot Size (Marla)',
    sale_value: 'Sale Value',
    calculate: 'Calculate',

    // Common / modal
    cancel: 'Cancel',
    create: 'Create',
    save: 'Save',
    close: 'Close',
    view: 'View',
    print: 'Print',
    upload: 'Upload',

    // Status words (dynamic content)
    status_available: 'available',
    status_sold: 'sold',
    status_transferred: 'transferred',
    status_bought_back: 'bought back',
  },

  ur: {
    housing_registry: 'ہاؤسنگ سوسائٹی رجسٹری',
    sign_in: 'سائن ان کریں',
    create_admin_account: 'ایڈمن اکاؤنٹ بنائیں',
    enter_credentials: 'جاری رکھنے کے لیے اپنی تفصیلات درج کریں۔',
    setup_subtitle: 'یہ ایک بار کی سیٹ اپ ہے۔ اس اکاؤنٹ کو مکمل رسائی حاصل ہوگی۔',
    full_name: 'پورا نام',
    username: 'یوزر نیم',
    password: 'پاس ورڈ',
    sign_in_btn: 'سائن ان کریں',
    create_and_sign_in: 'اکاؤنٹ بنائیں اور سائن ان کریں',

    erp_console: 'ای آر پی کنسول',
    nav_overview: 'جائزہ',
    nav_projects: 'پراجیکٹس اور پلاٹس',
    nav_customers: 'کسٹمرز',
    nav_sales: 'پلاٹ فروخت کریں',
    nav_recovery: 'وصولی',
    nav_transfer: 'ٹرانسفر',
    nav_noc: 'این او سی اور دوبارہ فروخت',
    nav_accounting: 'اکاؤنٹنگ',
    nav_brokers: 'بروکرز',
    nav_landlords: 'زمین دار',
    nav_team: 'ٹیم',
    nav_tools: 'یوٹیلیٹیز',
    nav_migration: 'مائیگریشن رپورٹ',
    logout: 'لاگ آؤٹ',

    plot_lookup_placeholder: 'پلاٹ کوڈ سے تلاش کریں (مثال 2130)',
    find: 'تلاش کریں',

    live_portfolio: 'لائیو پورٹ فولیو',
    hero_headline: 'ہر پلاٹ، ہر روپیہ،<br>ایک ہی جگہ۔',
    active_projects: 'فعال پراجیکٹس',
    total_plots: 'کل پلاٹس',
    customers_label: 'کسٹمرز',
    overdue_accounts: 'واجب الادا اکاؤنٹس',
    plot_status_breakdown: 'پلاٹ کی صورتحال',

    projects: 'پراجیکٹس',
    new_project: '+ نیا پراجیکٹ',
    plots: 'پلاٹس',
    new_plot: '+ پلاٹ شامل کریں',
    bulk_create: 'یکجا تخلیق',
    th_code: 'کوڈ',
    th_block: 'بلاک',
    th_type: 'قسم',
    th_marla: 'مرلہ',
    th_base_price: 'بنیادی قیمت',
    th_status: 'صورتحال',

    customers_title: 'کسٹمرز',
    search_customer_placeholder: 'نام / شناختی کارڈ / فون تلاش کریں',
    new_customer: '+ نیا کسٹمر',
    th_name: 'نام',
    th_father_name: 'والد کا نام',
    th_cnic: 'شناختی کارڈ',
    th_phone: 'فون',
    customer_ledger: 'کسٹمر لیجر',

    sell_a_plot: 'پلاٹ فروخت کریں',
    plot_code_label: 'پلاٹ کوڈ',
    customer_label: 'کسٹمر',
    total_price: 'کل قیمت',
    down_payment: 'ایڈوانس',
    contract_date: 'معاہدے کی تاریخ',
    plan_type: 'پلان کی قسم',
    plan_one_time: 'یک مشت',
    plan_monthly: 'ماہانہ',
    plan_quarterly: 'سہ ماہی',
    plan_semi_annual: 'ششماہی',
    plan_annual: 'سالانہ',
    number_of_installments: 'اقساط کی تعداد',
    english_clause: 'انگریزی شق (اختیاری)',
    create_sale_contract: 'فروخت کا معاہدہ بنائیں',

    outstanding_defaulters: 'واجبات اور نادہندگان',
    refresh: 'تازہ کریں',
    th_customer: 'کسٹمر',
    th_plot: 'پلاٹ',
    th_outstanding: 'واجب الادا',
    th_overdue_installments: 'زائد المیعاد اقساط',
    record_a_payment: 'ادائیگی درج کریں',
    installment_id: 'قسط آئی ڈی',
    paid_amount: 'ادا شدہ رقم',
    paid_date: 'ادائیگی کی تاریخ',
    mode: 'طریقہ',
    cash: 'نقد',
    bank: 'بینک',
    record_payment: 'ادائیگی درج کریں',

    transfer_ownership_title: 'پلاٹ کی ملکیت منتقل کریں',
    transfer_hint: 'پلاٹ کوڈ وہی رہتا ہے۔ نیا مالک موجودہ مالک بن جاتا ہے؛ پچھلے مالک کا ریکارڈ محفوظ رہتا ہے۔',
    new_owner: 'نیا مالک',
    transfer_date: 'منتقلی کی تاریخ',
    transfer_fee: 'منتقلی فیس',
    transfer_ownership_btn: 'ملکیت منتقل کریں',

    noc_status_issuance: 'این او سی کی صورتحال اور اجراء',
    check_status: 'صورتحال چیک کریں',
    buyback_a_plot: 'پلاٹ واپس خریدیں',
    buyback_hint: 'سوسائٹی موجودہ مالک سے پلاٹ واپس خریدتی ہے۔',
    buyback_amount: 'واپس خریداری کی رقم',
    date_label: 'تاریخ',
    record_buyback: 'واپس خریداری درج کریں',
    resell_bought_back: 'واپس خریدا گیا پلاٹ دوبارہ فروخت کریں',
    resale_hint: 'واپس خریداری کی قیمت کے مقابلے نفع یا نقصان خود بخود لیجر میں درج ہو جاتا ہے۔',
    new_buyer: 'نیا خریدار',
    resale_amount: 'دوبارہ فروخت کی رقم',
    record_resale: 'دوبارہ فروخت درج کریں',

    trial_balance: 'ٹرائل بیلنس',
    th_account: 'اکاؤنٹ',
    th_debit: 'ڈیبٹ',
    th_credit: 'کریڈٹ',
    recent_vouchers: 'حالیہ واؤچرز',
    th_no: 'نمبر',
    th_date: 'تاریخ',
    th_narration: 'تفصیل',

    brokers_agents: 'بروکرز اور سیلز ایجنٹس',
    new_broker: '+ نیا بروکر',
    th_commission_rate: 'کمیشن کی شرح',

    landlords_title: 'زمین دار',
    new_landlord: '+ نیا زمین دار',
    th_land_area: 'زمین کا رقبہ',
    th_purchase_price: 'خریداری قیمت',
    documents: 'دستاویزات',

    team_accounts: 'ٹیم اکاؤنٹس',
    new_team_member: '+ نیا ٹیم ممبر',
    team_hint: 'ابھی کردار صرف لیبل ہیں — ہر لاگ اِن اکاؤنٹ کو مکمل رسائی حاصل ہے۔ کردار کے مطابق پابندیاں مستقبل میں شامل ہوں گی۔',
    th_username: 'یوزر نیم',
    th_role: 'کردار',

    migration_report_title: 'آپ کے پرانے سافٹ ویئر سے کیا درآمد کیا گیا',

    whatsapp_notification: 'واٹس ایپ ادائیگی اطلاع',
    message_label: 'پیغام',
    send: 'بھیجیں',
    biometric_capture: 'بائیومیٹرک کیپچر',
    scan_fingerprint: 'فنگر پرنٹ اسکین کریں',
    registry_fee_calculator: 'رجسٹری فیس کیلکولیٹر',
    plot_size_marla: 'پلاٹ کا سائز (مرلہ)',
    sale_value: 'فروخت کی مالیت',
    calculate: 'حساب لگائیں',

    cancel: 'منسوخ کریں',
    create: 'بنائیں',
    save: 'محفوظ کریں',
    close: 'بند کریں',
    view: 'دیکھیں',
    print: 'پرنٹ کریں',
    upload: 'اپ لوڈ کریں',

    status_available: 'دستیاب',
    status_sold: 'فروخت شدہ',
    status_transferred: 'منتقل شدہ',
    status_bought_back: 'واپس خریدا گیا',
  }
};

let currentLang = localStorage.getItem('hs_erp_lang') || 'en';

function t(key) {
  return (TRANSLATIONS[currentLang] && TRANSLATIONS[currentLang][key]) || TRANSLATIONS.en[key] || key;
}

function applyTranslations() {
  document.documentElement.setAttribute('lang', currentLang === 'ur' ? 'ur' : 'en');
  document.documentElement.setAttribute('dir', currentLang === 'ur' ? 'rtl' : 'ltr');
  document.body.classList.toggle('lang-ur', currentLang === 'ur');

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const translated = t(key);
    // Preserve <br> etc for keys that intentionally contain markup
    if (translated.includes('<')) {
      el.innerHTML = translated;
    } else {
      el.textContent = translated;
    }
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
  });

  const toggleBtn = document.getElementById('lang-toggle-btn');
  if (toggleBtn) toggleBtn.textContent = currentLang === 'en' ? 'اردو' : 'English';
  const toggleBtnAuth = document.getElementById('lang-toggle-auth');
  if (toggleBtnAuth) toggleBtnAuth.textContent = currentLang === 'en' ? 'اردو' : 'English';
}

function setLanguage(lang) {
  localStorage.setItem('hs_erp_lang', lang);
  location.reload();
}

function toggleLanguage() {
  setLanguage(currentLang === 'en' ? 'ur' : 'en');
}
