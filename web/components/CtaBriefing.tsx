"use client";

import type { CtaRow } from "@/lib/useMenthorqCta";
import { formatCtaPercentileLabel, normalizeCtaPercentile } from "@/lib/ctaPercentiles";

/* ─── Types ──────────────────────────────────────────── */

type CtaTables = {
  main: CtaRow[];
  index: CtaRow[];
  commodity: CtaRow[];
  currency: CtaRow[];
};

type CtaBriefingProps = {
  tables: CtaTables;
  estSellingBn: number | null;
};

/* ─── Helpers ────────────────────────────────────────── */

function fmt(v: number | null | undefined, decimals = 2): string {
  if (v == null || !Number.isFinite(v)) return "---";
  return v.toFixed(decimals);
}

function pctile(v: number | null | undefined): number | null {
  return normalizeCtaPercentile(v);
}

/** Derive equity posture regime from SPX row in main table */
function deriveEquityPosture(main: CtaRow[]): {
  label: string;
  cssColor: string;
  borderColor: string;
  bgColor: string;
} {
  const spx = main.find((r) =>
    r.underlying.toLowerCase().includes("s&p") ||
    r.underlying.toLowerCase().includes("e-mini")
  );
  if (!spx) return { label: "UNKNOWN", cssColor: "var(--text-muted)", borderColor: "var(--border-dim)", bgColor: "transparent" };

  const pctile = normalizeCtaPercentile(spx.percentile_3m) ?? 50;
  const z = spx.z_score_3m;

  if (pctile <= 5 || z <= -2.0) return {
    label: "EXTREME SHORT",
    cssColor: "var(--negative)",
    borderColor: "rgba(232,93,108,0.4)",
    bgColor: "rgba(232,93,108,0.05)",
  };
  if (pctile <= 15 || z <= -1.5) return {
    label: "HEAVY SHORT",
    cssColor: "var(--negative)",
    borderColor: "rgba(232,93,108,0.3)",
    bgColor: "rgba(232,93,108,0.04)",
  };
  if (pctile <= 30) return {
    label: "SHORT",
    cssColor: "var(--warning)",
    borderColor: "rgba(245,166,35,0.35)",
    bgColor: "rgba(245,166,35,0.04)",
  };
  if (pctile >= 95 || z >= 2.0) return {
    label: "EXTREME LONG",
    cssColor: "var(--positive)",
    borderColor: "rgba(5,173,152,0.4)",
    bgColor: "rgba(5,173,152,0.05)",
  };
  if (pctile >= 80 || z >= 1.5) return {
    label: "HEAVY LONG",
    cssColor: "var(--positive)",
    borderColor: "rgba(5,173,152,0.3)",
    bgColor: "rgba(5,173,152,0.04)",
  };
  return {
    label: "NEUTRAL",
    cssColor: "var(--text-muted)",
    borderColor: "var(--border-dim)",
    bgColor: "transparent",
  };
}

/** Pull the SPX row from main */
function getSpxRow(main: CtaRow[]): CtaRow | undefined {
  return main.find((r) =>
    r.underlying.toLowerCase().includes("s&p") ||
    r.underlying.toLowerCase().includes("e-mini")
  );
}

/** Find most extreme commodity long (pctile_3m >= 80) */
function getCrowdedCommodityLongs(commodity: CtaRow[]): CtaRow[] {
  return commodity
    .filter((r) => (pctile(r.percentile_3m) ?? -1) >= 80 && r.position_today > 0)
    .sort((a, b) => (pctile(b.percentile_3m) ?? -1) - (pctile(a.percentile_3m) ?? -1));
}

function getCurrencyExtremes(currency: CtaRow[]): { shorts: CtaRow[]; longs: CtaRow[] } {
  const shorts = currency
    .filter((r) => r.position_today < 0 && ((pctile(r.percentile_3m) ?? 101) <= 20 || r.z_score_3m <= -1))
    .sort((a, b) => (pctile(a.percentile_3m) ?? 101) - (pctile(b.percentile_3m) ?? 101));
  const longs = currency
    .filter((r) => r.position_today > 0 && ((pctile(r.percentile_3m) ?? -1) >= 80 || r.z_score_3m >= 1))
    .sort((a, b) => (pctile(b.percentile_3m) ?? -1) - (pctile(a.percentile_3m) ?? -1));
  return { shorts, longs };
}

/** Derive squeeze risk label */
function deriveSqueezeRisk(spx: CtaRow | undefined): { label: string; cssColor: string } {
  if (!spx) return { label: "UNKNOWN", cssColor: "var(--text-muted)" };
  const pctile = normalizeCtaPercentile(spx.percentile_3m) ?? 50;
  const z = spx.z_score_3m;
  if (pctile <= 5 || z <= -2.0) return { label: "ELEVATED", cssColor: "var(--warning)" };
  if (pctile <= 15 || z <= -1.5) return { label: "MODERATE", cssColor: "var(--warning)" };
  return { label: "LOW", cssColor: "var(--text-muted)" };
}

/** Derive active signal tags from full dataset */
function deriveSignalTags(tables: CtaTables): Array<{ label: string; cssColor: string; borderColor: string; bgColor: string }> {
  const tags: Array<{ label: string; cssColor: string; borderColor: string; bgColor: string }> = [];

  const spx = getSpxRow(tables.main);
  if (spx && (pctile(spx.percentile_3m) ?? 101) <= 15) {
    tags.push({
      label: "SHORT EQUITIES",
      cssColor: "var(--negative)",
      borderColor: "rgba(232,93,108,0.3)",
      bgColor: "rgba(232,93,108,0.12)",
    });
  }
  if (spx && (pctile(spx.percentile_3m) ?? -1) >= 80) {
    tags.push({
      label: "LONG EQUITIES",
      cssColor: "var(--positive)",
      borderColor: "rgba(5,173,152,0.3)",
      bgColor: "rgba(5,173,152,0.1)",
    });
  }

  // Bond posture
  const bonds = tables.main.filter((r) =>
    r.underlying.toLowerCase().includes("t-note") ||
    r.underlying.toLowerCase().includes("treasury")
  );
  const bondShort = bonds.filter((r) => (pctile(r.percentile_3m) ?? 101) <= 10 && r.position_today < 0);
  if (bondShort.length >= 2) {
    tags.push({
      label: "SHORT BONDS",
      cssColor: "var(--negative)",
      borderColor: "rgba(232,93,108,0.25)",
      bgColor: "rgba(232,93,108,0.1)",
    });
  }

  // Crowded commodity longs
  const crowdedEnergy = tables.commodity.filter(
    (r) => (pctile(r.percentile_3m) ?? -1) >= 85 && r.position_today > 0 &&
      (r.underlying.toLowerCase().includes("brent") ||
        r.underlying.toLowerCase().includes("diesel") ||
        r.underlying.toLowerCase().includes("crude"))
  );
  if (crowdedEnergy.length > 0) {
    tags.push({
      label: "LONG ENERGY",
      cssColor: "var(--signal-core)",
      borderColor: "rgba(5,173,152,0.3)",
      bgColor: "rgba(5,173,152,0.1)",
    });
  }

  // Squeeze watch
  if (spx && (pctile(spx.percentile_3m) ?? 101) <= 10 && spx.position_1m_ago > 0) {
    tags.push({
      label: "SQUEEZE WATCH",
      cssColor: "var(--warning)",
      borderColor: "rgba(245,166,35,0.3)",
      bgColor: "rgba(245,166,35,0.1)",
    });
  }

  const fx = getCurrencyExtremes(tables.currency);
  if (fx.shorts.length > 0 && fx.longs.length > 0) {
    tags.push({
      label: "FX DISPERSION",
      cssColor: "var(--warning)",
      borderColor: "rgba(245,166,35,0.3)",
      bgColor: "rgba(245,166,35,0.1)",
    });
  } else if (fx.shorts.length >= 2) {
    tags.push({
      label: "DEFENSIVE FX",
      cssColor: "var(--negative)",
      borderColor: "rgba(232,93,108,0.25)",
      bgColor: "rgba(232,93,108,0.1)",
    });
  } else if (fx.longs.length >= 2) {
    tags.push({
      label: "FX LONGS CROWDED",
      cssColor: "var(--signal-core)",
      borderColor: "rgba(5,173,152,0.3)",
      bgColor: "rgba(5,173,152,0.1)",
    });
  }

  return tags;
}

/** Build narrative prose from data */
function buildNarrative(tables: CtaTables, estSellingBn: number | null): string {
  const spx = getSpxRow(tables.main);
  const nq = tables.main.find((r) => r.underlying.toLowerCase().includes("nasdaq"));
  const crowded = getCrowdedCommodityLongs(tables.commodity);
  const fx = getCurrencyExtremes(tables.currency);

  const parts: string[] = [];

  if (spx) {
    const flipped = spx.position_1m_ago > 0 && spx.position_today < 0;
    const spxPctile = pctile(spx.percentile_3m) ?? 50;
    if (spxPctile <= 10) {
      parts.push(
        `SPX CTAs at the ${formatCtaPercentileLabel(spx.percentile_3m)} percentile of their 3M range${flipped ? `, having flipped from ${fmt(spx.position_1m_ago)} long one month ago` : ""}.`
      );
    } else if (spxPctile >= 90) {
      parts.push(`SPX CTAs at the ${formatCtaPercentileLabel(spx.percentile_3m)} percentile of their 3M range — heavily long.`);
    }
  }

  if (nq && (pctile(nq.percentile_3m) ?? 101) <= 10) {
    const increasing = nq.position_today < nq.position_yesterday;
    parts.push(
      `NQ positioning at ${formatCtaPercentileLabel(nq.percentile_3m)} percentile${increasing ? ", shorts increasing" : ""} (${fmt(nq.position_yesterday)} to ${fmt(nq.position_today)}).`
    );
  }

  if (crowded.length > 0) {
    const labels = crowded.slice(0, 3).map((r) => {
      const name = r.underlying.split(" ")[0];
      return `${name} at ${formatCtaPercentileLabel(r.percentile_3m)} pctile`;
    });
    parts.push(`Crowded commodity longs: ${labels.join(", ")}.`);
  }

  if (fx.shorts.length > 0 && fx.longs.length > 0) {
    const short = fx.shorts[0];
    const long = fx.longs[0];
    parts.push(
      `${short.underlying} at ${formatCtaPercentileLabel(short.percentile_3m)} pctile short while ${long.underlying} sits ${formatCtaPercentileLabel(long.percentile_3m)} pctile long.`,
    );
  } else if (fx.shorts.length >= 2) {
    const labels = fx.shorts.slice(0, 2).map((r) => `${r.underlying} ${formatCtaPercentileLabel(r.percentile_3m)}`).join(", ");
    parts.push(`Defensive FX skew: ${labels}.`);
  } else if (fx.longs.length >= 2) {
    const labels = fx.longs.slice(0, 2).map((r) => `${r.underlying} ${formatCtaPercentileLabel(r.percentile_3m)}`).join(", ");
    parts.push(`Crowded FX longs: ${labels}.`);
  }

  const spxShort = getSpxRow(tables.main);
  if (spxShort && (pctile(spxShort.percentile_3m) ?? 101) <= 10 && spxShort.position_1m_ago > 0) {
    parts.push(
      "Positioning is a mean-reversion coil — any bullish catalyst risks violent CTA short-covering across all equity classes."
    );
  }

  if (estSellingBn != null && estSellingBn > 20) {
    parts.push(`Vol-targeting model estimates $${fmt(estSellingBn, 1)}B in forced selling still in pipeline.`);
  }

  return parts.join(" ") || "Positioning data available. No extreme concentration detected.";
}

/* ─── Component ──────────────────────────────────────── */

export default function CtaBriefing({ tables, estSellingBn }: CtaBriefingProps) {
  const spx = getSpxRow(tables.main);
  const posture = deriveEquityPosture(tables.main);
  const squeezeRisk = deriveSqueezeRisk(spx);
  const tags = deriveSignalTags(tables);
  const narrative = buildNarrative(tables, estSellingBn);
  const crowded = getCrowdedCommodityLongs(tables.commodity);

  return (
    <div
      className="cta-briefing"
      style={{
        margin: "0 0 0 0",
        borderBottom: "1px solid var(--border-dim)",
        borderLeft: `2px solid ${posture.borderColor}`,
        background: posture.bgColor,
        padding: "12px 16px 14px",
      }}
    >
      {/* ── Header row ── */}
      <div className="cta-briefing-header">
        <span
          className="cta-briefing-regime-pill"
          style={{
            color: posture.cssColor,
            borderColor: posture.borderColor,
            background: posture.bgColor,
          }}
        >
          {posture.label}
        </span>
        <span className="cta-briefing-label">CTA EQUITY POSTURE</span>
      </div>

      {/* ── Metric cards ── */}
      <div className="cta-briefing-metrics">
        <div className="cta-briefing-metric">
          <div className="cta-briefing-metric-label">SPX 3M PCTILE</div>
          <div
            className="cta-briefing-metric-value"
            style={{ color: spx && (pctile(spx.percentile_3m) ?? 50) <= 15 ? "var(--negative)" : spx && (pctile(spx.percentile_3m) ?? 50) >= 85 ? "var(--positive)" : "var(--text-primary)" }}
          >
            {spx != null ? formatCtaPercentileLabel(spx.percentile_3m) : "---"}
          </div>
        </div>
        <div className="cta-briefing-metric">
          <div className="cta-briefing-metric-label">SPX 3M Z-SCORE</div>
          <div
            className="cta-briefing-metric-value"
            style={{ color: spx && spx.z_score_3m <= -1.5 ? "var(--negative)" : spx && spx.z_score_3m >= 1.5 ? "var(--positive)" : "var(--text-primary)" }}
          >
            {spx != null ? fmt(spx.z_score_3m) : "---"}
          </div>
        </div>
        <div className="cta-briefing-metric">
          <div className="cta-briefing-metric-label">EST. SELLING</div>
          <div
            className="cta-briefing-metric-value"
            style={{ color: estSellingBn != null && estSellingBn > 50 ? "var(--warning)" : "var(--text-primary)" }}
          >
            {estSellingBn != null ? `$${fmt(estSellingBn, 0)}B` : "---"}
          </div>
        </div>
        <div className="cta-briefing-metric">
          <div className="cta-briefing-metric-label">SQUEEZE RISK</div>
          <div
            className="cta-briefing-metric-value"
            style={{ color: squeezeRisk.cssColor }}
          >
            {squeezeRisk.label}
          </div>
        </div>
        {crowded.length > 0 && (
          <div className="cta-briefing-metric">
            <div className="cta-briefing-metric-label">CROWDED LONGS</div>
            <div className="cta-briefing-metric-value" style={{ color: "var(--signal-core)" }}>
              {crowded.length}
            </div>
          </div>
        )}
      </div>

      {/* ── Narrative ── */}
      <p className="cta-briefing-narrative">{narrative}</p>

      {/* ── Signal tags ── */}
      {tags.length > 0 && (
        <div className="cta-briefing-tags">
          {tags.map((t) => (
            <span
              key={t.label}
              className="cta-briefing-tag"
              style={{
                color: t.cssColor,
                borderColor: t.borderColor,
                background: t.bgColor,
              }}
            >
              {t.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
