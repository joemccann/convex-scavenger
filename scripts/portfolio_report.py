#!/usr/bin/env python3
"""
Portfolio Report Generator

Generates an HTML portfolio status report and opens it in the browser.

Usage:
  python3 scripts/portfolio_report.py              # Generate and open report
  python3 scripts/portfolio_report.py --no-open    # Generate without opening
  python3 scripts/portfolio_report.py --sync       # Sync from IB first, then report
"""

import argparse
import json
import subprocess
import sys
import webbrowser
from datetime import datetime, date
from pathlib import Path
from typing import Dict, List, Any, Optional

# Paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
TEMPLATE_PATH = PROJECT_DIR / ".pi/skills/html-report/portfolio-template.html"
PORTFOLIO_PATH = PROJECT_DIR / "data/portfolio.json"
TRADE_LOG_PATH = PROJECT_DIR / "data/trade_log.json"
REPORTS_DIR = PROJECT_DIR / "reports"

TODAY = date(2026, 3, 4)  # Current date


def load_json(path: Path) -> Dict:
    """Load JSON file"""
    if not path.exists():
        return {}
    with open(path) as f:
        return json.load(f)


def calculate_dte(expiry_str: str) -> Optional[int]:
    """Calculate days to expiry"""
    if expiry_str == 'N/A' or not expiry_str:
        return None
    try:
        expiry = datetime.strptime(expiry_str, '%Y-%m-%d').date()
        return (expiry - TODAY).days
    except:
        return None


def format_currency(val: float, include_sign: bool = False) -> str:
    """Format value as currency"""
    if val is None:
        return 'N/A'
    if include_sign:
        return f"${val:+,.0f}" if val != 0 else "$0"
    return f"${val:,.0f}"


def format_pct(val: float) -> str:
    """Format value as percentage"""
    if val is None:
        return 'N/A'
    return f"{val:+.1f}%"


def get_pnl_class(pnl_pct: float) -> str:
    """Get CSS class based on P&L"""
    if pnl_pct >= 100:
        return "text-positive"
    elif pnl_pct >= 0:
        return "text-positive"
    elif pnl_pct > -50:
        return "text-negative"
    else:
        return "text-negative"


def get_risk_pill(risk: str) -> str:
    """Get pill HTML for risk type"""
    if risk == 'defined':
        return '<span class="pill pill-positive">DEFINED</span>'
    elif risk == 'undefined':
        return '<span class="pill pill-negative">UNDEFINED</span>'
    else:
        return '<span class="pill">EQUITY</span>'


def get_status_pill(pnl_pct: float, dte: Optional[int]) -> str:
    """Get status pill based on P&L and DTE"""
    if dte is not None and dte <= 7:
        return '<span class="pill pill-negative">EXPIRING</span>'
    if pnl_pct >= 100:
        return '<span class="pill pill-positive">WINNER</span>'
    if pnl_pct <= -50:
        return '<span class="pill pill-negative">AT STOP</span>'
    if pnl_pct < -25:
        return '<span class="pill pill-warning">UNDERWATER</span>'
    return '<span class="pill">ACTIVE</span>'


def generate_position_rows(positions: List[Dict], logged_trades: Dict) -> str:
    """Generate HTML table rows for positions"""
    rows = []
    
    for p in positions:
        ticker = p['ticker']
        structure = p['structure'][:35] + '..' if len(p['structure']) > 37 else p['structure']
        entry = p['entry']
        market = p['market']
        pnl = p['pnl']
        pnl_pct = p['pnl_pct']
        dte = p['dte']
        risk = p['risk']
        
        dte_str = str(dte) if dte is not None else '—'
        pnl_class = get_pnl_class(pnl_pct)
        risk_pill = get_risk_pill(risk)
        status_pill = get_status_pill(pnl_pct, dte)
        
        # Highlight row if expiring soon or at stop
        row_class = ""
        if dte is not None and dte <= 7:
            row_class = "highlight"
        elif pnl_pct <= -50:
            row_class = "highlight"
        
        row = f"""
        <tr class="{row_class}">
          <td><strong>{ticker}</strong></td>
          <td>{structure}</td>
          <td class="text-right">{format_currency(entry)}</td>
          <td class="text-right">{format_currency(market)}</td>
          <td class="text-right {pnl_class}">{format_currency(pnl, True)}</td>
          <td class="text-right {pnl_class}">{format_pct(pnl_pct)}</td>
          <td class="text-center">{dte_str}</td>
          <td class="text-center">{risk_pill}</td>
          <td class="text-center">{status_pill}</td>
        </tr>"""
        rows.append(row)
    
    return '\n'.join(rows)


def generate_attention_items(positions: List[Dict]) -> str:
    """Generate attention items HTML"""
    items = []
    
    # Expiring soon
    expiring = [p for p in positions if p['dte'] is not None and p['dte'] <= 7]
    if expiring:
        items.append('<div class="callout negative"><div class="callout-title">🔴 Expiring This Week</div><ul>')
        for p in expiring:
            items.append(f"<li><strong>{p['ticker']}</strong> — {p['structure']} | {p['dte']} DTE | {format_pct(p['pnl_pct'])} | {p['risk'].upper()}</li>")
        items.append('</ul></div>')
    
    # At stop
    at_stop = [p for p in positions if p['pnl_pct'] <= -50 and p['ticker'] not in [e['ticker'] for e in expiring]]
    if at_stop:
        items.append('<div class="callout warning"><div class="callout-title">🟡 At or Below Stop (≤-50%)</div><ul>')
        for p in at_stop:
            items.append(f"<li><strong>{p['ticker']}</strong> — {p['structure']} | {format_pct(p['pnl_pct'])} | {format_currency(p['pnl'])}</li>")
        items.append('</ul></div>')
    
    # Big winners
    winners = [p for p in positions if p['pnl_pct'] >= 100]
    if winners:
        items.append('<div class="callout positive"><div class="callout-title">🟢 Big Winners (≥+100%)</div><ul>')
        for p in winners:
            dte_str = f"{p['dte']} DTE" if p['dte'] else "No expiry"
            items.append(f"<li><strong>{p['ticker']}</strong> — {p['structure']} | {format_pct(p['pnl_pct'])} | {format_currency(p['pnl'])} | {dte_str}</li>")
        items.append('</ul></div>')
    
    # Undefined risk
    undefined = [p for p in positions if p['risk'] == 'undefined']
    if undefined:
        items.append('<div class="callout negative"><div class="callout-title">⛔ Undefined Risk Positions</div><ul>')
        for p in undefined:
            dte_str = f"{p['dte']} DTE" if p['dte'] else "No expiry"
            items.append(f"<li><strong>{p['ticker']}</strong> — {p['structure']} | {dte_str}</li>")
        items.append('</ul></div>')
    
    if not items:
        items.append('<div class="callout positive"><div class="callout-title">✓ No Immediate Actions Required</div><p>All positions within normal parameters.</p></div>')
    
    return '\n'.join(items)


def generate_report() -> str:
    """Generate the HTML report"""
    
    # Load data
    portfolio = load_json(PORTFOLIO_PATH)
    trade_log = load_json(TRADE_LOG_PATH)
    
    if not portfolio:
        return "<html><body><h1>Error: Could not load portfolio.json</h1></body></html>"
    
    # Build trade log lookup
    logged_trades = {}
    for trade in trade_log.get('trades', []):
        if trade.get('decision') == 'EXECUTED' and 'close_date' not in trade:
            logged_trades[trade['ticker']] = trade
    
    # Process positions
    positions_data = []
    total_pnl = 0
    
    for pos in portfolio['positions']:
        ticker = pos['ticker']
        entry_cost = pos['entry_cost']
        market_value = pos['market_value'] or 0
        
        # Calculate P&L
        if entry_cost < 0:
            pnl = -entry_cost - (-market_value) if market_value < 0 else market_value + entry_cost
            pnl_pct = (pnl / abs(entry_cost)) * 100 if entry_cost != 0 else 0
        else:
            pnl = market_value - entry_cost
            pnl_pct = (pnl / entry_cost) * 100 if entry_cost > 0 else 0
        
        dte = calculate_dte(pos['expiry'])
        
        positions_data.append({
            'ticker': ticker,
            'structure': pos['structure'],
            'type': pos['structure_type'],
            'risk': pos['risk_profile'],
            'entry': entry_cost,
            'market': market_value,
            'pnl': pnl,
            'pnl_pct': pnl_pct,
            'dte': dte,
            'expiry': pos['expiry'],
            'contracts': pos['contracts'],
            'logged': logged_trades.get(ticker)
        })
        
        total_pnl += pnl
    
    # Sort by DTE
    def sort_key(p):
        if p['dte'] is None:
            return (1, 9999, p['ticker'])
        return (0, p['dte'], p['ticker'])
    
    positions_data.sort(key=sort_key)
    
    # Portfolio metrics
    bankroll = portfolio.get('bankroll', 0)
    peak = portfolio.get('peak_value', bankroll)
    deployed_pct = portfolio.get('total_deployed_pct', 0)
    deployed_dollars = portfolio.get('total_deployed_dollars', 0)
    position_count = portfolio.get('position_count', len(positions_data))
    defined_count = portfolio.get('defined_risk_count', 0)
    undefined_count = portfolio.get('undefined_risk_count', 0)
    drawdown = ((peak - bankroll) / peak) * 100 if peak > 0 else 0
    
    # Count by category
    expiring_count = len([p for p in positions_data if p['dte'] is not None and p['dte'] <= 7])
    at_stop_count = len([p for p in positions_data if p['pnl_pct'] <= -50])
    winners_count = len([p for p in positions_data if p['pnl_pct'] >= 100])
    
    # Calculate total market value
    total_market = sum(p['market'] for p in positions_data if p['market'])
    
    # Generate HTML
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M PST")
    
    # Read template
    template = TEMPLATE_PATH.read_text() if TEMPLATE_PATH.exists() else get_default_template()
    
    # Replace placeholders
    html = template
    html = html.replace("{{TIMESTAMP}}", timestamp)
    html = html.replace("{{BANKROLL}}", format_currency(bankroll))
    html = html.replace("{{PEAK_VALUE}}", format_currency(peak))
    html = html.replace("{{DRAWDOWN}}", format_pct(-drawdown))
    html = html.replace("{{DRAWDOWN_CLASS}}", "text-negative" if drawdown > 5 else "text-muted")
    html = html.replace("{{TOTAL_PNL}}", format_currency(total_pnl, True))
    html = html.replace("{{TOTAL_PNL_CLASS}}", "text-positive" if total_pnl >= 0 else "text-negative")
    html = html.replace("{{DEPLOYED_DOLLARS}}", format_currency(deployed_dollars))
    html = html.replace("{{DEPLOYED_PCT}}", f"{deployed_pct:.1f}%")
    html = html.replace("{{REMAINING_PCT}}", f"{100 - deployed_pct:.1f}%")
    html = html.replace("{{POSITION_COUNT}}", str(position_count))
    html = html.replace("{{DEFINED_COUNT}}", str(defined_count))
    html = html.replace("{{UNDEFINED_COUNT}}", str(undefined_count))
    html = html.replace("{{EXPIRING_COUNT}}", str(expiring_count))
    html = html.replace("{{AT_STOP_COUNT}}", str(at_stop_count))
    html = html.replace("{{WINNERS_COUNT}}", str(winners_count))
    html = html.replace("{{POSITION_ROWS}}", generate_position_rows(positions_data, logged_trades))
    html = html.replace("{{ATTENTION_ITEMS}}", generate_attention_items(positions_data))
    
    # Status indicator
    if expiring_count > 0 or at_stop_count > 0:
        html = html.replace("{{STATUS_CLASS}}", "negative")
        html = html.replace("{{STATUS_TEXT}}", f"{expiring_count + at_stop_count} ACTIONS NEEDED")
    elif winners_count > 0:
        html = html.replace("{{STATUS_CLASS}}", "positive")
        html = html.replace("{{STATUS_TEXT}}", "WINNERS TO REVIEW")
    else:
        html = html.replace("{{STATUS_CLASS}}", "positive")
        html = html.replace("{{STATUS_TEXT}}", "ALL POSITIONS ACTIVE")
    
    return html


def get_default_template() -> str:
    """Return default template if file not found"""
    return """<!DOCTYPE html>
<html><head><title>Portfolio Report</title></head>
<body><h1>Portfolio Report</h1><p>Template not found. Please create portfolio-template.html</p></body>
</html>"""


def main():
    parser = argparse.ArgumentParser(description="Generate portfolio HTML report")
    parser.add_argument("--no-open", action="store_true", help="Don't open in browser")
    parser.add_argument("--sync", action="store_true", help="Sync from IB first")
    parser.add_argument("--output", type=str, help="Custom output path")
    
    args = parser.parse_args()
    
    # Sync from IB if requested
    if args.sync:
        print("Syncing portfolio from IB...")
        result = subprocess.run(
            ["python3", str(SCRIPT_DIR / "ib_sync.py"), "--sync"],
            capture_output=True,
            text=True
        )
        if result.returncode != 0:
            print(f"Warning: IB sync failed: {result.stderr}")
    
    # Generate report
    print("Generating portfolio report...")
    html = generate_report()
    
    # Save report
    REPORTS_DIR.mkdir(exist_ok=True)
    output_path = Path(args.output) if args.output else REPORTS_DIR / f"portfolio-{TODAY.strftime('%Y-%m-%d')}.html"
    output_path.write_text(html)
    print(f"✓ Report saved to {output_path}")
    
    # Open in browser
    if not args.no_open:
        print("Opening in browser...")
        webbrowser.open(f"file://{output_path.absolute()}")
    
    return str(output_path)


if __name__ == "__main__":
    main()
