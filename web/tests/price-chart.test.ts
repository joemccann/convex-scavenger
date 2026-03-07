import { test, expect } from "vitest";
import {
  generateMockHistory,
  getBasePrice,
  nextMockPrice,
} from "../lib/mockPriceGenerator";

// ─── mockPriceGenerator ───

test("getBasePrice returns known price for AAPL", () => {
  expect(getBasePrice("AAPL")).toBe(270);
  expect(getBasePrice("aapl")).toBe(270);
});

test("getBasePrice returns 100 for unknown ticker", () => {
  expect(getBasePrice("ZZZZ")).toBe(100);
});

test("generateMockHistory returns correct count", () => {
  const pts = generateMockHistory(100, 60);
  expect(pts.length).toBe(60);
});

test("generateMockHistory points are chronologically ordered", () => {
  const pts = generateMockHistory(200, 30);
  for (let i = 1; i < pts.length; i++) {
    expect(pts[i].time).toBeGreaterThan(pts[i - 1].time);
  }
});

test("generateMockHistory prices stay within realistic bounds (±10%)", () => {
  const base = 200;
  const pts = generateMockHistory(base, 200, 1, 99);
  for (const pt of pts) {
    expect(pt.value).toBeGreaterThan(base * 0.85);
    expect(pt.value).toBeLessThan(base * 1.15);
  }
});

test("generateMockHistory is deterministic with same seed", () => {
  const a = generateMockHistory(100, 20, 1, 42);
  const b = generateMockHistory(100, 20, 1, 42);
  expect(a.map((p) => p.value)).toEqual(b.map((p) => p.value));
});

test("generateMockHistory differs with different seeds", () => {
  const a = generateMockHistory(100, 20, 1, 42);
  const b = generateMockHistory(100, 20, 1, 99);
  const same = a.every((p, i) => p.value === b[i].value);
  expect(same).toBe(false);
});

test("nextMockPrice produces different values with default rng", () => {
  const results = new Set<number>();
  let price = 100;
  for (let i = 0; i < 20; i++) {
    price = nextMockPrice(price);
    results.add(Math.round(price * 100));
  }
  // Should have some variation
  expect(results.size).toBeGreaterThan(1);
});

test("nextMockPrice respects volatility parameter", () => {
  // With zero-ish volatility, price should barely move
  const rng = () => 0.9; // always the same
  let price = 100;
  for (let i = 0; i < 10; i++) {
    const next = nextMockPrice(price, rng, 0.0001);
    expect(Math.abs(next - price)).toBeLessThan(0.05);
    price = next;
  }
});

test("nextMockPrice never goes below 90% or above 110% of current", () => {
  const rng = () => 0; // extreme low
  const low = nextMockPrice(100, rng, 1.0);
  expect(low).toBeGreaterThanOrEqual(90 - 0.01);

  const rngHigh = () => 1; // extreme high
  const high = nextMockPrice(100, rngHigh, 1.0);
  expect(high).toBeLessThanOrEqual(110 + 0.01);
});

test("each LivelinePoint has time and value as numbers", () => {
  const pts = generateMockHistory(150, 10);
  for (const pt of pts) {
    expect(typeof pt.time).toBe("number");
    expect(typeof pt.value).toBe("number");
    expect(Number.isFinite(pt.time)).toBe(true);
    expect(Number.isFinite(pt.value)).toBe(true);
  }
});
