import path from "path";
import { readFile, readdir } from "fs/promises";
import { test, expect } from "@playwright/test";

const DATA_DIR = path.join(process.cwd(), "..", "data");
const CACHE_PATH = path.join(DATA_DIR, "cri.json");
const SCHEDULED_DIR = path.join(DATA_DIR, "cri_scheduled");

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

async function readLatestCri(): Promise<Record<string, unknown>> {
  try {
    const files = await readdir(SCHEDULED_DIR);
    const jsonFiles = files.filter((file) => file.startsWith("cri-") && file.endsWith(".json")).sort();
    if (jsonFiles.length > 0) {
      const latest = path.join(SCHEDULED_DIR, jsonFiles[jsonFiles.length - 1]);
      return JSON.parse(await readFile(latest, "utf-8"));
    }
  } catch {
    // fall through to legacy cache
  }

  return JSON.parse(await readFile(CACHE_PATH, "utf-8"));
}

async function setupNonRegimeMocks(page: import("@playwright/test").Page) {
  await page.unrouteAll({ behavior: "ignoreErrors" });

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

test.describe("/regime page — live route COR1M cache", () => {
  test("renders the same COR1M value as the latest CRI cache file", async ({ page }) => {
    const cri = await readLatestCri();
    const cor1m = typeof cri.cor1m === "number" ? cri.cor1m : null;

    test.skip(cor1m == null, "Latest CRI cache does not contain a numeric COR1M value.");

    await setupNonRegimeMocks(page);
    await page.goto("/regime");

    const cor1mCell = page.locator('[data-testid="strip-cor1m"]');
    await cor1mCell.waitFor({ timeout: 10_000 });

    await expect(cor1mCell.locator(".regime-strip-value")).toHaveText(cor1m.toFixed(2));
  });
});
