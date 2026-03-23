"use client";

import { AlertTriangle, Check, Shield, X, Zap } from "lucide-react";
import InfoTooltip from "./InfoTooltip";
import { useVcg, type VcgData, type VcgHistoryEntry } from "@/lib/useVcg";
import { MarketState } from "@/lib/useMarketHours";
import type { PriceData } from "@/lib/pricesProtocol";

type VcgPanelProps = {
  prices: Record<string, PriceData>;
  marketState?: MarketState;
};

/* ─── Helpers ─────────────────────────────────────────── */

function fmtZ(v: number | null): string {
  if (v == null) return "---";
  return v >= 0 ? `+${v.toFixed(2)}` : v.toFixed(2);
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return "---";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function fmtNum(v: number | null | undefined, decimals = 2): string {
  if (v == null) return "---";
  return v.toFixed(decimals);
}

function interpretationColor(interpretation: string): string {
  switch (interpretation) {
    case "CREDIT_ARTIFICIALLY_CALM": return "var(--fault)";
    case "CREDIT_OVERSHOT": return "var(--warn)";
    case "NORMAL": return "var(--signal-core)";
    default: return "var(--text-muted)";
  }
}

function interpretationLabel(interpretation: string): string {
  switch (interpretation) {
    case "CREDIT_ARTIFICIALLY_CALM": return "CREDIT ARTIFICIALLY CALM";
    case "CREDIT_OVERSHOT": return "CREDIT OVERSHOT";
    case "NORMAL": return "NORMAL";
    default: return "INSUFFICIENT DATA";
  }
}

function regimeBadgeColor(regime: string): string {
  switch (regime) {
    case "PANIC": return "var(--extreme)";
    case "TRANSITION": return "var(--warn)";
    default: return "var(--signal-core)";
  }
}

/* ─── Condition row ──────────────────────────────────── */

function ConditionRow({ label, met, value }: { label: string; met: boolean; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 0" }}>
      {met ? <Check size={14} style={{ color: "var(--signal-core)" }} /> : <X size={14} style={{ color: "var(--fault)" }} />}
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: met ? "var(--text-primary)" : "var(--text-muted)" }}>
        {label}: {value}
      </span>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────── */

export default function VcgPanel({ marketState }: VcgPanelProps) {
  const { data, loading, error, lastSync } = useVcg(marketState ?? null);

  if (loading && !data) {
    return (
      <div className="section">
        <div className="section-header">
          <div className="section-title">
            <Zap size={14} />
            Volatility-Credit Gap
          </div>
        </div>
        <div className="section-body" style={{ padding: "24px", textAlign: "center" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-muted)" }}>Loading VCG scan...</span>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="section">
        <div className="section-header">
          <div className="section-title">
            <Zap size={14} />
            Volatility-Credit Gap
          </div>
        </div>
        <div className="section-body" style={{ padding: "16px" }}>
          <div className="alert-item bearish">{error}</div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const sig = data.signal;
  const hdr = sig.hdr_conditions;
  const attr = sig.attribution;

  return (
    <>
      {/* Signal strip */}
      <div className="section">
        <div className="section-header">
          <div className="section-title">
            <Zap size={14} />
            VCG Signal
            <InfoTooltip text="Volatility-Credit Gap: detects divergence between vol complex (VIX/VVIX) and credit markets (HYG). VCG > +2 = credit artificially calm." />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span className="pill" style={{ background: regimeBadgeColor(sig.regime), color: "#fff", fontSize: "9px" }}>
              {sig.regime}
            </span>
            {sig.ro === 1 && (
              <span className="pill" style={{ background: "var(--fault)", color: "#fff", fontSize: "9px" }}>
                <AlertTriangle size={10} style={{ marginRight: "4px" }} />
                RISK-OFF
              </span>
            )}
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--text-muted)" }}>
              {data.credit_proxy}
            </span>
            {lastSync && (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--text-muted)" }}>
                {new Date(lastSync).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
              </span>
            )}
          </div>
        </div>

        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-label">VCG Z-Score</div>
            <div className="metric-value" style={{ color: interpretationColor(sig.interpretation) }}>
              {fmtZ(sig.vcg)}
            </div>
            <div className="metric-change" style={{ color: interpretationColor(sig.interpretation) }}>
              {interpretationLabel(sig.interpretation)}
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-label">VCG Div (Panic-Adj)</div>
            <div className="metric-value">{fmtZ(sig.vcg_div)}</div>
            <div className="metric-change neutral">
              {sig.pi_panic > 0 ? `π = ${sig.pi_panic.toFixed(2)} SUPPRESSED` : "NO SUPPRESSION"}
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Credit 5d Return</div>
            <div className={`metric-value ${sig.credit_5d_return_pct >= 0 ? "positive" : "negative"}`}>
              {fmtPct(sig.credit_5d_return_pct)}
            </div>
            <div className="metric-change neutral">{data.credit_proxy} @ ${fmtNum(sig.credit_price)}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Residual</div>
            <div className="metric-value">{sig.residual != null ? sig.residual.toFixed(6) : "---"}</div>
            <div className="metric-change neutral">MODEL ε</div>
          </div>
        </div>
      </div>

      {/* HDR Conditions + Attribution */}
      <div className="section">
        <div className="section-header">
          <div className="section-title">
            <Shield size={14} />
            High Divergence Risk
            <InfoTooltip text="All 3 conditions must be met AND VCG > +2 for a Risk-Off signal." />
          </div>
          <span className={`pill ${sig.hdr === 1 ? "undefined" : "defined"}`} style={{ fontSize: "9px" }}>
            {sig.hdr === 1 ? "HDR ACTIVE" : "HDR INACTIVE"}
          </span>
        </div>

        <div className="metrics-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="metric-card" style={{ padding: "12px 16px" }}>
            <ConditionRow label="VVIX > 110" met={hdr.vvix_gt_110} value={fmtNum(sig.vvix)} />
            <ConditionRow label="Credit 5d > -0.5%" met={hdr.credit_5d_gt_neg05pct} value={fmtPct(sig.credit_5d_return_pct)} />
            <ConditionRow label="VIX < 40 (non-panic)" met={hdr.vix_lt_40} value={fmtNum(sig.vix)} />
          </div>

          <div className="metric-card" style={{ padding: "12px 16px" }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: "8px" }}>
              Attribution
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
              <div style={{ flex: 1, height: "6px", borderRadius: "3px", background: "var(--bg-panel-raised)", overflow: "hidden" }}>
                <div style={{ width: `${Math.max(attr.vvix_pct, 0)}%`, height: "100%", background: "var(--extreme)", borderRadius: "3px" }} />
              </div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-primary)", minWidth: "60px" }}>
                VVIX {attr.vvix_pct.toFixed(0)}%
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ flex: 1, height: "6px", borderRadius: "3px", background: "var(--bg-panel-raised)", overflow: "hidden" }}>
                <div style={{ width: `${Math.max(attr.vix_pct, 0)}%`, height: "100%", background: "var(--signal-core)", borderRadius: "3px" }} />
              </div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-primary)", minWidth: "60px" }}>
                VIX {attr.vix_pct.toFixed(0)}%
              </span>
            </div>
            <div style={{ marginTop: "8px", fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text-muted)" }}>
              β₁(VVIX) = {fmtNum(sig.beta1_vvix, 6)} | β₂(VIX) = {fmtNum(sig.beta2_vix, 6)}
              {sig.sign_suppressed && <span style={{ color: "var(--warn)", marginLeft: "8px" }}>SIGN REVERSED</span>}
            </div>
          </div>
        </div>
      </div>

      {/* History table */}
      <div className="section">
        <div className="section-header">
          <div className="section-title">
            VCG History (10d)
          </div>
        </div>
        <div className="section-body table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th className="right">VCG</th>
                <th className="right">VCG Div</th>
                <th className="right">Residual</th>
                <th className="right">β₁ (VVIX)</th>
                <th className="right">β₂ (VIX)</th>
                <th className="right">VIX</th>
                <th className="right">VVIX</th>
                <th className="right">{data.credit_proxy}</th>
              </tr>
            </thead>
            <tbody>
              {data.history.map((h: VcgHistoryEntry) => (
                <tr key={h.date}>
                  <td>{h.date}</td>
                  <td className="right" style={{ color: (h.vcg ?? 0) > 2 ? "var(--fault)" : (h.vcg ?? 0) < -2 ? "var(--warn)" : "var(--text-primary)" }}>
                    {fmtZ(h.vcg)}
                  </td>
                  <td className="right">{fmtZ(h.vcg_div)}</td>
                  <td className="right">{h.residual != null ? h.residual.toFixed(6) : "---"}</td>
                  <td className="right">{h.beta1 != null ? h.beta1.toFixed(6) : "---"}</td>
                  <td className="right">{h.beta2 != null ? h.beta2.toFixed(6) : "---"}</td>
                  <td className="right">{h.vix.toFixed(2)}</td>
                  <td className="right">{h.vvix.toFixed(2)}</td>
                  <td className="right">{h.credit.toFixed(2)}</td>
                </tr>
              ))}
              {data.history.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: "center", color: "var(--text-muted)" }}>No history data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
