import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import path from "node:path";

type Tone = "success" | "error" | "info";

type CommandName = "scan" | "discover" | "evaluate" | "portfolio" | "journal" | "watchlist" | "help" | "chat";

export interface ChatPayload {
  status: "ok" | "error";
  command: CommandName;
  tone: Tone;
  title: string;
  summary: string;
  details?: unknown;
  raw?: string;
  rawCommandOutput?: string;
}

interface CommandDescriptor {
  name: CommandName;
  description: string;
  aliases?: string[];
}

interface WatchlistTicker {
  ticker: string;
  sector?: string;
  notes?: string;
}

interface WatchlistFile {
  last_updated: string;
  tickers: WatchlistTicker[];
}

interface PortfolioFile {
  bankroll: number;
  peak_value: number;
  positions: Array<Record<string, unknown>>;
  total_deployed_pct: number;
  total_deployed_dollars: number;
  remaining_capacity_pct: number;
  max_positions: number;
  avg_kelly_optimal: number;
}

interface TradeLogFile {
  trades: Array<Record<string, unknown>>;
}

interface ParsedArgs {
  positional: string[];
  flags: Map<string, string | true>;
}

const PROJECT_ROOT = path.resolve(process.cwd(), "..");
const REPO_ROOT = PROJECT_ROOT;
const PYTHON_SCRIPTS = {
  scan: path.join(PROJECT_ROOT, "scripts", "scanner.py"),
  discover: path.join(PROJECT_ROOT, "scripts", "discover.py"),
  fetchTicker: path.join(PROJECT_ROOT, "scripts", "fetch_ticker.py"),
  fetchFlow: path.join(PROJECT_ROOT, "scripts", "fetch_flow.py"),
  fetchOptions: path.join(PROJECT_ROOT, "scripts", "fetch_options.py"),
};

const DATA_PATH = {
  watchlist: path.join(PROJECT_ROOT, "data", "watchlist.json"),
  portfolio: path.join(PROJECT_ROOT, "data", "portfolio.json"),
  tradeLog: path.join(PROJECT_ROOT, "data", "trade_log.json"),
};

const COMMANDS: CommandDescriptor[] = [
  { name: "scan", description: "Scan watchlist for flow signals", aliases: ["scan", "/scan"] },
  { name: "discover", description: "Find new candidates from market-wide flow", aliases: ["discover", "/discover"] },
  { name: "evaluate", description: "Run edge + options scan for a ticker", aliases: ["evaluate", "/evaluate"] },
  {
    name: "portfolio",
    description: "Show portfolio summary",
    aliases: ["portfolio", "positions", "/portfolio", "/positions"],
  },
  { name: "journal", description: "Show recent journal / trade log entries", aliases: ["journal", "/journal"] },
  { name: "watchlist", description: "List or update watchlist", aliases: ["watchlist", "/watchlist"] },
  { name: "help", description: "Show command reference", aliases: ["help", "/help"] },
];

export function tokenizeCommand(text: string): string[] {
  const matches = text.match(/"([^"]+)"|'([^']+)'|([^\s]+)/g) ?? [];
  return matches.map((value) => value.replace(/^"|"$/g, "").replace(/^'|'$/g, ""));
}

function normalizeTicker(value: string): string {
  return value.trim().toUpperCase();
}

export function pickCommandName(input: string): CommandName {
  const parts = tokenizeCommand(input);
  const canonicalFirst = (parts[0] ?? "").replace(/^\//, "").toLowerCase();
  for (const command of COMMANDS) {
    if (command.aliases?.some((alias) => alias.replace(/^\//, "").toLowerCase() === canonicalFirst)) {
      return command.name;
    }
  }

  const lowered = input.toLowerCase();
  if (/\bscan\b/i.test(lowered)) return "scan";
  if (/\bdiscover\b/i.test(lowered)) return "discover";
  if (/\bevaluate\b/i.test(lowered)) return "evaluate";
  if (/\bportfolio\b/i.test(lowered) || /\bpositions\b/i.test(lowered)) return "portfolio";
  if (/\bjournal\b/i.test(lowered) || (/\blog\b/i.test(lowered) && /\btrade/i.test(lowered))) return "journal";
  if (/\bwatchlist\b/i.test(lowered) || /\btickers\b/i.test(lowered)) return "watchlist";

  return "chat";
}

function parseArgs(parts: string[]): ParsedArgs {
  const positional: string[] = [];
  const flags = new Map<string, string | true>();

  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];

    if (!part.startsWith("--")) {
      positional.push(part);
      continue;
    }

    const key = part.slice(2);
    const value = parts[i + 1];
    if (value && !value.startsWith("--")) {
      flags.set(key, value);
      i += 1;
    } else {
      flags.set(key, true);
    }
  }

  return { positional, flags };
}

function toInt(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return parsed;
}

function toFloat(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) return fallback;
  return parsed;
}

function tryParseJson(raw: string): unknown | null {
  const normalized = raw.trim();
  if (!normalized) return null;

  try {
    return JSON.parse(normalized);
  } catch {
    return null;
  }
}

async function runPython(script: string, args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const cmd = process.platform === "win32" ? "python" : "python3";

  return new Promise((resolve, reject) => {
    const child = spawn(cmd, [script, ...args], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({
        exitCode: typeof code === "number" ? code : 1,
        stdout,
        stderr,
      });
    });
  });
}

async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  const serialized = JSON.stringify(data, null, 2);
  await fs.writeFile(filePath, `${serialized}\n`, "utf-8");
}

function sortWatchlist(tickers: WatchlistTicker[]): WatchlistTicker[] {
  return [...tickers].sort((a, b) => a.ticker.localeCompare(b.ticker));
}

async function loadWatchlist(): Promise<WatchlistFile> {
  return readJson<WatchlistFile>(DATA_PATH.watchlist, {
    last_updated: new Date().toISOString().slice(0, 10),
    tickers: [],
  });
}

function formatWatchlistRows(tickers: WatchlistTicker[]): string {
  if (tickers.length === 0) {
    return "No tickers in watchlist.";
  }

  return tickers
    .map((entry) => {
      const metadata = [
        entry.sector ? `[${entry.sector}]` : "",
        entry.notes ? `— ${entry.notes}` : "",
      ].filter(Boolean);
      return `${entry.ticker} ${metadata.join(" ")}`.trim();
    })
    .join("\n");
}

function shortNumber(value: unknown): string {
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) return String(value);
  return `${Math.round(normalized * 100) / 100}`;
}

async function handleScan(flags: Map<string, string | true>): Promise<ChatPayload> {
  const top = toInt(flags.get("top")?.toString(), 20);
  const minScore = toFloat(flags.get("min-score")?.toString(), 0);

  const result = await runPython(PYTHON_SCRIPTS.scan, ["--top", String(top), "--min-score", String(minScore)]);
  const payload = tryParseJson(result.stdout);

  if (result.exitCode !== 0) {
    return {
      status: "error",
      tone: "error",
      command: "scan",
      title: "Scan failed",
      summary: "scan returned a non-zero exit code. Check UW_TOKEN and script output.",
      rawCommandOutput: result.stderr || result.stdout,
      details: payload,
    };
  }

  if (payload === null) {
    return {
      status: "error",
      tone: "error",
      command: "scan",
      title: "Scan parse failed",
      summary: "scan output was not JSON. The script may have returned stderr text only.",
      rawCommandOutput: result.stderr || result.stdout,
    };
  }

  const output = payload as {
    tickers_scanned?: number;
    signals_found?: number;
    top_signals?: Array<Record<string, unknown>>;
  };

  const signals = Array.isArray(output.top_signals) ? output.top_signals : [];
  const summaryLines = [
    `Scanned ${output.tickers_scanned ?? 0} tickers.`,
    `Signals found: ${output.signals_found ?? 0}.`,
    ...signals
      .slice(0, 8)
      .map((item, idx) => `${idx + 1}. ${item.ticker} | ${item.direction || "UNKNOWN"} | score ${item.score ?? "n/a"} | ${item.signal || ""}`),
  ];

  return {
    status: "ok",
    tone: "success",
    command: "scan",
    title: "Scan complete",
    summary: summaryLines.join("\n"),
    raw: signals.map((item) => `${item.ticker}: ${item.signal} (${item.score})`).join("\n"),
    details: payload,
  };
}

async function handleDiscover(flags: Map<string, string | true>): Promise<ChatPayload> {
  const minPremium = toInt(flags.get("min-premium")?.toString(), 500000);
  const minAlerts = toInt(flags.get("min-alerts")?.toString(), 1);
  const dpDays = toInt(flags.get("dp-days")?.toString(), 3);

  const result = await runPython(PYTHON_SCRIPTS.discover, [
    "--min-premium",
    String(minPremium),
    "--min-alerts",
    String(minAlerts),
    "--dp-days",
    String(dpDays),
  ]);

  const output = tryParseJson(result.stdout);
  if (result.exitCode !== 0 || output === null) {
    return {
      status: "error",
      tone: "error",
      command: "discover",
      title: "Discover failed",
      summary: "discover returned an execution error or non-JSON output.",
      rawCommandOutput: result.stderr || result.stdout,
      details: output,
    };
  }

  const payload = output as {
    alerts_analyzed?: number;
    candidates?: Array<Record<string, unknown>>;
  };
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
  const lines = [
    `Alerts analyzed: ${payload.alerts_analyzed ?? 0}.`,
    `Candidates returned: ${candidates.length}.`,
    ...candidates
      .slice(0, 12)
      .map(
        (candidate, idx) =>
          `${idx + 1}. ${candidate.ticker} | ${candidate.dp_direction || "unknown"}/${candidate.options_bias || "unknown"} | score ${candidate.score ?? "n/a"} | sustained ${candidate.dp_sustained_days ?? 0}d`,
      ),
  ];

  return {
    status: "ok",
    tone: "success",
    command: "discover",
    title: "Discover complete",
    summary: lines.join("\n"),
    details: payload,
  };
}

async function handleEvaluate(rawParts: string[]): Promise<ChatPayload> {
  const args = parseArgs(rawParts);
  const ticker = normalizeTicker(args.positional[1] ?? "");

  if (!ticker || !/^[A-Z]{1,6}$/i.test(ticker)) {
    return {
      status: "error",
      tone: "error",
      command: "evaluate",
      title: "Evaluate requires a ticker",
      summary: "Usage: /evaluate TICKER",
      raw: "Example: /evaluate AAPL",
    };
  }

  const [validationResult, flowResult, optionsResult] = await Promise.all([
    runPython(PYTHON_SCRIPTS.fetchTicker, [ticker]),
    runPython(PYTHON_SCRIPTS.fetchFlow, [ticker, "--days", "5"]),
    runPython(PYTHON_SCRIPTS.fetchOptions, [ticker, "--dte-min", "20", "--dte-max", "45"]),
  ]);

  const validation = tryParseJson(validationResult.stdout) as Record<string, unknown> | null;
  const flow = tryParseJson(flowResult.stdout) as Record<string, unknown> | null;
  const options = tryParseJson(optionsResult.stdout) as Record<string, unknown> | null;

  if (validationResult.exitCode !== 0 || !validation) {
    return {
      status: "error",
      tone: "error",
      command: "evaluate",
      title: `Evaluate failed for ${ticker}`,
      summary: (validation?.error as string | undefined) || "Unable to verify ticker or fetch flow data.",
      rawCommandOutput: [validationResult.stderr, validationResult.stdout].filter(Boolean).join("\n"),
      details: {
        validation,
        flow,
        options,
      },
    };
  }

  const aggregate = ((flow?.dark_pool as Record<string, unknown> | undefined)?.aggregate ??
    {}) as Record<string, unknown>;

  const edgeDirection = String(aggregate?.flow_direction || "UNKNOWN");
  const edgeStrength = Number(aggregate?.flow_strength ?? 0);
  const edgeSignal = String(flow?.combined_signal || "NO_SIGNAL");
  const passEdge = edgeSignal.includes("CONFLUENCE") || edgeSignal.startsWith("DP_");
  const passConvexity = Object.keys(options ?? {}).length > 0;
  const optionsNote = passConvexity ? "Options snapshot generated." : "Options snapshot is a stub / placeholder.";

  const summary = [
    `Ticker: ${ticker} ${validation.company_name ? `(${validation.company_name})` : ""}`,
    `Validation: ${validation.verified ? "VERIFIED" : "UNVERIFIED"}${validation.error ? ` — ${validation.error}` : ""}`,
    `Edge: ${edgeDirection} | strength ${shortNumber(edgeStrength)}`,
    `Signal path: ${edgeSignal}`,
    `Gate results: edge=${passEdge ? "PASS" : "FAIL"}, convexity=${passConvexity ? "PASS" : "WARN (stub)"}`,
    optionsNote,
    "Next step: run Kelly sizing with your preferred risk profile and append decision to trade log.",
  ].join("\n");

  return {
    status: validation.verified ? "ok" : "error",
    tone: validation.verified && passEdge ? "success" : "info",
    command: "evaluate",
    title: `Evaluate ${ticker}`,
    summary,
    details: {
      ticker,
      validation,
      flow,
      options,
      gates: {
        edge: passEdge,
        convexity: passConvexity,
      },
    },
  };
}

async function handlePortfolio(): Promise<ChatPayload> {
  const portfolio = await readJson<PortfolioFile>(DATA_PATH.portfolio, {
    bankroll: 0,
    peak_value: 0,
    positions: [],
    total_deployed_pct: 0,
    total_deployed_dollars: 0,
    remaining_capacity_pct: 0,
    max_positions: 0,
    avg_kelly_optimal: 0,
  });

  const rows = portfolio.positions.map((position, index) => {
    const typedPosition = position as Record<string, unknown>;
    return `${index + 1}. ${typedPosition.ticker} | ${typedPosition.structure || "UNDEFINED"} | risk $${shortNumber(typedPosition.max_risk)} | expiry ${typedPosition.expiry || "N/A"}`;
  });

  const summary = [
    rows.length ? rows.join("\n") : "No open positions.",
    `\nBankroll: $${shortNumber(portfolio.bankroll)}`,
    `Peak value: $${shortNumber(portfolio.peak_value)}`,
    `Deployed: ${shortNumber(portfolio.total_deployed_pct)}% ($${shortNumber(portfolio.total_deployed_dollars)})`,
    `Remaining capacity: ${shortNumber(portfolio.remaining_capacity_pct)}%`,
    `Max positions: ${portfolio.max_positions}`,
  ].join("\n");

  return {
    status: "ok",
    tone: "success",
    command: "portfolio",
    title: "Portfolio",
    summary,
    details: {
      ...portfolio,
      position_count: portfolio.positions.length,
    },
  };
}

async function handleJournal(flags: Map<string, string | true>): Promise<ChatPayload> {
  const limitRaw = flags.get("limit");
  const limit = toInt(typeof limitRaw === "string" ? limitRaw : undefined, 12);

  const tradeLog = await readJson<TradeLogFile>(DATA_PATH.tradeLog, { trades: [] });
  const trades = Array.isArray(tradeLog.trades) ? tradeLog.trades : [];
  const recent = trades.slice(-limit).reverse();

  if (recent.length === 0) {
    return {
      status: "ok",
      tone: "info",
      command: "journal",
      title: "Journal",
      summary: "No trade log entries found.",
      details: tradeLog,
    };
  }

  const rows = recent.map((entry, index) => {
    const trade = entry as Record<string, unknown>;
    const date = `${trade.date || ""} ${trade.time || ""}`.trim();
    const decision = trade.decision || trade.action || "N/A";
    const ticker = trade.ticker || "N/A";
    const note = trade.notes || trade.edge_signal || "";
    return `${index + 1}. [${date}] ${String(ticker)} ${String(decision)}${note ? ` | ${String(note).slice(0, 140)}` : ""}`;
  });

  return {
    status: "ok",
    tone: "success",
    command: "journal",
    title: "Journal",
    summary: rows.join("\n"),
    details: {
      entries: recent,
      count: recent.length,
    },
  };
}

async function handleWatchlist(parts: string[]): Promise<ChatPayload> {
  const args = parseArgs(parts);
  const action = args.positional[1]?.toLowerCase();

  if (action === "add") {
    const rawTicker = args.positional[2] || "";
    const ticker = normalizeTicker(rawTicker);
    if (!ticker) {
      return {
        status: "error",
        tone: "error",
        command: "watchlist",
        title: "Watchlist add failed",
        summary: "Usage: /watchlist add TICKER [--sector SEC] [--notes NOTE]",
      };
    }

    const rest = args.positional.slice(3);
    const sector =
      typeof args.flags.get("sector") === "string"
        ? String(args.flags.get("sector"))
        : rest.length > 0
          ? rest[0]
          : undefined;
    const notes =
      typeof args.flags.get("notes") === "string"
        ? String(args.flags.get("notes"))
        : rest.length > 1
          ? rest.slice(1).join(" ")
          : undefined;

    const state = await loadWatchlist();
    const existing = state.tickers.find((entry) => entry.ticker === ticker);
    if (existing) {
      existing.sector = sector || existing.sector;
      existing.notes = notes || existing.notes;
    } else {
      state.tickers.push({
        ticker,
        sector,
        notes,
      });
    }

    state.tickers = sortWatchlist(state.tickers);
    state.last_updated = new Date().toISOString().slice(0, 10);
    await writeJson(DATA_PATH.watchlist, state);

    return {
      status: "ok",
      tone: "success",
      command: "watchlist",
      title: "Watchlist updated",
      summary: `Saved ${ticker} in watchlist.`,
      details: state,
    };
  }

  if (action === "remove") {
    const ticker = normalizeTicker(args.positional[2] || "");
    if (!ticker) {
      return {
        status: "error",
        tone: "error",
        command: "watchlist",
        title: "Watchlist remove failed",
        summary: "Usage: /watchlist remove TICKER",
      };
    }

    const state = await loadWatchlist();
    const before = state.tickers.length;
    state.tickers = state.tickers.filter((entry) => entry.ticker !== ticker);
    if (state.tickers.length === before) {
      return {
        status: "error",
        tone: "error",
        command: "watchlist",
        title: "Watchlist remove failed",
        summary: `${ticker} not found in watchlist.`,
        details: state,
      };
    }

    state.last_updated = new Date().toISOString().slice(0, 10);
    await writeJson(DATA_PATH.watchlist, state);

    return {
      status: "ok",
      tone: "success",
      command: "watchlist",
      title: "Watchlist updated",
      summary: `Removed ${ticker} from watchlist.`,
      details: state,
    };
  }

  if (action === "list" || action === undefined || action === "show") {
    const state = await loadWatchlist();
    return {
      status: "ok",
      tone: "info",
      command: "watchlist",
      title: "Watchlist",
      summary: formatWatchlistRows(state.tickers),
      details: state,
    };
  }

  return {
    status: "error",
    tone: "error",
    command: "watchlist",
    title: "Unknown watchlist action",
    summary: "Use: /watchlist list | /watchlist add TICKER [--sector SEC] [--notes NOTE] | /watchlist remove TICKER",
  };
}

function sanitizeMessage(message: string): string {
  return message.trim().replace(/\s+/g, " ");
}

function formatDefaultHelp(): string {
  return [
    "Available commands:",
    "/scan [--top N] [--min-score X]",
    "/discover [--min-premium N] [--min-alerts N] [--dp-days N]",
    "/evaluate TICKER",
    "/portfolio",
    "/journal [--limit N]",
    "/watchlist list|add|remove",
    "/help",
  ].join("\n");
}

export function getAvailableCommands(): CommandDescriptor[] {
  return COMMANDS;
}

export async function runCommandFromMessage(message: string): Promise<ChatPayload> {
  const clean = sanitizeMessage(message);
  const startsWithSlashCommand = clean.startsWith("/");

  if (!clean) {
    return {
      status: "error",
      tone: "error",
      command: "chat",
      title: "Empty input",
      summary: "Send a command or question to interact with PI-style operations.",
    };
  }

  const command = pickCommandName(clean);
  const parts = tokenizeCommand(clean);
  const lowered = clean.toLowerCase();

  try {
    switch (command) {
      case "scan": {
        const { flags } = parseArgs(parts);
        return await handleScan(flags);
      }

      case "discover": {
        const { flags } = parseArgs(parts);
        return await handleDiscover(flags);
      }

      case "evaluate":
        return await handleEvaluate(parts);

      case "portfolio":
        return await handlePortfolio();

      case "journal": {
        const { flags } = parseArgs(parts);
        return await handleJournal(flags);
      }

      case "watchlist":
        if (!startsWithSlashCommand) {
          return handleWatchlist(["/watchlist", "list"]);
        }
        return await handleWatchlist(parts);

      case "help":
        return {
          status: "ok",
          tone: "info",
          command: "help",
          title: "Help",
          summary: formatDefaultHelp(),
        };

      case "chat": {
        if (/hello|hi|help|commands|what can you/i.test(lowered)) {
          return {
            status: "ok",
            tone: "info",
            command: "help",
            title: "Hello",
            summary: "I can run your PI workflows from chat. Try /scan, /discover, /evaluate AAPL, /portfolio, /journal, or /watchlist.",
            raw: formatDefaultHelp(),
          };
        }

        return {
          status: "ok",
          tone: "info",
          command: "chat",
          title: "How can I help?",
          summary: `Try a slash command: ${COMMANDS.map((command) => `/${command.name}`).join(", ")}`,
        };
      }
    }
  } catch (error) {
    return {
      status: "error",
      tone: "error",
      command,
      title: "Command execution failed",
      summary: "An unexpected runtime error occurred.",
      rawCommandOutput: error instanceof Error ? error.message : String(error),
    };
  }
}

export function buildMessageId(): string {
  return randomUUID();
}
