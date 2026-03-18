import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { OpenOrder, PortfolioLeg } from "@/lib/types";
import type { PriceData } from "@/lib/pricesProtocol";
import InstrumentDetailModal from "../components/InstrumentDetailModal";
import ModifyOrderModal from "../components/ModifyOrderModal";

vi.mock("../components/Modal", () => ({
  default: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => React.createElement("div", { className: className ?? "mock-modal" }, children),
}));

function makePriceData(overrides: Partial<PriceData> & { symbol: string }): PriceData {
  return {
    last: null,
    lastIsCalculated: false,
    bid: null,
    ask: null,
    bidSize: null,
    askSize: null,
    volume: null,
    high: null,
    low: null,
    open: null,
    close: null,
    week52High: null,
    week52Low: null,
    avgVolume: null,
    delta: null,
    gamma: null,
    theta: null,
    vega: null,
    impliedVol: null,
    undPrice: null,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

const shortCallLeg: PortfolioLeg = {
  direction: "SHORT",
  contracts: 25,
  type: "Call",
  strike: 130,
  entry_cost: -20_015,
  avg_cost: -801,
  market_price: 3.9,
  market_price_is_calculated: false,
  market_value: 10_257,
};

const optionPrices: Record<string, PriceData> = {
  AAOI_20260320_130_C: makePriceData({
    symbol: "AAOI_20260320_130_C",
    bid: 3.3,
    ask: 4.5,
    last: 3.9,
    close: 10.05,
    volume: 46,
    high: 5.5,
    low: 3.6,
  }),
};

const openOrder: OpenOrder = {
  orderId: 101,
  permId: 202,
  symbol: "AAOI",
  contract: {
    conId: 123456,
    symbol: "AAOI",
    secType: "OPT",
    strike: 130,
    right: "C",
    expiry: "2026-03-20",
  },
  action: "BUY",
  orderType: "LMT",
  totalQuantity: 25,
  limitPrice: 3.9,
  auxPrice: null,
  status: "Submitted",
  filled: 0,
  remaining: 25,
  avgFillPrice: null,
  tif: "GTC",
};

describe("order-ticket spread telemetry", () => {
  it("uses raw spread dollars and percent in the single-leg instrument ticket", () => {
    const html = renderToStaticMarkup(
      React.createElement(InstrumentDetailModal, {
        leg: shortCallLeg,
        ticker: "AAOI",
        expiry: "2026-03-20",
        prices: optionPrices,
        onClose: () => {},
      }),
    );

    // InstrumentDetailModal shows raw market spread (no resting limit overlay)
    // bid=3.3, ask=4.5, spread=1.2, mid=3.9, pct=30.77%
    expect(html).toContain("$1.20 / 30.77%");
  });

  it("applies resting limit overlay in the modify-order modal", () => {
    // Order is BUY at limit $3.9, market bid=$3.3, ask=$4.5
    // applyRestingLimitToQuote raises bid to max(3.3, 3.9) = 3.9
    // New spread: ask - bid = 4.5 - 3.9 = 0.6
    // New mid: (3.9 + 4.5) / 2 = 4.2
    // Spread %: 0.6 / 4.2 = 14.29%
    const html = renderToStaticMarkup(
      React.createElement(ModifyOrderModal, {
        order: openOrder,
        loading: false,
        prices: optionPrices,
        portfolio: null,
        onConfirm: () => {},
        onClose: () => {},
      }),
    );

    expect(html).toContain("$0.60 / 14.29%");
  });
});
