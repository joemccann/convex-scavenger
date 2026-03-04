#!/usr/bin/env python3
"""
Interactive Brokers Order Placement

Places option orders via TWS/IB Gateway

Requirements:
  pip install ib_insync

Usage:
  python3 scripts/ib_order.py --symbol ALAB --expiry 20270117 --strike 120 --right C --qty 10 --side BUY --limit MID
  python3 scripts/ib_order.py --symbol ALAB --expiry 20270117 --strike 120 --right C --qty 10 --side BUY --limit 42.50
  python3 scripts/ib_order.py --dry-run ...  # Preview only, don't submit
"""

import argparse
import sys
from datetime import datetime

try:
    from ib_insync import Option, LimitOrder, util
except ImportError:
    print("ERROR: ib_insync not installed")
    print("Install with: pip install ib_insync")
    sys.exit(1)

from clients.ib_client import IBClient, CLIENT_IDS, DEFAULT_HOST, DEFAULT_TWS_PORT

DEFAULT_PORT = DEFAULT_TWS_PORT  # TWS paper trading
DEFAULT_CLIENT_ID = CLIENT_IDS["ib_order"]


def connect_ib(host: str, port: int, client_id: int) -> IBClient:
    """Connect to TWS/IB Gateway, return an IBClient."""
    client = IBClient()
    try:
        client.connect(host=host, port=port, client_id=client_id)
        print(f"✓ Connected to IB on {host}:{port}")
        return client
    except Exception as e:
        print(f"✗ Connection failed: {e}")
        print("\nMake sure TWS/Gateway is running with API enabled")
        sys.exit(1)


def get_option_contract(client: IBClient, symbol: str, expiry: str, strike: float, right: str) -> Option:
    """Create and qualify an option contract"""
    contract = Option(
        symbol=symbol,
        lastTradeDateOrContractMonth=expiry,
        strike=strike,
        right=right,
        exchange='SMART',
        currency='USD'
    )

    qualified = client.qualify_contracts(contract)
    if not qualified:
        print(f"✗ Could not qualify contract: {symbol} {expiry} ${strike} {right}")
        sys.exit(1)

    return qualified[0]


def get_market_data(client: IBClient, contract) -> dict:
    """Get current bid/ask/mid for contract"""
    ticker = client.get_quote(contract)

    # Wait for data (up to 5 seconds)
    for _ in range(50):
        client.sleep(0.1)
        if ticker.bid and ticker.ask and not util.isNan(ticker.bid) and not util.isNan(ticker.ask):
            break

    bid = ticker.bid if ticker.bid and not util.isNan(ticker.bid) else 0
    ask = ticker.ask if ticker.ask and not util.isNan(ticker.ask) else 0
    mid = (bid + ask) / 2 if bid and ask else 0
    raw_last = ticker.last if ticker.last and not util.isNan(ticker.last) else 0
    if raw_last:
        last = raw_last
        last_is_calculated = False
    elif mid:
        last = mid
        last_is_calculated = True
    else:
        last = 0
        last_is_calculated = False

    client.cancel_market_data(contract)

    return {
        'bid': bid,
        'ask': ask,
        'mid': round(mid, 2),
        'last': last,
        'last_is_calculated': last_is_calculated,
        'spread': round(ask - bid, 2) if bid and ask else 0,
        'spread_pct': round((ask - bid) / mid * 100, 1) if mid else 0
    }


def place_order(client: IBClient, contract, side: str, qty: int, limit_price: float, dry_run: bool = False):
    """Place a limit order"""
    action = 'BUY' if side.upper() == 'BUY' else 'SELL'

    order = LimitOrder(
        action=action,
        totalQuantity=qty,
        lmtPrice=limit_price,
        tif='GTC',  # Good til cancelled
        outsideRth=False  # Regular trading hours only
    )

    if dry_run:
        print(f"\n🔍 DRY RUN - Order NOT submitted")
        print(f"   Would place: {action} {qty}x {contract.localSymbol}")
        print(f"   Limit Price: ${limit_price:.2f}")
        print(f"   Total Cost: ${limit_price * qty * 100:,.2f}")
        return None

    print(f"\n📤 Submitting order...")
    trade = client.place_order(contract, order)

    # Wait for order status
    client.sleep(2)

    return trade


def main():
    parser = argparse.ArgumentParser(description="Place option orders via Interactive Brokers")
    parser.add_argument("--symbol", required=True, help="Underlying symbol (e.g., ALAB)")
    parser.add_argument("--expiry", required=True, help="Expiry date YYYYMMDD (e.g., 20270117)")
    parser.add_argument("--strike", type=float, required=True, help="Strike price")
    parser.add_argument("--right", required=True, choices=['C', 'P'], help="C=Call, P=Put")
    parser.add_argument("--qty", type=int, required=True, help="Number of contracts")
    parser.add_argument("--side", required=True, choices=['BUY', 'SELL'], help="BUY or SELL")
    parser.add_argument("--limit", required=True, help="Limit price or 'MID' for mid price")
    parser.add_argument("--host", default=DEFAULT_HOST, help="TWS/Gateway host")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="Port (7497=paper, 7496=live)")
    parser.add_argument("--client-id", type=int, default=DEFAULT_CLIENT_ID, help="Client ID")
    parser.add_argument("--dry-run", action="store_true", help="Preview order without submitting")
    
    args = parser.parse_args()
    
    # Connect
    client = connect_ib(args.host, args.port, args.client_id)

    try:
        # Get contract
        print(f"\n📋 Contract: {args.symbol} {args.expiry} ${args.strike} {'Call' if args.right == 'C' else 'Put'}")
        contract = get_option_contract(client, args.symbol, args.expiry, args.strike, args.right)
        print(f"✓ Qualified: {contract.localSymbol}")

        # Get market data
        print(f"\n💹 Fetching market data...")
        mkt = get_market_data(client, contract)
        print(f"   Bid: ${mkt['bid']:.2f}")
        print(f"   Ask: ${mkt['ask']:.2f}")
        print(f"   Mid: ${mkt['mid']:.2f}")
        print(f"   Spread: ${mkt['spread']:.2f} ({mkt['spread_pct']:.1f}%)")
        if mkt['last']:
            print(f"   Last: ${mkt['last']:.2f}")
        
        # Determine limit price
        if args.limit.upper() == 'MID':
            if not mkt['mid']:
                print("✗ Cannot determine mid price - no bid/ask available")
                sys.exit(1)
            limit_price = mkt['mid']
            print(f"\n📍 Using MID price: ${limit_price:.2f}")
        else:
            limit_price = float(args.limit)
            print(f"\n📍 Using specified limit: ${limit_price:.2f}")
        
        # Calculate total
        total_cost = limit_price * args.qty * 100
        print(f"\n💰 Order Summary:")
        print(f"   {args.side} {args.qty}x {contract.localSymbol}")
        print(f"   @ ${limit_price:.2f} per contract")
        print(f"   Total: ${total_cost:,.2f}")
        
        # Warn if limit is worse than market
        if args.side == 'BUY' and limit_price > mkt['ask'] and mkt['ask'] > 0:
            print(f"   ⚠️  Limit (${limit_price:.2f}) > Ask (${mkt['ask']:.2f}) - will fill at ask")
        if args.side == 'BUY' and limit_price < mkt['bid'] and mkt['bid'] > 0:
            print(f"   ⚠️  Limit (${limit_price:.2f}) < Bid (${mkt['bid']:.2f}) - may not fill")
        
        # Confirm if not dry run
        if not args.dry_run:
            print(f"\n" + "="*50)
            confirm = input("⚠️  CONFIRM ORDER? (type 'YES' to proceed): ")
            if confirm != 'YES':
                print("Order cancelled.")
                sys.exit(0)
        
        # Place order
        trade = place_order(client, contract, args.side, args.qty, limit_price, args.dry_run)

        if trade:
            print(f"\n✓ Order submitted!")
            print(f"   Order ID: {trade.order.orderId}")
            print(f"   Status: {trade.orderStatus.status}")

            if trade.orderStatus.status == 'Filled':
                print(f"   Fill Price: ${trade.orderStatus.avgFillPrice:.2f}")
                print(f"   Filled Qty: {trade.orderStatus.filled}")
            else:
                print(f"   ⏳ Order is working. Check TWS for status.")

    finally:
        client.disconnect()
        print("\n✓ Disconnected from IB")


if __name__ == "__main__":
    main()
