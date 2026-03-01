import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PassThrough } from "node:stream";
import fs from "node:fs";
import { EventEmitter } from "node:events";
import { buildMessageId, getAvailableCommands, pickCommandName, runCommandFromMessage, tokenizeCommand } from "@/lib/pi-shell";
import * as childProcess from "node:child_process";

interface SpawnResult {
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  error?: string | Error;
}

const spawnQueue: SpawnResult[] = [];
const spawnCalls: Array<{ command: string; args: string[] }> = [];
const writeCaptures: Array<{ path: string; data: string }> = [];
const fileFixture = new Map<string, string>();

function queueSpawnResult(result: SpawnResult): void {
  spawnQueue.push(result);
}

function setFileFixture(pathSuffix: string, payload: unknown): void {
  fileFixture.set(pathSuffix, JSON.stringify(payload));
}

function setDefaultFixtures(): void {
  setFileFixture("watchlist.json", {
    last_updated: "2026-02-28",
    tickers: [
      {
        ticker: "MSFT",
        sector: "Technology",
        notes: "Current watch",
      },
      {
        ticker: "AAPL",
        sector: "Technology",
      },
    ],
  });

  setFileFixture("portfolio.json", {
    bankroll: 100000,
    peak_value: 100000,
    positions: [],
    total_deployed_pct: 0,
    total_deployed_dollars: 0,
    remaining_capacity_pct: 100,
    max_positions: 6,
    avg_kelly_optimal: 12,
  });

  setFileFixture("trade_log.json", {
    trades: [
      {
        id: 1,
        date: "2026-02-28",
        time: "11:00:00",
        ticker: "AAPL",
        decision: "NO_TRADE",
        notes: "Not a signal",
      },
      {
        id: 2,
        date: "2026-02-28",
        time: "12:00:00",
        ticker: "MSFT",
        decision: "NO_TRADE",
        notes: "Liquidity too low",
      },
    ],
  });
}

function attachFileSpies(): void {
  vi.spyOn(fs.promises, "readFile").mockImplementation(async (pathLike) => {
    const path = String(pathLike);
    for (const [suffix, payload] of fileFixture) {
      if (path.endsWith(suffix)) {
        return payload;
      }
    }

    throw new Error(`No mock data for ${path}`);
  });

  vi.spyOn(fs.promises, "writeFile").mockImplementation(async (pathLike, data) => {
    writeCaptures.push({ path: String(pathLike), data: String(data) });
  });
}

  vi.mock("node:child_process", () => {
  const spawn = vi.fn((command: string, args: string[]) => {
    spawnCalls.push({ command, args });
    const result = spawnQueue.shift() ?? {
      exitCode: 0,
      stdout: "{\"ok\":true}",
    };

    const stdout = new PassThrough();
    const stderr = new PassThrough();
    const emitter = new EventEmitter();

    setImmediate(() => {
      if (result.error) {
        emitter.emit("error", result.error instanceof Error ? result.error : new Error(result.error));
        return;
      }

      if (result.stdout) {
        stdout.push(result.stdout);
      }

      if (result.stderr) {
        stderr.push(result.stderr);
      }

      stdout.push(null);
      stderr.push(null);
      emitter.emit("close", result.exitCode);
    });

    const process = {
      stdout,
      stderr,
      on: (eventName: string, handler: (...args: unknown[]) => void) => {
        emitter.on(eventName, handler as (..._args: unknown[]) => void);
        return process as unknown as ReturnType<typeof childProcess.spawn>;
      },
    };

    return process as unknown as childProcess.ChildProcess;
  });

  return {
    spawn,
    default: {
      spawn,
    },
  };
});

function normalizeWatchlistTickers(response: string): string[] {
  const parsed = JSON.parse(response);
  return parsed.tickers.map((entry: { ticker: string }) => entry.ticker);
}

beforeEach(() => {
  spawnCalls.length = 0;
  spawnQueue.length = 0;
  writeCaptures.length = 0;
  fileFixture.clear();
  setDefaultFixtures();

  attachFileSpies();
  vi.mocked(childProcess.spawn).mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("runCommandFromMessage", () => {
  it("returns the help payload for /help", async () => {
    const response = await runCommandFromMessage("/help");

    expect(response.status).toBe("ok");
    expect(response.command).toBe("help");
    expect(response.summary).toContain("/scan");
  });

  it("runs scan with explicit flags", async () => {
    queueSpawnResult({
      exitCode: 0,
      stdout: JSON.stringify({
        tickers_scanned: 12,
        signals_found: 1,
        top_signals: [
          {
            ticker: "AAPL",
            signal: "STRONG",
            direction: "ACCUMULATION",
            score: 85,
          },
        ],
      }),
    });

    const response = await runCommandFromMessage("/scan --top 12 --min-score 0.9");

    expect(response.status).toBe("ok");
    expect(response.command).toBe("scan");
    expect(response.summary).toContain("Scanned 12 tickers.");

    const [call] = spawnCalls;
    expect(call.args).toContain("--top");
    expect(call.args).toContain("12");
    expect(call.args).toContain("--min-score");
    expect(call.args).toContain("0.9");
  });

  it("falls back to defaults when flags are invalid", async () => {
    queueSpawnResult({
      exitCode: 0,
      stdout: JSON.stringify({ tickers_scanned: 3, signals_found: 0, top_signals: [] }),
    });

    const response = await runCommandFromMessage("/scan --top nope --min-score bad");

    expect(response.status).toBe("ok");
    expect(response.title).toBe("Scan complete");
  });

  it("returns greeting payload for chat greeting phrases", async () => {
    const response = await runCommandFromMessage("hi there, what can you do?");

    expect(response.status).toBe("ok");
    expect(response.command).toBe("help");
    expect(response.title).toBe("Hello");
  });

  it("returns empty-input guidance", async () => {
    const response = await runCommandFromMessage("   ");

    expect(response.status).toBe("error");
    expect(response.title).toBe("Empty input");
  });

  it("routes generic messages to default chat guidance", async () => {
    const response = await runCommandFromMessage("Tell me what you can do");

    expect(response.status).toBe("ok");
    expect(response.command).toBe("chat");
    expect(response.title).toBe("How can I help?");
  });

  it("handles tokenless quoted input through chat fallback", async () => {
    const response = await runCommandFromMessage('""');

    expect(response.status).toBe("ok");
    expect(response.command).toBe("chat");
    expect(response.title).toBe("How can I help?");
  });

  it("maps natural-language scan phrasing to scan command", async () => {
    queueSpawnResult({
      exitCode: 0,
      stdout: JSON.stringify({
        tickers_scanned: 2,
        signals_found: 1,
        top_signals: [
          {
            ticker: "AAPL",
            score: 88,
          },
        ],
      }),
    });

    const response = await runCommandFromMessage("can we run a scan now");

    expect(response.status).toBe("ok");
    expect(response.command).toBe("scan");
    expect(response.summary).toContain("Scanned 2 tickers.");
  });

  it("maps discover phrasing to discover command", async () => {
    queueSpawnResult({
      exitCode: 0,
      stdout: JSON.stringify({
        alerts_analyzed: 0,
        candidates: [],
      }),
    });

    const response = await runCommandFromMessage("please discover opportunities");

    expect(response.status).toBe("ok");
    expect(response.command).toBe("discover");
    expect(response.summary).toContain("Alerts analyzed:");
  });

  it("maps journal phrasing to journal command", async () => {
    const response = await runCommandFromMessage("show me the log trade entries");

    expect(response.status).toBe("ok");
    expect(response.command).toBe("journal");
    expect(response.summary).toContain("MSFT");
  });

  it("reports watchlist unknown actions", async () => {
    const response = await runCommandFromMessage("/watchlist foo");

    expect(response.status).toBe("error");
    expect(response.title).toBe("Unknown watchlist action");
  });

  it("returns execution failure when spawn errors", async () => {
    queueSpawnResult({
      error: "runtime failure",
    });

    const response = await runCommandFromMessage("/scan");

    expect(response.status).toBe("error");
    expect(response.title).toBe("Command execution failed");
  });

  it("returns a parse error when scan output is not JSON", async () => {
    queueSpawnResult({ exitCode: 0, stdout: "not-json" });

    const response = await runCommandFromMessage("/scan --top 1");

    expect(response.status).toBe("error");
    expect(response.title).toBe("Scan parse failed");
  });

  it("handles blank scan payload as parse failure", async () => {
    queueSpawnResult({ exitCode: 0, stdout: "" });

    const response = await runCommandFromMessage("/scan --top 4");

    expect(response.status).toBe("error");
    expect(response.title).toBe("Scan parse failed");
    expect(response.rawCommandOutput).toContain("");
  });

  it("uses default scan values when scan output is sparse", async () => {
    queueSpawnResult({ exitCode: 0, stdout: JSON.stringify({}) });

    const response = await runCommandFromMessage("/scan");

    expect(response.summary).toBe("Scanned 0 tickers.\nSignals found: 0.");
  });

  it("maps scan output with malformed top_signals value", async () => {
    queueSpawnResult({
      exitCode: 0,
      stdout: JSON.stringify({
        tickers_scanned: 2,
        signals_found: 1,
        top_signals: { not: "array" },
      }),
    });

    const response = await runCommandFromMessage("/scan");

    expect(response.status).toBe("ok");
    expect(response.summary).toContain("Scanned 2 tickers.");
    expect(response.summary).toContain("Signals found: 1.");
    expect(response.summary).toBe("Scanned 2 tickers.\nSignals found: 1.");
  });

  it("maps scan output without optional signal fields", async () => {
    queueSpawnResult({
      exitCode: 0,
      stdout: JSON.stringify({
        tickers_scanned: 1,
        signals_found: 1,
        top_signals: [{ ticker: "GOOGL" }],
      }),
    });

    const response = await runCommandFromMessage("/scan");

    expect(response.status).toBe("ok");
    expect(response.summary).toContain("1. GOOGL | UNKNOWN | score n/a | ");
  });

  it("routes command from natural language includes evaluate keyword", async () => {
    const response = await runCommandFromMessage("please evaluate");

    expect(response.command).toBe("evaluate");
    expect(response.status).toBe("error");
    expect(response.title).toBe("Evaluate requires a ticker");
    expect(response.summary).toContain("Usage: /evaluate TICKER");
  });

  it("supports evaluating from platform override path", async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "win32" });

    try {
      queueSpawnResult({
        exitCode: 1,
        stdout: JSON.stringify({}),
        stderr: "failed",
      });
      queueSpawnResult({
        exitCode: 0,
        stdout: JSON.stringify({}),
      });
      queueSpawnResult({
        exitCode: 0,
        stdout: JSON.stringify({}),
      });

      const response = await runCommandFromMessage("/evaluate AAPL");

      expect(response.status).toBe("error");
      expect(response.summary).toContain("Unable to verify ticker or fetch flow data.");
      expect(response.rawCommandOutput).toContain("failed");
      expect(spawnCalls[0].command).toBe("python");
    } finally {
      Object.defineProperty(process, "platform", { value: originalPlatform });
    }
  });

  it("returns scan execution failure when script exits non-zero", async () => {
    queueSpawnResult({
      stdout: "temporary failure",
      stderr: "bad exit",
    });

    const response = await runCommandFromMessage("/scan --top 1");

    expect(response.status).toBe("error");
    expect(response.title).toBe("Scan failed");
    expect(response.rawCommandOutput).toContain("bad exit");
  });

  it("uses stdout as command output when stderr is missing", async () => {
    queueSpawnResult({
      exitCode: 1,
      stdout: "scan script failed hard",
    });

    const response = await runCommandFromMessage("/scan --top 1");

    expect(response.status).toBe("error");
    expect(response.title).toBe("Scan failed");
    expect(response.rawCommandOutput).toBe("scan script failed hard");
  });

  it("falls back for discover when output is malformed", async () => {
    queueSpawnResult({ exitCode: 0, stdout: "broken output" });

    const response = await runCommandFromMessage("/discover");

    expect(response.status).toBe("error");
    expect(response.title).toBe("Discover failed");
  });

  it("handles sparse discover rows and fallback candidate metadata", async () => {
    queueSpawnResult({
      exitCode: 0,
      stdout: JSON.stringify({
        alerts_analyzed: 1,
        candidates: [
          {
            ticker: "MSFT",
          },
        ],
      }),
    });

    const response = await runCommandFromMessage("/discover");

    expect(response.status).toBe("ok");
    expect(response.summary).toContain("1. MSFT | unknown/unknown | score n/a | sustained 0d");
  });

  it("runs discover and passes dp-days once", async () => {
    queueSpawnResult({
      exitCode: 0,
      stdout: JSON.stringify({
        alerts_analyzed: 2,
        candidates: [
          {
            ticker: "AAPL",
            dp_direction: "ACCUMULATION",
            options_bias: "BULLISH",
            score: 64,
            dp_sustained_days: 2,
          },
        ],
      }),
    });

    const response = await runCommandFromMessage("/discover --min-premium 250000 --min-alerts 2 --dp-days 7");

    expect(response.status).toBe("ok");
    expect(response.command).toBe("discover");

    const discoverArgs = spawnCalls[0].args;
    const dpDaysFlags = discoverArgs.filter((value) => value === "--dp-days").length;
    expect(dpDaysFlags).toBe(1);
    expect(discoverArgs).toContain("7");
  });

  it("supports discover with missing optional flag values", async () => {
    queueSpawnResult({
      exitCode: 0,
      stdout: JSON.stringify({
        alerts_analyzed: 0,
        candidates: [],
      }),
    });

    const response = await runCommandFromMessage("/discover --min-premium");

    expect(response.status).toBe("ok");
    expect(response.command).toBe("discover");

    const [call] = spawnCalls;
    expect(call.args).toContain("--min-premium");
    expect(call.args).toContain("500000");
  });

  it("falls back to discover from natural language", async () => {
    queueSpawnResult({
      exitCode: 0,
      stdout: JSON.stringify({
        alerts_analyzed: 1,
        candidates: [],
      }),
    });

    const response = await runCommandFromMessage("please discover opportunities from today");

    expect(response.status).toBe("ok");
    expect(response.command).toBe("discover");
  });

  it("handles discover payloads with missing alerts and malformed candidate lists", async () => {
    queueSpawnResult({
      exitCode: 0,
      stdout: JSON.stringify({}),
    });

    const response = await runCommandFromMessage("/discover");

    expect(response.status).toBe("ok");
    expect(response.summary).toContain("Alerts analyzed: 0.");
    expect(response.summary).toContain("Candidates returned: 0.");
  });

  it("requires a valid ticker for evaluate", async () => {
    const response = await runCommandFromMessage("/evaluate");

    expect(response.status).toBe("error");
    expect(response.title).toBe("Evaluate requires a ticker");
  });

  it("evaluates with edge and convexity warning signals", async () => {
    queueSpawnResult({
      exitCode: 0,
      stdout: JSON.stringify({
        verified: true,
        company_name: "Gamma Labs",
      }),
    });
    queueSpawnResult({
      exitCode: 0,
      stdout: JSON.stringify({
        dark_pool: {
          aggregate: {
            flow_direction: "DISTRIBUTION",
            flow_strength: 18.4,
          },
        },
        combined_signal: "UNCLEAR",
      }),
    });
    queueSpawnResult({
      exitCode: 0,
      stdout: JSON.stringify({}),
    });

    const response = await runCommandFromMessage("/evaluate NFLX");

    expect(response.status).toBe("ok");
    expect(response.tone).toBe("info");
    expect(response.summary).toContain("Gate results: edge=FAIL, convexity=WARN (stub)");
  });

  it("reports verification failure with generic message", async () => {
    queueSpawnResult({
      exitCode: 0,
      stdout: JSON.stringify({
        verified: false,
      }),
    });
    queueSpawnResult({
      exitCode: 0,
      stdout: JSON.stringify({
        dark_pool: {},
      }),
    });
    queueSpawnResult({
      exitCode: 0,
      stdout: JSON.stringify({}),
    });

    const response = await runCommandFromMessage("/evaluate RISK");

    expect(response.status).toBe("error");
    expect(response.summary).toContain("UNVERIFIED");
    expect(response.summary).toContain("Next step:");
  });

  it("uses validation error text when provided", async () => {
    queueSpawnResult({
      exitCode: 0,
      stdout: JSON.stringify({
        verified: false,
        error: "Invalid ticker symbol",
      }),
    });
    queueSpawnResult({
      exitCode: 0,
      stdout: JSON.stringify({
        dark_pool: {},
      }),
    });
    queueSpawnResult({
      exitCode: 0,
      stdout: JSON.stringify({}),
    });

    const response = await runCommandFromMessage("/evaluate BAD");

    expect(response.status).toBe("error");
    expect(response.summary).toContain("Invalid ticker symbol");
    expect(response.summary).toContain("Validation: UNVERIFIED");
  });

  it("uses generic validation summary when validation exits with no error message", async () => {
    queueSpawnResult({
      exitCode: 1,
      stdout: JSON.stringify({ verified: false }),
      stderr: "validation failed",
    });
    queueSpawnResult({
      exitCode: 0,
      stdout: JSON.stringify({}),
    });
    queueSpawnResult({
      exitCode: 0,
      stdout: JSON.stringify({}),
    });

    const response = await runCommandFromMessage("/evaluate MISS");

    expect(response.status).toBe("error");
    expect(response.summary).toContain("Unable to verify ticker or fetch flow data.");
    expect(response.rawCommandOutput).toContain("validation failed");
  });

  it("handles malformed options output as convexity stub", async () => {
    queueSpawnResult({
      exitCode: 0,
      stdout: JSON.stringify({ verified: true }),
    });
    queueSpawnResult({
      exitCode: 0,
      stdout: JSON.stringify({
        dark_pool: {
          aggregate: {
            flow_direction: "ACCUMULATION",
            flow_strength: 45,
          },
        },
        combined_signal: "UNCLEAR",
      }),
    });
    queueSpawnResult({
      exitCode: 0,
      stdout: "malformed json",
    });

    const response = await runCommandFromMessage("/evaluate AAPL");

    expect(response.status).toBe("ok");
    expect(response.summary).toContain("Options snapshot is a stub / placeholder.");
    expect(response.summary).toContain("Gate results: edge=FAIL, convexity=WARN (stub)");
  });

  it("surfaces non-Error runtime failures from command execution", async () => {
    vi.mocked(childProcess.spawn).mockImplementationOnce((): childProcess.ChildProcess => {
      const emitter = new EventEmitter();
      const stdout = new PassThrough();
      const stderr = new PassThrough();

      setImmediate(() => {
        emitter.emit("error", "raw runtime failure");
      });

      return {
        stdout,
        stderr,
        on: (eventName: string, handler: (...args: unknown[]) => void) => {
          emitter.on(eventName, handler as (..._args: unknown[]) => void);
          return {
            on: (innerName: string, innerHandler: (...args: unknown[]) => void) => {
              emitter.on(innerName, innerHandler as (..._args: unknown[]) => void);
              return {} as ReturnType<typeof childProcess.spawn>;
            },
          };
        },
      } as unknown as childProcess.ChildProcess;
    });

    const response = await runCommandFromMessage("/scan");

    expect(response.status).toBe("error");
    expect(response.title).toBe("Command execution failed");
    expect(response.rawCommandOutput).toBe("raw runtime failure");
  });

  it("evaluates a ticker with all upstream calls", async () => {
    queueSpawnResult({
      exitCode: 0,
      stdout: JSON.stringify({
        verified: true,
        company_name: "Acme Labs",
      }),
    });
    queueSpawnResult({
      exitCode: 0,
      stdout: JSON.stringify({
        dark_pool: {
          aggregate: {
            flow_direction: "ACCUMULATION",
            flow_strength: 45.6,
          },
        },
        combined_signal: "DP_CONFLUENCE",
      }),
    });
    queueSpawnResult({
      exitCode: 0,
      stdout: JSON.stringify({
        options: [
          {
            strike: 100,
          },
        ],
      }),
    });

    const response = await runCommandFromMessage("/evaluate AAPL");

    expect(response.status).toBe("ok");
    expect(response.command).toBe("evaluate");
    expect(response.title).toBe("Evaluate AAPL");
    expect(response.summary).toContain("Edge: ACCUMULATION | strength 45.6");
    expect(spawnCalls).toHaveLength(3);
  });

  it("returns evaluation failure when validation fails", async () => {
    queueSpawnResult({
      exitCode: 1,
      stdout: JSON.stringify({ verified: false, error: "Invalid ticker" }),
      stderr: "bad",
    });
    queueSpawnResult({ exitCode: 0, stdout: JSON.stringify({}) });
    queueSpawnResult({ exitCode: 0, stdout: JSON.stringify({}) });

    const response = await runCommandFromMessage("/evaluate FAKE");

    expect(response.status).toBe("error");
    expect(response.summary).toBe("Invalid ticker");
    expect(response.rawCommandOutput).toContain("bad");
    expect(response.command).toBe("evaluate");
  });

  it("builds a portfolio summary", async () => {
    const response = await runCommandFromMessage("/portfolio");

    expect(response.status).toBe("ok");
    expect(response.command).toBe("portfolio");
    expect(response.summary).toContain("Bankroll: $100000");
    expect(response.details).toEqual(
      expect.objectContaining({
        bankroll: 100000,
        max_positions: 6,
        position_count: 0,
      }),
    );
  });

  it("falls back to default portfolio when reading file fails", async () => {
    fileFixture.clear();
    setFileFixture("trade_log.json", {
      trades: [],
    });

    const response = await runCommandFromMessage("/portfolio");

    expect(response.status).toBe("ok");
    expect(response.summary).toContain("No open positions.");
    expect(response.summary).toContain("Bankroll: $0");
  });

  it("maps portfolio rows when positions exist", async () => {
    setFileFixture("portfolio.json", {
      bankroll: 100000,
      peak_value: 100000,
      positions: [
        {
          ticker: "AAPL",
          structure: "PUT DEBIT",
          max_risk: 1500,
          expiry: "2026-12-31",
        },
      ],
      total_deployed_pct: 20,
      total_deployed_dollars: 2000,
      remaining_capacity_pct: 80,
      max_positions: 6,
      avg_kelly_optimal: 12,
    });

    const response = await runCommandFromMessage("/portfolio");

    expect(response.status).toBe("ok");
    expect(response.summary).toContain("1. AAPL | PUT DEBIT | risk $1500 | expiry 2026-12-31");
    expect(response.details).toEqual(
      expect.objectContaining({
        position_count: 1,
      }),
    );
  });

  it("maps portfolio row defaults for missing structure and expiry", async () => {
    setFileFixture("portfolio.json", {
      bankroll: 0,
      peak_value: 10000,
      positions: [
        {
          ticker: "TSLA",
          max_risk: "not-a-number",
        },
      ],
      total_deployed_pct: 0,
      total_deployed_dollars: 0,
      remaining_capacity_pct: 100,
      max_positions: 6,
      avg_kelly_optimal: 12,
    });

    const response = await runCommandFromMessage("/portfolio");

    expect(response.status).toBe("ok");
    expect(response.summary).toContain("1. TSLA | UNDEFINED | risk $not-a-number | expiry N/A");
    expect(response.summary).toContain("Bankroll: $0");
  });

  it("supports journal limit and ordering", async () => {
    const response = await runCommandFromMessage("/journal --limit 1");

    expect(response.status).toBe("ok");
    expect(response.command).toBe("journal");
    expect(response.summary).toContain("[2026-02-28 12:00:00] MSFT NO_TRADE");
    expect(response.details).toEqual(
      expect.objectContaining({
        count: 1,
      }),
    );
  });

  it("renders journal rows with missing metadata", async () => {
    setFileFixture("trade_log.json", {
      trades: [
        {
          id: 9,
        },
      ],
    });

    const response = await runCommandFromMessage("/journal --limit 1");

    expect(response.status).toBe("ok");
    expect(response.summary).toContain("1. [] N/A N/A");
  });

  it("uses fallback limits for malformed journal input", async () => {
    const response = await runCommandFromMessage("/journal --limit bad");

    expect(response.status).toBe("ok");
    expect(response.command).toBe("journal");
    expect(response.summary).toContain("[2026-02-28 12:00:00]");
  });

  it("handles malformed journal payload as empty list", async () => {
    setFileFixture("trade_log.json", {
      trades: "malformed" as unknown as Array<Record<string, unknown>>,
    });

    const response = await runCommandFromMessage("/journal");

    expect(response.status).toBe("ok");
    expect(response.summary).toBe("No trade log entries found.");
  });

  it("renders journal rows without notes", async () => {
    setFileFixture("trade_log.json", {
      trades: [
        {
          date: "2026-03-01",
          decision: "TRADE",
          ticker: "TSLA",
        },
      ],
    });

    const response = await runCommandFromMessage("/journal");

    expect(response.status).toBe("ok");
    expect(response.summary).toContain("[2026-03-01] TSLA TRADE");
  });

  it("validates watchlist remove without ticker", async () => {
    const response = await runCommandFromMessage("/watchlist remove");

    expect(response.status).toBe("error");
    expect(response.title).toBe("Watchlist remove failed");
    expect(response.summary).toContain("Usage: /watchlist remove TICKER");
  });

  it("shows no entries when journal is empty", async () => {
    setFileFixture("trade_log.json", { trades: [] });

    const response = await runCommandFromMessage("/journal --limit 3");

    expect(response.status).toBe("ok");
    expect(response.summary).toBe("No trade log entries found.");
  });

  it("lists watchlist rows sorted", async () => {
    setFileFixture("watchlist.json", {
      last_updated: "2026-02-28",
      tickers: [
        { ticker: "MSFT", sector: "Technology", notes: "Watch" },
        { ticker: "AAPL", sector: "Technology", notes: "Priority" },
      ],
    });

    const response = await runCommandFromMessage("/watchlist list");

    expect(response.status).toBe("ok");
    expect(response.summary).toContain("AAPL [Technology] — Priority");
  });

  it("lists watchlist rows without optional metadata", async () => {
    setFileFixture("watchlist.json", {
      last_updated: "2026-02-28",
      tickers: [
        {
          ticker: "AAPL",
        },
        {
          ticker: "TSLA",
        },
      ],
    });

    const response = await runCommandFromMessage("/watchlist");

    expect(response.status).toBe("ok");
    expect(response.summary).toContain("AAPL\nTSLA");
  });

  it("adds watchlist entries and writes sorted data", async () => {
    const response = await runCommandFromMessage(
      '/watchlist add aapl --sector "Technology" --notes "Growth pick"',
    );

    expect(response.status).toBe("ok");
    expect(response.title).toBe("Watchlist updated");
    expect(writeCaptures).toHaveLength(1);
    expect(normalizeWatchlistTickers(writeCaptures[0].data)).toEqual(["AAPL", "MSFT"]);
  });

  it("validates watchlist add without ticker", async () => {
    const response = await runCommandFromMessage("/watchlist add");

    expect(response.status).toBe("error");
    expect(response.title).toBe("Watchlist add failed");
    expect(response.summary).toContain("Usage: /watchlist add TICKER");
  });

  it("updates existing watchlist ticker while preserving existing metadata", async () => {
    const response = await runCommandFromMessage("/watchlist add aapl");

    expect(response.status).toBe("ok");
    expect(response.title).toBe("Watchlist updated");
    expect(writeCaptures).toHaveLength(1);

    const written = JSON.parse(writeCaptures[0].data);
    expect(written.tickers).toEqual([
      { ticker: "AAPL", sector: "Technology" },
      { ticker: "MSFT", sector: "Technology", notes: "Current watch" },
    ]);
  });

  it("adds watchlist entries from positional metadata", async () => {
    const response = await runCommandFromMessage("/watchlist add tsla Technology Momentum");

    expect(response.status).toBe("ok");
    expect(response.title).toBe("Watchlist updated");
    expect(writeCaptures).toHaveLength(1);

    const written = JSON.parse(writeCaptures[0].data);
    expect(written.tickers).toEqual([
      { ticker: "AAPL", sector: "Technology" },
      { ticker: "MSFT", sector: "Technology", notes: "Current watch" },
      { ticker: "TSLA", sector: "Technology", notes: "Momentum" },
    ]);
  });

  it("removes watchlist tickers when present", async () => {
    const response = await runCommandFromMessage("/watchlist remove AAPL");

    expect(response.status).toBe("ok");
    expect(writeCaptures).toHaveLength(1);
    const written = JSON.parse(writeCaptures[0].data);
    expect(written.tickers).toEqual([{ ticker: "MSFT", sector: "Technology", notes: "Current watch" }]);
  });

  it("reports watchlist remove miss when missing", async () => {
    const response = await runCommandFromMessage("/watchlist remove TSLA");

    expect(response.status).toBe("error");
    expect(response.summary).toContain("not found in watchlist");
    expect(writeCaptures).toHaveLength(0);
  });

  it("maps tickers keyword fallback to watchlist list", async () => {
    setFileFixture("watchlist.json", {
      last_updated: "2026-02-28",
      tickers: [],
    });

    const response = await runCommandFromMessage("show me tickers on watch");

    expect(response.status).toBe("ok");
    expect(response.command).toBe("watchlist");
    expect(response.summary).toBe("No tickers in watchlist.");
  });

  it("maps natural language phrases to known commands", async () => {
    const response = await runCommandFromMessage("can you show me the portfolio now");

    expect(response.command).toBe("portfolio");
    expect(response.status).toBe("ok");
  });

  it("exposes command metadata helpers", () => {
    const commands = getAvailableCommands();
    expect(commands.map((command) => command.name)).toEqual(expect.arrayContaining(["scan", "discover"]));

    const messageId = buildMessageId();
    expect(typeof messageId).toBe("string");
    expect(messageId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("supports quoted command tokens", async () => {
    queueSpawnResult({
      exitCode: 0,
      stdout: JSON.stringify({
        last_updated: "2026-03-01",
        tickers: [{ ticker: "MSFT" }],
      }),
    });

    const response = await runCommandFromMessage(' /watchlist add "tsla" --notes "blue chip" ');

    expect(response.status).toBe("ok");
    expect(response.command).toBe("watchlist");
    expect(response.summary).toContain("Saved TSLA");
  });

  it("tokenizes command text into tokens and handles empty input", () => {
    expect(tokenizeCommand("/scan --top 12")).toEqual(["/scan", "--top", "12"]);
    expect(tokenizeCommand('add "AAPL" --notes "deep value"')).toEqual(["add", "AAPL", "--notes", "deep value"]);
    expect(tokenizeCommand("   ")).toEqual([]);
  });

  it("falls back to default command when command name cannot be resolved", () => {
    expect(pickCommandName("")).toBe("chat");
    expect(pickCommandName("something random")).toBe("chat");
  });
});
