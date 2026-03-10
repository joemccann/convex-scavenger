import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

/**
 * Source-inspection tests confirming WorkspaceShell guarantees SPY is
 * subscribed to the IB real-time feed when the active section is "regime".
 *
 * These tests parse the component source rather than rendering it (no DOM
 * environment needed) and verify the structural logic is present.
 */

const TEST_DIR = fileURLToPath(new URL(".", import.meta.url));
const SHELL_PATH = join(TEST_DIR, "../components/WorkspaceShell.tsx");
const source = readFileSync(SHELL_PATH, "utf-8");

describe("WorkspaceShell — regime SPY subscription", () => {
  it("defines a regime-gated stocks memo that includes SPY", () => {
    // The memo must guard on activeSection === "regime"
    expect(source).toContain('activeSection === "regime"');
    // SPY must be in the regime stocks list
    expect(source).toContain('"SPY"');
  });

  it("includes regime stocks in the allSymbols memo", () => {
    // Verify allSymbols spreads the regime stock array
    expect(source).toContain("...regimeStocks");
  });

  it("passes allSymbols (which includes SPY for regime) to usePrices as symbols", () => {
    expect(source).toContain("symbols: allSymbols");
  });

  it("does NOT add SPY to regimeIndexes (SPY is a Stock, not an Index)", () => {
    // regimeIndexes must contain only CBOE indexes for the regime view.
    const regimeIndexesBlock = source.match(/regimeIndexes\s*=\s*useMemo[^;]+;/s)?.[0] ?? "";
    expect(regimeIndexesBlock).not.toContain("SPY");
    expect(regimeIndexesBlock).toContain("VIX");
    expect(regimeIndexesBlock).toContain("VVIX");
    expect(regimeIndexesBlock).toContain("COR1M");
  });
});
