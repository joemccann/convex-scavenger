import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { PriceData } from "../lib/pricesProtocol";

const priceHistoryProbe = vi.hoisted(() => ({
  current: {
    data: [
      { time: 1, value: 100.5 },
      { time: 2, value: 101.25 },
    ],
    value: 101.25,
    loading: false,
    isMid: false,
  },
}));

vi.mock("@/lib/usePriceHistory", () => ({
  usePriceHistory: () => priceHistoryProbe.current,
}));

vi.mock("liveline", async () => {
  const React = await import("react");

  return {
    Liveline: (props: {
      theme: string;
      color: string;
      referenceLine?: { label?: string };
    }) =>
      React.createElement("div", {
        "data-testid": "liveline-probe",
        "data-theme": props.theme,
        "data-color": props.color,
        "data-reference-label": props.referenceLine?.label ?? "",
      }),
  };
});

import PriceChart from "../components/PriceChart";

function makePriceData(overrides: Partial<PriceData> = {}): PriceData {
  return {
    symbol: "AAPL",
    last: 101.25,
    lastIsCalculated: false,
    bid: 101.1,
    ask: 101.4,
    bidSize: null,
    askSize: null,
    volume: 500_000,
    high: 102.5,
    low: 99.8,
    open: 100.3,
    close: 100,
    week52High: null,
    week52Low: null,
    avgVolume: null,
    delta: null,
    gamma: null,
    theta: null,
    vega: null,
    impliedVol: null,
    undPrice: null,
    timestamp: "2026-03-11T18:35:00Z",
    ...overrides,
  };
}

describe("PriceChart shared shell", () => {
  it("emits live-trace shell metadata and forwards the theme into the canvas adapter", () => {
    priceHistoryProbe.current = {
      data: [
        { time: 1, value: 100.5 },
        { time: 2, value: 101.25 },
      ],
      value: 101.25,
      loading: false,
      isMid: false,
    };

    const html = renderToStaticMarkup(
      createElement(PriceChart, {
        ticker: "AAPL",
        prices: { AAPL: makePriceData() },
        theme: "light",
      }),
    );

    expect(html).toContain('data-testid="price-chart-shell"');
    expect(html).toContain('data-chart-family="Live Trace"');
    expect(html).toContain('data-chart-renderer="canvas-adapter"');
    expect(html).toContain('data-theme="light"');
    expect(html).toContain('data-reference-label="PREV CLOSE"');
  });

  it("preserves the mid-price badge when the live trace is charting midpoint values", () => {
    priceHistoryProbe.current = {
      data: [
        { time: 1, value: 2.7 },
        { time: 2, value: 3.05 },
      ],
      value: 3.05,
      loading: false,
      isMid: true,
    };

    const html = renderToStaticMarkup(
      createElement(PriceChart, {
        ticker: "AAPL",
        prices: { AAPL: makePriceData({ close: 2.8 }) },
        theme: "dark",
      }),
    );

    expect(html).toContain("MIDPRICE");
    expect(html).toContain('data-theme="dark"');
  });
});
