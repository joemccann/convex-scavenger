"use client";

import { useSyncHook, type UseSyncReturn } from "./useSyncHook";
import { MarketState } from "./useMarketHours";

/* ─── VCG types (match vcg_scan.py JSON output) ─────────────── */

export type VcgSignal = {
  vcg: number | null;
  vcg_div: number | null;
  residual: number | null;
  beta1_vvix: number | null;
  beta2_vix: number | null;
  alpha: number | null;
  vix: number;
  vvix: number;
  credit_price: number;
  credit_5d_return_pct: number;
  hdr: 0 | 1;
  ro: 0 | 1;
  sign_ok: boolean;
  sign_suppressed: boolean;
  pi_panic: number;
  regime: "PANIC" | "TRANSITION" | "DIVERGENCE";
  interpretation: "CREDIT_ARTIFICIALLY_CALM" | "CREDIT_OVERSHOT" | "NORMAL" | "INSUFFICIENT_DATA";
  hdr_conditions: {
    vvix_gt_110: boolean;
    credit_5d_gt_neg05pct: boolean;
    vix_lt_40: boolean;
  };
  attribution: {
    vvix_pct: number;
    vix_pct: number;
    vvix_component: number;
    vix_component: number;
    model_implied: number;
  };
};

export type VcgHistoryEntry = {
  date: string;
  residual: number | null;
  vcg: number | null;
  vcg_div: number | null;
  beta1: number | null;
  beta2: number | null;
  vix: number;
  vvix: number;
  credit: number;
};

export type VcgData = {
  scan_time: string;
  market_open: boolean;
  credit_proxy: string;
  signal: VcgSignal;
  history: VcgHistoryEntry[];
};

/* ─── Staleness check ────────────────────────────────────────── */

function todayET(): string {
  return new Date().toLocaleDateString("sv", { timeZone: "America/New_York" });
}

function needsVcgRetry(data: VcgData | null | undefined): boolean {
  if (!data?.scan_time) return true;
  try {
    const scanDate = new Date(data.scan_time).toLocaleDateString("sv", { timeZone: "America/New_York" });
    return scanDate !== todayET();
  } catch {
    return true;
  }
}

/* ─── Hook ───────────────────────────────────────────────────── */

const VCG_SYNC_CONFIG = {
  endpoint: "/api/vcg",
  interval: 60_000,
  hasPost: false,
  extractTimestamp: (d: VcgData) => d.scan_time || null,
  shouldRetry: (d: VcgData) => needsVcgRetry(d),
  retryIntervalMs: 5000,
  retryMethod: "GET" as const,
};

export function useVcg(marketState: MarketState | null = null): UseSyncReturn<VcgData> {
  let active: boolean;
  if (marketState === MarketState.OPEN || marketState === MarketState.EXTENDED) {
    active = true;
  } else if (marketState === MarketState.CLOSED) {
    active = false;
  } else {
    active = true; // unknown → poll
  }

  const config = {
    ...VCG_SYNC_CONFIG,
    interval: marketState === MarketState.EXTENDED ? 300_000 : 60_000,
  };

  return useSyncHook(config, active);
}
