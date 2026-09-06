"""
Categorizes the internal (non-customer) legacy accounts found in MDS.DBF -
Office Cash, Salary, Bank, Tax, staff expenses, and landowner land-purchase
accounts - by keyword matching on their (Urdu/English) account names, so
import-internal.js knows which chart-of-accounts bucket or which module
(Landlords vs Accounting) each one belongs to.

Reads:  internal-accounts.json  (written by import.js)
Writes: internal-accounts-categorized.json

Usage: python3 migration/categorize.py
"""
import json

with open('migration/internal-accounts.json', encoding='utf-8') as f:
    accounts = json.load(f)

RULES = [
    (['مالک زمين'], 'LANDLORD', 'Landowner (route to Landlords module)'),
    (['کيش', 'CASH'], '1100', 'Cash in Hand'),
    (['بينک', 'BANK', 'ALLIED', 'FAISAL'], '1200', 'Bank Account'),
    (['سيلري', 'SALARY'], '5300', 'Salary Expense'),
    (['ٹيکس', 'TAX', 'INCOME TAX', 'SALES TAX', 'PROFESSIONAL TAX', 'PRA'], '5400', 'Tax Expense'),
    (['کميشن', 'COMMISSION'], '5100', 'Broker Commission'),
    (['خريداري', 'خريد', 'رقبہ خريداري'], '1300', 'Land Held for Development'),
    (['تعمير', 'کنسٹرکشن', 'CONSTRUCTION', 'ديوار', 'بنياد'], '5600', 'Construction & Development Expense'),
    (['مارکيٹنگ', 'MARKETING', 'اشتہارات'], '5700', 'Marketing Expense'),
    (['بجلي', 'ELECTRICITY', 'واپڈا', 'کنکشن بجلي'], '5800', 'Utilities Expense'),
    (['گيس', 'GAS'], '5800', 'Utilities Expense'),
    (['موبائل', 'نٹ', 'MOBILE'], '5800', 'Utilities Expense'),
    (['قانوني', 'LEGAL', 'LAWYER', 'ADVISER'], '5900', 'Legal & Professional Fees'),
    (['سٹيشنري', 'STATIONERY'], '5500', 'General & Administrative Expense'),
    (['نفع', 'نقصان', 'PROFIT', 'LOSS'], '4200', 'Resale Profit'),
    (['ٹي ايم اے', 'TMA'], '5400', 'Tax Expense'),
    (['گارڈ', 'GUARD', 'صفائي', 'مالي'], '5300', 'Salary Expense'),
    (['اخراجات', 'EXPENSES', 'EXPENSE'], '5500', 'General & Administrative Expense'),
]

def categorize(name):
    for keywords, code, label in RULES:
        for kw in keywords:
            if kw.upper() in name.upper():
                return code, label
    return '5500', 'General & Administrative Expense'

categorized = []
for a in accounts:
    name = a['customer_name'] or ''
    code, label = categorize(name)
    categorized.append({**a, 'matched_category_code': code, 'matched_category_label': label})

from collections import defaultdict
totals = defaultdict(lambda: [0, 0.0])
for a in categorized:
    key = (a['matched_category_code'], a['matched_category_label'])
    totals[key][0] += 1
    totals[key][1] += a['computed_outstanding'] or 0

print(f"{'Code':7} {'Category':40} {'Count':>6} {'Total':>18}")
for (code, label), (count, total) in sorted(totals.items(), key=lambda x: -x[1][1]):
    print(f"{code:7} {label:40} {count:>6} {total:>18,.0f}")

with open('migration/internal-accounts-categorized.json', 'w', encoding='utf-8') as f:
    json.dump(categorized, f, ensure_ascii=False, indent=2)

print("\nWrote migration/internal-accounts-categorized.json")
