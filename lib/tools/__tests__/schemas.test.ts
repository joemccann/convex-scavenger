import { describe, it, expect } from "vitest";
import { Value } from "@sinclair/typebox/value";
import { KellyOutput } from "../schemas/kelly";
import { FetchTickerOutput } from "../schemas/fetch-ticker";
import { ScannerOutput } from "../schemas/scanner";
import { OrdersData } from "../schemas/ib-orders";
import { PortfolioData } from "../schemas/ib-sync";
import { IBOrderManageOutput } from "../schemas/ib-order-manage";

describe("KellyOutput schema", () => {
  it("accepts valid kelly output", () => {
    const valid = {
      full_kelly_pct: 10.0,
      fractional_kelly_pct: 2.5,
      fraction_used: 0.25,
      edge_exists: true,
      recommendation: "STRONG",
    };
    expect(Value.Check(KellyOutput, valid)).toBe(true);
  });

  it("accepts kelly output with optional bankroll fields", () => {
    const valid = {
      full_kelly_pct: 10.0,
      fractional_kelly_pct: 2.5,
      fraction_used: 0.25,
      edge_exists: true,
      recommendation: "STRONG",
      dollar_size: 2500,
      max_per_position: 2500,
      use_size: 2500,
    };
    expect(Value.Check(KellyOutput, valid)).toBe(true);
  });

  it("rejects missing required fields", () => {
    const invalid = { full_kelly_pct: 10.0 };
    expect(Value.Check(KellyOutput, invalid)).toBe(false);
  });
});

describe("FetchTickerOutput schema", () => {
  it("accepts valid ticker output", () => {
    const valid = {
      ticker: "AAPL",
      fetched_at: "2026-03-04T10:00:00",
      verified: true,
      validation_method: "dark_pool_activity",
      from_cache: false,
      company_name: "Apple Inc",
      sector: "Technology",
      industry: null,
      market_cap: null,
      avg_volume: null,
      current_price: 185.5,
      options_available: true,
      error: null,
    };
    expect(Value.Check(FetchTickerOutput, valid)).toBe(true);
  });
});

describe("ScannerOutput schema", () => {
  it("accepts valid scanner output", () => {
    const valid = {
      scan_time: "2026-03-04T10:00:00",
      tickers_scanned: 25,
      signals_found: 3,
      top_signals: [
        {
          ticker: "AAPL",
          sector: "Technology",
          score: 85.0,
          signal: "STRONG",
          direction: "ACCUMULATION",
          strength: 70,
          buy_ratio: 0.65,
          num_prints: 250,
          sustained_days: 3,
          recent_direction: "ACCUMULATION",
          recent_strength: 75,
        },
      ],
    };
    expect(Value.Check(ScannerOutput, valid)).toBe(true);
  });
});

describe("OrdersData schema", () => {
  it("accepts empty orders", () => {
    const valid = {
      last_sync: "2026-03-04T10:00:00",
      open_orders: [],
      executed_orders: [],
      open_count: 0,
      executed_count: 0,
    };
    expect(Value.Check(OrdersData, valid)).toBe(true);
  });
});

describe("PortfolioData schema", () => {
  it("accepts valid portfolio data", () => {
    const valid = {
      bankroll: 100000,
      peak_value: 105000,
      last_sync: "2026-03-04T10:00:00",
      positions: [],
      total_deployed_pct: 15.5,
      total_deployed_dollars: 15500,
      remaining_capacity_pct: 84.5,
      position_count: 0,
      defined_risk_count: 0,
      undefined_risk_count: 0,
      avg_kelly_optimal: null,
    };
    expect(Value.Check(PortfolioData, valid)).toBe(true);
  });
});

describe("IBOrderManageOutput schema", () => {
  it("accepts cancel success", () => {
    const valid = {
      status: "ok" as const,
      message: "Order cancelled (orderId=10)",
      orderId: 10,
      finalStatus: "Cancelled",
    };
    expect(Value.Check(IBOrderManageOutput, valid)).toBe(true);
  });

  it("accepts error", () => {
    const valid = {
      status: "error" as const,
      message: "Trade not found",
    };
    expect(Value.Check(IBOrderManageOutput, valid)).toBe(true);
  });
});
