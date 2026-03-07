Run the Cross-Asset Volatility-Credit Gap (VCG) scan:

**Full strategy spec:** `docs/strategies.md` (Strategy 5)
**Math spec:** `docs/VCG_institutional_research_note.md`

**STEP 1: RUN THE VCG SCANNER**
```bash
python3 scripts/vcg_scan.py --json
```
This fetches 1Y daily bars for VIX, VVIX, and HYG (IB primary, Yahoo fallback), runs the rolling 21-day OLS regression, computes the VCG z-score, and evaluates the binary signal.

**STEP 2: PARSE THE SIGNAL**
From the JSON output, extract and present:

| Field | What to check |
|-------|---------------|
| `signal.vcg` | VCG z-score. > +2 = risk-off trigger. < -2 = exhaustion. -2 to +2 = normal. |
| `signal.vcg_div` | Panic-adjusted VCG. Same as VCG when VIX < 40. Suppressed toward 0 as VIX → 48. |
| `signal.regime` | DIVERGENCE (VIX < 40), TRANSITION (40-48), or PANIC (≥ 48) |
| `signal.hdr` | High Divergence Risk state flag (all 3 conditions must pass) |
| `signal.ro` | Risk-Off trade trigger (HDR=1 AND VCG > 2) |
| `signal.sign_suppressed` | If true, beta signs are wrong — signal suppressed regardless of VCG |

**STEP 3: EVALUATE HDR CONDITIONS**
All three must be true for HDR = 1:
- `signal.hdr_conditions.vvix_gt_110` — VVIX > 110 (vol-of-vol elevated)
- `signal.hdr_conditions.credit_5d_gt_neg05pct` — HYG 5d return > -0.5% (credit hasn't sold off yet)
- `signal.hdr_conditions.vix_lt_40` — VIX < 40 (not in panic mode)

If any condition fails, state which one and why the divergence thesis is weakened.

**STEP 4: ASSESS MODEL QUALITY**
- `signal.beta1_vvix` — Expected negative. If positive, model is unreliable (21-day noise).
- `signal.beta2_vix` — Expected negative. If positive, same issue.
- `signal.attribution.vvix_pct` vs `signal.attribution.vix_pct` — Is the gap driven by convexity demand (VVIX) or broad vol (VIX)?

**STEP 5: GENERATE HTML REPORT**
The script auto-generates `reports/vcg-scan-{YYYY-MM-DD}.html`. If it didn't open automatically:
```bash
python3 scripts/vcg_scan.py
```
(Without `--json`, it generates and opens the HTML report.)

**STEP 6: DECISION**

| Signal State | Action |
|-------------|--------|
| `RO = 1` | RISK-OFF: Reduce credit beta, preserve downside hedges, consider HYG puts |
| `HDR = 1, VCG < 2` | ELEVATED: Monitor closely. Divergence conditions met but gap not yet extreme. |
| `HDR = 0` | NORMAL: No divergence. At least one gate fails. |
| `sign_suppressed = true` | UNRELIABLE: Model betas have wrong signs. Do not trade on VCG today. |

**STEP 7: PORTFOLIO OVERLAY (if RO = 1)**
- Review current positions for credit-sensitive exposure
- Preserve existing equity downside hedges — do NOT monetize early
- Consider: ATM/OTM HYG puts (1-2 week expiry), bear put spreads on HYG/JNK
- Size: 2.5% bankroll cap, fractional Kelly on gap-closure probability
- Exit when: VCG normalizes < 1.0, credit sells off (5d < -1.5%), VIX > 48, or HDR flips to 0

Present the scan results as:

```
VCG SCAN — {DATE}
═══════════════════════════════════════════
VCG:       {vcg} ({interpretation})
VCG div:   {vcg_div}
Regime:    {regime} (VIX={vix}, Π={pi_panic})

HDR CONDITIONS:
  VVIX > 110:         {vvix} → {PASS/FAIL}
  Credit 5d > -0.5%:  {credit_5d}% → {PASS/FAIL}
  VIX < 40:           {vix} → {PASS/FAIL}
  HDR = {hdr}

MODEL:
  β₁ (VVIX): {beta1}  β₂ (VIX): {beta2}
  Sign OK: {sign_ok}
  Residual: {residual}
  Attribution: VVIX {vvix_pct}% / VIX {vix_pct}%

SIGNAL: {RO=1 → RISK-OFF | HDR=1 → ELEVATED | NORMAL}
═══════════════════════════════════════════
```
