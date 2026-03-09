/**
 * CRI cache staleness logic — market-hours aware.
 *
 * Rule:
 *  - data.date !== today                        → always stale (new trading day)
 *  - market_open === false + date === today      → NOT stale (EOD data is final)
 *  - market_open === true  + mtime > TTL        → stale (intraday refresh)
 *  - market_open unknown   + date === today      → fall back to TTL check
 *
 * This prevents the API from continuously re-running cri_scan.py after market
 * close. The launchd CRI service (every 30 min, 4:05 AM–8 PM ET) handles
 * scheduled refreshes; the API only needs to refresh during market hours.
 */

const CACHE_TTL_MS = 60_000; // 1 minute — intraday refresh interval

export interface CriDataShape {
  date?: string;
  market_open?: boolean;
  [key: string]: unknown;
}

/**
 * @param data      - parsed CRI JSON (must have date and market_open fields)
 * @param mtimeMs   - file modification time in milliseconds (Date.now()-style)
 * @param todayET   - today's date in ET as YYYY-MM-DD (injected for testability)
 */
export function isCriDataStale(
  data: CriDataShape,
  mtimeMs: number,
  todayET: string
): boolean {
  // Different day → always stale
  if (!data.date || data.date !== todayET) return true;

  // Market closed + today's data → not stale (EOD values are final)
  if (data.market_open === false) return false;

  // Market open (or unknown) → stale if mtime exceeds TTL
  return Date.now() - mtimeMs > CACHE_TTL_MS;
}
