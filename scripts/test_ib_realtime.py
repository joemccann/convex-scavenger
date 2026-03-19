#!/usr/bin/env python3
"""
Tests for IB Real-Time Price Server connectivity.

Usage:
  python3 scripts/test_ib_realtime.py
  python3 scripts/test_ib_realtime.py --ib-only      # Test IB connection only
  python3 scripts/test_ib_realtime.py --ws-only      # Test WebSocket server only
  python3 scripts/test_ib_realtime.py --server-url ws://localhost:8765
"""

import argparse
import asyncio
import json
import sys
from datetime import datetime
from typing import Optional

# Test results tracking
class TestResults:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.errors = []
    
    def ok(self, name: str, message: str = ""):
        self.passed += 1
        print(f"  ✓ {name}" + (f" - {message}" if message else ""))
    
    def fail(self, name: str, message: str = ""):
        self.failed += 1
        self.errors.append((name, message))
        print(f"  ✗ {name}" + (f" - {message}" if message else ""))
    
    def summary(self):
        total = self.passed + self.failed
        print(f"\n{'='*50}")
        print(f"Tests: {self.passed}/{total} passed")
        if self.errors:
            print("\nFailures:")
            for name, msg in self.errors:
                print(f"  - {name}: {msg}")
        return self.failed == 0


TestResults.__test__ = False


results = TestResults()


# =============================================================================
# IB Connection Tests
# =============================================================================

async def test_ib_connection(host: str, port: int):
    """Test direct IB connection."""
    print("\n[IB Connection Tests]")
    
    try:
        from ib_insync import IB, Stock
    except ImportError:
        results.fail("ib_insync import", "Module not installed")
        return
    
    results.ok("ib_insync import")
    
    ib = IB()
    
    # Test connection
    try:
        await ib.connectAsync(host, port, clientId=200, timeout=10)
        results.ok("IB connect", f"{host}:{port}")
    except Exception as e:
        results.fail("IB connect", str(e))
        return
    
    # Test contract qualification
    try:
        contract = Stock("AAPL", "SMART", "USD")
        await ib.qualifyContractsAsync(contract)
        results.ok("Contract qualification", f"AAPL conId={contract.conId}")
    except Exception as e:
        results.fail("Contract qualification", str(e))
        ib.disconnect()
        return
    
    # Test market data request
    try:
        ticker = ib.reqMktData(contract, "", False, False)
        await asyncio.sleep(2)
        
        if ticker.last and ticker.last == ticker.last:  # NaN check
            results.ok("Market data streaming", f"AAPL last={ticker.last:.2f}")
        else:
            results.fail("Market data streaming", "No price received")
    except Exception as e:
        results.fail("Market data streaming", str(e))
    
    # Test snapshot
    try:
        msft = Stock("MSFT", "SMART", "USD")
        await ib.qualifyContractsAsync(msft)
        ticker = ib.reqMktData(msft, "", True, False)  # snapshot
        await asyncio.sleep(1)
        
        if ticker.last and ticker.last == ticker.last:
            results.ok("Snapshot quote", f"MSFT last={ticker.last:.2f}")
        else:
            results.fail("Snapshot quote", "No price in snapshot")
    except Exception as e:
        results.fail("Snapshot quote", str(e))
    
    # Test multiple symbols
    try:
        symbols = ["NVDA", "TSLA", "GOOGL"]
        contracts = [Stock(s, "SMART", "USD") for s in symbols]
        await ib.qualifyContractsAsync(*contracts)
        
        tickers = [ib.reqMktData(c, "", False, False) for c in contracts]
        await asyncio.sleep(2)
        
        prices = {s: t.last for s, t in zip(symbols, tickers) if t.last == t.last}
        if len(prices) >= 2:
            results.ok("Multiple symbols", f"Got prices for {list(prices.keys())}")
        else:
            results.fail("Multiple symbols", f"Only got {len(prices)} prices")
        
        # Cancel market data
        for c in contracts:
            ib.cancelMktData(c)
    except Exception as e:
        results.fail("Multiple symbols", str(e))
    
    # Disconnect
    ib.disconnect()
    results.ok("IB disconnect")


# =============================================================================
# WebSocket Server Tests
# =============================================================================

async def test_websocket_server(server_url: str):
    """Test WebSocket server connectivity."""
    print("\n[WebSocket Server Tests]")
    
    try:
        import websockets
    except ImportError:
        results.fail("websockets import", "Module not installed")
        return
    
    results.ok("websockets import")
    
    # Test connection
    try:
        async with websockets.connect(server_url, close_timeout=5) as ws:
            results.ok("WebSocket connect", server_url)
            
            # Should receive status message
            try:
                msg = await asyncio.wait_for(ws.recv(), timeout=5)
                data = json.loads(msg)
                if data.get("type") == "status":
                    ib_connected = data.get("ib_connected", False)
                    results.ok("Status message", f"IB connected: {ib_connected}")
                else:
                    results.fail("Status message", f"Unexpected type: {data.get('type')}")
            except asyncio.TimeoutError:
                results.fail("Status message", "Timeout waiting for status")
            
            # Test ping/pong
            try:
                await ws.send(json.dumps({"action": "ping"}))
                msg = await asyncio.wait_for(ws.recv(), timeout=5)
                data = json.loads(msg)
                if data.get("type") == "pong":
                    results.ok("Ping/pong")
                else:
                    results.fail("Ping/pong", f"Unexpected response: {data}")
            except asyncio.TimeoutError:
                results.fail("Ping/pong", "Timeout")
            
            # Test subscribe
            try:
                await ws.send(json.dumps({"action": "subscribe", "symbols": ["AAPL"]}))
                
                # Wait for subscribed confirmation and initial price
                # Note: Messages may arrive in any order due to async nature
                subscribed = False
                got_price = False
                
                for _ in range(15):  # Max 15 messages
                    try:
                        msg = await asyncio.wait_for(ws.recv(), timeout=2)
                        data = json.loads(msg)
                        
                        if data.get("type") == "subscribed":
                            subscribed = True
                        
                        if data.get("type") == "price":
                            got_price = True
                            price_data = data.get("data", {})
                            if not subscribed:
                                # Price arrived before subscribe confirmation - that's OK
                                subscribed = True  # Implicit confirmation
                        
                        if subscribed and got_price:
                            break
                    except asyncio.TimeoutError:
                        break
                
                if subscribed:
                    results.ok("Subscribe confirmation", "received (or implicit via price)")
                else:
                    results.fail("Subscribe confirmation", "Never received")
                if got_price:
                    results.ok("Price update", f"AAPL received")
                else:
                    results.fail("Price update", "Never received")
                    
            except Exception as e:
                results.fail("Subscribe flow", str(e))
            
            # Test unsubscribe - drain any pending price messages first
            try:
                await ws.send(json.dumps({"action": "unsubscribe", "symbols": ["AAPL"]}))
                unsubscribed = False
                for _ in range(10):
                    try:
                        msg = await asyncio.wait_for(ws.recv(), timeout=2)
                        data = json.loads(msg)
                        if data.get("type") == "unsubscribed":
                            unsubscribed = True
                            results.ok("Unsubscribe", f"symbols: {data.get('symbols')}")
                            break
                        # Skip price messages still in queue
                    except asyncio.TimeoutError:
                        break
                if not unsubscribed:
                    results.fail("Unsubscribe", "Never received confirmation")
            except Exception as e:
                results.fail("Unsubscribe", str(e))
            
            # Test snapshot - need to wait for response among other messages
            try:
                await ws.send(json.dumps({"action": "snapshot", "symbols": ["MSFT"]}))
                got_snapshot = False
                for _ in range(10):
                    try:
                        msg = await asyncio.wait_for(ws.recv(), timeout=3)
                        data = json.loads(msg)
                        if data.get("type") == "snapshot":
                            price_data = data.get("data", {})
                            results.ok("Snapshot", f"MSFT last={price_data.get('last')}")
                            got_snapshot = True
                            break
                        # Skip other message types
                    except asyncio.TimeoutError:
                        break
                if not got_snapshot:
                    results.fail("Snapshot", "Never received")
            except Exception as e:
                results.fail("Snapshot", str(e))
            
            # Test invalid action
            try:
                await ws.send(json.dumps({"action": "invalid_action"}))
                got_error = False
                for _ in range(5):
                    try:
                        msg = await asyncio.wait_for(ws.recv(), timeout=2)
                        data = json.loads(msg)
                        if data.get("type") == "error":
                            results.ok("Error handling", f"Got error for invalid action")
                            got_error = True
                            break
                    except asyncio.TimeoutError:
                        break
                if not got_error:
                    results.fail("Error handling", "Never received error response")
            except Exception as e:
                results.fail("Error handling", str(e))
                
    except Exception as e:
        results.fail("WebSocket connect", str(e))


# =============================================================================
# Integration Tests
# =============================================================================

async def test_multiple_clients(server_url: str):
    """Test multiple simultaneous clients."""
    print("\n[Multiple Client Tests]")
    
    try:
        import websockets
    except ImportError:
        results.fail("Multiple clients", "websockets not installed")
        return
    
    async def client_session(client_id: int, symbols: list) -> dict:
        """Run a client session and return results."""
        result = {"connected": False, "subscribed": False, "prices": {}}
        
        try:
            async with websockets.connect(server_url, close_timeout=5) as ws:
                result["connected"] = True
                
                # Subscribe
                await ws.send(json.dumps({"action": "subscribe", "symbols": symbols}))
                
                # Collect messages for 3 seconds
                end_time = asyncio.get_event_loop().time() + 3
                while asyncio.get_event_loop().time() < end_time:
                    try:
                        msg = await asyncio.wait_for(ws.recv(), timeout=1)
                        data = json.loads(msg)
                        
                        if data.get("type") == "subscribed":
                            result["subscribed"] = True
                        elif data.get("type") == "price":
                            symbol = data.get("data", {}).get("symbol")
                            if symbol:
                                result["prices"][symbol] = data.get("data", {}).get("last")
                    except asyncio.TimeoutError:
                        continue
                        
        except Exception as e:
            result["error"] = str(e)
        
        return result
    
    # Run 3 clients concurrently
    try:
        client_tasks = [
            client_session(1, ["AAPL", "MSFT"]),
            client_session(2, ["NVDA", "TSLA"]),
            client_session(3, ["AAPL", "NVDA"]),  # Overlapping symbols
        ]
        
        client_results = await asyncio.gather(*client_tasks)
        
        connected = sum(1 for r in client_results if r["connected"])
        subscribed = sum(1 for r in client_results if r["subscribed"])
        total_prices = sum(len(r["prices"]) for r in client_results)
        
        if connected == 3:
            results.ok("Multiple connections", f"{connected}/3 clients connected")
        else:
            results.fail("Multiple connections", f"Only {connected}/3 connected")
        
        if subscribed == 3:
            results.ok("Multiple subscriptions", f"{subscribed}/3 clients subscribed")
        else:
            results.fail("Multiple subscriptions", f"Only {subscribed}/3 subscribed")
        
        if total_prices >= 4:
            results.ok("Price distribution", f"Received {total_prices} price updates total")
        else:
            results.fail("Price distribution", f"Only {total_prices} prices received")
            
    except Exception as e:
        results.fail("Multiple clients", str(e))


# =============================================================================
# Latency Test
# =============================================================================

async def test_latency(server_url: str):
    """Test round-trip latency."""
    print("\n[Latency Tests]")
    
    try:
        import websockets
    except ImportError:
        results.fail("Latency test", "websockets not installed")
        return
    
    try:
        async with websockets.connect(server_url, close_timeout=5) as ws:
            # Skip initial status
            await asyncio.wait_for(ws.recv(), timeout=5)
            
            # Measure ping latency
            latencies = []
            for _ in range(5):
                start = datetime.now()
                await ws.send(json.dumps({"action": "ping"}))
                await asyncio.wait_for(ws.recv(), timeout=5)
                latency = (datetime.now() - start).total_seconds() * 1000
                latencies.append(latency)
            
            avg_latency = sum(latencies) / len(latencies)
            min_latency = min(latencies)
            max_latency = max(latencies)
            
            if avg_latency < 100:
                results.ok("Ping latency", f"avg={avg_latency:.1f}ms, min={min_latency:.1f}ms, max={max_latency:.1f}ms")
            else:
                results.fail("Ping latency", f"avg={avg_latency:.1f}ms (>100ms)")
                
    except Exception as e:
        results.fail("Latency test", str(e))


# Manual probe script: keep callable from __main__ but do not let pytest treat
# these parameterized helpers as fixture-driven tests.
test_ib_connection.__test__ = False
test_websocket_server.__test__ = False
test_multiple_clients.__test__ = False
test_latency.__test__ = False


# =============================================================================
# Main
# =============================================================================

async def main():
    parser = argparse.ArgumentParser(description="Test IB Real-Time connectivity")
    parser.add_argument("--ib-host", default="127.0.0.1", help="IB Gateway host")
    parser.add_argument("--ib-port", type=int, default=4001, help="IB Gateway port")
    parser.add_argument("--server-url", default="ws://localhost:8765", help="WebSocket server URL")
    parser.add_argument("--ib-only", action="store_true", help="Only test IB connection")
    parser.add_argument("--ws-only", action="store_true", help="Only test WebSocket server")
    args = parser.parse_args()
    
    print("=" * 50)
    print("IB Real-Time Connectivity Tests")
    print("=" * 50)
    
    if not args.ws_only:
        await test_ib_connection(args.ib_host, args.ib_port)
    
    if not args.ib_only:
        await test_websocket_server(args.server_url)
        await test_multiple_clients(args.server_url)
        await test_latency(args.server_url)
    
    success = results.summary()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    asyncio.run(main())
