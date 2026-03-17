export type PriceData = {
  symbol: string;
  last: number | null;
  lastIsCalculated: boolean;
  bid: number | null;
  ask: number | null;
  bidSize: number | null;
  askSize: number | null;
  volume: number | null;
  high: number | null;
  low: number | null;
  open: number | null;
  close: number | null;
  // Misc Stats (generic tick 165)
  week52High: number | null;
  week52Low: number | null;
  avgVolume: number | null;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  impliedVol: number | null;
  undPrice: number | null;
  timestamp: string;
};


export type FundamentalsData = {
  symbol: string;
  peRatio: number | null;
  eps: number | null;
  dividendYield: number | null;
  week52High: number | null;
  week52Low: number | null;
  priceBookRatio: number | null;
  roe: number | null;
  revenue: number | null;
  timestamp: string;
};

export type WSPriceMessage = {
  type: "price";
  symbol: string;
  data: PriceData;
};

export type WSSubscribedMessage = {
  type: "subscribed";
  symbols: string[];
};

export type WSUnsubscribedMessage = {
  type: "unsubscribed";
  symbols: string[];
};

export type WSSnapshotMessage = {
  type: "snapshot";
  symbol: string;
  data: PriceData;
};

export type WSFundamentalsMessage = {
  type: "fundamentals";
  symbol: string;
  data: FundamentalsData;
};

export type WSErrorMessage = {
  type: "error";
  message: string;
};

export type WSPingMessage = {
  type: "ping";
};

export type WSPongMessage = {
  type: "pong";
};

export type WSStatusMessage = {
  type: "status";
  ib_connected: boolean;
  ib_issue: string | null;
  ib_status_message: string | null;
  subscriptions: string[];
};

export type WSBatchMessage = {
  type: "batch";
  updates: Record<string, PriceData>;
};

export type WSMessage =
  | WSPriceMessage
  | WSFundamentalsMessage
  | WSSubscribedMessage
  | WSUnsubscribedMessage
  | WSSnapshotMessage
  | WSBatchMessage
  | WSErrorMessage
  | WSPingMessage
  | WSPongMessage
  | WSStatusMessage;

/* ─── Option contract types & helpers ─────────────────── */

export type OptionContract = {
  symbol: string;
  expiry: string; // YYYYMMDD
  strike: number;
  right: "C" | "P";
};

export function normalizeOptionExpiry(expiry: string): string | null {
  const compact = expiry.trim().replace(/-/g, "");
  return compact.length === 8 ? compact : null;
}

export function normalizeOptionContract(contract: OptionContract): OptionContract | null {
  const symbol = contract.symbol.trim().toUpperCase();
  const expiry = normalizeOptionExpiry(contract.expiry);
  if (!symbol || !expiry || !Number.isFinite(contract.strike) || contract.strike <= 0) {
    return null;
  }
  return {
    symbol,
    expiry,
    strike: contract.strike,
    right: contract.right,
  };
}

/** Build composite key for an option contract: SYMBOL_YYYYMMDD_STRIKE_RIGHT */
export function optionKey(c: OptionContract): string {
  const normalized = normalizeOptionContract(c);
  if (normalized) {
    return `${normalized.symbol}_${normalized.expiry}_${normalized.strike}_${normalized.right}`;
  }
  return `${c.symbol.trim().toUpperCase()}_${c.expiry.trim()}_${c.strike}_${c.right}`;
}

export function uniqueOptionContracts(contracts: OptionContract[]): OptionContract[] {
  const seen = new Set<string>();
  const normalizedContracts: OptionContract[] = [];
  for (const contract of contracts) {
    const normalized = normalizeOptionContract(contract);
    if (!normalized) continue;
    const key = optionKey(normalized);
    if (seen.has(key)) continue;
    seen.add(key);
    normalizedContracts.push(normalized);
  }
  return normalizedContracts;
}

/** Stable hash for a list of option contracts (for memoization change detection) */
export function contractsKey(contracts: OptionContract[]): string {
  return uniqueOptionContracts(contracts)
    .map(optionKey)
    .sort()
    .join(",");
}

/**
 * Convert a portfolio leg into an IB-ready OptionContract descriptor.
 * Returns null for Stock legs, null/0 strikes, or missing data.
 */
export function portfolioLegToContract(
  ticker: string,
  expiry: string,
  leg: { type: string; strike: number | null },
): OptionContract | null {
  if (leg.type === "Stock") return null;
  if (leg.strike == null || leg.strike === 0) return null;
  if (!expiry || expiry === "N/A") return null;

  const right = leg.type === "Call" ? "C" : leg.type === "Put" ? "P" : null;
  if (!right) return null;

  return normalizeOptionContract({
    symbol: ticker.toUpperCase(),
    expiry,
    strike: leg.strike,
    right,
  });
}

/* ─── Index contract types ────────────────────────────── */

export type IndexContract = {
  symbol: string;
  exchange: string; // e.g. "CBOE"
};

/* ─── Symbol helpers ──────────────────────────────────── */

export function normalizeSymbolList(symbols: string[]): string[] {
  return [...symbols]
    .map((symbol) => symbol.trim().toUpperCase())
    .filter((symbol) => symbol.length > 0);
}

export function symbolKey(symbols: string[]): string {
  return normalizeSymbolList(symbols).sort().join(",");
}
