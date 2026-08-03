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


def fmt_date(ts_str):
    try:
        return datetime.fromtimestamp(int(ts_str), tz=timezone.utc).strftime('%Y-%m-%d')
    except (ValueError, OSError):
        return '—'


def abbr_addr(addr):
    if isinstance(addr, str) and addr.startswith('0x') and len(addr) > 10:
        return addr[:6] + '…' + addr[-4:]
    return addr or '—'


def compute_stats(companies, contracts):
    # Companies
    by_year_co = defaultdict(int)
    companies_by_year = defaultdict(list)
    valid_addresses = 0
    for c in companies:
        year = c.get('join_date', '')[:4]
        if year.isdigit():
            by_year_co[year] += 1
            companies_by_year[year].append(c)
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
    rec_txns = {}
    retire_txns = []
    return_txns = []

    for contract in contracts:
        contract_minted = 0.0
        contract_txns = []
        for txn in contract.get('transactions', []):
            if txn.get('ignore'):
                continue
            action = txn.get('action', '')
            amount = txn.get('amount', 0)
            ts = txn.get('timeStamp', '0')
            year = ts_to_year(ts)
            action_counts[action] += 1
            action_totals[action] += amount
            by_year_txn[year][action] += 1

            info = {
                'rec_name': contract['name'],
                'action': action,
                'amount': amount,
                'date': fmt_date(ts),
                'to': txn.get('to', ''),
                'from': txn.get('from', ''),
                'hash': txn.get('hash', ''),
                'block_number': txn.get('blockNumber', '0'),
                'verification_data': txn.get('verification_data'),
            }
            contract_txns.append(info)

            if action == 'mint':
                total_mints += 1
                contract_minted += amount
                if txn.get('verification_data'):
                    verified_mints += 1
            elif action == 'retire':
                retire_txns.append(info)
            elif action == 'return':
                return_txns.append(info)

        rec_minted[contract['name']] = contract_minted
        rec_txns[contract['name']] = contract_txns

    minted = action_totals.get('mint', 0)
    retired = action_totals.get('retire', 0)
    returned = action_totals.get('return', 0)

    return {
        'total_companies': len(companies),
        'by_year_co': dict(sorted(by_year_co.items())),
        'companies_by_year': {y: sorted(cs, key=lambda c: c['name'])
                              for y, cs in sorted(companies_by_year.items())},
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
        'rec_txns': rec_txns,
        'retire_txns': retire_txns,
        'return_txns': return_txns,
    }


def fmt(n):
    return f"{int(n):,}"


def pct(n):
    return f"{n:.1f}%"


POLYGONSCAN = "https://polygonscan.com/tx/"


def _tx_link(info):
    h = info['hash']
    if h and info['block_number'] != '0':
        return f'<a href="{POLYGONSCAN}{h}" target="_blank" rel="noopener">{h[:8]}…</a>'
    return (h[:8] + '…') if h else '—'


def _verify_link(info):
    vd = info.get('verification_data')
    return f'<a href="{vd}" target="_blank" rel="noopener">CSV</a>' if vd else '—'


def _action_tag(action):
    return f'<span class="tag tag-{action}">{action.capitalize()}</span>'


def cross_txn_rows(txns):
    """Table rows for a cross-REC transaction list (retire / return views)."""
    return '\n'.join(
        f'<tr>'
        f'<td>{t["date"]}</td>'
        f'<td>{t["rec_name"]}</td>'
        f'<td class="num">{fmt(t["amount"])}</td>'
        f'<td class="addr" title="{t["to"]}">{abbr_addr(t["to"])}</td>'
        f'<td>{_tx_link(t)}</td>'
        f'<td>{_verify_link(t)}</td>'
        f'</tr>'
        for t in txns
    )


def rec_txn_rows(txns):
    """Table rows for a single REC's full transaction history."""
    return '\n'.join(
        f'<tr>'
        f'<td>{t["date"]}</td>'
        f'<td>{_action_tag(t["action"])}</td>'
        f'<td class="num">{fmt(t["amount"])}</td>'
        f'<td class="addr" title="{t["to"]}">{abbr_addr(t["to"])}</td>'
        f'<td>{_tx_link(t)}</td>'
        f'<td>{_verify_link(t)}</td>'
        f'</tr>'
        for t in txns
    )


TXN_THEAD = '<thead><tr><th>Date</th><th>REC</th><th class="num">MWh</th><th>To</th><th>TX</th><th>Verify</th></tr></thead>'
REC_THEAD = '<thead><tr><th>Date</th><th>Action</th><th class="num">MWh</th><th>To</th><th>TX</th><th>Verify</th></tr></thead>'


def sub_table(thead, rows_html):
    if not rows_html.strip():
        return '<p class="empty">No transactions.</p>'
    return f'<div class="sub-table"><table>{thead}<tbody>{rows_html}</tbody></table></div>'


def expandable(summary_html, body_html, extra_class=''):
    cls = f' class="{extra_class}"' if extra_class else ''
    return (
        f'<details{cls}>'
        f'<summary>{summary_html}<span class="arrow">›</span></summary>'
        f'{body_html}'
        f'</details>'
    )


def render_html(stats, generated_at):
    action_order = ['mint', 'transfer', 'retire', 'return']

    # --- Companies: one <details> per year ---
    company_details = ''.join(
        expandable(
            f'<span class="s-label">{year}</span><span class="s-val">{len(cos)}</span>',
            '<ul class="sub-list">'
            + ''.join(f'<li>{c["name"]}</li>' for c in cos)
            + '</ul>',
        )
        for year, cos in stats['companies_by_year'].items()
    )

    # --- Energy Totals: <details> for Retired and Returned ---
    retire_body = sub_table(TXN_THEAD, cross_txn_rows(stats['retire_txns']))
    return_body = sub_table(TXN_THEAD, cross_txn_rows(stats['return_txns']))
    retired_detail = expandable(
        f'<span class="s-label row-label">Retired</span>'
        f'<span class="s-val row-value">{fmt(stats["retired"])} MWh</span>',
        retire_body, 'row-detail',
    )
    returned_detail = expandable(
        f'<span class="s-label row-label">Returned</span>'
        f'<span class="s-val row-value">{fmt(stats["returned"])} MWh</span>',
        return_body, 'row-detail',
    )

    # --- Top RECs: one <details> per REC ---
    top_rec_details = ''.join(
        expandable(
            f'<span class="s-label">{name}</span>'
            f'<span class="s-val">{fmt(vol)} MWh</span>',
            sub_table(REC_THEAD, rec_txn_rows(stats['rec_txns'].get(name, []))),
        )
        for name, vol in stats['top_recs'] if vol > 0
    )

    # --- Transaction Activity table ---
    action_rows = ''.join(
        f'<tr><td>{a.capitalize()}</td>'
        f'<td class="num">{fmt(stats["action_counts"].get(a, 0))}</td>'
        f'<td class="num">{fmt(stats["action_totals"].get(a, 0))} MWh</td></tr>'
        for a in action_order if a in stats['action_counts']
    )

    # --- Transactions by year table ---
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

    region_pills = ''.join(f'<span class="pill">{r}</span>' for r in stats['regions'])

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
    background: #f4f6f1; color: #1a2e1a; font-size: 14px; line-height: 1.5; padding: 28px;
  }}
  header {{ margin-bottom: 28px; padding-bottom: 18px; border-bottom: 3px solid #2d7a2d; }}
  h1 {{ font-size: 26px; color: #2d7a2d; font-weight: 700; }}
  .meta {{ color: #777; font-size: 12px; margin-top: 5px; }}
  .grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 20px; }}
  .card {{ background: #fff; border-radius: 8px; padding: 20px 22px; box-shadow: 0 1px 4px rgba(0,0,0,.08); }}
  .card.wide {{ grid-column: 1 / -1; }}
  .card h2 {{ font-size: 11px; text-transform: uppercase; letter-spacing: .07em; color: #2d7a2d;
               margin-bottom: 14px; font-weight: 700; }}
  .big {{ font-size: 40px; font-weight: 700; line-height: 1; color: #1a2e1a; }}
  .big.green {{ color: #2d7a2d; }}
  .big-label {{ font-size: 12px; color: #777; margin-top: 3px; margin-bottom: 14px; }}
  table {{ width: 100%; border-collapse: collapse; }}
  th, td {{ padding: 5px 8px; text-align: left; border-bottom: 1px solid #eee; font-size: 13px; }}
  th {{ font-size: 11px; color: #999; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; }}
  td.num, th.num {{ text-align: right; font-variant-numeric: tabular-nums; }}
  td.addr {{ font-family: monospace; font-size: 11px; color: #666; }}
  a {{ color: #2d7a2d; text-decoration: none; }}
  a:hover {{ text-decoration: underline; }}
  .row {{ display: flex; justify-content: space-between; align-items: baseline;
           padding: 6px 0; border-bottom: 1px solid #eee; }}
  .row:last-child {{ border-bottom: none; }}
  .row-label {{ color: #555; }}
  .row-value {{ font-weight: 600; font-variant-numeric: tabular-nums; }}
  .pills {{ margin-top: 12px; display: flex; flex-wrap: wrap; gap: 6px; }}
  .pill {{ background: #eaf4ea; color: #2d7a2d; font-size: 11px; font-weight: 600;
           border-radius: 100px; padding: 3px 10px; }}

  /* Expandable sections */
  .expand-header {{
    display: flex; justify-content: space-between;
    font-size: 11px; color: #999; font-weight: 600; text-transform: uppercase;
    letter-spacing: .04em; padding: 4px 8px; border-bottom: 2px solid #eee;
    margin-bottom: 1px;
  }}
  details {{ border-bottom: 1px solid #eee; }}
  details:last-child {{ border-bottom: none; }}
  summary {{
    display: flex; align-items: center; gap: 6px;
    padding: 7px 8px; cursor: pointer; font-size: 13px;
    list-style: none; user-select: none;
  }}
  summary::-webkit-details-marker {{ display: none; }}
  summary:hover {{ background: #f7faf7; border-radius: 4px; }}
  .s-label {{ flex: 1; }}
  .s-val {{ font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; }}
  .arrow {{ color: #bbb; font-size: 16px; line-height: 1; transition: transform .15s;
            display: inline-block; margin-left: 2px; }}
  details[open] > summary .arrow {{ transform: rotate(90deg); }}

  /* Energy card: <details> sits among .row divs */
  .row-detail {{ border-bottom: 1px solid #eee; }}
  .row-detail:last-of-type {{ border-bottom: none; }}
  .row-detail > summary {{ padding: 6px 8px; }}
  .row-detail > summary .s-label {{ color: #555; }}

  /* Sub-content */
  .sub-list {{
    list-style: none; padding: 4px 12px 10px 20px; font-size: 13px; color: #444;
    background: #f8fbf8; border-top: 1px solid #eee;
  }}
  .sub-list li {{ padding: 2px 0; }}
  .sub-table {{ overflow-x: auto; background: #f8fbf8; border-top: 1px solid #eee; padding: 4px 0 6px; }}
  .sub-table table {{ min-width: 480px; }}
  .empty {{ padding: 8px 14px; color: #999; font-size: 12px; font-style: italic;
            background: #f8fbf8; border-top: 1px solid #eee; }}

  /* Action tags */
  .tag {{ display: inline-block; padding: 1px 7px; border-radius: 100px; font-size: 11px; font-weight: 600; }}
  .tag-mint {{ background: #dff0df; color: #1a6e1a; }}
  .tag-transfer {{ background: #dde9ff; color: #1a3ea0; }}
  .tag-retire {{ background: #f0dfdf; color: #7a1a1a; }}
  .tag-return {{ background: #fff0d9; color: #7a4a00; }}

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
    <div class="expand-header"><span>Year joined</span><span>Count</span></div>
    {company_details}
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
    {retired_detail}
    {returned_detail}
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
    <div class="expand-header"><span>REC</span><span>MWh Minted</span></div>
    {top_rec_details}
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
