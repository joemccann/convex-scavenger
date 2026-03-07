"use client";

import { useEffect, useRef, useState } from "react";
import type { LivelinePoint } from "liveline";
import type { PriceData } from "@/lib/pricesProtocol";
import { generateMockHistory, getBasePrice, nextMockPrice } from "./mockPriceGenerator";

interface PriceHistoryResult {
  data: LivelinePoint[];
  value: number;
  loading: boolean;
}

/**
 * Accumulates a LivelinePoint[] from real-time price updates.
 * Seeds with mock history on mount so the chart isn't empty.
 * Falls back to mock ticks when no real price arrives for >3s.
 */
export function usePriceHistory(
  ticker: string | null,
  prices: Record<string, PriceData>,
  maxPoints = 200,
): PriceHistoryResult {
  const [data, setData] = useState<LivelinePoint[]>([]);
  const [value, setValue] = useState(0);
  const lastRealRef = useRef(0);
  const mockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPriceRef = useRef(0);
  const tickerRef = useRef(ticker);

  // Reset on ticker change
  useEffect(() => {
    tickerRef.current = ticker;
    if (!ticker) {
      setData([]);
      setValue(0);
      return;
    }

    const base = prices[ticker]?.last ?? getBasePrice(ticker);
    const seed = generateMockHistory(base, 60, 1, hashStr(ticker));
    setData(seed);
    setValue(seed[seed.length - 1]?.value ?? base);
    lastPriceRef.current = seed[seed.length - 1]?.value ?? base;
    lastRealRef.current = 0;

    return () => {
      if (mockTimerRef.current) clearTimeout(mockTimerRef.current);
    };
  }, [ticker]); // eslint-disable-line react-hooks/exhaustive-deps

  // Append real price updates
  useEffect(() => {
    if (!ticker) return;
    const pd = prices[ticker];
    if (!pd?.last || pd.last <= 0) return;

    const now = Date.now() / 1000;
    lastRealRef.current = now;
    lastPriceRef.current = pd.last;

    setData((prev) => {
      const next = [...prev, { time: now, value: pd.last! }];
      return next.length > maxPoints ? next.slice(next.length - maxPoints) : next;
    });
    setValue(pd.last);
  }, [ticker, prices[ticker ?? ""]?.last, maxPoints]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mock tick fallback when no real data arrives
  useEffect(() => {
    if (!ticker) return;

    const tick = () => {
      if (tickerRef.current !== ticker) return;

      const now = Date.now() / 1000;
      const sinceReal = now - lastRealRef.current;

      // Only generate mock ticks if no real update in 3s
      if (sinceReal > 3 || lastRealRef.current === 0) {
        const newPrice = nextMockPrice(lastPriceRef.current);
        lastPriceRef.current = newPrice;

        setData((prev) => {
          const next = [...prev, { time: now, value: newPrice }];
          return next.length > maxPoints ? next.slice(next.length - maxPoints) : next;
        });
        setValue(newPrice);
      }

      mockTimerRef.current = setTimeout(tick, 1000);
    };

    mockTimerRef.current = setTimeout(tick, 1000);

    return () => {
      if (mockTimerRef.current) clearTimeout(mockTimerRef.current);
    };
  }, [ticker, maxPoints]);

  return { data, value, loading: data.length === 0 };
}

/** Simple string hash for deterministic seeding per ticker. */
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}
