import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SRC = fs.readFileSync(
  path.resolve(__dirname, "../components/ticker-detail/OptionsChainTab.tsx"),
  "utf-8",
);

describe("Combo order leg ratio", () => {
  it("sets ratio to 1 for each leg, not leg.quantity", () => {
    // IB combo legs must have ratio: 1 for vertical spreads.
    // The overall position size is controlled by the top-level `quantity` field.
    // Using leg.quantity as ratio causes IB error 321 "Invalid leg ratio".
    expect(SRC).toContain("ratio: 1,");
    expect(SRC).not.toContain("ratio: l.quantity");
  });

  it("passes totalQty as the top-level order quantity", () => {
    // The top-level quantity field controls how many spreads to trade
    expect(SRC).toContain("quantity: totalQty,");
  });
});
