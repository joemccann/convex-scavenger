#!/usr/bin/env node
/**
 * Red/Green tests for daily change % bug:
 *   getDailyChange should only return a value for Stock positions.
 *   For options/spreads, the WS streams the underlying stock price,
 *   so showing the stock's daily change for a bear spread is misleading.
 *
 * Run: node scripts/test_daily_change.mjs
 */

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ❌ FAIL: ${name}`);
    console.log(`          ${e.message}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

// ============================================================================
// Mirror of getDailyChange from WorkspaceSections.tsx
// ============================================================================

function getDailyChange(realtimePrice) {
  if (!realtimePrice) return null;
  const { last, close } = realtimePrice;
  if (last == null || close == null || close === 0) return null;
  return ((last - close) / close) * 100;
}

/**
 * Mirror of the daily change logic in PositionRow.
 * Takes a position and optional realtimePrice, returns dailyChg or null.
 */
function getPositionDailyChange(pos, realtimePrice) {
  const isStock = pos.structure_type === "Stock";
  // FIX: only show underlying daily change for stock positions
  return isStock ? getDailyChange(realtimePrice) : null;
}

// ============================================================================
// Test data
// ============================================================================

const stockPosition = {
  id: 1,
  ticker: "AAPL",
  structure: "Stock",
  structure_type: "Stock",
  risk_profile: "equity",
  contracts: 100,
  direction: "LONG",
};

const bearPutSpread = {
  id: 2,
  ticker: "EWY",
  structure: "Bear Put Spread",
  structure_type: "Bear Put Spread",
  risk_profile: "defined",
  contracts: 200,
  direction: "BEARISH",
};

const bullCallSpread = {
  id: 3,
  ticker: "SPY",
  structure: "Bull Call Spread",
  structure_type: "Bull Call Spread",
  risk_profile: "defined",
  contracts: 10,
  direction: "BULLISH",
};

const nakedPut = {
  id: 4,
  ticker: "TSLA",
  structure: "Short Put",
  structure_type: "Short Put",
  risk_profile: "undefined",
  contracts: 5,
  direction: "BULLISH",
};

const mockPrice = {
  symbol: "EWY",
  last: 49.22,
  close: 55.14,
  bid: 49.20,
  ask: 49.25,
  volume: 1200000,
  timestamp: new Date().toISOString(),
};

const mockPriceUp = {
  symbol: "AAPL",
  last: 155.0,
  close: 150.0,
  bid: 154.95,
  ask: 155.05,
  volume: 5000000,
  timestamp: new Date().toISOString(),
};

// ============================================================================
// Tests — stock positions SHOULD show daily change
// ============================================================================

console.log("\n── Stock positions: daily change should display ──");

test("stock position with price data returns daily change %", () => {
  const chg = getPositionDailyChange(stockPosition, mockPriceUp);
  assert(chg != null, "daily change should not be null for stock");
  const expected = ((155.0 - 150.0) / 150.0) * 100;
  assert(
    Math.abs(chg - expected) < 0.001,
    `expected ~${expected.toFixed(4)}, got ${chg.toFixed(4)}`
  );
});

test("stock position with no price data returns null", () => {
  const chg = getPositionDailyChange(stockPosition, null);
  assert(chg === null, `expected null, got ${chg}`);
});

test("stock position with missing close returns null", () => {
  const chg = getPositionDailyChange(stockPosition, {
    ...mockPriceUp,
    close: null,
  });
  assert(chg === null, `expected null, got ${chg}`);
});

// ============================================================================
// Tests — options/spread positions should NOT show underlying daily change
// ============================================================================

console.log("\n── Options/spread positions: daily change should be null ──");

test("bear put spread should NOT show underlying stock daily change", () => {
  const chg = getPositionDailyChange(bearPutSpread, mockPrice);
  assert(
    chg === null,
    `expected null for bear put spread, got ${chg?.toFixed(2)}% (underlying stock change)`
  );
});

test("bull call spread should NOT show underlying stock daily change", () => {
  const chg = getPositionDailyChange(bullCallSpread, mockPriceUp);
  assert(
    chg === null,
    `expected null for bull call spread, got ${chg?.toFixed(2)}%`
  );
});

test("naked put should NOT show underlying stock daily change", () => {
  const chg = getPositionDailyChange(nakedPut, mockPriceUp);
  assert(
    chg === null,
    `expected null for naked put, got ${chg?.toFixed(2)}%`
  );
});

test("options position with no price data returns null", () => {
  const chg = getPositionDailyChange(bearPutSpread, null);
  assert(chg === null, `expected null, got ${chg}`);
});

// ============================================================================
// Tests — getDailyChange pure function still works correctly
// ============================================================================

console.log("\n── getDailyChange pure function ──");

test("positive daily change calculated correctly", () => {
  const chg = getDailyChange({ last: 110, close: 100 });
  assert(Math.abs(chg - 10.0) < 0.001, `expected 10.0, got ${chg}`);
});

test("negative daily change calculated correctly", () => {
  const chg = getDailyChange({ last: 90, close: 100 });
  assert(Math.abs(chg - -10.0) < 0.001, `expected -10.0, got ${chg}`);
});

test("null price returns null", () => {
  assert(getDailyChange(null) === null, "should return null");
});

test("zero close returns null (avoid division by zero)", () => {
  assert(getDailyChange({ last: 50, close: 0 }) === null, "should return null");
});

// ============================================================================
// Summary
// ============================================================================
console.log(`\n── Results: ${passed} passed, ${failed} failed ──\n`);
process.exit(failed > 0 ? 1 : 0);
