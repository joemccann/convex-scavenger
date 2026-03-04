#!/usr/bin/env python3
"""
Interactive Brokers Real-Time Price Server

A standalone WebSocket server that streams real-time prices from IB.
Separate from ib_sync.py which handles periodic portfolio syncing.

Usage:
  python3 scripts/ib_realtime_server.py
  python3 scripts/ib_realtime_server.py --port 8765 --ib-port 4001

Requirements:
  pip install ib_insync websockets

Protocol:
  Client -> Server:
    {"action": "subscribe", "symbols": ["AAPL", "MSFT"]}
    {"action": "unsubscribe", "symbols": ["AAPL"]}
    {"action": "snapshot", "symbols": ["NVDA"]}
    {"action": "ping"}
  
  Server -> Client:
    {"type": "price", "symbol": "AAPL", "data": {...}}
    {"type": "subscribed", "symbols": ["AAPL", "MSFT"]}
    {"type": "unsubscribed", "symbols": ["AAPL"]}
    {"type": "snapshot", "symbol": "NVDA", "data": {...}}
    {"type": "error", "message": "..."}
    {"type": "pong"}
    {"type": "status", "ib_connected": true, "subscriptions": [...]}
"""

import argparse
import asyncio
import json
import logging
import math
import signal
import sys
from datetime import datetime
from typing import Dict, Set, Optional, Any

try:
    from ib_insync import IB, Stock, Option, util
    HAS_IB = True
except ImportError:
    HAS_IB = False
    print("Warning: ib_insync not installed. Run: pip install ib_insync", file=sys.stderr)

try:
    import websockets
    from websockets.server import WebSocketServerProtocol
    HAS_WS = True
except ImportError:
    HAS_WS = False
    print("Warning: websockets not installed. Run: pip install websockets", file=sys.stderr)

from clients.ib_client import CLIENT_IDS, DEFAULT_HOST, DEFAULT_GATEWAY_PORT

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger(__name__)


class IBRealtimeServer:
    """WebSocket server that streams real-time IB prices."""
    
    def __init__(self, ws_port: int = 8765, ib_host: str = DEFAULT_HOST, ib_port: int = DEFAULT_GATEWAY_PORT):
        self.ws_port = ws_port
        self.ib_host = ib_host
        self.ib_port = ib_port
        self.ib: Optional[IB] = None
        self.clients: Set[WebSocketServerProtocol] = set()
        self.subscriptions: Dict[str, Set[WebSocketServerProtocol]] = {}  # symbol -> clients
        self.tickers: Dict[str, Any] = {}  # symbol -> IB ticker
        self.contracts: Dict[str, Any] = {}  # symbol -> IB contract
        self.running = False
    
    async def connect_ib(self) -> bool:
        """Connect to IB Gateway/TWS."""
        if not HAS_IB:
            logger.error("ib_insync not installed")
            return False
        
        try:
            self.ib = IB()
            await self.ib.connectAsync(
                self.ib_host, 
                self.ib_port, 
                clientId=CLIENT_IDS["ib_realtime_server"],
                timeout=10
            )
            logger.info(f"✓ Connected to IB on {self.ib_host}:{self.ib_port}")
            
            # Set up disconnect handler
            self.ib.disconnectedEvent += self._on_ib_disconnect
            
            return True
        except Exception as e:
            logger.error(f"✗ Failed to connect to IB: {e}")
            return False
    
    def _on_ib_disconnect(self):
        """Handle IB disconnection."""
        logger.warning("IB connection lost, attempting reconnect...")
        asyncio.create_task(self._reconnect_ib())
    
    async def _reconnect_ib(self):
        """Attempt to reconnect to IB."""
        await asyncio.sleep(5)
        if await self.connect_ib():
            # Resubscribe to all symbols
            symbols = list(self.subscriptions.keys())
            for symbol in symbols:
                await self._subscribe_symbol(symbol)
    
    async def _subscribe_symbol(self, symbol: str) -> bool:
        """Subscribe to market data for a symbol."""
        if not self.ib or not self.ib.isConnected():
            return False
        
        if symbol in self.tickers:
            return True  # Already subscribed
        
        try:
            # Create contract
            contract = Stock(symbol, 'SMART', 'USD')
            await self.ib.qualifyContractsAsync(contract)
            
            # Request streaming market data
            ticker = self.ib.reqMktData(contract, '233', False, False)
            
            # Set up update callback
            ticker.updateEvent += lambda t: asyncio.create_task(
                self._on_ticker_update(symbol, t)
            )
            
            self.tickers[symbol] = ticker
            self.contracts[symbol] = contract
            
            logger.info(f"Subscribed to {symbol}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to subscribe to {symbol}: {e}")
            return False
    
    async def _unsubscribe_symbol(self, symbol: str):
        """Unsubscribe from market data for a symbol."""
        if symbol in self.tickers and self.ib and self.ib.isConnected():
            try:
                self.ib.cancelMktData(self.contracts[symbol])
            except Exception:
                pass
            del self.tickers[symbol]
            del self.contracts[symbol]
            logger.info(f"Unsubscribed from {symbol}")
    
    async def _on_ticker_update(self, symbol: str, ticker: Any):
        """Handle ticker update from IB."""
        if symbol not in self.subscriptions:
            return
        
        # Build price update message
        data = self._ticker_to_dict(symbol, ticker)
        message = json.dumps({"type": "price", "symbol": symbol, "data": data})
        
        # Broadcast to all subscribed clients
        clients = self.subscriptions.get(symbol, set())
        if clients:
            await asyncio.gather(
                *[self._safe_send(client, message) for client in clients],
                return_exceptions=True
            )
    
    @staticmethod
    def _safe_value(val):
        """Return None if val is NaN, otherwise return val."""
        if val is None:
            return None
        try:
            if math.isnan(val):
                return None
        except TypeError:
            pass
        return val

    def _ticker_to_dict(self, symbol: str, ticker: Any) -> dict:
        """Convert IB ticker to dictionary."""
        last = self._safe_value(ticker.last)
        bid = self._safe_value(ticker.bid)
        ask = self._safe_value(ticker.ask)
        last_is_calculated = False
        if last is None and bid is not None and ask is not None:
            last = round((bid + ask) / 2, 4)
            last_is_calculated = True

        return {
            "symbol": symbol,
            "last": last,
            "lastIsCalculated": last_is_calculated,
            "bid": bid,
            "ask": ask,
            "bidSize": self._safe_value(ticker.bidSize),
            "askSize": self._safe_value(ticker.askSize),
            "volume": self._safe_value(ticker.volume),
            "high": self._safe_value(ticker.high),
            "low": self._safe_value(ticker.low),
            "open": self._safe_value(ticker.open),
            "close": self._safe_value(ticker.close),
            "timestamp": datetime.now().isoformat()
        }
    
    async def _safe_send(self, client: WebSocketServerProtocol, message: str):
        """Safely send message to client, handling disconnections."""
        try:
            await client.send(message)
        except websockets.exceptions.ConnectionClosed:
            await self._remove_client(client)
    
    async def _remove_client(self, client: WebSocketServerProtocol):
        """Remove a client and clean up its subscriptions."""
        self.clients.discard(client)
        
        # Remove from all subscriptions
        empty_symbols = []
        for symbol, clients in self.subscriptions.items():
            clients.discard(client)
            if not clients:
                empty_symbols.append(symbol)
        
        # Unsubscribe from symbols with no clients
        for symbol in empty_symbols:
            del self.subscriptions[symbol]
            await self._unsubscribe_symbol(symbol)
    
    async def handle_client(self, websocket: WebSocketServerProtocol):
        """Handle a WebSocket client connection."""
        self.clients.add(websocket)
        client_id = id(websocket)
        logger.info(f"Client {client_id} connected ({len(self.clients)} total)")
        
        # Send initial status
        await self._safe_send(websocket, json.dumps({
            "type": "status",
            "ib_connected": self.ib.isConnected() if self.ib else False,
            "subscriptions": list(self.subscriptions.keys())
        }))
        
        try:
            async for message in websocket:
                await self._handle_message(websocket, message)
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            await self._remove_client(websocket)
            logger.info(f"Client {client_id} disconnected ({len(self.clients)} total)")
    
    async def _handle_message(self, client: WebSocketServerProtocol, message: str):
        """Handle incoming message from client."""
        try:
            data = json.loads(message)
            action = data.get("action")
            
            if action == "subscribe":
                symbols = data.get("symbols", [])
                await self._handle_subscribe(client, symbols)
            
            elif action == "unsubscribe":
                symbols = data.get("symbols", [])
                await self._handle_unsubscribe(client, symbols)
            
            elif action == "snapshot":
                symbols = data.get("symbols", [])
                await self._handle_snapshot(client, symbols)
            
            elif action == "ping":
                await self._safe_send(client, json.dumps({"type": "pong"}))
            
            else:
                await self._safe_send(client, json.dumps({
                    "type": "error",
                    "message": f"Unknown action: {action}"
                }))
                
        except json.JSONDecodeError:
            await self._safe_send(client, json.dumps({
                "type": "error",
                "message": "Invalid JSON"
            }))
    
    async def _handle_subscribe(self, client: WebSocketServerProtocol, symbols: list):
        """Handle subscribe request."""
        subscribed = []
        
        for symbol in symbols:
            symbol = symbol.upper()
            
            # Add to subscriptions
            if symbol not in self.subscriptions:
                self.subscriptions[symbol] = set()
            self.subscriptions[symbol].add(client)
            
            # Subscribe to IB if needed
            if symbol not in self.tickers:
                if await self._subscribe_symbol(symbol):
                    subscribed.append(symbol)
                    
                    # Wait a moment for initial data
                    await asyncio.sleep(0.5)
                    
                    # Send initial snapshot
                    if symbol in self.tickers:
                        data = self._ticker_to_dict(symbol, self.tickers[symbol])
                        await self._safe_send(client, json.dumps({
                            "type": "price",
                            "symbol": symbol,
                            "data": data
                        }))
            else:
                subscribed.append(symbol)
                # Send current data
                data = self._ticker_to_dict(symbol, self.tickers[symbol])
                await self._safe_send(client, json.dumps({
                    "type": "price",
                    "symbol": symbol,
                    "data": data
                }))
        
        await self._safe_send(client, json.dumps({
            "type": "subscribed",
            "symbols": subscribed
        }))
    
    async def _handle_unsubscribe(self, client: WebSocketServerProtocol, symbols: list):
        """Handle unsubscribe request."""
        unsubscribed = []
        
        for symbol in symbols:
            symbol = symbol.upper()
            
            if symbol in self.subscriptions:
                self.subscriptions[symbol].discard(client)
                unsubscribed.append(symbol)
                
                # If no more clients, unsubscribe from IB
                if not self.subscriptions[symbol]:
                    del self.subscriptions[symbol]
                    await self._unsubscribe_symbol(symbol)
        
        await self._safe_send(client, json.dumps({
            "type": "unsubscribed",
            "symbols": unsubscribed
        }))
    
    async def _handle_snapshot(self, client: WebSocketServerProtocol, symbols: list):
        """Handle snapshot request (one-time quote)."""
        if not self.ib or not self.ib.isConnected():
            await self._safe_send(client, json.dumps({
                "type": "error",
                "message": "IB not connected"
            }))
            return
        
        for symbol in symbols:
            symbol = symbol.upper()
            
            try:
                contract = Stock(symbol, 'SMART', 'USD')
                await self.ib.qualifyContractsAsync(contract)
                
                ticker = self.ib.reqMktData(contract, '', True, False)  # snapshot=True
                await asyncio.sleep(1)
                
                data = self._ticker_to_dict(symbol, ticker)
                await self._safe_send(client, json.dumps({
                    "type": "snapshot",
                    "symbol": symbol,
                    "data": data
                }))
                
            except Exception as e:
                await self._safe_send(client, json.dumps({
                    "type": "error",
                    "message": f"Failed to get snapshot for {symbol}: {e}"
                }))
    
    async def run(self):
        """Run the WebSocket server."""
        if not HAS_WS:
            logger.error("websockets library not installed")
            return
        
        # Connect to IB
        if not await self.connect_ib():
            logger.warning("Starting without IB connection (will retry)")
        
        self.running = True
        
        # Start WebSocket server
        async with websockets.serve(self.handle_client, "0.0.0.0", self.ws_port):
            logger.info(f"✓ WebSocket server running on ws://0.0.0.0:{self.ws_port}")
            
            # Keep running until stopped
            while self.running:
                await asyncio.sleep(1)
                
                # Periodically check IB connection
                if self.ib and not self.ib.isConnected():
                    await self._reconnect_ib()
    
    async def shutdown(self):
        """Gracefully shutdown the server."""
        logger.info("Shutting down...")
        self.running = False
        
        # Disconnect from IB
        if self.ib and self.ib.isConnected():
            self.ib.disconnect()
        
        # Close all client connections
        for client in list(self.clients):
            try:
                await client.close()
            except Exception:
                pass


async def main():
    parser = argparse.ArgumentParser(description="IB Real-Time Price Server")
    parser.add_argument("--port", type=int, default=8765, help="WebSocket server port")
    parser.add_argument("--ib-host", default=DEFAULT_HOST, help="IB Gateway host")
    parser.add_argument("--ib-port", type=int, default=DEFAULT_GATEWAY_PORT, help="IB Gateway port")
    args = parser.parse_args()
    
    server = IBRealtimeServer(
        ws_port=args.port,
        ib_host=args.ib_host,
        ib_port=args.ib_port
    )
    
    # Handle shutdown signals
    loop = asyncio.get_event_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, lambda: asyncio.create_task(server.shutdown()))
    
    await server.run()


if __name__ == "__main__":
    if not HAS_IB or not HAS_WS:
        print("Missing dependencies. Install with:")
        print("  pip install ib_insync websockets")
        sys.exit(1)
    
    asyncio.run(main())
