"""
One-time extraction of the legacy Visual FoxPro database (DIGITAL software)
into clean JSON for import into the new ERP.

Source tables:
  MDS.DBF   - one row per plot sale (customer + plot + contract, combined)
  JSALE.DBF - full transaction ledger (debit = sale value, credit = payments received)

Encoding: cp1256 (Windows Arabic/Urdu codepage) - confirmed correct by manual inspection.
"""
from dbfread import DBF, FieldParser
import json
import re

class SafeFieldParser(FieldParser):
    def parseD(self, field, data):
        try: return super().parseD(field, data)
        except (ValueError, TypeError): return None
    def parseN(self, field, data):
        try: return super().parseN(field, data)
        except (ValueError, TypeError): return None
    def parseF(self, field, data):
        try: return super().parseF(field, data)
        except (ValueError, TypeError): return None

SRC_DIR = '/home/claude/legacy_data/2026'

def load(table_name):
    return list(DBF(f'{SRC_DIR}/{table_name}', encoding='cp1256',
                     ignore_missing_memofile=True, parserclass=SafeFieldParser))

def clean_str(v):
    if v is None:
        return None
    s = str(v).strip()
    return s if s else None

def to_iso_date(d):
    if d is None:
        return None
    try:
        return d.isoformat()
    except AttributeError:
        return None

def parse_father_name(fname):
    """FNAME often looks like 'S/O X', 'W/O X', 'D/O X' - split relation from name."""
    if not fname:
        return None, None
    fname = fname.strip()
    m = re.match(r'^(S/O|W/O|D/O)\s+(.*)$', fname, re.IGNORECASE)
    if m:
        return m.group(2).strip(), m.group(1).upper()
    return fname, None

def parse_marla_sqft(items):
    """Best-effort parse of plot size from free-text ITEMS field."""
    if not items:
        return None, None
    marla = None
    sqft = None
    m = re.search(r'([\d.]+)\s*MARLA', items, re.IGNORECASE)
    if m:
        try: marla = float(m.group(1))
        except ValueError: pass
    m = re.search(r'\(([\d.]+)\s*X\s*([\d.]+)\)', items, re.IGNORECASE)
    if m:
        try: sqft = float(m.group(1)) * float(m.group(2))
        except ValueError: pass
    return marla, sqft

print("Loading MDS.DBF (plot sale accounts)...")
mds_rows = load('MDS.DBF')
print(f"  {len(mds_rows)} raw records")

print("Loading JSALE.DBF (transaction ledger)...")
jsale_rows = load('JSALE.DBF')
print(f"  {len(jsale_rows)} raw records")

# ---------- Transform MDS -> customers + plots + contracts + ownership ----------
accounts = []
skipped = []

for r in mds_rows:
    plot_code = clean_str(r.get('MLC'))
    name = clean_str(r.get('MLNAME'))
    if not plot_code or not name:
        skipped.append({'reason': 'missing plot_code or name', 'raw_mlc': str(r.get('MLC'))})
        continue

    father_name, relation = parse_father_name(clean_str(r.get('FNAME')))
    marla, sqft = parse_marla_sqft(clean_str(r.get('ITEMS')))

    price = r.get('PRICE') or 0
    advance = r.get('ADVANCE') or r.get('TOTRECE') or 0
    net_amount = r.get('NETAMOUNT') or (price - advance if price else 0)
    cperiod = int(r.get('CPERIOD') or 1)
    minstall = r.get('MINSTALL') or 0

    accounts.append({
        'plot_code': plot_code,
        'customer_name': name,
        'father_name': father_name,
        'relation': relation,
        'cnic': clean_str(r.get('IDNO')),
        'phone': clean_str(r.get('PHONE')),
        'address': clean_str(r.get('ADDRESS')),
        'city': clean_str(r.get('CITY')),
        'plot_description': clean_str(r.get('ITEMS')),
        'marla': marla,
        'square_feet': sqft,
        'total_price': float(price) if price else None,
        'advance_or_received': float(advance) if advance else None,
        'net_amount': float(net_amount) if net_amount else None,
        'installment_count': cperiod,
        'installment_amount': float(minstall) if minstall else None,
        'contract_date': to_iso_date(r.get('OPDATE')) or to_iso_date(r.get('DATE')),
        'registry_no': clean_str(r.get('REGISTRYNO')),
        'witness1_name': clean_str(r.get('GNAME1')),
        'witness1_father': clean_str(r.get('GFNAME1')),
        'witness1_cnic': clean_str(r.get('GIDNO1')),
        'witness1_address': clean_str(r.get('GADDRESS1')),
        'witness2_name': clean_str(r.get('GNAME2')),
        'witness2_father': clean_str(r.get('GFNAME2')),
        'witness2_cnic': clean_str(r.get('GIDNO2')),
        'witness2_address': clean_str(r.get('GADDRESS2')),
        'remarks': clean_str(r.get('REMARKS')),
        'details': clean_str(r.get('DETAILS')),
    })

print(f"\nTransformed {len(accounts)} accounts, skipped {len(skipped)} (missing plot_code/name)")

# ---------- Transform JSALE -> ledger entries grouped by plot_code ----------
ledger_by_plot = {}
ledger_skipped = 0

for r in jsale_rows:
    plot_code = clean_str(r.get('MLC'))
    if not plot_code:
        ledger_skipped += 1
        continue
    entry = {
        'date': to_iso_date(r.get('DATE')),
        'particular': clean_str(r.get('PARTICULAR')),
        'type': clean_str(r.get('TYPE')),
        'voucher_no': clean_str(r.get('VNO')),
        'debit': float(r.get('DEBIT')) if r.get('DEBIT') else 0,
        'credit': float(r.get('CREDIT')) if r.get('CREDIT') else 0,
        'balance': float(r.get('BALANCE')) if r.get('BALANCE') is not None else None,
        'mode': clean_str(r.get('MODE1')) or clean_str(r.get('MODE')),
    }
    ledger_by_plot.setdefault(plot_code, []).append(entry)

total_ledger_entries = sum(len(v) for v in ledger_by_plot.values())
print(f"Transformed {total_ledger_entries} ledger entries across {len(ledger_by_plot)} plots, skipped {ledger_skipped} (no plot code)")

# Attach computed outstanding balance to each account
for acc in accounts:
    entries = ledger_by_plot.get(acc['plot_code'], [])
    total_debit = sum(e['debit'] for e in entries)
    total_credit = sum(e['credit'] for e in entries)
    acc['ledger_entry_count'] = len(entries)
    acc['computed_total_debit'] = total_debit
    acc['computed_total_credit'] = total_credit
    acc['computed_outstanding'] = round(total_debit - total_credit, 2)

with open('/home/claude/erp/migration/accounts.json', 'w', encoding='utf-8') as f:
    json.dump(accounts, f, ensure_ascii=False, indent=2)

with open('/home/claude/erp/migration/ledger.json', 'w', encoding='utf-8') as f:
    json.dump(ledger_by_plot, f, ensure_ascii=False)

with open('/home/claude/erp/migration/skipped.json', 'w', encoding='utf-8') as f:
    json.dump(skipped, f, ensure_ascii=False, indent=2)

print(f"\nWrote accounts.json ({len(accounts)} accounts)")
print(f"Wrote ledger.json ({total_ledger_entries} entries)")
print(f"Wrote skipped.json ({len(skipped)} skipped records)")
