---
name: html-report
description: Generate styled HTML reports using the Terminal Dashboard theme. Use when the user needs to create an HTML report, dashboard, data visualization, or styled output document. Triggers include requests to "generate a report", "create an HTML file", "make a dashboard", "visualize data", "export to HTML", or any task requiring formatted HTML output with the project's visual identity.
---

# HTML Report Generation

Generate professional HTML reports using the Terminal Dashboard theme — a precision-focused, monochromatic, high-density design supporting both dark and light modes.

## Quick Start

1. **Read the template:** `.pi/skills/html-report/template.html`
2. **Replace placeholders:**
   - `{{TITLE}}` → Report title (appears in browser tab)
   - `{{BODY}}` → Your report content HTML
3. **Write to:** `reports/[report-name].html`

```python
# Example generation pattern
template = read("/.pi/skills/html-report/template.html")
html = template.replace("{{TITLE}}", "LEAP IV Scan | 2026-03-03")
html = html.replace("{{BODY}}", body_content)
write("reports/leap-iv-scan.html", html)
```

## Template Features

The template (`template.html`) includes:

- ✅ Full CSS with dark/light mode support
- ✅ System preference detection (`prefers-color-scheme`)
- ✅ Theme toggle button (just add the button HTML in your body)
- ✅ JetBrains Mono font loaded
- ✅ All component styles pre-defined
- ✅ Print-friendly styles
- ✅ Responsive grid utilities

**You only write the `<body>` content — no `<head>` needed!**

## Body Structure Template

```html
<!-- HEADER (always include) -->
<header class="header">
  <div>
    <h1 class="title">Report Title</h1>
    <p class="subtitle">Optional subtitle or description</p>
  </div>
  <div class="header-actions">
    <span class="timestamp">Generated: 2026-03-03 11:30 PST</span>
    <button class="theme-toggle" onclick="toggleTheme()">◐ THEME</button>
  </div>
</header>

<!-- METRICS (optional) -->
<div class="metrics">
  <div class="metric">
    <div class="metric-label">Label</div>
    <div class="metric-value">Value</div>
    <div class="metric-change">Change note</div>
  </div>
  <!-- more metrics... -->
</div>

<!-- CONTENT PANELS -->
<div class="panel">
  <div class="panel-header">Section Title</div>
  <div class="panel-body">
    Content here
  </div>
</div>

<!-- OR TABLES -->
<div class="panel">
  <div class="panel-header">Data Table</div>
  <table>
    <thead>
      <tr>
        <th>Column</th>
        <th class="text-right">Number</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Value</td>
        <td class="text-right">123.45</td>
      </tr>
    </tbody>
  </table>
</div>

<!-- FOOTER (optional) -->
<div class="footer">
  <p>Footer text · Additional info</p>
</div>
```

## Available CSS Classes

### Layout
| Class | Usage |
|-------|-------|
| `.container` | Auto-applied, max-width 1400px |
| `.header` | Report header with flex layout |
| `.grid-2` | Two-column grid (2fr 1fr) |
| `.grid-3` | Three equal columns |
| `.grid-4` | Four equal columns |
| `.divider` | Horizontal rule with margin |

### Panels & Cards
| Class | Usage |
|-------|-------|
| `.panel` | Container with border |
| `.panel-header` | Section title bar |
| `.panel-body` | Padded content area |
| `.panel-accent` | Highlighted border |
| `.card` | Standalone card |
| `.card-accent` | Highlighted card |

### Metrics
| Class | Usage |
|-------|-------|
| `.metrics` | Auto-fit grid container |
| `.metric` | Single metric block |
| `.metric-label` | Small uppercase label |
| `.metric-value` | Large value display |
| `.metric-value.large` | 32px value |
| `.metric-value.small` | 18px value |
| `.metric-change` | Secondary info with top border |

### Tables
| Class | Usage |
|-------|-------|
| `table` | Full-width, collapsed borders |
| `th` | Sticky header, uppercase |
| `tr:hover` | Row highlight on hover |
| `tr.highlight` | Permanently highlighted row |

### Text
| Class | Usage |
|-------|-------|
| `.text-right` | Right align |
| `.text-center` | Center align |
| `.text-muted` | Secondary color |
| `.text-positive` | Green |
| `.text-negative` | Red |
| `.text-warning` | Orange |
| `.text-small` | 11px |
| `.text-uppercase` | Uppercase + letter-spacing |

### Pills / Badges
| Class | Usage |
|-------|-------|
| `.pill` | Default bordered badge |
| `.pill-accent` | Inverted (white/black) |
| `.pill-positive` | Green background |
| `.pill-negative` | Red background |
| `.pill-warning` | Orange background |

### Status Indicators
```html
<span class="status">
  <span class="status-dot"></span>
  LIVE
</span>

<!-- Variants -->
<span class="status-dot positive"></span>
<span class="status-dot negative"></span>
<span class="status-dot warning"></span>
<span class="status-dot static"></span>  <!-- No animation -->
```

### Buttons
| Class | Usage |
|-------|-------|
| `.btn` | Default button |
| `.btn-accent` | Inverted button |
| `.theme-toggle` | Theme switch button |

### Special Components
```html
<!-- Callout box -->
<div class="callout">
  <div class="callout-title">Note</div>
  <p>Content here</p>
</div>
<div class="callout positive">...</div>
<div class="callout negative">...</div>
<div class="callout warning">...</div>

<!-- Section header -->
<div class="section-header">Section Name</div>

<!-- Progress bar -->
<div class="bar-container">
  <div class="bar-fill" style="width: 75%"></div>
</div>
<div class="bar-container">
  <div class="bar-fill positive" style="width: 60%"></div>
</div>
```

## Color Tokens

Use CSS variables for theme compatibility:

| Token | Usage |
|-------|-------|
| `--bg-base` | Page background |
| `--bg-panel` | Panel background |
| `--bg-hover` | Hover state |
| `--border-dim` | Default borders |
| `--border-focus` | Active borders |
| `--text-primary` | Main text |
| `--text-muted` | Secondary text |
| `--accent-bg` | Inverted bg |
| `--accent-text` | Inverted text |
| `--positive` | Green |
| `--negative` | Red |
| `--warning` | Orange |

## Example: Minimal Report

```html
{{BODY}} content:

<header class="header">
  <div>
    <h1 class="title">Daily Summary</h1>
  </div>
  <div class="header-actions">
    <span class="timestamp">2026-03-03</span>
    <button class="theme-toggle" onclick="toggleTheme()">◐ THEME</button>
  </div>
</header>

<div class="metrics">
  <div class="metric">
    <div class="metric-label">Positions</div>
    <div class="metric-value">12</div>
  </div>
  <div class="metric">
    <div class="metric-label">P&L</div>
    <div class="metric-value text-positive">+$4,500</div>
  </div>
</div>

<div class="panel">
  <div class="panel-header">Open Positions</div>
  <table>
    <thead>
      <tr>
        <th>Ticker</th>
        <th class="text-right">Value</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>AAPL</td>
        <td class="text-right">$15,000</td>
        <td><span class="pill pill-positive">PROFIT</span></td>
      </tr>
    </tbody>
  </table>
</div>
```

## File Naming Convention

```
reports/
├── portfolio-2026-03-03.html
├── leap-iv-scan-2026-03-03.html
├── flow-scan-AAPL.html
├── trade-journal-2026-03.html
└── pnl-EWY-2026-03-03.html
```

---

## P&L Report Template

**For any trade P&L or reconciliation report, use the dedicated P&L template.**

**Template:** `.pi/skills/html-report/pnl-template.html`

### When to Use

- Trade closed → generate P&L report
- P&L reconciliation requested
- Historical trade analysis
- Spread P&L breakdown

### P&L Template Features

Everything in the base template PLUS:
- Timeline component for trade history
- Subtotal/total row styles for tables
- Panel accent variants (positive/negative border)
- Optimized metric sizing (28px default, fits 6-digit amounts)

### Required Sections

Every P&L report MUST include:

#### 1. Header with Status Pill
```html
<header class="header">
  <div>
    <h1 class="title">{{TICKER}} {{STRATEGY}} — P&L Reconciliation</h1>
    <p class="subtitle">{{DESCRIPTION}} · {{EXPIRY}}</p>
  </div>
  <div class="header-actions">
    <span class="pill pill-positive">CLOSED</span>  <!-- or pill-negative for loss -->
    <button class="theme-toggle" onclick="toggleTheme()">◐ THEME</button>
  </div>
</header>
```

#### 2. Summary Metrics (4 required)
```html
<div class="metrics">
  <div class="metric">
    <div class="metric-label">Realized P&L</div>
    <div class="metric-value text-positive">+$17,651</div>  <!-- or text-negative -->
    <div class="metric-change">Net of all commissions</div>
  </div>
  <div class="metric">
    <div class="metric-label">Total Commissions</div>
    <div class="metric-value">$168.60</div>
    <div class="metric-change">{{NUM_ROUNDTRIPS}} round-trips</div>
  </div>
  <div class="metric">
    <div class="metric-label">Hold Period</div>
    <div class="metric-value">{{DAYS}} days</div>
    <div class="metric-change">{{OPEN_DATE}} → {{CLOSE_DATE}}</div>
  </div>
  <div class="metric">
    <div class="metric-label">Return on Risk</div>
    <div class="metric-value text-positive">+106.8%</div>  <!-- P&L / Capital at Risk -->
    <div class="metric-change">On ${{CAPITAL_AT_RISK}} {{DEBIT_OR_CREDIT}}</div>
  </div>
</div>
```

#### 3. Trade Summary Callout
```html
<div class="callout positive">  <!-- or "callout negative" for losses -->
  <div class="callout-title">Trade Summary</div>
  <p><strong>Strategy:</strong> {{STRATEGY_DESCRIPTION}}</p>
  <p><strong>Thesis:</strong> {{THESIS}}</p>
  <p><strong>Outcome:</strong> {{OUTCOME_DESCRIPTION}}</p>
</div>
```

#### 4. Execution Table (per leg for spreads)
```html
<div class="panel">
  <div class="panel-header">{{LEG_DESCRIPTION}}</div>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Action</th>
        <th class="text-right">Qty</th>
        <th class="text-right">Price</th>
        <th class="text-right">Cash Flow</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>{{DATE}}</td>
        <td><span class="text-positive">● BUY TO OPEN</span></td>
        <td class="text-right">{{QTY}}</td>
        <td class="text-right">${{PRICE}}</td>
        <td class="text-right text-negative">-${{AMOUNT}}</td>
      </tr>
      <!-- More rows... -->
      <tr class="subtotal">
        <td colspan="3"><strong>{{LEG}} Subtotal</strong></td>
        <td class="text-right"><strong>CLOSED</strong></td>
        <td class="text-right text-positive"><strong>+${{LEG_PNL}}</strong></td>
      </tr>
    </tbody>
  </table>
</div>
```

#### 5. Combined P&L Panel (for spreads)
```html
<div class="panel panel-accent">  <!-- or panel-accent negative -->
  <div class="panel-header">Combined Spread P&L</div>
  <table>
    <tbody>
      <tr>
        <td>{{LEG_1}} P&L</td>
        <td class="text-right text-positive">+${{LEG_1_PNL}}</td>
      </tr>
      <tr>
        <td>{{LEG_2}} P&L</td>
        <td class="text-right text-negative">-${{LEG_2_PNL}}</td>
      </tr>
      <tr>
        <td>Total Commissions</td>
        <td class="text-right text-muted">(${{TOTAL_COMM}})</td>
      </tr>
      <tr class="total">
        <td><strong>NET REALIZED P&L</strong></td>
        <td class="text-right text-positive"><strong>+${{NET_PNL}}</strong></td>
      </tr>
    </tbody>
  </table>
</div>
```

#### 6. Trade Timeline
```html
<div class="panel">
  <div class="panel-header">Trade Timeline</div>
  <div class="panel-body">
    <div class="timeline">
      <div class="timeline-item buy">
        <div class="timeline-date">{{OPEN_DATE_FORMATTED}}</div>
        <div class="timeline-action">OPENED {{STRATEGY}}</div>
        <div class="timeline-detail">
          {{OPEN_DETAILS}}<br>
          <strong>Net {{DEBIT_OR_CREDIT}}: ${{OPEN_AMOUNT}}</strong>
        </div>
      </div>
      <div class="timeline-item sell">
        <div class="timeline-date">{{CLOSE_DATE_FORMATTED}}</div>
        <div class="timeline-action">CLOSED {{STRATEGY}}</div>
        <div class="timeline-detail">
          {{CLOSE_DETAILS}}<br>
          <strong>Net {{CREDIT_OR_DEBIT}}: ${{CLOSE_AMOUNT}}</strong>
        </div>
      </div>
    </div>
  </div>
</div>
```

#### 7. Footer
```html
<div class="footer">
  <p>Generated by Trade Blotter · Data from IB Flex Query + Real-time API · {{DATE}}</p>
</div>
```

### Return on Risk Calculation

**Always calculate Return on Risk as:**

```
Return on Risk = Realized P&L / Capital at Risk

Where Capital at Risk =
  - For DEBIT spreads: Net debit paid to open
  - For CREDIT spreads: Max loss (spread width - credit received)
  - For long options: Premium paid
  - For stock: Total cost basis
```

### Example P&L Report Reference

See: `reports/ewy-pnl-reconciliation-2026-03-03.html`

---

## Trade Specification Template ⭐ PRIMARY

**For ANY trade recommendation, ALWAYS use this template.**

**Template:** `.pi/skills/html-report/trade-specification-template.html`

### When to Use

- **ALWAYS** when recommending a trade after evaluation
- **ALWAYS** when presenting a trade for execution confirmation
- Ticker evaluation results (whether TRADE or NO_TRADE)
- Full milestone-based evaluation output

### Template Structure

The trade specification template includes ALL sections needed for a complete evaluation:

1. **Header** — Ticker, company, price, gate status
2. **Summary Metrics** — 6 key metrics (signal score, buy ratio, flow strength, convexity, position size, max gain)
3. **Milestone Summary** — All 7 milestones with pass/fail status
4. **Dark Pool Flow Section** — Daily breakdown + aggregate analysis
5. **Options Flow Section** — Chain bias, institutional flow, combined signal
6. **Context Section** — Seasonality + analyst ratings
7. **Structure & Kelly** — Position structure and Kelly sizing
8. **Trade Specification** — Exact order details ready for execution
9. **Thesis & Risk Factors** — Callouts with reasoning
10. **Three Gates Summary** — Final gate check table

### Template Variables

Replace these placeholders with actual values:

| Variable | Description | Example |
|----------|-------------|---------|
| `{{TICKER}}` | Stock symbol | GOOG |
| `{{COMPANY_NAME}}` | Full company name | Alphabet Inc. (Class C) |
| `{{SECTOR}}` | Industry sector | Communication Services |
| `{{CURRENT_PRICE}}` | Current stock price | 302.38 |
| `{{DATE}}` | Evaluation date | 2026-03-04 |
| `{{TIMESTAMP}}` | Full timestamp | 2026-03-04 06:43 PST |
| `{{STATUS_TEXT}}` | Gate status | ALL GATES PASSED |
| `{{STATUS_CLASS}}` | CSS class | positive / negative / warning |
| `{{SIGNAL_SCORE}}` | Combined signal score | 129.7 |
| `{{BUY_RATIO}}` | Dark pool buy ratio % | 94.87 |
| `{{FLOW_STRENGTH}}` | Flow strength 0-100 | 89.7 |
| `{{RR_RATIO}}` | Risk:reward ratio | 3.0 |
| `{{POSITION_SIZE}}` | Total position cost | 27,544 |
| `{{POSITION_PCT}}` | % of bankroll | 2.46 |
| `{{MAX_GAIN}}` | Maximum profit | 82,456 |
| `{{NUM_CONTRACTS}}` | Number of contracts | 44 |
| `{{DTE}}` | Days to expiration | 43 |
| `{{NET_DEBIT}}` | Net debit per spread | 6.26 |
| `{{THESIS}}` | Trade thesis | Extraordinary institutional... |

### Milestone Variables

For each milestone (M1, M1B, M1C, M2, M3, M4, M5, M6):

| Variable Pattern | Values |
|------------------|--------|
| `{{MX_CLASS}}` | `complete` or `failed` or empty |
| `{{MX_DESCRIPTION}}` | Description text |
| `{{MX_GATE_CLASS}}` | `gate-pass` or `gate-fail` |
| `{{MX_RESULT}}` | `✓ PASS` or `✗ FAIL` or result text |

### Gate Summary Variables

| Variable | Description |
|----------|-------------|
| `{{GATE1_ACTUAL}}` | e.g., "3.0:1" |
| `{{GATE1_PILL}}` | `pill-positive` or `pill-negative` |
| `{{GATE1_STATUS}}` | `PASS` or `FAIL` |
| `{{GATE2_ACTUAL}}` | e.g., "89.7, 5 days" |
| `{{GATE3_ACTUAL}}` | e.g., "2.46%" |

### NO_TRADE Reports

When evaluation fails a gate, still generate the report but:

1. Set `{{STATUS_TEXT}}` to failing gate (e.g., "EDGE FAILED")
2. Set `{{STATUS_CLASS}}` to `negative`
3. Mark failed milestone with `failed` class
4. Omit Structure & Kelly sections (not reached)
5. Omit Trade Specification section
6. Include callout explaining why trade was rejected

### Output Location

```
reports/{ticker}-evaluation-{date}.html

Examples:
  reports/goog-evaluation-2026-03-04.html
  reports/amd-evaluation-2026-03-04.html
```

### Reference Implementation

See: `reports/goog-evaluation-2026-03-04.html`

---

## Generation Checklist

### General Reports

1. [ ] Read template from `.pi/skills/html-report/template.html`
2. [ ] Replace `{{TITLE}}` with report title
3. [ ] Create body HTML with header (include theme toggle!)
4. [ ] Replace `{{BODY}}` with your content
5. [ ] Save to `reports/` with descriptive filename
6. [ ] Open in browser to verify

### P&L Reports

1. [ ] Read template from `.pi/skills/html-report/pnl-template.html`
2. [ ] Replace `{{TITLE}}` with "{TICKER} P&L | {DATE}"
3. [ ] Build body with ALL 7 required sections (see above)
4. [ ] Calculate Return on Risk correctly (P&L / Capital at Risk)
5. [ ] Use `text-positive` for profits, `text-negative` for losses
6. [ ] Save to `reports/pnl-{TICKER}-{DATE}.html`
7. [ ] Open in browser to verify formatting fits
