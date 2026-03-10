"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Shield, X, Zap } from "lucide-react";
import CriHistoryChart from "./CriHistoryChart";
import InfoTooltip from "./InfoTooltip";
import type { PriceData } from "@/lib/pricesProtocol";
import { useRegime } from "@/lib/useRegime";
import { SECTION_TOOLTIPS } from "@/lib/sectionTooltips";
import { computeCri, type CriLevel, type CriResult } from "@/lib/criCalc";

type RegimePanelProps = {
  prices: Record<string, PriceData>;
};

/* ─── Helpers ────────────────────────────────────────── */

function levelColor(level: CriLevel): string {
  switch (level) {
    case "LOW": return "var(--positive)";
    case "ELEVATED": return "var(--warning)";
    case "HIGH": return "var(--negative)";
    case "CRITICAL": return "var(--negative)";
  }
}

function fmt(v: number | null | undefined, decimals = 2): string {
  if (v == null || !Number.isFinite(v)) return "---";
  return v.toFixed(decimals);
}

function fmtPct(v: number | null | undefined, decimals = 2): string {
  if (v == null || !Number.isFinite(v)) return "---";
  return `${v >= 0 ? "+" : ""}${v.toFixed(decimals)}%`;
}

function fmtSigned(v: number | null | undefined, decimals = 2): string {
  if (v == null || !Number.isFinite(v)) return "---";
  return `${v >= 0 ? "+" : ""}${v.toFixed(decimals)}`;
}

type BadgeVariant = "live" | "daily";

function LiveBadge({ live, variant }: { live: boolean; variant?: BadgeVariant }) {
  const resolved: BadgeVariant = variant ?? (live ? "live" : "daily");
  const bg =
    resolved === "live" ? "rgba(5,173,152,0.15)"
    : "rgba(226,232,240,0.06)";
  const color =
    resolved === "live" ? "var(--positive)"
    : "var(--text-muted)";
  const label =
    resolved === "live" ? "LIVE"
    : "DAILY";
  return (
    <span className="regime-badge" style={{ background: bg, color }}>
      {label}
    </span>
  );
}

/* ─── Component Bar ──────────────────────────────────── */

const COMPONENT_TOOLTIPS: Record<string, string> = {
  VIX: "CBOE Volatility Index — 30-day implied vol of SPX. Score rises as VIX exceeds 20 (elevated) and 30 (high). Extreme spikes indicate tail-risk hedging by institutional players.",
  VVIX: "Vol-of-VIX — measures expected volatility of VIX itself. Score rises with absolute level and VVIX/VIX ratio >5, signalling second-order stress and unstable vol regimes.",
  CORRELATION: "Cboe 1-Month Implied Correlation Index (COR1M). High COR1M (>60) means the market expects the largest S&P 500 stocks to move together, reducing diversification and signalling herding risk.",
  MOMENTUM: "SPX distance below 100-day MA combined with VIX 5-day rate of change. Captures both price trend stress and velocity of volatility acceleration.",
};

function ComponentBar({ label, score, live }: { label: string; score: number; live: boolean }) {
  const pct = (score / 25) * 100;
  const barColor = score < 8 ? "var(--positive)" : score > 16 ? "var(--negative)" : "var(--warning)";
  const tooltip = COMPONENT_TOOLTIPS[label];
  return (
    <div className="regime-component-bar">
      <div className="regime-component-label">
        <span style={{ flex: 1 }}>{label}</span>
        {tooltip && <InfoTooltip text={tooltip} />}
        <LiveBadge live={live} />
      </div>
      <div className="regime-bar-track">
        <div className="regime-bar-fill" style={{ width: `${pct}%`, background: barColor }} />
      </div>
      <div className="regime-component-score">{score.toFixed(1)}/25</div>
    </div>
  );
}

/* ─── Trigger Row ────────────────────────────────────── */

function TriggerRow({ label, met, value, live }: { label: string; met: boolean; value: string; live: boolean }) {
  return (
    <div className="regime-trigger-row">
      <div className="regime-trigger-icon">
        {met ? <Check size={14} color="var(--positive)" /> : <X size={14} color="var(--negative)" />}
      </div>
      <div className="regime-trigger-label">{label}</div>
      <div className="regime-trigger-value">{value}</div>
      <LiveBadge live={live} />
    </div>
  );
}

/* ─── Main Panel ─────────────────────────────────────── */

export default function RegimePanel({ prices }: RegimePanelProps) {
  const { data, syncing, lastSync } = useRegime(true);

  // market_open flag from CRI data — gates live vs static behaviour.
  // Default true (live) when undefined so behaviour is unchanged until the
  // flag propagates from the first CRI scan response.
  const marketOpen = data?.market_open ?? true;

  // Live prices from WS — only meaningful while market is open
  const liveVix = prices["VIX"]?.last ?? null;
  const liveVvix = prices["VVIX"]?.last ?? null;
  const liveSpy = prices["SPY"]?.last ?? null;
  const hasLive = marketOpen && (liveVix != null || liveVvix != null || liveSpy != null);

  // Timestamps for last live VIX / VVIX value received
  const [vixLastTs, setVixLastTs] = useState<string | null>(null);
  const [vvixLastTs, setVvixLastTs] = useState<string | null>(null);

  useEffect(() => {
    if (marketOpen && liveVix != null) setVixLastTs(new Date().toLocaleTimeString());
  }, [marketOpen, liveVix]);

  useEffect(() => {
    if (marketOpen && liveVvix != null) setVvixLastTs(new Date().toLocaleTimeString());
  }, [marketOpen, liveVvix]);

  // ── Intraday realized vol ────────────────────────────────────────────────
  // Replace today's last close in the 21-day SPY series with the live price,
  // then recompute: std(log_returns) * sqrt(252) * 100  (same as cri_scan.py).
  // When the market is closed, skip live computation — use data?.realized_vol.
  const intradayRvol = useMemo(() => {
    if (!marketOpen) return null;
    if (liveSpy == null || !data?.spy_closes?.length) return null;
    const closes = data.spy_closes;
    // Need at least 21 prices to get 20 log-returns.
    if (closes.length < 21) return null;
    // Replace the last historical close with the live price.
    const series = [...closes.slice(0, -1), liveSpy];
    const n = series.length;
    const logReturns: number[] = [];
    for (let i = 1; i < n; i++) {
      if (series[i - 1] > 0) logReturns.push(Math.log(series[i] / series[i - 1]));
    }
    if (logReturns.length < 2) return null;
    const mean = logReturns.reduce((s, r) => s + r, 0) / logReturns.length;
    const variance = logReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / (logReturns.length - 1);
    return Math.sqrt(variance) * Math.sqrt(252) * 100;
  }, [marketOpen, liveSpy, data?.spy_closes]);

  const hasIntradayRvol = intradayRvol != null;
  const activeRvol = intradayRvol ?? data?.realized_vol ?? null;

  const activeCorr = data?.cor1m ?? 0;
  const activeCorrChange = data?.cor1m_5d_change ?? 0;
  const correlationTriggerMet =
    data?.crash_trigger?.conditions.cor1m_gt_60 ?? activeCorr > 60;

  // Merge live + cached into CRI inputs.
  // When market is closed, return null so `cri` falls back to data?.cri
  // (the authoritative EOD values from cri_scan.py — do not recompute with
  // stale WS prices that linger after close).
  const liveCri: CriResult | null = useMemo(() => {
    if (!data) return null;
    if (!marketOpen) return null;

    const vix = liveVix ?? data.vix;
    const vvix = liveVvix ?? data.vvix;
    const spy = liveSpy ?? data.spy;
    const vvixVixRatio = vix > 0 ? vvix / vix : data.vvix_vix_ratio ?? 0;
    const ma = data.spx_100d_ma;
    const spxDistancePct = ma && ma > 0 ? ((spy / ma) - 1) * 100 : data.spx_distance_pct;

    return computeCri({
      vix,
      vix5dRoc: data.vix_5d_roc,
      vvix,
      vvixVixRatio,
      corr: activeCorr,
      corr5dChange: activeCorrChange,
      spxDistancePct,
    });
  }, [data, marketOpen, liveVix, liveVvix, liveSpy, activeCorr, activeCorrChange]);

  const cri = liveCri ?? (data?.cri ? { ...data.cri, level: data.cri.level as CriLevel } : { score: 0, level: "LOW" as CriLevel, components: { vix: 0, vvix: 0, correlation: 0, momentum: 0 } });
  const color = levelColor(cri.level);

  // Display values: use live WS only while market is open.
  // When closed, always use CRI EOD values so stale WS prices don't appear.
  const vixVal = (marketOpen ? liveVix : null) ?? data?.vix ?? 0;
  const vvixVal = (marketOpen ? liveVvix : null) ?? data?.vvix ?? 0;
  const spyVal = (marketOpen ? liveSpy : null) ?? data?.spy ?? 0;
  const vvixVixRatio = vixVal > 0 ? vvixVal / vixVal : data?.vvix_vix_ratio ?? 0;
  const ma = data?.spx_100d_ma;
  const spxDistPct = ma && ma > 0 ? ((spyVal / ma) - 1) * 100 : data?.spx_distance_pct ?? 0;
  const spxBelowMa = ma ? spyVal < ma : data?.crash_trigger?.conditions.spx_below_100d_ma ?? false;

  if (!data && !syncing) {
    return (
      <div className="regime-panel">
        <div className="regime-empty">
          <Shield size={32} strokeWidth={1} />
          <p>No CRI data available. Click Sync Now to run a scan.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="regime-panel">
      {/* ── Row 1: CRI Score Hero ──────────────────── */}
      <div className="regime-hero">
        <div className="regime-hero-score" style={{ color }}>
          {cri.score.toFixed(0)}
          <span className="regime-hero-max">/100</span>
        </div>
        <div className="regime-hero-meta">
          <span className="regime-level-badge" style={{ background: color, color: cri.level === "LOW" ? "#000" : "#fff" }}>
            {cri.level}
          </span>
          <span className="regime-live-dot" style={{ background: hasLive ? "var(--positive)" : "var(--text-muted)" }} />
          <span className="regime-hero-label">{hasLive ? "LIVE" : "CACHED"}</span>
          {lastSync && (
            <span className="regime-hero-timestamp">
              Last scan: {new Date(lastSync).toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="regime-hero-bar">
          <div className="regime-hero-bar-fill" style={{ width: `${cri.score}%`, background: color }} />
        </div>
        <div className="regime-hero-scale">
          <span>LOW</span><span>ELEVATED</span><span>HIGH</span><span>CRITICAL</span>
        </div>
      </div>

      {/* ── Market Closed Indicator ───────────────── */}
      {!marketOpen && (
        <div
          data-testid="market-closed-indicator"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "6px 12px",
            background: "rgba(245,166,35,0.12)",
            color: "var(--warning, #F5A623)",
            fontSize: "11px",
            fontFamily: "var(--font-mono, monospace)",
            letterSpacing: "0.08em",
            fontWeight: 600,
            borderLeft: "2px solid var(--warning, #F5A623)",
          }}
        >
          MARKET CLOSED — END OF DAY VALUES
        </div>
      )}

      {/* ── Row 2: Live Tickers Strip ─────────────── */}
      <div className="regime-strip">
        <div className="regime-strip-cell" data-testid="strip-vix">
          <div className="regime-strip-label">VIX <LiveBadge live={marketOpen && liveVix != null} /></div>
          <div className="regime-strip-value">{fmt(vixVal)}</div>
          <div className="regime-strip-sub">5d RoC: {fmtPct(data?.vix_5d_roc, 1)}</div>
          <div className="regime-strip-ts">{vixLastTs ?? "---"}</div>
        </div>
        <div className="regime-strip-cell" data-testid="strip-vvix">
          <div className="regime-strip-label">VVIX <LiveBadge live={marketOpen && liveVvix != null} /></div>
          <div className="regime-strip-value">{fmt(vvixVal)}</div>
          <div className="regime-strip-sub">VVIX/VIX: {fmt(vvixVixRatio)}</div>
          <div className="regime-strip-ts">{vvixLastTs ?? "---"}</div>
        </div>
        <div className="regime-strip-cell">
          <div className="regime-strip-label">SPY <LiveBadge live={marketOpen && liveSpy != null} /></div>
          <div className="regime-strip-value">${fmt(spyVal)}</div>
          <div className="regime-strip-sub">vs 100d MA: {fmtPct(spxDistPct)}</div>
        </div>
        <div className="regime-strip-cell">
          <div className="regime-strip-label">REALIZED VOL <LiveBadge live={hasIntradayRvol} /></div>
          <div className="regime-strip-value">{activeRvol != null ? `${fmt(activeRvol)}%` : "---"}</div>
          <div className="regime-strip-sub">20d annualized</div>
        </div>
        <div className="regime-strip-cell" data-testid="strip-cor1m">
          <div className="regime-strip-label">COR1M <LiveBadge live={false} /></div>
          <div className="regime-strip-value">{fmt(activeCorr, 2)}</div>
          <div className="regime-strip-sub">5d chg: {fmtSigned(activeCorrChange, 2)} pts</div>
        </div>
      </div>

      {/* ── Row 3+4: Components + Crash Trigger side by side ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0" }}>
        <div className="regime-components">
          <div className="regime-panel-title">
            <Zap size={12} />
            CRI COMPONENTS
            <InfoTooltip text={SECTION_TOOLTIPS["CRI COMPONENTS"]} />
          </div>
          <ComponentBar label="VIX" score={cri.components.vix} live={marketOpen && liveVix != null} />
          <ComponentBar label="VVIX" score={cri.components.vvix} live={marketOpen && liveVvix != null} />
          <ComponentBar label="CORRELATION" score={cri.components.correlation} live={false} />
          <ComponentBar label="MOMENTUM" score={cri.components.momentum} live={marketOpen && liveSpy != null} />
        </div>
        <div className="regime-triggers">
          <div className="regime-panel-title">
            <AlertTriangle size={12} />
            CRASH TRIGGER CONDITIONS
            <InfoTooltip text={SECTION_TOOLTIPS["CRASH TRIGGER CONDITIONS"]} />
          </div>
            <div className={`regime-trigger-status ${data?.crash_trigger?.triggered ? "regime-triggered" : ""}`}>
            {data?.crash_trigger?.triggered ? "TRIGGERED" : "INACTIVE"}
          </div>
            <TriggerRow
              label="SPX < 100d MA"
              met={spxBelowMa}
              value={`${fmtPct(spxDistPct)} (MA: $${fmt(ma)})`}
              live={marketOpen && liveSpy != null}
            />
            <TriggerRow
              label="Realized Vol > 25%"
              met={data?.crash_trigger?.conditions.realized_vol_gt_25 ?? false}
              value={data?.realized_vol != null ? `${fmt(data.realized_vol)}%` : "---"}
              live={false}
            />
            <TriggerRow
              label="COR1M > 60"
              met={correlationTriggerMet}
              value={fmt(activeCorr, 2)}
              live={false}
            />
        </div>
      </div>

      {/* ── Row 5: 10-Day History Chart ───────────── */}

      {data?.history && data.history.length > 0 && (
        <>
          <div className="section-header" style={{ display: "flex", alignItems: "center", gap: "6px" }}>10-DAY HISTORY <InfoTooltip text={SECTION_TOOLTIPS["10-DAY HISTORY"]} /></div>
          <CriHistoryChart history={data.history} criScore={cri.score} />
        </>
      )}
    </div>
  );
}
