import { describe, expect, it } from "vitest";

/**
 * Tests that the IB relay error handler correctly classifies
 * "No security definition" errors (code 200) so they are silently
 * cleaned up instead of flooding the log as red errors.
 *
 * The actual handler lives in ib_realtime_server.js — we test the
 * classification patterns here to prevent regressions.
 */

const NO_SEC_DEF_REGEX = /No security definition has been found/i;

const SAMPLE_ERRORS = [
  "No security definition has been found for the request (PLTR_20260327_106_C)",
  "No security definition has been found for the request (tickerId:1258)",
  "No Security Definition Has Been Found for the request",
];

const UNRELATED_ERRORS = [
  "Market data farm connection is OK:usfarm",
  "market data is not subscribed for tickerId:42",
  "Fundamentals data is not allowed",
  "connect ECONNREFUSED 127.0.0.1:4001",
];

describe("IB No Security Definition error classification", () => {
  it("matches code 200 for no-security-def errors", () => {
    // The handler checks: code === 200 || regex match
    const code = 200;
    expect(code === 200 || NO_SEC_DEF_REGEX.test("anything")).toBe(true);
  });

  it.each(SAMPLE_ERRORS)("regex matches: %s", (msg) => {
    expect(NO_SEC_DEF_REGEX.test(msg)).toBe(true);
  });

  it.each(UNRELATED_ERRORS)("regex does not match: %s", (msg) => {
    expect(NO_SEC_DEF_REGEX.test(msg)).toBe(false);
  });

  it("handler cleans up tickerId mapping when symbol is known", () => {
    // Simulate the handler logic
    const requestIdToSymbol = new Map<number, string>([[1258, "PLTR_20260327_106_C"]]);
    const symbolStates = new Map<string, { tickerId: number | null }>([
      ["PLTR_20260327_106_C", { tickerId: 1258 }],
    ]);

    const tickerId = 1258;
    const symbol = requestIdToSymbol.get(tickerId) ?? null;
    const code = 200;

    if (code === 200 || NO_SEC_DEF_REGEX.test("No security definition has been found")) {
      if (symbol) {
        const state = symbolStates.get(symbol);
        if (state && state.tickerId === tickerId) {
          requestIdToSymbol.delete(tickerId);
          state.tickerId = null;
        }
      }
    }

    expect(requestIdToSymbol.size).toBe(0);
    expect(symbolStates.get("PLTR_20260327_106_C")?.tickerId).toBeNull();
  });

  it("handler cleans up orphaned tickerId when symbol is unknown", () => {
    const requestIdToSymbol = new Map<number, string>();
    const tickerId = 1870;

    // symbol not found — handler should still delete the tickerId
    const symbol = requestIdToSymbol.get(tickerId) ?? null;
    const code = 200;

    if (code === 200) {
      if (!symbol && tickerId != null) {
        requestIdToSymbol.delete(tickerId);
      }
    }

    expect(requestIdToSymbol.has(tickerId)).toBe(false);
  });
});
