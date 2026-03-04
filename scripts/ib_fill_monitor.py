#!/usr/bin/env python3
"""
Interactive Brokers Fill Monitor

Monitors open orders for fills with real-time spread pricing updates.

Requirements:
  pip install ib_insync

Usage:
  # Monitor specific order by ID
  python3 scripts/ib_fill_monitor.py --order-id 7

  # Monitor all orders for a symbol
  python3 scripts/ib_fill_monitor.py --symbol GOOG

  # Monitor all open orders
  python3 scripts/ib_fill_monitor.py --all

  # Custom settings
  python3 scripts/ib_fill_monitor.py --symbol GOOG --interval 5 --timeout 600

  # Output JSON when filled (for automation)
  python3 scripts/ib_fill_monitor.py --order-id 7 --json
"""

import argparse
import json
import sys
from datetime import datetime
from typing import Optional, List, Dict, Any

try:
    from ib_insync import IB, Option, util
except ImportError:
    print("ERROR: ib_insync not installed")
    print("Install with: pip install ib_insync")
    sys.exit(1)


DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 4001
DEFAULT_CLIENT_ID = 52
DEFAULT_INTERVAL = 10  # seconds between checks
DEFAULT_TIMEOUT = 300  # 5 minutes default


class FillMonitor:
    def __init__(self, host: str, port: int, client_id: int):
        self.ib = IB()
        self.host = host
        self.port = port
        self.client_id = client_id
        self.leg_tickers = {}  # conId -> ticker for spread legs
        
    def connect(self) -> bool:
        try:
            self.ib.connect(self.host, self.port, clientId=self.client_id)
            return True
        except Exception as e:
            print(f"✗ Connection failed: {e}")
            return False
    
    def disconnect(self):
        # Cancel any market data subscriptions
        for ticker in self.leg_tickers.values():
            try:
                self.ib.cancelMktData(ticker.contract)
            except:
                pass
        self.ib.disconnect()
    
    def get_open_orders(self, symbol: Optional[str] = None, order_id: Optional[int] = None) -> List:
        """Get open orders, optionally filtered by symbol or order ID"""
        self.ib.reqAllOpenOrders()
        self.ib.sleep(1)
        trades = self.ib.openTrades()
        
        if order_id is not None:
            trades = [t for t in trades if t.order.orderId == order_id]
        elif symbol is not None:
            trades = [t for t in trades if t.contract.symbol == symbol.upper()]
        
        return trades
    
    def get_fills(self, symbol: Optional[str] = None) -> List:
        """Get execution fills, optionally filtered by symbol"""
        fills = self.ib.fills()
        if symbol:
            fills = [f for f in fills if f.contract.symbol == symbol.upper()]
        return fills
    
    def setup_spread_market_data(self, trade) -> None:
        """Set up market data for spread legs to calculate live spread mid"""
        if trade.contract.secType != 'BAG':
            return
        
        combo_legs = trade.contract.comboLegs
        if not combo_legs:
            return
        
        for leg in combo_legs:
            if leg.conId in self.leg_tickers:
                continue
            
            # Create option contract from conId
            # We need to request contract details to get full contract
            contracts = self.ib.reqContractDetails(
                Option(conId=leg.conId, exchange='SMART')
            )
            if contracts:
                contract = contracts[0].contract
                ticker = self.ib.reqMktData(contract, '', False, False)
                self.leg_tickers[leg.conId] = ticker
    
    def get_spread_mid(self, trade) -> Optional[float]:
        """Calculate current spread mid price from leg market data"""
        if trade.contract.secType != 'BAG':
            return None
        
        combo_legs = trade.contract.comboLegs
        if not combo_legs or len(combo_legs) != 2:
            return None
        
        spread_mid = 0.0
        for leg in combo_legs:
            ticker = self.leg_tickers.get(leg.conId)
            if not ticker:
                return None
            
            bid = ticker.bid if ticker.bid and not util.isNan(ticker.bid) else 0
            ask = ticker.ask if ticker.ask and not util.isNan(ticker.ask) else 0
            
            if not bid or not ask:
                return None
            
            mid = (bid + ask) / 2
            
            # BUY leg adds to cost, SELL leg reduces cost
            if leg.action == 'BUY':
                spread_mid += mid
            else:
                spread_mid -= mid
        
        return round(spread_mid, 2)
    
    def format_trade_summary(self, trade) -> str:
        """Format trade for display"""
        contract = trade.contract
        order = trade.order
        
        if contract.secType == 'BAG':
            return f"{order.action} {int(order.totalQuantity)}x {contract.symbol} SPREAD @ ${order.lmtPrice:.2f}"
        elif contract.secType == 'OPT':
            return f"{order.action} {int(order.totalQuantity)}x {contract.localSymbol} @ ${order.lmtPrice:.2f}"
        else:
            return f"{order.action} {int(order.totalQuantity)}x {contract.symbol} @ ${order.lmtPrice:.2f}"
    
    def monitor(
        self,
        symbol: Optional[str] = None,
        order_id: Optional[int] = None,
        monitor_all: bool = False,
        interval: int = DEFAULT_INTERVAL,
        timeout: int = DEFAULT_TIMEOUT,
        output_json: bool = False
    ) -> Dict[str, Any]:
        """
        Monitor orders for fills.
        
        Returns dict with:
          - status: 'filled', 'partial', 'timeout', 'cancelled', 'not_found'
          - orders: list of order results
        """
        if not self.connect():
            return {"status": "error", "message": "Connection failed"}
        
        try:
            # Initial order lookup
            if monitor_all:
                trades = self.get_open_orders()
            elif order_id is not None:
                trades = self.get_open_orders(order_id=order_id)
            elif symbol is not None:
                trades = self.get_open_orders(symbol=symbol)
            else:
                print("✗ Must specify --order-id, --symbol, or --all")
                return {"status": "error", "message": "No filter specified"}
            
            if not trades:
                # Check if already filled
                fills = self.get_fills(symbol)
                if fills:
                    if not output_json:
                        print(f"✓ No open orders found - checking recent fills...")
                        for f in fills:
                            side = "BUY" if f.execution.side == "BOT" else "SELL"
                            print(f"  {side} {int(f.execution.shares)}x {f.contract.symbol} @ ${f.execution.avgPrice:.2f}")
                    return {
                        "status": "filled",
                        "orders": [{
                            "symbol": f.contract.symbol,
                            "side": f.execution.side,
                            "quantity": int(f.execution.shares),
                            "fill_price": f.execution.avgPrice,
                            "time": str(f.execution.time)
                        } for f in fills]
                    }
                else:
                    if not output_json:
                        print("✗ No matching orders found")
                    return {"status": "not_found", "orders": []}
            
            # Set up market data for spreads
            for trade in trades:
                self.setup_spread_market_data(trade)
            
            self.ib.sleep(2)  # Allow market data to populate
            
            if not output_json:
                print(f"📡 Monitoring {len(trades)} order(s)")
                for trade in trades:
                    print(f"   #{trade.order.orderId}: {self.format_trade_summary(trade)}")
                print(f"   Interval: {interval}s | Timeout: {timeout}s")
                print("=" * 60)
            
            # Track order IDs we're monitoring
            order_ids = {t.order.orderId for t in trades}
            results = {}
            
            checks = 0
            max_checks = timeout // interval
            
            while checks < max_checks:
                self.ib.sleep(interval)
                checks += 1
                
                # Refresh orders
                self.ib.reqAllOpenOrders()
                self.ib.sleep(0.5)
                
                current_trades = self.get_open_orders()
                current_ids = {t.order.orderId for t in current_trades}
                
                timestamp = datetime.now().strftime('%H:%M:%S')
                
                for trade in current_trades:
                    if trade.order.orderId not in order_ids:
                        continue
                    
                    status = trade.orderStatus
                    filled = int(status.filled)
                    total = int(trade.order.totalQuantity)
                    
                    # Check for fills
                    if status.status == 'Filled':
                        results[trade.order.orderId] = {
                            "status": "filled",
                            "symbol": trade.contract.symbol,
                            "quantity": filled,
                            "fill_price": status.avgFillPrice,
                            "total_cost": status.avgFillPrice * filled * 100
                        }
                        if not output_json:
                            print(f"\n✓ ORDER #{trade.order.orderId} FILLED @ ${status.avgFillPrice:.2f}")
                            print(f"   Contracts: {filled}")
                            print(f"   Total: ${status.avgFillPrice * filled * 100:,.2f}")
                        order_ids.discard(trade.order.orderId)
                    
                    elif filled > 0:
                        if not output_json:
                            print(f"[{timestamp}] #{trade.order.orderId}: PARTIAL {filled}/{total} @ ${status.avgFillPrice:.2f}")
                    
                    else:
                        # Show spread mid if available
                        spread_mid = self.get_spread_mid(trade)
                        limit = trade.order.lmtPrice
                        
                        if spread_mid and not output_json:
                            gap = spread_mid - limit
                            print(f"[{timestamp}] #{trade.order.orderId}: {status.status} | Mid: ${spread_mid:.2f} | Limit: ${limit:.2f} | Gap: ${gap:+.2f}")
                        elif not output_json:
                            print(f"[{timestamp}] #{trade.order.orderId}: {status.status}")
                
                # Check for orders that disappeared (filled or cancelled)
                disappeared = order_ids - current_ids
                for oid in disappeared:
                    if oid not in results:
                        # Check fills
                        fills = self.get_fills(symbol)
                        recent_fill = next((f for f in fills if hasattr(f, 'order') and f.order.orderId == oid), None)
                        
                        if recent_fill:
                            results[oid] = {
                                "status": "filled",
                                "symbol": recent_fill.contract.symbol,
                                "quantity": int(recent_fill.execution.shares),
                                "fill_price": recent_fill.execution.avgPrice
                            }
                        else:
                            results[oid] = {"status": "unknown", "message": "Order disappeared"}
                        
                        if not output_json:
                            print(f"\n⚠️  Order #{oid} no longer open - checking fills...")
                    
                    order_ids.discard(oid)
                
                # Exit if all orders resolved
                if not order_ids:
                    break
            
            # Timeout - report remaining orders
            for oid in order_ids:
                results[oid] = {"status": "timeout", "message": f"Still working after {timeout}s"}
            
            if not output_json:
                print(f"\n{'=' * 60}")
                print(f"Monitoring ended at {datetime.now().strftime('%H:%M:%S')}")
                
                if order_ids:
                    print(f"⏳ {len(order_ids)} order(s) still working")
            
            # Determine overall status
            statuses = [r.get("status") for r in results.values()]
            if all(s == "filled" for s in statuses):
                overall = "filled"
            elif any(s == "filled" for s in statuses):
                overall = "partial"
            elif any(s == "timeout" for s in statuses):
                overall = "timeout"
            else:
                overall = "unknown"
            
            return {"status": overall, "orders": results}
        
        finally:
            self.disconnect()


def main():
    parser = argparse.ArgumentParser(description="Monitor IB orders for fills")
    
    # Filter options (mutually exclusive in spirit, but allow combinations)
    parser.add_argument("--order-id", type=int, help="Monitor specific order by ID")
    parser.add_argument("--symbol", type=str, help="Monitor all orders for symbol")
    parser.add_argument("--all", action="store_true", dest="monitor_all", help="Monitor all open orders")
    
    # Connection options
    parser.add_argument("--host", default=DEFAULT_HOST, help="TWS/Gateway host")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="Port (4001=Gateway, 7497=TWS paper)")
    parser.add_argument("--client-id", type=int, default=DEFAULT_CLIENT_ID, help="Client ID")
    
    # Monitoring options
    parser.add_argument("--interval", type=int, default=DEFAULT_INTERVAL, help="Seconds between checks")
    parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT, help="Total seconds before timeout")
    
    # Output options
    parser.add_argument("--json", action="store_true", help="Output JSON result (for automation)")
    
    args = parser.parse_args()
    
    if not any([args.order_id, args.symbol, args.monitor_all]):
        parser.error("Must specify --order-id, --symbol, or --all")
    
    monitor = FillMonitor(args.host, args.port, args.client_id)
    
    result = monitor.monitor(
        symbol=args.symbol,
        order_id=args.order_id,
        monitor_all=args.monitor_all,
        interval=args.interval,
        timeout=args.timeout,
        output_json=args.json
    )
    
    if args.json:
        print(json.dumps(result, indent=2))
    
    # Exit code based on status
    if result["status"] == "filled":
        sys.exit(0)
    elif result["status"] == "partial":
        sys.exit(0)
    elif result["status"] == "timeout":
        sys.exit(2)
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()
