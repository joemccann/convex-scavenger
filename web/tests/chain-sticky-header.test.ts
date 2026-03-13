/**
 * Unit test: options chain sticky header requires:
 * 1. position: sticky + z-index on individual th cells
 * 2. position: relative + z-index on thead (stacking context above tbody)
 * 3. --bg-panel-raised defined (opaque background so content doesn't show through)
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const CSS_PATH = path.resolve(__dirname, "../app/globals.css");

describe("chain sticky header CSS", () => {
  const css = fs.readFileSync(CSS_PATH, "utf-8");

  it(".chain-header z-index >= 10", () => {
    const match = css.match(/\.chain-header\s*\{[^}]*z-index:\s*(\d+)/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBeGreaterThanOrEqual(10);
  });

  it(".chain-side-label z-index >= 10", () => {
    const match = css.match(/\.chain-side-label\s*\{[^}]*z-index:\s*(\d+)/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBeGreaterThanOrEqual(10);
  });

  it(".chain-header has position: sticky", () => {
    const match = css.match(/\.chain-header\s*\{[^}]*position:\s*(sticky)/);
    expect(match).not.toBeNull();
  });

  it(".chain-side-label has position: sticky", () => {
    const match = css.match(/\.chain-side-label\s*\{[^}]*position:\s*(sticky)/);
    expect(match).not.toBeNull();
  });

  it(".chain-grid thead has position: relative (stacking context)", () => {
    const match = css.match(
      /\.chain-grid\s+thead\s*\{[^}]*position:\s*(relative)/,
    );
    expect(match).not.toBeNull();
  });

  it(".chain-grid thead has z-index >= 10", () => {
    const match = css.match(
      /\.chain-grid\s+thead\s*\{[^}]*z-index:\s*(\d+)/,
    );
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBeGreaterThanOrEqual(10);
  });

  it("--bg-panel-raised is defined in dark theme", () => {
    const match = css.match(
      /\[data-theme="dark"\]\s*\{[^}]*--bg-panel-raised:\s*(#[0-9a-fA-F]+)/,
    );
    expect(match).not.toBeNull();
  });

  it("--bg-panel-raised is defined in light theme", () => {
    const match = css.match(
      /\[data-theme="light"\]\s*\{[^}]*--bg-panel-raised:\s*(#[0-9a-fA-F]+)/,
    );
    expect(match).not.toBeNull();
  });
});
