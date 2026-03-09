import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Source-inspection tests confirming RegimePanel correctly gates live
 * data behind `market_open` — when the market is closed the component
 * must fall back to static EOD CRI values and hide all LIVE badges.
 *
 * Tests parse component source (no DOM environment needed).
 */

const PANEL_PATH = join(__dirname, "../components/RegimePanel.tsx");
const source = readFileSync(PANEL_PATH, "utf-8");

describe("RegimePanel — market closed static fallback", () => {
  it("reads market_open from CriData via useRegime()", () => {
    // The component must destructure market_open (or data.market_open) from
    // the hook return value so it can gate live vs static behaviour.
    expect(source).toMatch(/market_open/);
  });

  it("disables intraday realized vol computation when market is closed", () => {
    // intradayRvol must return null when market_open === false.
    // The useMemo for intradayRvol must early-return null when !marketOpen
    // (or equivalent guard on the market_open flag).
    expect(source).toMatch(/marketOpen|market_open/);
    // The intradayRvol memo must reference the market open gate.
    const rvolMemo = source.match(/intradayRvol\s*=\s*useMemo[\s\S]*?(?=\n\s*const\s|\n\s*\/\/)/)?.[0] ?? "";
    expect(rvolMemo).toMatch(/marketOpen|market_open/);
  });

  it("shows MARKET CLOSED indicator text when market is closed", () => {
    // The panel must render an end-of-day marker when !marketOpen.
    expect(source).toMatch(/MARKET CLOSED/i);
  });

  it("hides LIVE badge on VIX strip cell when market is closed", () => {
    // The VIX strip LiveBadge must be suppressed when market is closed.
    // Either the badge receives live={false} unconditionally, or it is
    // wrapped in a conditional that checks marketOpen.
    //
    // Simplest verifiable contract: the strip-vix cell's LiveBadge live prop
    // must evaluate to false (not just liveVix != null) when market is closed.
    // We verify this by checking that marketOpen gates the live prop for VIX/VVIX.
    expect(source).toMatch(/marketOpen.*liveVix|liveVix.*marketOpen|marketOpen && liveVix|marketOpen \? liveVix/);
  });

  it("hides LIVE badge on VVIX strip cell when market is closed", () => {
    expect(source).toMatch(/marketOpen.*liveVvix|liveVvix.*marketOpen|marketOpen && liveVvix|marketOpen \? liveVvix/);
  });

  it("uses static data.realized_vol when market is closed (activeRvol fallback)", () => {
    // When marketOpen is false, intradayRvol is null so activeRvol falls
    // through to data?.realized_vol.  The existing fallback line handles this
    // automatically — we just need to confirm it still exists.
    expect(source).toContain("data?.realized_vol");
    expect(source).toContain("intradayRvol ??");
  });

  it("EOD indicator uses amber styling (warning color)", () => {
    // The MARKET CLOSED badge must use warning/amber colour signalling,
    // consistent with the design system.
    expect(source).toMatch(/warning|amber|#f59e0b/i);
  });
});
