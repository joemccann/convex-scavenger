/**
 * PI extension tool registration using shared schemas and wrappers.
 *
 * Usage in .pi/extensions/trading-tools.ts:
 *   import { registerTradingTools } from "../../lib/tools/pi-tools";
 *   export default function (pi: ExtensionAPI) { registerTradingTools(pi); }
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { kelly as kellyWrapper } from "./wrappers/kelly";
import { fetchTicker } from "./wrappers/fetch-ticker";
import { scanner as scannerWrapper } from "./wrappers/scanner";

export function registerTradingTools(pi: ExtensionAPI) {
  // Kelly calculator — uses the Python wrapper for full feature parity
  pi.registerTool({
    name: "kelly_calc",
    label: "Kelly Calculator",
    description: "Calculate fractional Kelly bet size given probability and odds",
    parameters: Type.Object({
      prob_win: Type.Number({ description: "Probability of winning (0-1)" }),
      odds: Type.Number({ description: "Win/loss ratio" }),
      fraction: Type.Optional(Type.Number({ description: "Kelly fraction, default 0.25" })),
      bankroll: Type.Optional(Type.Number({ description: "Current bankroll in dollars" })),
    }),
    async execute(_toolCallId: string, params: any) {
      try {
        const { prob_win, odds, fraction, bankroll } = params ?? {};
        const result = await kellyWrapper({
          prob: prob_win,
          odds,
          fraction,
          bankroll,
        });

        if (!result.ok) {
          return {
            content: [{ type: "text" as const, text: `Error: ${result.stderr}` }],
          };
        }

        return {
          content: [{ type: "text" as const, text: JSON.stringify(result.data, null, 2) }],
        };
      } catch (e: any) {
        return {
          content: [{ type: "text" as const, text: `Error: ${e?.message ?? String(e)}` }],
        };
      }
    },
  });

  // Ticker validation tool
  pi.registerTool({
    name: "validate_ticker",
    label: "Ticker Validator",
    description: "Validate a ticker symbol via dark pool activity",
    parameters: Type.Object({
      ticker: Type.String({ description: "Ticker symbol to validate" }),
    }),
    async execute(_toolCallId: string, params: any) {
      try {
        const result = await fetchTicker({ ticker: params.ticker });

        if (!result.ok) {
          return {
            content: [{ type: "text" as const, text: `Error: ${result.stderr}` }],
          };
        }

        return {
          content: [{ type: "text" as const, text: JSON.stringify(result.data, null, 2) }],
        };
      } catch (e: any) {
        return {
          content: [{ type: "text" as const, text: `Error: ${e?.message ?? String(e)}` }],
        };
      }
    },
  });

  // Watchlist scanner tool
  pi.registerTool({
    name: "scan_watchlist",
    label: "Watchlist Scanner",
    description: "Scan watchlist for dark pool flow signals",
    parameters: Type.Object({
      top: Type.Optional(Type.Number({ description: "Number of top signals (default 20)" })),
      min_score: Type.Optional(Type.Number({ description: "Minimum score threshold (default 0)" })),
    }),
    async execute(_toolCallId: string, params: any) {
      try {
        const result = await scannerWrapper({
          top: params?.top,
          minScore: params?.min_score,
        });

        if (!result.ok) {
          return {
            content: [{ type: "text" as const, text: `Error: ${result.stderr}` }],
          };
        }

        return {
          content: [{ type: "text" as const, text: JSON.stringify(result.data, null, 2) }],
        };
      } catch (e: any) {
        return {
          content: [{ type: "text" as const, text: `Error: ${e?.message ?? String(e)}` }],
        };
      }
    },
  });

  // Quick portfolio summary command
  pi.registerCommand("positions", {
    description: "Show current portfolio positions summary",
    handler: async (_args, _ctx) => {
      pi.sendUserMessage("/portfolio");
    },
  });

  // LEAP scanner presets command
  pi.registerCommand("leap-presets", {
    description: "List available LEAP IV scanner presets",
    handler: async (_args, _ctx) => {
      const presets = `Here are the available LEAP IV scanner presets:

| Preset | Description | Tickers |
|--------|-------------|---------|
| \`sectors\` | S&P 500 sector ETFs | XLB, XLC, XLE, XLF, XLI, XLK, XLP, XLRE, XLU, XLV, XLY |
| \`mag7\` | Magnificent 7 | AAPL, MSFT, GOOGL, AMZN, NVDA, META, TSLA |
| \`semis\` | Semiconductors | NVDA, AMD, INTC, AVGO, QCOM, MU, AMAT, LRCX, TSM |
| \`emerging\` | Emerging Markets | EEM, EWZ, EWY, EWT, INDA, FXI, EWW, ILF |
| \`china\` | China Stocks & ETFs | BABA, JD, PDD, BIDU, NIO, XPEV, LI, FXI, KWEB |

### Rest of World (Country ETFs)
| Preset | Description | Count |
|--------|-------------|-------|
| \`row\` | All country-specific ETFs | 45 |
| \`row-americas\` | Canada, Mexico, Brazil, Chile, Argentina | 5 |
| \`row-europe\` | UK, Germany, France, Italy, Spain, Nordic, etc. | 17 |
| \`row-asia\` | Japan, Korea, Taiwan, India, China, SE Asia | 15 |
| \`row-mena\` | Israel, South Africa, Saudi, UAE, Qatar | 5 |

### Commodities
| Preset | Description | Count |
|--------|-------------|-------|
| \`metals\` | Gold, Silver, Copper, Uranium + Miners | 23 |
| \`energy\` | Oil, Natural Gas, Refiners, MLPs, Clean Energy | 24 |

Usage: \`leap-scan --preset mag7\`, \`leap-scan --preset row\`, \`leap-scan --preset metals --min-gap 10\``;
      pi.sendUserMessage(presets);
    },
  });
}
