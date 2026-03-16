"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createReconnectStrategy, type ReconnectState } from "./reconnectStrategy";

/* ─── Types ───────────────────────────────────────────── */

export type ConnectionState = "connected" | "ib_offline" | "relay_offline";

export type IBStatusState = {
  /** WebSocket to our realtime server is open */
  wsConnected: boolean;
  /** IB Gateway is connected (reported by server) */
  ibConnected: boolean;
  /** Timestamp when connection was lost (null = connected) */
  disconnectedSince: number | null;
  /** Derived three-state connection status */
  connectionState: ConnectionState;
};

type StatusMessage = {
  type: "status";
  ib_connected: boolean;
};

type PingMessage = {
  type: "ping";
};

/* ─── Context ─────────────────────────────────────────── */

const IBStatusContext = createContext<IBStatusState>({
  wsConnected: false,
  ibConnected: false,
  disconnectedSince: null,
  connectionState: "relay_offline",
});

/* ─── Staleness constants ─────────────────────────────── */

const STALENESS_CHECK_INTERVAL_MS = 15_000;
const STALENESS_THRESHOLD_MS = 60_000;

/* ─── Provider ────────────────────────────────────────── */

export function IBStatusProvider({ children }: { children: ReactNode }) {
  const [wsConnected, setWsConnected] = useState(false);
  const [ibConnected, setIbConnected] = useState(true); // assume connected until told otherwise
  const [disconnectedSince, setDisconnectedSince] = useState<number | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const mountedRef = useRef(true);
  const prevConnectedRef = useRef<boolean | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stalenessTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastMessageRef = useRef<number>(Date.now());
  const strategyRef = useRef<ReconnectState>(
    createReconnectStrategy({ maxAttempts: 0 }) // unlimited for status
  );

  const socketUrl =
    process.env.NEXT_PUBLIC_IB_REALTIME_WS_URL ??
    process.env.IB_REALTIME_WS_URL ??
    "ws://localhost:8765";

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const clearStalenessTimer = useCallback(() => {
    if (stalenessTimerRef.current) {
      clearInterval(stalenessTimerRef.current);
      stalenessTimerRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    clearReconnectTimer();

    if (wsRef.current) {
      wsRef.current.close();
    }

    const ws = new WebSocket(socketUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setWsConnected(true);
      strategyRef.current.reset();
      lastMessageRef.current = Date.now();

      // Start staleness check
      clearStalenessTimer();
      stalenessTimerRef.current = setInterval(() => {
        if (Date.now() - lastMessageRef.current > STALENESS_THRESHOLD_MS) {
          // Force reconnect on stale connection
          ws.close();
        }
      }, STALENESS_CHECK_INTERVAL_MS);
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;
      lastMessageRef.current = Date.now();
      try {
        const msg = JSON.parse(event.data) as StatusMessage | PingMessage;

        if (msg.type === "ping") {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ action: "pong" }));
          }
          return;
        }

        if (msg.type === "status") {
          const nowConnected = (msg as StatusMessage).ib_connected;
          setIbConnected(nowConnected);

          if (nowConnected) {
            setDisconnectedSince(null);
          } else {
            setDisconnectedSince((prev) => prev ?? Date.now());
          }

          prevConnectedRef.current = nowConnected;
        }
      } catch {
        // ignore parse errors for non-status messages
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setWsConnected(false);
      clearStalenessTimer();

      // If WS drops, treat as disconnected
      if (prevConnectedRef.current !== false) {
        setIbConnected(false);
        setDisconnectedSince((prev) => prev ?? Date.now());
        prevConnectedRef.current = false;
      }

      // Schedule reconnect with backoff
      if (strategyRef.current.canRetry()) {
        const delay = strategyRef.current.nextDelay();
        reconnectTimerRef.current = setTimeout(() => {
          if (mountedRef.current) connect();
        }, delay);
      }
    };

    ws.onerror = () => {
      if (!mountedRef.current) return;
      ws.close();
    };
  }, [socketUrl, clearReconnectTimer, clearStalenessTimer]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      clearReconnectTimer();
      clearStalenessTimer();
      if (wsRef.current) {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.close();
        }
        wsRef.current = null;
      }
    };
  }, [connect, clearReconnectTimer, clearStalenessTimer]);

  // Derive three-state connection status
  const connectionState: ConnectionState =
    wsConnected && ibConnected
      ? "connected"
      : wsConnected && !ibConnected
        ? "ib_offline"
        : "relay_offline";

  return (
    <IBStatusContext.Provider
      value={{ wsConnected, ibConnected, disconnectedSince, connectionState }}
    >
      {children}
    </IBStatusContext.Provider>
  );
}

export function useIBStatusContext(): IBStatusState {
  return useContext(IBStatusContext);
}
