import { Type, type Static } from "@sinclair/typebox";

// ── Input (maps to argparse) ──────────────────────────────────────────

export const FetchTickerInput = Type.Object({
  ticker: Type.String({ description: "Ticker symbol to validate" }),
});

export type FetchTickerInput = Static<typeof FetchTickerInput>;

// ── Output (matches fetch_ticker.py JSON) ─────────────────────────────

export const FetchTickerOutput = Type.Object({
  ticker: Type.String(),
  fetched_at: Type.String(),
  verified: Type.Boolean(),
  validation_method: Type.String(),
  from_cache: Type.Boolean(),
  company_name: Type.Union([Type.String(), Type.Null()]),
  sector: Type.Union([Type.String(), Type.Null()]),
  industry: Type.Union([Type.String(), Type.Null()]),
  market_cap: Type.Union([Type.Number(), Type.Null()]),
  avg_volume: Type.Union([Type.Number(), Type.Null()]),
  current_price: Type.Union([Type.Number(), Type.Null()]),
  options_available: Type.Boolean(),
  error: Type.Union([Type.String(), Type.Null()]),
  dp_prints_3d: Type.Optional(Type.Number()),
  dp_volume_3d: Type.Optional(Type.Number()),
  dp_premium_3d: Type.Optional(Type.Number()),
  trading_days_checked: Type.Optional(Type.Array(Type.String())),
  liquidity_warning: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  liquidity_note: Type.Optional(Type.String()),
  recent_options_activity: Type.Optional(Type.Boolean()),
});

export type FetchTickerOutput = Static<typeof FetchTickerOutput>;
