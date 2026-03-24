import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import CtaBriefing from "../components/CtaBriefing";

describe("CtaBriefing currency analysis", () => {
  it("surfaces currency narrative and tags when MenthorQ percentiles arrive as decimals", () => {
    const html = renderToStaticMarkup(
      React.createElement(CtaBriefing, {
        estSellingBn: 32,
        tables: {
          main: [
            {
              underlying: "E-Mini S&P 500 Index",
              position_today: -1.36,
              position_yesterday: -0.84,
              position_1m_ago: 0.72,
              percentile_1m: 0.05,
              percentile_3m: 0.02,
              percentile_1y: 0.05,
              z_score_3m: -3.2,
            },
          ],
          index: [],
          commodity: [],
          currency: [
            {
              underlying: "Euro",
              position_today: -0.3,
              position_yesterday: -0.34,
              position_1m_ago: 0.35,
              percentile_1m: 0.33,
              percentile_3m: 0.13,
              percentile_1y: 0.09,
              z_score_3m: -1.13,
            },
            {
              underlying: "Canadian Dollar",
              position_today: 1.36,
              position_yesterday: 1.2,
              position_1m_ago: 1.03,
              percentile_1m: 0.57,
              percentile_3m: 0.84,
              percentile_1y: 0.65,
              z_score_3m: 1.01,
            },
          ],
        },
      }),
    );

    expect(html).toContain("Euro at 13th pctile short while Canadian Dollar sits 84th pctile long.");
    expect(html).toContain("FX DISPERSION");
  });
});
