"use client";

import { useMemo } from "react";
import { Liveline } from "liveline";
import type { PriceData } from "@/lib/pricesProtocol";
import { usePriceHistory } from "@/lib/usePriceHistory";

interface PriceChartProps {
  ticker: string;
  prices: Record<string, PriceData>;
  /** Override the price key used for charting (e.g. option contract key instead of underlying) */
  priceKey?: string;
  /** Theme forwarded from the shell — defaults to 'dark' to preserve existing behavior */
  theme?: "dark" | "light";
}

export default function PriceChart({ ticker, prices, priceKey, theme = "dark" }: PriceChartProps) {
  const chartKey = priceKey ?? ticker;
  const { data, value, loading, isMid } = usePriceHistory(chartKey, prices);

  const priceData = prices[chartKey];
  const closePrice = priceData?.close ?? null;

  const color = useMemo(() => {
    if (!closePrice || !value) return "#05AD98";
    return value >= closePrice ? "#05AD98" : "#E85D6C";
  }, [value, closePrice]);

  const referenceLine = useMemo(() => {
    if (closePrice == null || closePrice <= 0) return undefined;
    return { value: closePrice, label: "PREV CLOSE" };
  }, [closePrice]);

  return (
    <div className="price-chart-container">
      {isMid && (
        <div className="price-chart-mid-badge" aria-label="Chart values are mid price (bid+ask)/2">
          MIDPRICE
        </div>
      )}
      <Liveline
        data={data}
        value={value}
        theme={theme}
        color={color}
        grid={true}
        badge={true}
        scrub={true}
        fill={true}
        formatValue={(v: number) => `$${v.toFixed(2)}`}
        referenceLine={referenceLine}
        loading={loading}
        padding={{ top: 16, right: 80, bottom: 28, left: 12 }}
      />
    </div>
  );
}
