Run the Crash Risk Index (CRI) scan:

**Full strategy spec:** `docs/strategies.md` (Strategy 6)

**STEP 1: RUN THE CRI SCANNER**
```bash
python3 scripts/cri_scan.py --json
```
This fetches 1Y daily bars for VIX, VVIX, SPY, and Cboe COR1M implied correlation (IB primary; Yahoo `^COR1M` last resort for the index), computes the CRI composite score, CTA exposure model, and crash trigger conditions.

**STEP 2: PARSE THE CRI SCORE**
From the JSON output, extract and present:

| Field | What to check |
|-------|---------------|
| `cri.score` | Composite score 0-100. LOW (<25), ELEVATED (25-50), HIGH (50-75), CRITICAL (75+) |
| `cri.components.vix` | VIX component (0-25): level + 5d rate of change |
| `cri.components.vvix` | VVIX component (0-25): level + VVIX/VIX ratio |
| `cri.components.correlation` | Correlation component (0-25): COR1M level + 5-session spike |
| `cri.components.momentum` | Momentum component (0-25): SPX distance from 100d MA |

**STEP 3: EVALUATE CTA EXPOSURE MODEL**
- `cta.realized_vol` — Current 20d annualized realized volatility
- `cta.exposure_pct` — Implied CTA equity exposure (10% target / realized vol)
- `cta.forced_reduction_pct` — How much exposure CTAs must shed
- `cta.est_selling_bn` — Estimated dollar selling pressure

**STEP 4: CHECK CRASH TRIGGER CONDITIONS**
All three must fire simultaneously for crash regime:
- `crash_trigger.conditions.spx_below_100d_ma` — SPX below 100-day moving average
- `crash_trigger.conditions.realized_vol_gt_25` — 20d realized vol > 25% annualized
- `crash_trigger.conditions.cor1m_gt_60` — COR1M implied correlation > 60

If any condition fails, state which one and why the crash thesis is weakened.

**STEP 5: GENERATE HTML REPORT**
The script auto-generates `reports/cri-scan-{YYYY-MM-DD}.html`. If it didn't open automatically:
```bash
python3 scripts/cri_scan.py
```

**STEP 6: DECISION**

| CRI State | Action |
|-----------|--------|
| CRITICAL + Trigger ACTIVE | CRASH REGIME: Reduce equity, add tail hedges, avoid dip-buying |
| HIGH + Trigger INACTIVE | ELEVATED: Monitor closely. One condition away from crash regime. |
| ELEVATED | WATCH: Multiple components stressed but no immediate threat. |
| LOW | NORMAL: No systematic crash risk detected. |

**STEP 7: PORTFOLIO OVERLAY (if Crash Trigger ACTIVE)**
- Reduce equity exposure immediately — don't fight CTA selling cascades
- Add tail hedges: SPY puts (2-4 week expiry), VIX calls
- Avoid catching the knife — wait for vol mean-reversion signal
- Size hedges: 2.5% bankroll cap per position
- Exit hedges when: CRI normalizes < 25, realized vol drops below 20%, COR1M < 40

Present the scan results as:

```
CRI SCAN — {DATE}
═══════════════════════════════════════════
CRI SCORE: {score}/100 — {level}
  VIX         : {vix_score}/25
  VVIX        : {vvix_score}/25
  Correlation : {corr_score}/25
  Momentum    : {momentum_score}/25

LEVELS:
  VIX  : {vix} (5d RoC: {roc}%)
  VVIX : {vvix} (VVIX/VIX: {ratio})
  SPY  : ${spy} (vs 100d MA: {dist}%)
  COR1M: {cor1m} (5d chg: {cor1m_5d_change})
  RVol : {realized_vol}%

CTA MODEL:
  Exposure  : {exposure}%
  Reduction : {reduction}%
  Est. Selling: ${selling}B

CRASH TRIGGER:
  SPX < 100d MA  : {PASS/FAIL}
  RVol > 25%     : {PASS/FAIL}
  COR1M > 60     : {PASS/FAIL}
  TRIGGERED      : {YES/NO}

SIGNAL: {CRASH REGIME / ELEVATED / WATCH / NORMAL}
═══════════════════════════════════════════
```
