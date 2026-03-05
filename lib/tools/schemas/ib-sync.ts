import { Type, type Static } from "@sinclair/typebox";

// ── Input (maps to argparse) ──────────────────────────────────────────

export const IBSyncInput = Type.Object({
  host: Type.Optional(Type.String({ description: "TWS/Gateway host" })),
  port: Type.Optional(Type.Number({ description: "TWS/Gateway port" })),
  clientId: Type.Optional(Type.Number({ description: "Client ID" })),
  sync: Type.Optional(Type.Boolean({ description: "Sync to portfolio.json" })),
  noPrices: Type.Optional(Type.Boolean({ description: "Skip market price fetch" })),
});

export type IBSyncInput = Static<typeof IBSyncInput>;

// ── Output (matches data/portfolio.json shape) ────────────────────────

const PortfolioLeg = Type.Object({
  direction: Type.String(),
  contracts: Type.Number(),
  type: Type.String(),
  strike: Type.Union([Type.Number(), Type.Null()]),
  entry_cost: Type.Number(),
  avg_cost: Type.Number(),
  market_price: Type.Union([Type.Number(), Type.Null()]),
  market_value: Type.Union([Type.Number(), Type.Null()]),
  market_price_is_calculated: Type.Optional(Type.Boolean()),
});

const PortfolioPosition = Type.Object({
  id: Type.Number(),
  ticker: Type.String(),
  structure: Type.String(),
  structure_type: Type.String(),
  risk_profile: Type.String(),
  expiry: Type.String(),
  contracts: Type.Number(),
  direction: Type.String(),
  entry_cost: Type.Number(),
  max_risk: Type.Union([Type.Number(), Type.Null()]),
  market_value: Type.Union([Type.Number(), Type.Null()]),
  legs: Type.Array(PortfolioLeg),
  market_price_is_calculated: Type.Optional(Type.Boolean()),
  kelly_optimal: Type.Union([Type.Number(), Type.Null()]),
  target: Type.Union([Type.Number(), Type.Null()]),
  stop: Type.Union([Type.Number(), Type.Null()]),
  entry_date: Type.String(),
});

export const PortfolioData = Type.Object({
  bankroll: Type.Number(),
  peak_value: Type.Number(),
  last_sync: Type.String(),
  positions: Type.Array(PortfolioPosition),
  total_deployed_pct: Type.Number(),
  total_deployed_dollars: Type.Number(),
  remaining_capacity_pct: Type.Number(),
  position_count: Type.Number(),
  defined_risk_count: Type.Number(),
  undefined_risk_count: Type.Number(),
  avg_kelly_optimal: Type.Union([Type.Number(), Type.Null()]),
});

export type PortfolioData = Static<typeof PortfolioData>;
