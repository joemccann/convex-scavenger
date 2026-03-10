/** Shared theme constants for OG image rendering (Satori).
 *  No CSS variables — Satori requires literal values. */

export const OG = {
  bg: "#0a0f14",
  panel: "#0f1519",
  border: "#1e293b",
  text: "#e2e8f0",
  muted: "#94a3b8",
  positive: "#05AD98",
  negative: "#E85D6C",
  warning: "#F5A623",
  info: "#8B5CF6",
} as const;

export function posColor(v: number): string {
  if (v > 0) return OG.positive;
  if (v < 0) return OG.negative;
  return OG.text;
}

export function pctileBg(v: number): string {
  if (v <= 10) return "rgba(232,93,108,0.25)";
  if (v <= 25) return "rgba(232,93,108,0.12)";
  if (v <= 40) return "rgba(245,166,35,0.12)";
  if (v >= 75) return "rgba(5,173,152,0.25)";
  if (v >= 60) return "rgba(5,173,152,0.12)";
  return "transparent";
}

export function zColor(z: number): string {
  if (z > 0) return OG.positive;
  if (z < 0) return OG.negative;
  return OG.text;
}

export function zOpacity(z: number): number {
  const abs = Math.abs(z);
  if (abs >= 2) return 1;
  if (abs >= 1) return 0.85;
  if (abs >= 0.5) return 0.7;
  return 0.55;
}

export function fmt(v: number | null | undefined, decimals = 2): string {
  if (v == null || !Number.isFinite(v)) return "---";
  return v.toFixed(decimals);
}
