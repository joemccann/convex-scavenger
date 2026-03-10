/**
 * E2E: /regime page — market closed EOD values
 *
 * Verifies that when market_open=false:
 *  1. COR1M shows "DAILY" badge, NOT "INTRADAY"
 *  2. VIX value matches CRI data (not live WS)
 *  3. VVIX value matches CRI data (not live WS)
 *  4. COR1M value matches CRI data (not a sector ETF proxy)
 *  4. VIX timestamp shows "---" (no live update)
 *  5. VVIX timestamp shows "---" (no live update)
 *  6. MARKET CLOSED banner is visible
 */

import { test, expect } from "@playwright/test";

const CRI_MOCK_CLOSED = {
  scan_time: "2026-03-09T16:30:00",
  market_open: false,
  date: "2026-03-09",
  vix: 29.49,
  vvix: 121.27,
  spy: 677.69,
  vix_5d_roc: 18.9,
  vvix_vix_ratio: 4.11,
  realized_vol: 11.72,
  cor1m: 38.12,
  cor1m_5d_change: 1.0,
  spx_100d_ma: 682.05,
  spx_distance_pct: -0.64,
  spy_closes: Array.from({ length: 22 }, (_, i) => 660 + i),
  cri: { score: 24, level: "LOW", components: { vix: 6, vvix: 5, correlation: 7, momentum: 6 } },
  crash_trigger: {
    triggered: false,
    conditions: { spx_below_100d_ma: false, realized_vol_gt_25: false, cor1m_gt_60: false },
  },
  cta: { exposure_pct: 95, forced_reduction_pct: 0, est_selling_bn: 0 },
  menthorq_cta: null,
  history: [],
};

const PORTFOLIO_EMPTY = {
  bankroll: 100_000,
  positions: [],
  account_summary: {},
  exposure: {},
  violations: [],
};

const ORDERS_EMPTY = {
  last_sync: new Date().toISOString(),
  open_orders: [],
  executed_orders: [],
  open_count: 0,
  executed_count: 0,
};

async function setupMocks(page: import("@playwright/test").Page) {
  await page.unrouteAll({ behavior: "ignoreErrors" });

  await page.route("**/api/regime", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(CRI_MOCK_CLOSED),
    }),
  );
  await page.route("**/api/portfolio", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(PORTFOLIO_EMPTY),
    }),
  );
  await page.route("**/api/orders", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(ORDERS_EMPTY),
    }),
  );
  // Abort WS prices — simulates post-close where prices feed may still deliver
  // stale last-values; we must NOT use them when market_open=false
  await page.route("**/api/prices", (route) => route.abort());
  await page.route("**/api/ib-status", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ connected: false }),
    }),
  );
  await page.route("**/api/blotter", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ as_of: new Date().toISOString(), summary: { realized_pnl: 0 }, closed_trades: [], open_trades: [] }),
    }),
  );
  await page.route("**/api/menthorq/cta", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ tables: [] }),
    }),
  );
}

test.describe("Regime /regime — market closed EOD values", () => {
  test("MARKET CLOSED banner is visible", async ({ page }) => {
    await setupMocks(page);
    await page.goto("/regime");

    const banner = page.locator('[data-testid="market-closed-indicator"]');
    await banner.waitFor({ timeout: 10_000 });
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("MARKET CLOSED");
  });

  test("COR1M shows DAILY badge (not INTRADAY) when market closed", async ({ page }) => {
    await setupMocks(page);
    await page.goto("/regime");

    // Wait for regime strip to render
    await page.locator('[data-testid="strip-vix"]').waitFor({ timeout: 10_000 });

    // The COR1M cell badge text must be DAILY, not INTRADAY
    const corrCell = page.locator(".regime-strip-cell").filter({ hasText: "COR1M" });
    await expect(corrCell).toBeVisible();
    const badge = corrCell.locator(".regime-badge");
    await expect(badge).not.toHaveText("INTRADAY");
    await expect(badge).toHaveText("DAILY");
  });

  test("COR1M value shows CRI EOD data (38.12)", async ({ page }) => {
    await setupMocks(page);
    await page.goto("/regime");

    const corrCell = page.locator(".regime-strip-cell").filter({ hasText: "COR1M" });
    await corrCell.waitFor({ timeout: 10_000 });

    await expect(corrCell.locator(".regime-strip-value")).toHaveText("38.12");
  });

  test("VIX value shows CRI EOD data (29.49), not live WS", async ({ page }) => {
    await setupMocks(page);
    await page.goto("/regime");

    const vixCell = page.locator('[data-testid="strip-vix"]');
    await vixCell.waitFor({ timeout: 10_000 });

    // Should show the CRI EOD value 29.49
    await expect(vixCell.locator(".regime-strip-value")).toHaveText("29.49");
  });

  test("VVIX value shows CRI EOD data (121.27), not live WS", async ({ page }) => {
    await setupMocks(page);
    await page.goto("/regime");

    const vvixCell = page.locator('[data-testid="strip-vvix"]');
    await vvixCell.waitFor({ timeout: 10_000 });

    await expect(vvixCell.locator(".regime-strip-value")).toHaveText("121.27");
  });

  test("VIX timestamp shows '---' when market closed (no live updates)", async ({ page }) => {
    await setupMocks(page);
    await page.goto("/regime");

    const vixCell = page.locator('[data-testid="strip-vix"]');
    await vixCell.waitFor({ timeout: 10_000 });

    await expect(vixCell.locator(".regime-strip-ts")).toHaveText("---");
  });

  test("VVIX timestamp shows '---' when market closed (no live updates)", async ({ page }) => {
    await setupMocks(page);
    await page.goto("/regime");

    const vvixCell = page.locator('[data-testid="strip-vvix"]');
    await vvixCell.waitFor({ timeout: 10_000 });

    await expect(vvixCell.locator(".regime-strip-ts")).toHaveText("---");
  });
});
