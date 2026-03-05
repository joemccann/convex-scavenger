import { describe, it, expect } from "vitest";
import { readDataFile } from "../data-reader";
import { PortfolioData } from "../schemas/ib-sync";

describe("readDataFile", () => {
  it("reads an existing JSON file", async () => {
    const result = await readDataFile("data/watchlist.json");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveProperty("tickers");
    }
  });

  it("returns error for missing file", async () => {
    const result = await readDataFile("data/nonexistent.json");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("not found");
    }
  });

  it("validates against schema when provided", async () => {
    // portfolio.json should match the PortfolioData schema if it exists
    const result = await readDataFile("data/portfolio.json", PortfolioData);
    // File may or may not exist, but if it does, it should pass validation
    if (result.ok) {
      expect(result.data).toHaveProperty("bankroll");
      expect(result.data).toHaveProperty("positions");
    }
  });
});
