"use client";

import { useState } from "react";
import type { CtaRow } from "@/lib/useMenthorqCta";
import { SECTION_TOOLTIPS } from "@/lib/sectionTooltips";
import InfoTooltip from "./InfoTooltip";
import { normalizeCtaPercentile } from "@/lib/ctaPercentiles";

/* ─── Props ──────────────────────────────────────────── */

export type CtaSectionCallout = {
  headline: string;
  body: string;
  kind: "short" | "long" | "neutral";
};

type SortableCtaTableProps = {
  sectionKey: string;
  rows: CtaRow[];
  callout?: CtaSectionCallout;
};

/* ─── Helpers ────────────────────────────────────────── */

function fmt(v: number | null | undefined, decimals = 2): string {
  if (v == null || !Number.isFinite(v)) return "---";
  return v.toFixed(decimals);
}

function fmtPctile(v: number | null | undefined): string {
  const normalized = normalizeCtaPercentile(v);
  if (normalized == null) return "---";
  return String(Math.round(normalized));
}

function posColor(v: number): string {
  if (v > 0) return "var(--positive)";
  if (v < 0) return "var(--negative)";
  return "var(--text-primary)";
}

function pctileBg(v: number): string {
  const normalized = normalizeCtaPercentile(v) ?? v;
  if (normalized <= 10) return "rgba(232,93,108,0.25)";
  if (normalized <= 25) return "rgba(232,93,108,0.12)";
  if (normalized <= 40) return "rgba(245,166,35,0.12)";
  if (normalized >= 75) return "rgba(5,173,152,0.25)";
  if (normalized >= 60) return "rgba(5,173,152,0.12)";
  return "transparent";
}

function zColor(z: number): string {
  if (z > 0) return "var(--positive)";
  if (z < 0) return "var(--negative)";
  return "var(--text-primary)";
}

function zOpacity(z: number): number {
  const abs = Math.abs(z);
  if (abs >= 2) return 1;
  if (abs >= 1) return 0.85;
  if (abs >= 0.5) return 0.7;
  return 0.55;
}

/* ─── Constants ──────────────────────────────────────── */

const SECTION_LABELS: Record<string, string> = {
  main: "MAIN INDICES",
  index: "INDEX FUTURES",
  commodity: "COMMODITIES",
  currency: "CURRENCIES",
};

type NumericSortCol =
  | "position_today"
  | "position_yesterday"
  | "position_1m_ago"
  | "percentile_1m"
  | "percentile_3m"
  | "percentile_1y"
  | "z_score_3m";

/* ─── Flag helpers ───────────────────────────────────── */

function flagForRow(r: CtaRow): { kind: "short" | "long"; tooltip: string } | null {
  const p = normalizeCtaPercentile(r.percentile_3m) ?? r.percentile_3m;
  const z = r.z_score_3m;
  const isExtreme = p <= 10 || p >= 90 || Math.abs(z) >= 1.5;
  if (!isExtreme) return null;

  const isShort = r.position_today < 0 && (p <= 10 || z <= -1.5);
  const isLong  = r.position_today > 0 && (p >= 90 || z >= 1.5);

  if (isShort) {
    const flipped = r.position_1m_ago > 0;
    return {
      kind: "short",
      tooltip: [
        `${Math.round(p)}th pctile (3M), z ${fmt(z)}.`,
        flipped ? `Flipped from ${fmt(r.position_1m_ago)} long 1M ago.` : null,
        Math.abs(z) >= 2.0
          ? "Extreme short. Violent covering risk on any bullish catalyst."
          : "Heavy short positioning.",
      ].filter(Boolean).join(" "),
    };
  }
  if (isLong) {
    return {
      kind: "long",
      tooltip: [
        `${Math.round(p)}th pctile (3M), z ${fmt(z)}.`,
        "Crowded long. Mean reversion risk elevated.",
      ].join(" "),
    };
  }
  return null;
}

type SortDir = "asc" | "desc";

/* ─── Component ──────────────────────────────────────── */

export default function SortableCtaTable({ sectionKey, rows, callout }: SortableCtaTableProps) {
  const [sortCol, setSortCol] = useState<NumericSortCol | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(col: NumericSortCol) {
    if (sortCol === col) {
      if (sortDir === "desc") {
        setSortDir("asc");
      } else {
        // asc → unsorted
        setSortCol(null);
        setSortDir("desc");
      }
    } else {
      setSortCol(col);
      setSortDir("desc");
    }
  }

  const sorted = sortCol == null
    ? rows
    : [...rows].sort((a, b) => {
        const av = a[sortCol] as number;
        const bv = b[sortCol] as number;
        return sortDir === "asc" ? av - bv : bv - av;
      });

  function indicator(col: NumericSortCol) {
    if (sortCol !== col) return null;
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  function thStyle(col: NumericSortCol): React.CSSProperties {
    return {
      cursor: "pointer",
      userSelect: "none",
      color: sortCol === col ? "var(--text-primary)" : undefined,
      whiteSpace: "nowrap",
    };
  }

  return (
    <div data-testid="sortable-cta-table" style={{ width: "100%" }}>
      <div
        style={{
          fontFamily: "var(--font-mono, monospace)",
          fontSize: "10px",
          fontWeight: 700,
          letterSpacing: "0.10em",
          color: "var(--text-muted)",
          padding: "8px 12px 4px",
          textTransform: "uppercase",
        }}
      >
        {SECTION_LABELS[sectionKey] ?? sectionKey.toUpperCase()}
        {SECTION_TOOLTIPS[SECTION_LABELS[sectionKey]] && (
          <InfoTooltip text={SECTION_TOOLTIPS[SECTION_LABELS[sectionKey]]} />
        )}
        <span
          style={{
            marginLeft: "8px",
            fontSize: "9px",
            fontWeight: 400,
            background: "rgba(226,232,240,0.06)",
            padding: "1px 5px",
            letterSpacing: "0.04em",
          }}
        >
          {rows.length}
        </span>
      </div>
      {callout && (
        <div
          className="cta-section-callout"
          style={{
            borderLeftColor: callout.kind === "short"
              ? "var(--negative)"
              : callout.kind === "long"
                ? "var(--signal-core)"
                : "var(--border-dim)",
          }}
        >
          <span
            className="cta-section-callout-headline"
            style={{
              color: callout.kind === "short"
                ? "var(--negative)"
                : callout.kind === "long"
                  ? "var(--signal-core)"
                  : "var(--text-muted)",
            }}
          >
            {callout.headline}
          </span>
          {" "}
          <span className="cta-section-callout-body">{callout.body}</span>
        </div>
      )}
      <div className="cta-table-wrap" style={{ width: "100%" }}>
        <table className="cta-table" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th className="cta-th-underlying">UNDERLYING</th>
              <th className="cta-th-num" style={thStyle("position_today")} onClick={() => handleSort("position_today")}>
                TODAY{indicator("position_today")}
              </th>
              <th className="cta-th-num" style={thStyle("position_yesterday")} onClick={() => handleSort("position_yesterday")}>
                YDAY{indicator("position_yesterday")}
              </th>
              <th className="cta-th-num" style={thStyle("position_1m_ago")} onClick={() => handleSort("position_1m_ago")}>
                1M AGO{indicator("position_1m_ago")}
              </th>
              <th className="cta-th-num" style={thStyle("percentile_1m")} onClick={() => handleSort("percentile_1m")}>
                1M %ILE{indicator("percentile_1m")}
              </th>
              <th className="cta-th-num" style={thStyle("percentile_3m")} onClick={() => handleSort("percentile_3m")}>
                3M %ILE{indicator("percentile_3m")}
              </th>
              <th className="cta-th-num" style={thStyle("percentile_1y")} onClick={() => handleSort("percentile_1y")}>
                1Y %ILE{indicator("percentile_1y")}
              </th>
              <th className="cta-th-num" style={thStyle("z_score_3m")} onClick={() => handleSort("z_score_3m")}>
                3M Z{indicator("z_score_3m")}
              </th>
              <th style={{ width: "24px" }} aria-label="signal flag" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const flag = flagForRow(r);
              return (
                <tr key={r.underlying}>
                  <td className="cta-td-underlying">{r.underlying}</td>
                  <td className="cta-td-num" style={{ color: posColor(r.position_today) }}>
                    {fmt(r.position_today)}
                  </td>
                  <td className="cta-td-num" style={{ color: posColor(r.position_yesterday) }}>
                    {fmt(r.position_yesterday)}
                  </td>
                  <td className="cta-td-num" style={{ color: posColor(r.position_1m_ago) }}>
                    {fmt(r.position_1m_ago)}
                  </td>
                  <td className="cta-td-num" style={{ background: pctileBg(r.percentile_1m) }}>
                    {fmtPctile(r.percentile_1m)}
                  </td>
                  <td className="cta-td-num" style={{ background: pctileBg(r.percentile_3m) }}>
                    {fmtPctile(r.percentile_3m)}
                  </td>
                  <td className="cta-td-num" style={{ background: pctileBg(r.percentile_1y) }}>
                    {fmtPctile(r.percentile_1y)}
                  </td>
                  <td
                    className="cta-td-num"
                    style={{ color: zColor(r.z_score_3m), opacity: zOpacity(r.z_score_3m) }}
                  >
                    {fmt(r.z_score_3m)}
                  </td>
                  <td className="cta-td-flag">
                    {flag && (
                      <span
                        className={`cta-flag cta-flag-${flag.kind}`}
                        title={flag.tooltip}
                        aria-label={flag.tooltip}
                      >
                        {flag.kind === "short" ? "!" : "^"}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
