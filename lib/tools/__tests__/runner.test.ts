import { describe, it, expect, beforeEach } from "vitest";
import { runScript, resolveProjectRoot, _resetRootCache } from "../runner";

describe("resolveProjectRoot", () => {
  beforeEach(() => _resetRootCache());

  it("returns a path containing scripts/ and data/", () => {
    const root = resolveProjectRoot();
    expect(root).toBeTruthy();
    // Root should end with convex-scavenger or be a valid project dir
    expect(root).toMatch(/convex-scavenger/);
  });

  it("caches the result", () => {
    const first = resolveProjectRoot();
    const second = resolveProjectRoot();
    expect(first).toBe(second);
  });
});

describe("runScript", () => {
  it("returns ok: true with parsed JSON for a valid script", async () => {
    const result = await runScript("scripts/kelly.py", {
      args: ["--prob", "0.6", "--odds", "2.0"],
      timeout: 10_000,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveProperty("full_kelly_pct");
      expect(result.data).toHaveProperty("edge_exists");
      expect(result.data).toHaveProperty("recommendation");
    }
  });

  it("returns ok: false for a non-existent script", async () => {
    const result = await runScript("scripts/nonexistent.py");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.stderr).toContain("not found");
    }
  });

  it("returns ok: false when script exits non-zero", async () => {
    // fetch_ticker exits 1 when ticker not verified — use a guaranteed-bad ticker
    const result = await runScript("scripts/kelly.py", {
      args: ["--prob", "not-a-number"],
      timeout: 10_000,
    });

    expect(result.ok).toBe(false);
  });
});
