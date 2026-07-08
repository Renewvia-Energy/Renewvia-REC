#!/usr/bin/env python3
"""Generate a one-page HTML summary of key Renewvia REC platform statistics."""

import argparse
import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path


def find_repo_root():
    here = Path(__file__).resolve().parent
    for d in [here, here.parent, here.parent.parent]:
        if (d / 'web' / 'js').is_dir():
            return d
    raise FileNotFoundError("Cannot locate repo root (expected a 'web/js/' directory)")


def load_json(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def is_valid_address(addr):
    return isinstance(addr, str) and addr.startswith('0x') and len(addr) == 42


def extract_region(name):
    for suffix in [' R-RECs', ' R-REC', ' Solar Tax Credit REC']:
        name = name.replace(suffix, '')
    return name.strip()


def ts_to_year(ts_str):
    try:
        return str(datetime.fromtimestamp(int(ts_str), tz=timezone.utc).year)
    except (ValueError, OSError):
        return 'unknown'


def compute_stats(companies, contracts):
    # Companies
    by_year_co = defaultdict(int)
    valid_addresses = 0
    for c in companies:
        year = c.get('join_date', '')[:4]
        if year.isdigit():
            by_year_co[year] += 1
        if is_valid_address(c.get('address', '')):
            valid_addresses += 1

    # RECs
    regions = sorted({extract_region(c['name']) for c in contracts})
    deployed_recs = sum(1 for c in contracts if is_valid_address(c.get('address')))
    africa_kw = {'Cameroon', "Cote d'Ivoire", 'Congo', 'Senegal', 'South Africa', 'Nigeria', 'Kenya'}
    usa_kw = {'Alabama', 'Georgia', 'North Carolina', 'Virginia', 'South Carolina'}
    africa_recs = sum(1 for c in contracts if any(k in c['name'] for k in africa_kw))
    usa_recs = sum(1 for c in contracts if any(k in c['name'] for k in usa_kw))

    # Transactions
    action_counts = defaultdict(int)
    action_totals = defaultdict(float)
    by_year_txn = defaultdict(lambda: defaultdict(int))
    total_mints = 0
    verified_mints = 0
    rec_minted = {}

    for contract in contracts:
        contract_minted = 0.0
        for txn in contract.get('transactions', []):
            if txn.get('ignore'):
                continue
            action = txn.get('action', '')
            amount = txn.get('amount', 0)
            year = ts_to_year(txn.get('timeStamp', '0'))
            action_counts[action] += 1
            action_totals[action] += amount
            by_year_txn[year][action] += 1
            if action == 'mint':
                total_mints += 1
                contract_minted += amount
                if txn.get('verification_data'):
                    verified_mints += 1
        rec_minted[contract['name']] = contract_minted

    minted = action_totals.get('mint', 0)
    retired = action_totals.get('retire', 0)
    returned = action_totals.get('return', 0)

    return {
        'total_companies': len(companies),
        'by_year_co': dict(sorted(by_year_co.items())),
        'valid_addresses': valid_addresses,
        'total_recs': len(contracts),
        'deployed_recs': deployed_recs,
        'regions': regions,
        'africa_recs': africa_recs,
        'usa_recs': usa_recs,
        'minted': minted,
        'retired': retired,
        'returned': returned,
        'circulating': minted - retired - returned,
        'retirement_rate': (retired / minted * 100) if minted else 0,
        'action_counts': dict(action_counts),
        'action_totals': dict(action_totals),
        'txn_total': sum(action_counts.values()),
        'by_year_txn': {y: dict(v) for y, v in sorted(by_year_txn.items())},
        'total_mints': total_mints,
        'verified_mints': verified_mints,
        'verification_rate': (verified_mints / total_mints * 100) if total_mints else 0,
        'top_recs': sorted(rec_minted.items(), key=lambda x: x[1], reverse=True),
    }


def fmt(n):
    return f"{int(n):,}"


def pct(n):
    return f"{n:.1f}%"


def render_html(stats, generated_at):
    company_year_rows = ''.join(
        f'<tr><td>{y}</td><td class="num">{v}</td></tr>'
        for y, v in stats['by_year_co'].items()
    )

    action_order = ['mint', 'transfer', 'retire', 'return']
    action_rows = ''.join(
        f'<tr><td>{a.capitalize()}</td>'
        f'<td class="num">{fmt(stats["action_counts"].get(a, 0))}</td>'
        f'<td class="num">{fmt(stats["action_totals"].get(a, 0))} MWh</td></tr>'
        for a in action_order if a in stats['action_counts']
    )

    txn_years = sorted(y for y in stats['by_year_txn'] if y != 'unknown')
    year_header = '<th>Action</th>' + ''.join(f'<th class="num">{y}</th>' for y in txn_years)
    year_rows = ''
    for action in action_order:
        if not any(stats['by_year_txn'].get(yr, {}).get(action, 0) for yr in txn_years):
            continue
        cells = ''.join(
            f'<td class="num">{stats["by_year_txn"].get(yr, {}).get(action, "") or ""}</td>'
            for yr in txn_years
        )
        year_rows += f'<tr><td>{action.capitalize()}</td>{cells}</tr>'

    top_rec_rows = ''.join(
        f'<tr><td>{name}</td><td class="num">{fmt(vol)} MWh</td></tr>'
        for name, vol in stats['top_recs'] if vol > 0
    )

    region_pills = ''.join(
        f'<span class="pill">{r}</span>' for r in stats['regions']
    )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Renewvia REC Platform &mdash; Summary</title>
<style>
  *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    background: #f4f6f1;
    color: #1a2e1a;
    font-size: 14px;
    line-height: 1.5;
    padding: 28px;
  }}
  header {{
    margin-bottom: 28px;
    padding-bottom: 18px;
    border-bottom: 3px solid #2d7a2d;
  }}
  h1 {{ font-size: 26px; color: #2d7a2d; font-weight: 700; }}
  .meta {{ color: #777; font-size: 12px; margin-top: 5px; }}
  .grid {{
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    gap: 20px;
  }}
  .card {{
    background: #fff;
    border-radius: 8px;
    padding: 20px 22px;
    box-shadow: 0 1px 4px rgba(0,0,0,.08);
  }}
  .card.wide {{ grid-column: 1 / -1; }}
  .card h2 {{
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: .07em;
    color: #2d7a2d;
    margin-bottom: 14px;
    font-weight: 700;
  }}
  .big {{ font-size: 40px; font-weight: 700; line-height: 1; color: #1a2e1a; }}
  .big.green {{ color: #2d7a2d; }}
  .big-label {{ font-size: 12px; color: #777; margin-top: 3px; margin-bottom: 14px; }}
  table {{ width: 100%; border-collapse: collapse; }}
  th, td {{ padding: 5px 8px; text-align: left; border-bottom: 1px solid #eee; font-size: 13px; }}
  th {{ font-size: 11px; color: #999; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; }}
  td.num, th.num {{ text-align: right; font-variant-numeric: tabular-nums; }}
  .row {{ display: flex; justify-content: space-between; align-items: baseline;
           padding: 6px 0; border-bottom: 1px solid #eee; }}
  .row:last-child {{ border-bottom: none; }}
  .row-label {{ color: #555; }}
  .row-value {{ font-weight: 600; font-variant-numeric: tabular-nums; }}
  .pills {{ margin-top: 12px; display: flex; flex-wrap: wrap; gap: 6px; }}
  .pill {{
    background: #eaf4ea; color: #2d7a2d; font-size: 11px; font-weight: 600;
    border-radius: 100px; padding: 3px 10px;
  }}
  @media print {{
    body {{ background: #fff; padding: 0; }}
    .card {{ box-shadow: none; border: 1px solid #ddd; break-inside: avoid; }}
  }}
</style>
</head>
<body>
<header>
  <h1>Renewvia REC Platform &mdash; Summary</h1>
  <p class="meta">Generated {generated_at}&nbsp;&nbsp;|&nbsp;&nbsp;All energy values in MWh</p>
</header>
<div class="grid">

  <div class="card">
    <h2>Companies</h2>
    <div class="big">{stats['total_companies']}</div>
    <div class="big-label">registered companies</div>
    <table>
      <thead><tr><th>Year joined</th><th class="num">Count</th></tr></thead>
      <tbody>{company_year_rows}</tbody>
    </table>
    <div class="row" style="margin-top:10px">
      <span class="row-label">On-chain addresses</span>
      <span class="row-value">{stats['valid_addresses']} / {stats['total_companies']}</span>
    </div>
  </div>

  <div class="card">
    <h2>REC Types &amp; Geography</h2>
    <div class="big">{stats['total_recs']}</div>
    <div class="big-label">REC types</div>
    <div class="row">
      <span class="row-label">Deployed on-chain</span>
      <span class="row-value">{stats['deployed_recs']} / {stats['total_recs']}</span>
    </div>
    <div class="row">
      <span class="row-label">Africa</span>
      <span class="row-value">{stats['africa_recs']} types</span>
    </div>
    <div class="row">
      <span class="row-label">North America</span>
      <span class="row-value">{stats['usa_recs']} types</span>
    </div>
    <div class="pills">{region_pills}</div>
  </div>

  <div class="card">
    <h2>Energy Totals</h2>
    <div class="big green">{fmt(stats['minted'])}</div>
    <div class="big-label">MWh total minted</div>
    <div class="row">
      <span class="row-label">Retired</span>
      <span class="row-value">{fmt(stats['retired'])} MWh</span>
    </div>
    <div class="row">
      <span class="row-label">Returned</span>
      <span class="row-value">{fmt(stats['returned'])} MWh</span>
    </div>
    <div class="row">
      <span class="row-label">Circulating</span>
      <span class="row-value">{fmt(stats['circulating'])} MWh</span>
    </div>
    <div class="row">
      <span class="row-label">Retirement rate</span>
      <span class="row-value">{pct(stats['retirement_rate'])}</span>
    </div>
  </div>

  <div class="card">
    <h2>Transaction Activity</h2>
    <div class="big">{fmt(stats['txn_total'])}</div>
    <div class="big-label">total transactions (excl. ignored)</div>
    <table>
      <thead><tr><th>Action</th><th class="num">Count</th><th class="num">Volume</th></tr></thead>
      <tbody>{action_rows}</tbody>
    </table>
  </div>

  <div class="card">
    <h2>Top RECs by Minted Volume</h2>
    <table>
      <thead><tr><th>REC</th><th class="num">MWh Minted</th></tr></thead>
      <tbody>{top_rec_rows}</tbody>
    </table>
  </div>

  <div class="card">
    <h2>Verification Coverage</h2>
    <div class="big green">{pct(stats['verification_rate'])}</div>
    <div class="big-label">of mint transactions have linked verification data</div>
    <div class="row">
      <span class="row-label">Verified mints</span>
      <span class="row-value">{stats['verified_mints']} / {stats['total_mints']}</span>
    </div>
  </div>

  <div class="card wide">
    <h2>Transactions by Year</h2>
    <table>
      <thead><tr>{year_header}</tr></thead>
      <tbody>{year_rows}</tbody>
    </table>
  </div>

</div>
</body>
</html>"""


def main():
    parser = argparse.ArgumentParser(description='Generate Renewvia REC platform summary HTML')
    parser.add_argument('--output', metavar='PATH', help='Output file path (default: scripts/platform_summary.html)')
    args = parser.parse_args()

    repo = find_repo_root()
    companies = load_json(repo / 'web' / 'js' / 'companies.json')
    contracts = load_json(repo / 'web' / 'js' / 'contracts.json')

    stats = compute_stats(companies, contracts)
    generated_at = datetime.now(tz=timezone.utc).strftime('%Y-%m-%d %H:%M UTC')
    html = render_html(stats, generated_at)

    out = Path(args.output) if args.output else repo / 'scripts' / 'platform_summary.html'
    out.write_text(html, encoding='utf-8')
    print(out)


if __name__ == '__main__':
    main()
