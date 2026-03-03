#!/usr/bin/env python3
"""
Trade Blotter - Fetch and reconcile trades from Interactive Brokers.

Usage:
    python3 scripts/blotter.py                 # Today's trades
    python3 scripts/blotter.py --summary       # P&L summary only
    python3 scripts/blotter.py --json          # JSON output
    python3 scripts/blotter.py --verbose       # Show execution details
    python3 scripts/blotter.py --port 7497     # Custom IB port

Integration tests:
    python3 scripts/trade_blotter/test_integration.py
"""
import sys
import os

# Add trade_blotter package to path
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'trade_blotter'))

from cli import main

if __name__ == "__main__":
    sys.exit(main())
