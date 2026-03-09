/**
 * Unit tests: RegimePanel market-closed value gating
 *
 * Bug: After market close, RegimePanel continued to:
 *  1. Show INTRADAY badge on SECTOR CORR (intradayCorr not gated on marketOpen)
 *  2. Show live WS values for VIX/VVIX (vixVal/vvixVal ignored marketOpen flag)
 *  3. Show timestamps on VIX/VVIX strip (timestamp effect not gated on marketOpen)
 *
 * All three require `marketOpen` gating — verified here via source inspection.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const PANEL_PATH = join(__dirname, "../components/RegimePanel.tsx");
const source = readFileSync(PANEL_PATH, "utf-8");

describe("RegimePanel — intradayCorr must be gated on marketOpen", () => {
  it("intradayCorr useMemo early-returns null when market is closed", () => {
    // The intradayCorr memo must check !marketOpen before calling
    // computeIntradaySectorCorr(). Without this gate, accumulated WS snapshots
    // produce a stale INTRADAY badge after close.
    const corrMemo = source.match(
      /intradayCorr\s*=\s*useMemo[\s\S]*?(?=\n\s*const\s|\n\s*\/\/)/
    )?.[0] ?? "";
    expect(corrMemo).toMatch(/marketOpen/);
  });

  it("snapshot buffer stops accumulating when market is closed", () => {
    // appendSnapshot should only run when marketOpen is true so the
    // buffer doesn't keep growing with stale post-close ticks.
    const snapEffect = source.match(
      /appendSnapshot[\s\S]*?(?=\}\s*,\s*\[)/
    )?.[0] ?? "";
    expect(snapEffect).toMatch(/marketOpen/);
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
