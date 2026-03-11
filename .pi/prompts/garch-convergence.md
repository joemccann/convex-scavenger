GARCH Convergence Spread scan for {{tickers}}:

**Full strategy spec:** `docs/strategy-garch-convergence.md`

**STEP 1: IDENTIFY CORRELATED PAIRS**
- If specific tickers given: treat as potential lagger(s), find their natural pair partner(s)
- If preset given (semis, energy, mega-tech, china-etf): use preset pair groups
- Confirm fundamental correlation: same vol driver, same sector catalyst
- Pair types: component vs ETF, sector peers, supply chain, leveraged vs vanilla

**STEP 2: FETCH IV/HV DATA FOR BOTH SIDES**
For each asset in the pair:
- Run `python3 scripts/leap_iv_scanner.py [TICKER1] [TICKER2] --min-gap 0` (IB, preferred)
- OR `python3 scripts/leap_scanner_uw.py [TICKER1] [TICKER2]` (no IB fallback)
- Record: HV20, HV60, ATM IV (3-6 month expiry), IV rank
- Fetch current spot price via IB or UW

**STEP 3: COMPUTE DIVERGENCE METRICS**
For each pair (A = potential leader, B = potential lagger):
```
IV/HV Ratio A = IV_A / HV60_A
IV/HV Ratio B = IV_B / HV60_B
Divergence = (IV/HV Ratio A) - (IV/HV Ratio B)

Raw IV Ratio = IV_A / IV_B
Compare to historical norm (if available)

Lagger HV-IV Gap = HV20_B - IV_B (must be ≥10 pts)
```

**STEP 4: SIGNAL ASSESSMENT**
Rate each pair:

| Criterion | Check | Pass? |
|-----------|-------|-------|
| IV Ratio Divergence | Leader IV/HV ≥1.0, Lagger IV/HV <0.85 | |
| Lagger HV > IV | HV20 - IV ≥ 10 points | |
| Shared vol driver | Same fundamental catalyst affects both | |
| Lagger IV rank | <50th percentile | |
| Lagger liquidity | OI >100, bid-ask <15% of mid | |

Signal strength:
- **Strong**: Divergence prominent, HV gap >20pts, IV rank <30% → Full size
- **Moderate**: Divergence clear, HV gap >15pts, IV rank <40% → Half size
- **Weak**: Divergence marginal, HV gap >10pts → Monitor only

**STEP 5: STRUCTURE (if signal is Strong or Moderate)**
- Instrument: 30-40Δ calls on the LAGGER, 3-6 month expiry
- Prefer the expiry with highest vega-to-premium ratio
- Calculate expected convergence:
  ```
  Expected IV = Leader's IV/HV ratio × Lagger's HV60
  Expected move = Expected IV - Current Lagger IV
  Expected gain = Expected move × Vega
  ```
- Verify R:R ≥ 2:1 (expected gain + delta upside vs premium cost)

**STEP 6: KELLY SIZING**
- Run `python3 scripts/kelly.py --prob [P] --odds [X] --fraction 0.25 --bankroll [B]`
- P(convergence) estimate: 50-65% based on signal strength
- Odds = Expected gain / Premium cost
- Hard cap: 2.5% of bankroll
- Max concurrent convergence trades: 3

**STEP 7: DECISION**
- All four gates pass? → Generate Trade Specification HTML report
- Any gate fails? → State which gate failed, log to docs/status.md
- Present pair analysis table:

```
PAIR: [LEADER] vs [LAGGER]
         | HV20  | HV60  | IV(4mo) | IV/HV  | IV Rank |
Leader   | XX%   | XX%   | XX%     | X.XX   | XXth    |
Lagger   | XX%   | XX%   | XX%     | X.XX   | XXth    |
Gap      |       |       |         | X.XX   |         |
Expected convergence: +XX vol pts → $X.XX per contract
```

**Pair Presets:**

| Preset | Pairs |
|--------|-------|
| `semis` | (NVDA, AMD), (MU, AMAT), (TSM, ASML), (AVGO, QCOM) |
| `energy` | (XOM, COP), (SLB, HAL), (XLE, OIH) |
| `china-etf` | (Top holdings vs EWY), (Top holdings vs FXI) |
| `mega-tech` | (AAPL, MSFT), (GOOGL, META), (AMZN, NFLX) |

**Exit monitoring (post-entry):**
- IV Ratio converges within 0.5σ → close for profit
- 8 weeks with no convergence → close (GARCH adjusted)
- Lagger HV drops below IV → close (mispricing resolved)
- Fundamental correlation breaks → close immediately
