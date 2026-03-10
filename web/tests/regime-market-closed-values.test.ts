/**
 * Unit tests: RegimePanel COR1M presentation + market-closed value gating
 *
 * Regression target:
 *  1. The regime strip must use COR1M fields from CRI data, not sector ETF proxies.
 *  2. The component must no longer depend on intraday sector-correlation snapshots.
 *  3. VIX/VVIX/SPY live values and timestamps remain gated on marketOpen.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const TEST_DIR = fileURLToPath(new URL(".", import.meta.url));
const PANEL_PATH = join(TEST_DIR, "../components/RegimePanel.tsx");
const source = readFileSync(PANEL_PATH, "utf-8");

describe("RegimePanel — COR1M replaces sector ETF correlation inputs", () => {
  it("renders COR1M instead of SECTOR CORR", () => {
    expect(source).toContain("COR1M");
    expect(source).not.toContain("SECTOR CORR");
  });

  it("reads COR1M fields from CRI data", () => {
    expect(source).toContain("data?.cor1m");
    expect(source).toContain("data?.cor1m_5d_change");
    expect(source).not.toContain("avg_sector_correlation");
  });

  it("does not depend on intraday sector correlation utilities", () => {
    expect(source).not.toContain("computeIntradaySectorCorr");
    expect(source).not.toContain("appendSnapshot");
    expect(source).not.toContain("bufferDepth");
    expect(source).not.toContain("resetBuffer");
  });

  it("uses COR1M > 60 for the crash-trigger label", () => {
    expect(source).toContain("COR1M > 60");
  });
});

describe("RegimePanel — VIX/VVIX/SPY values must use CRI data when market is closed", () => {
  it("vixVal is gated on marketOpen before using live WS value", () => {
    // Must be: (marketOpen ? liveVix : null) ?? data?.vix
    // NOT: liveVix ?? data?.vix  (which ignores market status)
    expect(source).toMatch(/marketOpen.*liveVix|liveVix.*marketOpen/);
    // The vixVal assignment must NOT use bare `liveVix ??` without the gate
    const vixValLine = source.match(/const vixVal\s*=\s*.+/)?.[0] ?? "";
    expect(vixValLine).toMatch(/marketOpen/);
  });

  it("vvixVal is gated on marketOpen before using live WS value", () => {
    const vvixValLine = source.match(/const vvixVal\s*=\s*.+/)?.[0] ?? "";
    expect(vvixValLine).toMatch(/marketOpen/);
  });

  it("spyVal is gated on marketOpen before using live WS value", () => {
    const spyValLine = source.match(/const spyVal\s*=\s*.+/)?.[0] ?? "";
    expect(spyValLine).toMatch(/marketOpen/);
  });
});

describe("RegimePanel — VIX/VVIX timestamps must not update when market is closed", () => {
  it("vixLastTs effect is gated on marketOpen", () => {
    // useEffect for vixLastTs must check marketOpen before calling setVixLastTs
    // so that post-close WS ticks don't stamp a live timestamp.
    const vixEffect = source.match(
      /vixLastTs[\s\S]*?setVixLastTs[\s\S]*?(?=\}\s*,?\s*\[)/
    )?.[0] ?? "";
    expect(vixEffect).toMatch(/marketOpen/);
  });

  it("vvixLastTs effect is gated on marketOpen", () => {
    const vvixEffect = source.match(
      /vvixLastTs[\s\S]*?setVvixLastTs[\s\S]*?(?=\}\s*,?\s*\[)/
    )?.[0] ?? "";
    expect(vvixEffect).toMatch(/marketOpen/);
  });
});

describe("RegimePanel — liveCri must not recompute with live prices when market is closed", () => {
  it("liveCri useMemo returns null when market is closed", () => {
    // When !marketOpen, liveCri should be null so `cri` falls back to data?.cri
    // (the authoritative EOD values from cri_scan.py).
    const criMemo = source.match(
      /liveCri[\s\S]*?computeCri[\s\S]*?(?=\}\s*,?\s*\[)/
    )?.[0] ?? "";
    expect(criMemo).toMatch(/marketOpen/);
  });
});
