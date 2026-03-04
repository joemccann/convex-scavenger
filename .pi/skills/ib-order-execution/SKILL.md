---
name: ib-order-execution
description: Execute and monitor options orders via Interactive Brokers. Use when placing trades, monitoring fills, or managing orders. Triggers on "execute order", "place trade", "buy calls", "sell puts", "bull call spread", "bear put spread", "monitor fills", "check order status", or any IB order-related task.
---

# IB Order Execution Skill

Execute and monitor options orders via Interactive Brokers TWS/Gateway.

## When to Use

- Placing single-leg option orders (buy/sell calls or puts)
- Placing multi-leg spread orders (verticals, iron condors, etc.)
- Monitoring orders for fills
- Checking order status
- Canceling or modifying orders

## Prerequisites

- TWS or IB Gateway running with API enabled
- `ib_insync` installed (`pip install ib_insync`)
- Port configuration:
  - 4001: IB Gateway Live
  - 4002: IB Gateway Paper
  - 7496: TWS Live
  - 7497: TWS Paper

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/ib_order.py` | Place single-leg option orders |
| `scripts/ib_fill_monitor.py` | Monitor orders for fills |
| `scripts/ib_orders.py` | View/sync all open orders |

---

## Order Placement Workflow

### 1. Single-Leg Option Order

```bash
# Buy calls
python3 scripts/ib_order.py \
  --symbol GOOG \
  --expiry 20260417 \
  --strike 315 \
  --right C \
  --qty 10 \
  --side BUY \
  --limit 9.00

# Sell puts
python3 scripts/ib_order.py \
  --symbol GOOG \
  --expiry 20260417 \
  --strike 290 \
  --right P \
  --qty 5 \
  --side SELL \
  --limit 3.50

# Use mid price
python3 scripts/ib_order.py ... --limit MID

# Dry run (preview without submitting)
python3 scripts/ib_order.py ... --dry-run
```

### 2. Multi-Leg Spread Order (Combo/Bag)

For spreads, use inline Python. Example bull call spread:

```python
from ib_insync import IB, Option, ComboLeg, Contract, LimitOrder

# Connect
ib = IB()
ib.connect('127.0.0.1', 4001, clientId=50)

# Qualify legs
long_call = Option('GOOG', '20260417', 315, 'C', 'SMART', currency='USD')
short_call = Option('GOOG', '20260417', 340, 'C', 'SMART', currency='USD')
ib.qualifyContracts(long_call, short_call)

# Create combo contract
combo = Contract()
combo.symbol = 'GOOG'
combo.secType = 'BAG'
combo.currency = 'USD'
combo.exchange = 'SMART'

leg1 = ComboLeg()
leg1.conId = long_call.conId
leg1.ratio = 1
leg1.action = 'BUY'
leg1.exchange = 'SMART'

leg2 = ComboLeg()
leg2.conId = short_call.conId
leg2.ratio = 1
leg2.action = 'SELL'
leg2.exchange = 'SMART'

combo.comboLegs = [leg1, leg2]

# Place order (positive limit = debit)
order = LimitOrder(
    action='BUY',
    totalQuantity=44,
    lmtPrice=6.26,  # Net debit
    tif='GTC'
)

trade = ib.placeOrder(combo, order)
print(f"Order ID: {trade.order.orderId}")

ib.disconnect()
```

---

## Fill Monitoring

### Monitor by Order ID

```bash
python3 scripts/ib_fill_monitor.py --order-id 7
```

### Monitor by Symbol

```bash
python3 scripts/ib_fill_monitor.py --symbol GOOG
```

### Monitor All Open Orders

```bash
python3 scripts/ib_fill_monitor.py --all
```

### Custom Interval and Timeout

```bash
# Check every 5 seconds, timeout after 10 minutes
python3 scripts/ib_fill_monitor.py --symbol GOOG --interval 5 --timeout 600
```

### JSON Output (for automation)

```bash
python3 scripts/ib_fill_monitor.py --order-id 7 --json
```

Returns:
```json
{
  "status": "filled",
  "orders": {
    "7": {
      "status": "filled",
      "symbol": "GOOG",
      "quantity": 44,
      "fill_price": 6.26,
      "total_cost": 27544.0
    }
  }
}
```

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Filled (or partial fill) |
| 1 | Error or not found |
| 2 | Timeout (order still working) |

---

## Complete Order + Monitor Workflow

When executing a trade, follow this sequence:

### Step 1: Place Order

```bash
# For single leg
python3 scripts/ib_order.py --symbol GOOG --expiry 20260417 --strike 315 --right C --qty 44 --side BUY --limit 9.00

# For spread - use inline Python (see above)
```

### Step 2: Monitor for Fill

```bash
# Immediately after placing, monitor
python3 scripts/ib_fill_monitor.py --symbol GOOG --timeout 300
```

### Step 3: On Fill - Update Records

When order fills, update:
1. `data/trade_log.json` — Log the executed trade
2. `data/portfolio.json` — Add the new position
3. `docs/status.md` — Update recent evaluations

---

## Spread Types Reference

| Spread | Legs | Net Premium |
|--------|------|-------------|
| **Bull Call Spread** | BUY lower call, SELL higher call | Debit (+) |
| **Bear Put Spread** | BUY higher put, SELL lower put | Debit (+) |
| **Bull Put Spread** | SELL higher put, BUY lower put | Credit (-) |
| **Bear Call Spread** | SELL lower call, BUY higher call | Credit (-) |
| **Long Straddle** | BUY call + BUY put (same strike) | Debit (+) |
| **Iron Condor** | 4 legs (2 credit spreads) | Credit (-) |

For credit spreads, use negative limit price.

---

## View Open Orders

```bash
# Display all open orders
python3 scripts/ib_orders.py

# Sync to orders.json
python3 scripts/ib_orders.py --sync
```

---

## Troubleshooting

### Connection Failed
- Ensure TWS/Gateway is running
- Check API is enabled: Configure → API → Settings → Enable ActiveX and Socket Clients
- Verify correct port (4001 for Gateway, 7497 for TWS paper)

### Order Rejected
- Check buying power in TWS
- Verify contract is tradeable
- Ensure limit price is reasonable

### Order Not Filling
- Check current spread mid vs limit price
- Consider adjusting limit closer to mid
- Monitor with `ib_fill_monitor.py` to see gap

### Client ID Conflict
- Each script uses different client ID to avoid conflicts
- ib_sync: 1, ib_order: 2, ib_fill_monitor: 52, ib_orders: 11

---

## Agent Automation Pattern

When agent places and monitors an order:

```python
# 1. Place order (returns order ID)
# 2. Immediately start monitoring
# 3. On fill, capture fill details
# 4. Update trade_log.json, portfolio.json, status.md
# 5. Report to user
```

The `--json` flag on `ib_fill_monitor.py` enables programmatic parsing of results for automated record-keeping.
