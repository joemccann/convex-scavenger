"use client";

import { Dispatch, FormEvent, SetStateAction, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Bell,
  Bot,
  CheckCircle2,
  Circle,
  LayoutDashboard,
  LineChart,
  Search,
  Send,
  Sparkles,
  TriangleAlert,
  TrendingDown,
  Wrench,
} from "lucide-react";

type MessageRole = "assistant" | "user";

type Message = {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
};

type FlowRow = {
  ticker: string;
  position: string;
  flowLabel: string;
  flowClass: string;
  strength: string;
  note: string;
};

type ApiMessage = {
  role: MessageRole;
  content: string;
};

type AssistantResponse = {
  content?: string;
  model?: string;
  error?: string;
};

type PiResponse = {
  command: string;
  status: "ok" | "error";
  output: string;
  stderr?: string;
  error?: string;
};

type WorkspaceSection = "dashboard" | "flow-analysis" | "portfolio" | "scanner" | "discover" | "journal";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type WorkspaceNavItem = {
  label: string;
  route: WorkspaceSection;
  href: string;
  icon: typeof LayoutDashboard;
};

const PI_COMMANDS = ["scan", "discover", "evaluate", "portfolio", "journal", "sync", "leap-scan", "help"] as const;
const PI_COMMAND_SET = new Set<string>(PI_COMMANDS);

const PI_COMMAND_ALIASES: Record<string, string> = {
  "compare support vs against": "/scan --top 20",
  "action items": "/journal --limit 25",
  "what are action items": "/journal --limit 25",
  "review watch list": "/scan --top 12",
  "watch list": "/scan --top 12",
  "watchlist": "/scan --top 12",
};

const navItems: WorkspaceNavItem[] = [
  { label: "Dashboard", route: "dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Flow Analysis", route: "flow-analysis", href: "/flow-analysis", icon: LineChart },
  { label: "Portfolio", route: "portfolio", href: "/portfolio", icon: Circle },
  { label: "Scanner", route: "scanner", href: "/scanner", icon: Sparkles },
  { label: "Discover", route: "discover", href: "/discover", icon: Search },
  { label: "Journal", route: "journal", href: "/journal", icon: Wrench },
];

const metricCards = [
  { label: "Net Liquidation", value: "$981,353", change: "BANKROLL", tone: "neutral" },
  { label: "Positions", value: "19", change: "7 DEFINED / 12 UNDEFINED", tone: "neutral" },
  { label: "Flow Aligned", value: "6", change: "↑ SUPPORTED", tone: "positive" },
  { label: "Flow Against", value: "2", change: "↓ REVIEW NEEDED", tone: "negative" },
];

const supports: FlowRow[] = [
  { ticker: "IGV", position: "Long Calls + Risk Rev", flowLabel: "72% ACCUM", flowClass: "accum", strength: "44.2", note: "Strong institutional buying" },
  { ticker: "NFLX", position: "Long Stock", flowLabel: "60% ACCUM", flowClass: "accum", strength: "20.5", note: "Friday 93% buy ratio" },
  { ticker: "PLTR", position: "Risk Reversal", flowLabel: "61% ACCUM", flowClass: "accum", strength: "22.2", note: "Friday 80% buy ratio" },
  { ticker: "EWY", position: "Bear Put Spread", flowLabel: "42% DISTRIB", flowClass: "distrib", strength: "16.6", note: "Flow confirms bearish bet" },
  { ticker: "EC", position: "Long Stock", flowLabel: "58% ACCUM", flowClass: "accum", strength: "15.3", note: "Modest accumulation" },
  { ticker: "SOFI", position: "Long Calls", flowLabel: "56% ACCUM", flowClass: "accum", strength: "11.7", note: "Weak but directional" },
];

const against: FlowRow[] = [
  {
    ticker: "BRZE",
    position: "Long 300x Calls (Mar 20)",
    flowLabel: "29% DISTRIB",
    flowClass: "distrib",
    strength: "42.2",
    note: "Institutions selling, you're long. Near-term expiry.",
  },
  {
    ticker: "RR",
    position: "Long 10K shares",
    flowLabel: "36% DISTRIB",
    flowClass: "distrib",
    strength: "27.6",
    note: "Sustained distribution pattern",
  },
];

const watchRows = [
  { ticker: "MSFT", flow: "Fri 0.8%", className: "distrib", note: "Massive single-day distribution", position: "Long 1K shares ($469K)" },
  { ticker: "BKD", flow: "Fri 65%", className: "accum", note: "Recent day bullish, against bearish spread", position: "Bear Put Spread" },
];

const neutralRows = [
  { ticker: "AAOI", strength: "50%", className: "neutral", prints: "992" },
  { ticker: "BAP", strength: "51%", className: "neutral", prints: "216" },
  { ticker: "ETHA", strength: "54%", className: "neutral", prints: "699" },
  { ticker: "ILF", strength: "53%", className: "neutral", prints: "251" },
  { ticker: "NAK", strength: "55%", className: "accum", prints: "19" },
  { ticker: "TSLL", strength: "49%", className: "neutral", prints: "1,827" },
  { ticker: "URTY", strength: "45%", className: "neutral", prints: "257" },
  { ticker: "USAX", strength: "100%", className: "accum", prints: "3" },
];

const quickPromptsBySection: Record<WorkspaceSection, string[]> = {
  dashboard: ["portfolio", "scan --top 12", "compare support vs against", "review watch list", "help"],
  "flow-analysis": ["analyze brze", "compare support vs against", "what are action items", "review watch list", "scan --top 12", "evaluate brze", "portfolio"],
  portfolio: ["portfolio", "analyze brze", "journal --limit 10", "evaluate msft", "help"],
  scanner: ["scan --top 25", "scan --min-score 12", "evaluate igv", "discover", "help"],
  discover: ["discover", "scan --top 12", "analyze aaoi", "journal", "help"],
  journal: ["journal --limit 25", "portfolio", "analyze nfLx", "help"],
};

const sectionDescription: Record<WorkspaceSection, string> = {
  dashboard: "Portfolio snapshot and command control panel.",
  "flow-analysis": "Flow and position analysis context.",
  portfolio: "Current portfolio-focused controls and risk summary.",
  scanner: "Candidate discovery and scan-driven alerts.",
  discover: "Opportunity discovery and watchlist growth.",
  journal: "Trade decision logs and history review.",
};

function isPiCommandInput(raw: string) {
  const normalized = raw.trim().toLowerCase();
  const first = normalized.replace(/^\//, "").split(/\s+/)[0];
  return first ? PI_COMMAND_SET.has(first) : false;
}

function normalizeCommandInput(raw: string) {
  const trimmed = raw.trim();
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function routeToPiPrompt(raw: string): string | null {
  const normalized = raw.trim();
  if (!normalized) {
    return null;
  }

  if (isPiCommandInput(normalized)) {
    return normalizeCommandInput(normalized);
  }

  const lower = normalized.toLowerCase();
  const alias = PI_COMMAND_ALIASES[lower];
  if (alias) {
    return alias;
  }

  if (lower.startsWith("analyze ")) {
    const tokenized = lower.replace(/^\s*analyze\s+/, "").trim().split(/\s+/)[0];
    if (tokenized) {
      return `/evaluate ${tokenized.toUpperCase()}`;
    }
  }

  if (/\bportfolio\b/.test(lower) || /\bpositions?\b/.test(lower)) {
    return "/portfolio";
  }

  if (/\bdiscover\b/.test(lower)) {
    return "/discover";
  }

  if (/\bjournal\b/.test(lower)) {
    return "/journal";
  }

  if (/\bscan\b/.test(lower)) {
    return `/scan`;
  }

  return null;
}

function createTimestamp() {
  return new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function titleCase(input: string) {
  return input
    .replace(/[_-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function formatCurrency(value: unknown) {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) {
    return "N/A";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function parsePossibleJson(raw: string): unknown | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  if (!/^[\[{].*[\]}]$/s.test(trimmed)) {
    return null;
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
}

function normalizeForCell(raw: unknown) {
  if (raw === null || raw === undefined) {
    return "N/A";
  }
  if (typeof raw === "string") {
    return raw;
  }
  if (typeof raw === "number" || typeof raw === "boolean") {
    return String(raw);
  }
  try {
    return JSON.stringify(raw);
  } catch {
    return String(raw);
  }
}

function formatArrayAsTable(parsed: unknown[]) {
  if (!parsed.length) {
    return "No rows available.";
  }

  if (!parsed.every((row) => row && typeof row === "object" && !Array.isArray(row))) {
    return null;
  }

  const rows = parsed as Record<string, JsonValue>[];
  const columns = Array.from(
    rows.reduce((acc, row) => {
      Object.keys(row).forEach((key) => {
        acc.add(key);
      });
      return acc;
    }, new Set<string>()),
  );

  if (!columns.length) {
    return null;
  }

  const header = columns.map((column) => titleCase(column));
  const separator = columns.map(() => "---");
  const body = rows.map((row) => columns.map((column) => normalizeForCell(row[column])));

  const table = [`| ${header.join(" | ")} |`, `| ${separator.join(" | ")} |`, ...body.map((row) => `| ${row.join(" | ")} |`)];

  return table.join("\n");
}

function extractSingleArrayFromObject(parsed: Record<string, unknown>) {
  const rowsEntries = Object.entries(parsed).filter(([, value]) => Array.isArray(value));
  if (rowsEntries.length !== 1) {
    return null;
  }

  const [field, value] = rowsEntries[0] as [string, unknown[]];
  if (!value.length || !value.every((row) => row && typeof row === "object" && !Array.isArray(row))) {
    return null;
  }

  const table = formatArrayAsTable(value);
  if (!table) {
    return null;
  }

  return `${field.toUpperCase()}:\n${table}`;
}

function valueToText(value: unknown): string {
  if (value === null || value === undefined) {
    return "N/A";
  }
  if (typeof value === "boolean" || typeof value === "number") {
    return String(value);
  }
  if (typeof value === "string") {
    return value;
  }

  return "";
}

function normalizeTextLines(raw: string) {
  return raw
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

function formatJsonObject(value: Record<string, JsonValue>, indent = 0): string {
  const spaces = " ".repeat(indent * 2);
  const lines: string[] = [];
  for (const [key, entry] of Object.entries(value)) {
    const label = titleCase(key);
    if (entry === null || typeof entry !== "object") {
      const stringValue = valueToText(entry);
      if (stringValue) {
        lines.push(`${spaces}${label}: ${stringValue}`);
      }
      continue;
    }

    if (Array.isArray(entry)) {
      lines.push(`${spaces}${label}:`);
      if (!entry.length) {
        lines.push(`${spaces}  - none`);
        continue;
      }
      for (const [index, row] of entry.entries()) {
        if (row === null || typeof row !== "object") {
          lines.push(`${spaces}  ${index + 1}. ${valueToText(row)}`);
          continue;
        }
        const rowLabel = Object.entries(row as Record<string, JsonValue>)
          .filter(([, rowValue]) => rowValue !== undefined)
          .map(([rowKey, rowValue]) => `${rowKey}: ${valueToText(rowValue)}`)
          .join(" | ");
        lines.push(`${spaces}  ${index + 1}. ${rowLabel || "(empty row)"}`);
      }
      continue;
    }

    const nested = formatJsonObject(entry as Record<string, JsonValue>, indent + 1);
    lines.push(`${spaces}${label}:`);
    if (nested) {
      lines.push(nested);
    }
  }

  return lines.join("\n");
}

function formatPortfolioPayload(raw: unknown): string {
  const payload = raw as { bankroll?: unknown; position_count?: unknown; defined_risk_count?: unknown; undefined_risk_count?: unknown; last_sync?: unknown; positions?: unknown[] };
  const positions = Array.isArray(payload?.positions) ? payload.positions : [];

  const lines = [
    "Portfolio Snapshot",
    `Bankroll: ${formatCurrency(payload?.bankroll)}`,
    `Positions: ${Number(payload?.position_count ?? positions.length)}`,
    `Defined Risk: ${Number(payload?.defined_risk_count ?? 0)}`,
    `Undefined Risk: ${Number(payload?.undefined_risk_count ?? 0)}`,
    `Last Sync: ${String(payload?.last_sync ?? "N/A")}`,
    "",
    "Positions:",
  ];

  if (!positions.length) {
    lines.push("No positions found.");
    return lines.join("\n");
  }

  const table = formatArrayAsTable(positions);
  if (table && table !== "No rows available.") {
    lines.push(table);
    return lines.join("\n");
  }

  for (const [index, position] of positions.entries()) {
    if (typeof position !== "object" || position === null) {
      lines.push(`${index + 1}. ${String(position)}`);
      continue;
    }

    const entry = position as {
      ticker?: string;
      structure?: string;
      expiry?: string;
      risk_profile?: string;
      entry_cost?: number;
    };

    lines.push(
      `${index + 1}. ${entry.ticker ?? "UNKNOWN"} — ${entry.structure ?? "No structure"} (` +
        `expiry: ${entry.expiry ?? "N/A"}, entry cost: ${formatCurrency(entry.entry_cost)})`,
    );
    if (entry.risk_profile) {
      lines.push(`   Risk Profile: ${entry.risk_profile}`);
    }
  }

  return lines.join("\n");
}

function formatJournalPayload(raw: unknown): string {
  const payload = raw as { trades?: unknown[] };
  const trades = Array.isArray(payload?.trades) ? payload.trades : [];

  const lines = ["Recent Journal", ""];
  if (!trades.length) {
    lines.push("No trades logged.");
    return lines.join("\n");
  }

  const table = formatArrayAsTable(trades);
  if (table && table !== "No rows available.") {
    lines.push(table);
    return lines.join("\n");
  }

  for (const [index, trade] of trades.entries()) {
    if (typeof trade !== "object" || trade === null) {
      lines.push(`${index + 1}. ${String(trade)}`);
      continue;
    }

    const entry = trade as { timestamp?: string; ticker?: string; decision?: string; confidence?: string | number; note?: string };
    const prefix = `${index + 1}. ${entry.timestamp ?? "No timestamp"} ${entry.ticker ?? "N/A"} ${entry.decision ?? ""}`.trim();
    lines.push(prefix);
    if (entry.confidence !== undefined) {
      lines.push(`   Confidence: ${entry.confidence}`);
    }
    if (entry.note) {
      lines.push(`   Note: ${entry.note}`);
    }
  }

  return lines.join("\n");
}

function formatGenericPayload(parsedPayload: unknown): string {
  if (Array.isArray(parsedPayload)) {
    const table = formatArrayAsTable(parsedPayload);
    if (table) {
      return normalizeTextLines(table);
    }
    return normalizeTextLines(formatJsonObject({ list: parsedPayload }, 0).replace(/^List:\n/, ""));
  }

  if (parsedPayload && typeof parsedPayload === "object") {
    const singleArray = extractSingleArrayFromObject(parsedPayload as Record<string, unknown>);
    if (singleArray) {
      return normalizeTextLines(singleArray);
    }
    return normalizeTextLines(formatJsonObject(parsedPayload as Record<string, JsonValue>, 0));
  }

  return normalizeTextLines(String(parsedPayload));
}

function formatAssistantPayload(output: string): string {
  const parsed = parsePossibleJson(output);
  if (!parsed) {
    return normalizeTextLines(output);
  }

  return formatGenericPayload(parsed);
}

function formatPiPayload(command: string, output: string): string {
  const parsed = parsePossibleJson(output);
  if (!parsed) {
    return normalizeTextLines(output);
  }

  const canonical = command.replace(/^\//, "").toLowerCase();

  if (canonical === "portfolio") {
    return normalizeTextLines(formatPortfolioPayload(parsed));
  }

  if (canonical === "journal") {
    return normalizeTextLines(formatJournalPayload(parsed));
  }

  return formatGenericPayload(parsed);
}

function formatChatMessage(content: string) {
  const normalized = normalizeTextLines(content);
  if (!normalized) {
    return <span className="chat-empty">No output.</span>;
  }

  return (
    <div className="chat-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="chat-markdown-p">{children}</p>,
        ul: ({ children }) => <ul className="chat-markdown-list chat-markdown-list-unordered">{children}</ul>,
        ol: ({ children }) => <ol className="chat-markdown-list chat-markdown-list-ordered">{children}</ol>,
        li: ({ children }) => <li className="chat-markdown-list-item">{children}</li>,
        table: ({ children }) => <div className="chat-table-wrap"><table className="chat-table">{children}</table></div>,
        thead: ({ children }) => <thead className="chat-markdown-thead">{children}</thead>,
        tbody: ({ children }) => <tbody>{children}</tbody>,
        tr: ({ children }) => <tr>{children}</tr>,
        th: ({ children }) => <th>{children}</th>,
        td: ({ children }) => <td>{children}</td>,
        blockquote: ({ children }) => <blockquote className="chat-markdown-blockquote">{children}</blockquote>,
        pre: ({ children }) => <pre className="chat-markdown-code-block">{children}</pre>,
        code: ({ inline, children }) => {
          if (inline) {
            return <code className="chat-markdown-inline-code">{children}</code>;
          }
          return <code className="chat-markdown-fenced-code">{children}</code>;
        },
        a: ({ href, children }) => (
          <a href={href ?? "#"} target="_blank" rel="noopener noreferrer" className="chat-markdown-link">
            {children}
          </a>
        ),
        em: ({ children }) => <em className="chat-markdown-emphasis">{children}</em>,
        strong: ({ children }) => <strong className="chat-markdown-strong">{children}</strong>,
        h1: ({ children }) => <h1 className="chat-markdown-heading chat-markdown-heading-1">{children}</h1>,
        h2: ({ children }) => <h2 className="chat-markdown-heading chat-markdown-heading-2">{children}</h2>,
        h3: ({ children }) => <h3 className="chat-markdown-heading chat-markdown-heading-3">{children}</h3>,
        h4: ({ children }) => <h4 className="chat-markdown-heading chat-markdown-heading-4">{children}</h4>,
        }}
      >
        {normalized}
      </ReactMarkdown>
    </div>
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function fallbackReply(input: string) {
  const query = input.trim().toLowerCase();

  if (!query) {
    return "I can analyze flow structure, scan alignment, and risk, then map to a decision view.";
  }

  if (query.includes("analyze brze") || query.includes("brze")) {
    return "BRZE is against-flow. You are long 300x Mar 20 calls, and flow is negative with 29% distributed bias. If this continues near expiry, reduce risk or hedge immediately.";
  }

  if (query.includes("analyze rr") || query.includes(" rr")) {
    return "RR shows 36% distributed flow and a sustained signal. Keep a hard risk gate: no add, and ensure thesis still controls risk.";
  }

  if (query.includes("compare support vs against") || query.includes("support against") || query.includes("support vs against")) {
    return "Support side currently has 6 positions with confirmation; against side has 2 with a higher urgency profile. Treat against as active monitor tier.";
  }

  if (query.includes("action") || query.includes("items")) {
    return "Priority list: BRZE, RR, then MSFT. Confirm any additional prints before adding exposure.";
  }

  if (query.includes("watch list") || query.includes("watch closely")) {
    return "Watch list is flagged from mixed intraday flow. MSFT and BKD need one full session before any structural decision.";
  }

  if (query.includes("portfolio") || query.includes("positions")) {
    return "Portfolio snapshot: 19 positions total. 7 defined structure, 12 undefined. Net liquidation is $981,353. Flow-aligned positions currently lead.";
  }

  return "I can review any ticker, compare support/against groups, or walk through risk and Kelly logic for any position.";
}

async function requestAssistantReply(history: ApiMessage[], latestMessage: string): Promise<string> {
  const response = await fetch("/api/assistant", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: [
        ...history,
        { role: "user", content: latestMessage },
      ],
    }),
  });

  const payload = (await response.json()) as AssistantResponse;

  if (!response.ok) {
    if (payload.error) {
      return `Error: ${payload.error}`;
    }
    return "Assistant service returned an error.";
  }

  if (typeof payload.content === "string" && payload.content.trim()) {
    return formatAssistantPayload(payload.content);
  }

  return fallbackReply(latestMessage);
}

async function requestPiReply(command: string): Promise<string> {
  const response = await fetch("/api/pi", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input: command }),
  });

  const payload = (await response.json()) as PiResponse;
  const normalized = normalizeTextLines(payload.output || "");
  const canonicalCommand = command.trim().replace(/^\//, "").split(/\s+/)[0] ?? "";

  if (!response.ok) {
    if (payload.error) {
      return `Error: ${payload.error}`;
    }
    return "PI command request failed.";
  }

  if (payload.status === "error") {
    const details = payload.stderr ? `\n\nDetails:\n${payload.stderr}` : "";
    return `Command '${payload.command}' failed: ${normalized}${details}`;
  }

  if (!normalized) {
    return "No output returned from PI command.";
  }

  return formatPiPayload(canonicalCommand, normalized);
}

async function streamMessage(messageId: string, fullText: string, setMessages: Dispatch<SetStateAction<Message[]>>) {
  const chunk = 120;
  let rendered = "";
  const source = fullText.length ? fullText : "No output returned from PI command.";
  const parts = source.match(new RegExp(`.{1,${chunk}}`, "gs"));

  if (!parts) {
    setMessages((current) =>
      current.map((message) => (message.id === messageId ? { ...message, content: source } : message)),
    );
    return;
  }

  for (const piece of parts) {
    rendered += piece;
    setMessages((current) => current.map((message) => (message.id === messageId ? { ...message, content: rendered } : message)));
    await sleep(8);
  }
}

function renderFlowSections() {
  return (
    <>
      <div className="section">
        <div className="alert-box">
          <div className="alert-title">
            <TriangleAlert size={14} />
            ACTION ITEMS
          </div>
          <div className="alert-item">
            <span className="alert-ticker">BRZE</span> — Long calls expiring Mar 20 (20 days) with 42% distribution flow. Consider exit or reduced exposure.
          </div>
          <div className="alert-item">
            <span className="alert-ticker">RR</span> — Sustained distribution. Review thesis for continued hold.
          </div>
          <div className="alert-item">
            <span className="alert-ticker">MSFT</span> — $469K position saw massive Friday selling (0.8% buy ratio). Monitor Monday.
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-header">
          <div className="section-title">
            <CheckCircle2 size={14} />
            Flow Supports Position
          </div>
          <span className="pill defined">6 POSITIONS</span>
        </div>
        <div className="section-body">
          <table>
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Position</th>
                <th>Flow</th>
                <th>Strength</th>
                <th>Signal</th>
              </tr>
            </thead>
            <tbody>
              {supports.map((item) => (
                <tr key={`support-${item.ticker}`}>
                  <td>
                    <strong>{item.ticker}</strong>
                  </td>
                  <td>{item.position}</td>
                  <td>
                    <span className={`pill ${item.flowClass}`}>{item.flowLabel}</span>
                  </td>
                  <td>
                    <div className="strength-bar">
                      <div className="strength-fill" style={{ width: `${item.strength}%` }} />
                    </div>
                    <div className="strength-value">{item.strength}</div>
                  </td>
                  <td>{item.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="section">
        <div className="section-header">
          <div className="section-title">
            <TrendingDown size={14} />
            Flow Against Position
          </div>
          <span className="pill distrib">2 POSITIONS</span>
        </div>
        <div className="section-body">
          <table>
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Position</th>
                <th>Flow</th>
                <th>Strength</th>
                <th>Concern</th>
              </tr>
            </thead>
            <tbody>
              {against.map((item) => (
                <tr key={`against-${item.ticker}`}>
                  <td>
                    <strong>{item.ticker}</strong>
                  </td>
                  <td>{item.position}</td>
                  <td>
                    <span className={`pill ${item.flowClass}`}>{item.flowLabel}</span>
                  </td>
                  <td>
                    <div className="strength-bar">
                      <div className="strength-fill" style={{ width: `${item.strength}%` }} />
                    </div>
                    <div className="strength-value">{item.strength}</div>
                  </td>
                  <td>{item.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="two-col">
        <div className="section">
          <div className="section-header">
            <div className="section-title">
              <Bell size={14} />
              Watch Closely
            </div>
            <span className="pill undefined">2 POSITIONS</span>
          </div>
          <div className="section-body">
            <table>
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th>Position</th>
                  <th>Flow</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {watchRows.map((item) => (
                  <tr key={item.ticker}>
                    <td>
                      <strong>{item.ticker}</strong>
                    </td>
                    <td>{item.position}</td>
                    <td>
                      <span className={`pill ${item.className}`}>{item.flow}</span>
                    </td>
                    <td>{item.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="section">
          <div className="section-header">
            <div className="section-title">
              <Circle size={14} />
              Neutral / Low Signal
            </div>
            <span className="pill neutral">8 POSITIONS</span>
          </div>
          <div className="section-body">
            <table>
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th>Flow</th>
                  <th className="right">Prints</th>
                </tr>
              </thead>
              <tbody>
                {neutralRows.map((row) => (
                  <tr key={`neutral-${row.ticker}`}>
                    <td>{row.ticker}</td>
                    <td>
                      <span className={`pill ${row.className}`}>{row.strength}</span>
                    </td>
                    <td className="right">{row.prints}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="report-meta">
          Report Generated: 2026-02-28 18:12:12 PST • Source: IB Gateway (4001) • Dark Pool Lookback: 5 Trading Days
        </div>
      </div>
    </>
  );
}

function renderDashboardSections() {
  return null;
}

function renderPortfolioSections() {
  return (
    <>
      <div className="section">
        <div className="section-header">
          <div className="section-title">
            <Circle size={14} />
            Portfolio Snapshot
          </div>
          <span className="pill defined">POSITIONS</span>
        </div>
        <div className="section-body">
          <table>
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Position</th>
                <th>Flow</th>
                <th>Signal</th>
              </tr>
            </thead>
            <tbody>
              {supports.map((item) => (
                <tr key={`portfolio-support-${item.ticker}`}>
                  <td>{item.ticker}</td>
                  <td>{item.position}</td>
                  <td>{item.flowLabel}</td>
                  <td>{item.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="section">
        <div className="section-header">
          <div className="section-title">
            <TrendingDown size={14} />
            Risk Review
          </div>
          <span className="pill distrib">ALERT LIST</span>
        </div>
        <div className="section-body">
          <div className="alert-item">BRZE and RR marked for direct review based on flow mismatch.</div>
        </div>
      </div>
    </>
  );
}

function renderScannerSections() {
  return (
    <>
      <div className="section">
        <div className="section-header">
          <div className="section-title">
            <Sparkles size={14} />
            Scanner Signals
          </div>
          <span className="pill defined">SCANNER</span>
        </div>
        <div className="section-body">
          <table>
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Signal</th>
                <th>Signal Strength</th>
              </tr>
            </thead>
            <tbody>
              {neutralRows.slice(0, 4).map((row) => (
                <tr key={`scanner-${row.ticker}`}>
                  <td>{row.ticker}</td>
                  <td>Neutral Flow</td>
                  <td>{row.strength}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function renderDiscoverSections() {
  return (
    <>
      <div className="section">
        <div className="section-header">
          <div className="section-title">
            <Search size={14} />
            Discovery Queue
          </div>
          <span className="pill defined">DISCOVER</span>
        </div>
        <div className="section-body">
          <div className="alert-item">Discovering by premise and options flow strength.</div>
          <div className="alert-item">BKD, MSFT, and IGV currently in active watch set.</div>
        </div>
      </div>
      <div className="section">
        <div className="section-header">
          <div className="section-title">
            <Bell size={14} />
            Watch candidates
          </div>
          <span className="pill neutral">LIVE</span>
        </div>
        <div className="section-body">
          <div className="report-meta">
            Report Generated: 2026-02-28 18:12:12 PST • Source: Internal Market Scanner
          </div>
        </div>
      </div>
    </>
  );
}

function renderJournalSections() {
  return (
    <>
      <div className="section">
        <div className="section-header">
          <div className="section-title">
            <Wrench size={14} />
            Journal Log
          </div>
          <span className="pill defined">JOURNAL</span>
        </div>
        <div className="section-body">
          <div className="alert-item">No trade decision yet. Request `/journal --limit N` for most recent entries.</div>
          <div className="alert-item">BRZE and RR flagged by recent flow event.</div>
        </div>
      </div>
    </>
  );
}

function renderWorkspaceSections(section: WorkspaceSection) {
  switch (section) {
    case "dashboard":
      return renderDashboardSections();
    case "flow-analysis":
      return renderFlowSections();
    case "portfolio":
      return renderPortfolioSections();
    case "scanner":
      return renderScannerSections();
    case "discover":
      return renderDiscoverSections();
    case "journal":
      return renderJournalSections();
    default:
      return renderFlowSections();
  }
}

type WorkspacePageProps = {
  section?: WorkspaceSection;
};

function resolveSectionFromPath(pathname: string | null, fallback: WorkspaceSection): WorkspaceSection {
  if (!pathname) {
    return fallback;
  }

  if (pathname === "/" || pathname === "/dashboard") {
    return "dashboard";
  }

  if (pathname.startsWith("/flow-analysis")) {
    return "flow-analysis";
  }

  if (pathname.startsWith("/portfolio")) {
    return "portfolio";
  }

  if (pathname.startsWith("/scanner")) {
    return "scanner";
  }

  if (pathname.startsWith("/discover")) {
    return "discover";
  }

  if (pathname.startsWith("/journal")) {
    return "journal";
  }

  return fallback;
}

export default function Page({ section }: WorkspacePageProps) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isBusy, setBusy] = useState(false);
  const [lastError, setLastError] = useState("");
  const searchRef = useRef<HTMLInputElement | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();
  const activeSection = section ?? resolveSectionFromPath(pathname, "dashboard");
  const activeLabel = navItems.find((item) => item.route === activeSection)?.label ?? "Dashboard";
  const sectionPrompts = quickPromptsBySection[activeSection];

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") {
      setTheme(saved);
      document.documentElement.setAttribute("data-theme", saved);
    }
  }, []);

  useEffect(() => {
    const handler = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages]);

  const actionTone = useMemo(() => {
    return theme === "dark" ? "#f0f0f0" : "#0a0a0a";
  }, [theme]);

  const sendMessage = async (eventOrPrompt: FormEvent<HTMLFormElement> | string) => {
    if (typeof eventOrPrompt !== "string") {
      eventOrPrompt.preventDefault();
    }

    const nextPrompt = typeof eventOrPrompt === "string" ? eventOrPrompt : query;
    const cleaned = nextPrompt.trim();
    if (!cleaned) {
      return;
    }

    const userMessage: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      timestamp: createTimestamp(),
      content: cleaned,
    };

    const conversation: ApiMessage[] = messages.map((message) => ({
      role: message.role,
      content: message.content,
    }));

    setMessages((current) => [...current, userMessage]);
    setQuery("");
    setBusy(true);
    setLastError("");

    try {
      const piCommand = routeToPiPrompt(cleaned);
      const isCommand = Boolean(piCommand);

      if (isCommand) {
        const assistantId = `a-${Date.now()}-pi`;
        const assistantMessage: Message = {
          id: assistantId,
          role: "assistant",
          timestamp: createTimestamp(),
          content: "",
        };
        setMessages((current) => [...current, assistantMessage]);
        const assistantContent = await requestPiReply(piCommand || cleaned);
        await streamMessage(assistantId, assistantContent, setMessages);
      } else {
        const assistantContent = await requestAssistantReply(conversation, cleaned);
        const assistantMessage: Message = {
          id: `a-${Date.now()}`,
          role: "assistant",
          timestamp: createTimestamp(),
          content: assistantContent,
        };
        setMessages((current) => [...current, assistantMessage]);
      }
    } catch (error) {
      const isPiCommand = Boolean(routeToPiPrompt(cleaned));
      const fallback = isPiCommand ? "PI command failed to run in this session." : fallbackReply(cleaned);
      const errorMessage =
        error instanceof Error
          ? error.message
          : isPiCommand
            ? "Unexpected PI command error."
            : "Unexpected assistant error.";

      setMessages((current) => [
        ...current,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          timestamp: createTimestamp(),
          content: `${fallback}\n\nFallback note: ${errorMessage}`,
        },
      ]);
      setLastError(errorMessage);
    } finally {
      setBusy(false);
    }
  };

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  };

  return (
    <div className="app-shell" suppressHydrationWarning>
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo-icon" />
          <span className="logo-text">Convex Scavenger</span>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={item.route === activeSection ? "nav-item active" : "nav-item"}
              >
                <span className="nav-icon">
                  <Icon size={14} color={actionTone} strokeWidth={2} />
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="status-row">
            <span>IB Gateway</span>
            <span className="status-dot-wrap">
              <span className="status-dot" />
              CONNECTED
            </span>
          </div>
          <div className="status-row">
            <span>Last Sync</span>
            <span>18:04:20</span>
          </div>
          <div className="status-row">
            <span>Port</span>
            <span>4001</span>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="header">
          <div className="breadcrumb">
            WORKSPACE / <span>{activeLabel.toUpperCase()}</span>
          </div>
          <div className="header-actions" suppressHydrationWarning>
            <input
              suppressHydrationWarning
              ref={searchRef}
              type="text"
              className="search-input"
              placeholder="CMD+K to search..."
            />
            <button
              suppressHydrationWarning
              className="theme-toggle"
              onClick={toggleTheme}
              title="Toggle theme"
              aria-label="Toggle theme"
            >
              <Search size={14} />
            </button>
          </div>
        </header>

        <div className="content">
          <div className={`section chat-panel ${activeSection === "dashboard" ? "dashboard-chat-panel" : ""}`}>
            <div className="section-header">
              <div className="section-title">
                <Bot size={14} />
                Convex Pi Assistant
              </div>
              <span className="pill defined">LIVE CONVERSATION</span>
            </div>
            <div className="section-body">
              <div className="chat-shell">
                <form suppressHydrationWarning className="chat-input-row" onSubmit={sendMessage}>
                  <textarea
                    suppressHydrationWarning
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Ask Pi for flow analysis, risk checks, action items..."
                    className="chat-textarea"
                    rows={6}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        sendMessage(query);
                      }
                    }}
                    maxLength={400}
                  />
                  <button
                    suppressHydrationWarning
                    className="chat-send"
                    type="submit"
                    disabled={!query.trim()}
                  >
                    <Send size={14} />
                  </button>
                </form>

                <div className="chat-pills" aria-live="polite">
                  {sectionPrompts.map((prompt) => (
                    <button
                      type="button"
                      key={prompt}
                      onClick={() => sendMessage(prompt)}
                      className="pill-chip"
                    >
                      / {prompt}
                    </button>
                  ))}
                </div>

                {lastError ? <div className="chat-error">{lastError}</div> : null}

                {messages.length ? (
                  <div ref={messagesRef} className="chat-messages">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={`chat-message ${message.role}${
                          message.role === "assistant" && !message.content ? " streaming" : ""
                        }`}
                      >
                        <div className="chat-meta">
                          <span className="chat-role">{message.role === "assistant" ? "Pi" : "You"}</span>
                          <span className="chat-time">{message.timestamp}</span>
                        </div>
                        <div className="chat-message-body">{formatChatMessage(message.content)}</div>
                      </div>
                    ))}
                    {isBusy ? (
                      <div className="chat-message assistant streaming">
                        <div className="chat-meta">
                          <span className="chat-role">Pi</span>
                          <span className="chat-time">processing...</span>
                        </div>
                        <div className="chat-message-body">
                          <div className="chat-content">
                            <div className="chat-line">Analyzing flow, structure, and risk context...</div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {activeSection !== "dashboard" ? (
            <div className="metrics-grid">
              {metricCards.map((item) => (
                <div key={item.label} className="metric-card">
                  <div className="metric-label">{item.label}</div>
                  <div className="metric-value">{item.value}</div>
                  <div
                    className={`metric-change ${
                      item.tone === "positive" ? "positive" : item.tone === "negative" ? "negative" : "neutral"
                    }`}
                  >
                    {item.change}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {activeSection !== "dashboard" ? renderWorkspaceSections(activeSection) : null}
        </div>
      </main>
    </div>
  );
}
