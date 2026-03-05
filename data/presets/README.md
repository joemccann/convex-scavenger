# Presets

Strategy-agnostic ticker presets. Used by `leap-scan`, `garch-convergence`, `discover`, and any future strategy.

## Schema

Every preset file follows this structure:

```json
{
  "name": "sp500-semis",
  "description": "S&P 500 Semiconductors (GICS Sub-Industry)",
  "tickers": ["NVDA", "AMD", "AVGO", ...],
  "pairs": [["NVDA", "AMD"], ["AVGO", "QCOM"], ...],
  "sector": "Information Technology",
  "sub_industry": "Semiconductors",
  "vol_driver": "AI/cloud capex, semiconductor demand",
  "source": "S&P 500 GICS classification"
}
```

### Fields

| Field | Type | Required | Used By |
|-------|------|----------|---------|
| `name` | string | ✅ | All |
| `description` | string | ✅ | All |
| `tickers` | string[] | ✅ | leap-scan, discover, any scan |
| `pairs` | [string, string][] | ✅ | garch-convergence |
| `sector` | string | Optional | Filtering |
| `sub_industry` | string | Optional | Filtering |
| `vol_driver` | string | Optional | garch-convergence thesis |
| `source` | string | Optional | Provenance |
| `groups` | object | Optional | sp500 master only (hierarchical) |

### Usage

```python
from utils.presets import load_preset, list_presets

# List all available presets
presets = list_presets()

# Load a preset
p = load_preset("sp500-semis")
p.tickers  # ["NVDA", "AMD", ...]  — for leap-scan
p.pairs    # [["NVDA","AMD"], ...]  — for garch-convergence

# Load the full S&P 500
sp = load_preset("sp500")
sp.tickers  # all 503
sp.groups   # hierarchical sub-industry breakdown
```

### CLI

```bash
# leap-scan
python3 scripts/leap_scanner_uw.py --preset sp500-semis

# garch-convergence
python3 scripts/garch_convergence_scanner.py --preset sp500-semis
```

## Presets Index

### Master
- `sp500.json` — Full S&P 500 (503 tickers, 286 pairs, 99 groups)

### Sub-Industry Presets (33)
See individual files: `sp500-*.json`
