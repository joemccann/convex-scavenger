/**
 * @vitest-environment jsdom
 */

import React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import VcgPanel from "../components/VcgPanel";

const mockUseVcg = vi.fn();

vi.mock("@/lib/useVcg", () => ({
  useVcg: (...args: unknown[]) => mockUseVcg(...args),
}));

describe("VcgPanel EDR badge", () => {
  it("styles the EDR chip with the warning design token", () => {
    mockUseVcg.mockReturnValue({
      data: {
        scan_time: "2026-03-24T06:42:00Z",
        market_open: true,
        credit_proxy: "HYG",
        signal: {
          vcg: 3.15,
          vcg_adj: 3.15,
          residual: 0.006132,
          beta1_vvix: -0.013941,
          beta2_vix: -0.023025,
          alpha: 0,
          vix: 26.15,
          vvix: 122.82,
          credit_price: 79.44,
          credit_5d_return_pct: -0.01,
          ro: 0,
          edr: 1,
          tier: 3,
          bounce: 0,
          vvix_severity: "extreme",
          sign_ok: true,
          sign_suppressed: false,
          pi_panic: 0,
          regime: "DIVERGENCE",
          interpretation: "EDR",
          attribution: {
            vvix_pct: 41,
            vix_pct: 59,
            vvix_component: 0,
            vix_component: 0,
            model_implied: 0,
          },
        },
        history: [],
      },
      loading: false,
      error: null,
      lastSync: "2026-03-24T06:42:00Z",
    });

    const { container } = render(React.createElement(VcgPanel, { prices: {} }));

    const edrBadge = Array.from(container.querySelectorAll(".section-header .pill"))
      .find((node) => node.textContent?.trim() === "EDR");
    expect(edrBadge).toBeTruthy();
    expect(edrBadge.getAttribute("style")).toContain("var(--warning)");
  });
});
