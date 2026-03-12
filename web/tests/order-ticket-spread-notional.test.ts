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

describe("order-ticket spread notional", () => {
  it("uses displayed quantity in the single-leg instrument ticket spread notional", () => {
    const html = renderToStaticMarkup(
      React.createElement(InstrumentDetailModal, {
        leg: shortCallLeg,
        ticker: "AAOI",
        expiry: "2026-03-20",
        prices: optionPrices,
        onClose: () => {},
      }),
    );

    expect(html).toContain("$3,000.00 / 3,077 bps");
  });

  it("uses quote-level half-spread telemetry in the modify-order modal", () => {
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

    expect(html).toContain("$0.60 / 1,538 bps");
  });
});
