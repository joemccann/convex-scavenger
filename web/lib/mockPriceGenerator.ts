import type { LivelinePoint } from "liveline";

/** Seed-able pseudo-random (mulberry32). Deterministic for tests. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Known base prices for portfolio tickers. Falls back to 100. */
const BASE_PRICES: Record<string, number> = {
  AAPL: 270, GOOG: 185, GOOGL: 185, AMZN: 225, MSFT: 450,
  META: 620, NVDA: 140, TSLA: 340, AMD: 175, SPY: 595,
  QQQ: 525, IWM: 220, AAOI: 35, ILF: 22, NET: 120,
  PLTR: 115, COIN: 260, MSTR: 370, UBER: 85, CRWD: 380,
};

export function getBasePrice(ticker: string): number {
  return BASE_PRICES[ticker.toUpperCase()] ?? 100;
}

/** Single random-walk step. Returns new price. */
export function nextMockPrice(
  current: number,
  rng: () => number = Math.random,
  volatility = 0.001,
): number {
  const change = (rng() - 0.5) * 2 * volatility * current;
  return Math.max(current * 0.9, Math.min(current * 1.1, current + change));
}

/**
 * Generate a mock price history for chart seeding.
 * Returns `count` points spaced `intervalSec` apart, ending at `now`.
 */
export function generateMockHistory(
  basePrice: number,
  count: number,
  intervalSec = 1,
  seed = 42,
): LivelinePoint[] {
  const rng = mulberry32(seed);
  const now = Date.now() / 1000;
  const points: LivelinePoint[] = [];
  let price = basePrice;

  for (let i = count - 1; i >= 0; i--) {
    price = nextMockPrice(price, rng, 0.0008);
    points.push({ time: now - i * intervalSec, value: price });
  }

  return points;
}
