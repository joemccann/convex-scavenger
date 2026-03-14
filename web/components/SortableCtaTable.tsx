"use client";

import { useState } from "react";
import type { CtaRow } from "@/lib/useMenthorqCta";
import { SECTION_TOOLTIPS } from "@/lib/sectionTooltips";
import InfoTooltip from "./InfoTooltip";

/* ─── Props ──────────────────────────────────────────── */

type SortableCtaTableProps = {
  sectionKey: string;
  rows: CtaRow[];
};

/* ─── Helpers ────────────────────────────────────────── */

import { fmt } from "@/lib/format";

function posColor(v: number): string {
  if (v > 0) return "var(--positive)";
  if (v < 0) return "var(--negative)";
  return "var(--text-primary)";
}

function pctileBg(v: number): string {
  if (v <= 10) return "rgba(232,93,108,0.25)";
  if (v <= 25) return "rgba(232,93,108,0.12)";
  if (v <= 40) return "rgba(245,166,35,0.12)";
  if (v >= 75) return "rgba(5,173,152,0.25)";
  if (v >= 60) return "rgba(5,173,152,0.12)";
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

type SortDir = "asc" | "desc";

/* ─── Component ──────────────────────────────────────── */

export default function SortableCtaTable({ sectionKey, rows }: SortableCtaTableProps) {
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
    <div data-testid="sortable-cta-table" className="wf">
      <div
        className="fm tm uppercase"
        style={{
          fontSize: "10px",
          fontWeight: 700,
          letterSpacing: "0.10em",
          padding: "8px 12px 4px",
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
      <div className="ctw w-full">
        <table className="cta-table w-full">
          <thead>
            <tr>
              <th className="ctu">UNDERLYING</th>
              <th className="ctn" style={thStyle("position_today")} onClick={() => handleSort("position_today")}>
                TODAY{indicator("position_today")}
              </th>
              <th className="ctn" style={thStyle("position_yesterday")} onClick={() => handleSort("position_yesterday")}>
                YDAY{indicator("position_yesterday")}
              </th>
              <th className="ctn" style={thStyle("position_1m_ago")} onClick={() => handleSort("position_1m_ago")}>
                1M AGO{indicator("position_1m_ago")}
              </th>
              <th className="ctn" style={thStyle("percentile_1m")} onClick={() => handleSort("percentile_1m")}>
                1M %ILE{indicator("percentile_1m")}
              </th>
              <th className="ctn" style={thStyle("percentile_3m")} onClick={() => handleSort("percentile_3m")}>
                3M %ILE{indicator("percentile_3m")}
              </th>
              <th className="ctn" style={thStyle("percentile_1y")} onClick={() => handleSort("percentile_1y")}>
                1Y %ILE{indicator("percentile_1y")}
              </th>
              <th className="ctn" style={thStyle("z_score_3m")} onClick={() => handleSort("z_score_3m")}>
                3M Z{indicator("z_score_3m")}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.underlying}>
                <td className="cdu">{r.underlying}</td>
                <td className="cdn" style={{ color: posColor(r.position_today) }}>
                  {fmt(r.position_today)}
                </td>
                <td className="cdn" style={{ color: posColor(r.position_yesterday) }}>
                  {fmt(r.position_yesterday)}
                </td>
                <td className="cdn" style={{ color: posColor(r.position_1m_ago) }}>
                  {fmt(r.position_1m_ago)}
                </td>
                <td className="cdn" style={{ background: pctileBg(r.percentile_1m) }}>
                  {r.percentile_1m}
                </td>
                <td className="cdn" style={{ background: pctileBg(r.percentile_3m) }}>
                  {r.percentile_3m}
                </td>
                <td className="cdn" style={{ background: pctileBg(r.percentile_1y) }}>
                  {typeof r.percentile_1y === "number" && r.percentile_1y > 100
                    ? fmt(r.percentile_1y)
                    : r.percentile_1y}
                </td>
                <td
                  className="cdn"
                  style={{ color: zColor(r.z_score_3m), opacity: zOpacity(r.z_score_3m) }}
                >
                  {fmt(r.z_score_3m)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
