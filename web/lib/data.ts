import {
  Circle,
  LayoutDashboard,
  LineChart,
  Search,
  Sparkles,
  Wrench,
} from "lucide-react";
import type { FlowRow, WorkspaceNavItem, WorkspaceSection } from "./types";

export const PI_COMMANDS = ["scan", "discover", "evaluate", "portfolio", "journal", "sync", "leap-scan", "help"] as const;
export const PI_COMMAND_SET = new Set<string>(PI_COMMANDS);

export const PI_COMMAND_ALIASES: Record<string, string> = {
  "compare support vs against": "/scan --top 20",
  "action items": "/journal --limit 25",
  "what are action items": "/journal --limit 25",
  "review watch list": "/scan --top 12",
  "watch list": "/scan --top 12",
  "watchlist": "/scan --top 12",
};

export const navItems: WorkspaceNavItem[] = [
  { label: "Dashboard", route: "dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Flow Analysis", route: "flow-analysis", href: "/flow-analysis", icon: LineChart },
  { label: "Portfolio", route: "portfolio", href: "/portfolio", icon: Circle },
  { label: "Scanner", route: "scanner", href: "/scanner", icon: Sparkles },
  { label: "Discover", route: "discover", href: "/discover", icon: Search },
  { label: "Journal", route: "journal", href: "/journal", icon: Wrench },
];

export const metricCards = [
  { label: "Net Liquidation", value: "$981,353", change: "BANKROLL", tone: "neutral" },
  { label: "Positions", value: "19", change: "7 DEFINED / 12 UNDEFINED", tone: "neutral" },
  { label: "Flow Aligned", value: "6", change: "↑ SUPPORTED", tone: "positive" },
  { label: "Flow Against", value: "2", change: "↓ REVIEW NEEDED", tone: "negative" },
];

export const supports: FlowRow[] = [
  { ticker: "IGV", position: "Long Calls + Risk Rev", flowLabel: "72% ACCUM", flowClass: "accum", strength: "44.2", note: "Strong institutional buying" },
  { ticker: "NFLX", position: "Long Stock", flowLabel: "60% ACCUM", flowClass: "accum", strength: "20.5", note: "Friday 93% buy ratio" },
  { ticker: "PLTR", position: "Risk Reversal", flowLabel: "61% ACCUM", flowClass: "accum", strength: "22.2", note: "Friday 80% buy ratio" },
  { ticker: "EWY", position: "Bear Put Spread", flowLabel: "42% DISTRIB", flowClass: "distrib", strength: "16.6", note: "Flow confirms bearish bet" },
  { ticker: "EC", position: "Long Stock", flowLabel: "58% ACCUM", flowClass: "accum", strength: "15.3", note: "Modest accumulation" },
  { ticker: "SOFI", position: "Long Calls", flowLabel: "56% ACCUM", flowClass: "accum", strength: "11.7", note: "Weak but directional" },
];

export const against: FlowRow[] = [
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

export const watchRows = [
  { ticker: "MSFT", flow: "Fri 0.8%", className: "distrib", note: "Massive single-day distribution", position: "Long 1K shares ($469K)" },
  { ticker: "BKD", flow: "Fri 65%", className: "accum", note: "Recent day bullish, against bearish spread", position: "Bear Put Spread" },
];

export const neutralRows = [
  { ticker: "AAOI", strength: "50%", className: "neutral", prints: "992" },
  { ticker: "BAP", strength: "51%", className: "neutral", prints: "216" },
  { ticker: "ETHA", strength: "54%", className: "neutral", prints: "699" },
  { ticker: "ILF", strength: "53%", className: "neutral", prints: "251" },
  { ticker: "NAK", strength: "55%", className: "accum", prints: "19" },
  { ticker: "TSLL", strength: "49%", className: "neutral", prints: "1,827" },
  { ticker: "URTY", strength: "45%", className: "neutral", prints: "257" },
  { ticker: "USAX", strength: "100%", className: "accum", prints: "3" },
];

export const quickPromptsBySection: Record<WorkspaceSection, string[]> = {
  dashboard: ["portfolio", "scan --top 12", "compare support vs against", "review watch list", "help"],
  "flow-analysis": ["analyze brze", "compare support vs against", "what are action items", "review watch list", "scan --top 12", "evaluate brze", "portfolio"],
  portfolio: ["portfolio", "analyze brze", "journal --limit 10", "evaluate msft", "help"],
  scanner: ["scan --top 25", "scan --min-score 12", "evaluate igv", "discover", "help"],
  discover: ["discover", "scan --top 12", "analyze aaoi", "journal", "help"],
  journal: ["journal --limit 25", "portfolio", "analyze nfLx", "help"],
};

export const sectionDescription: Record<WorkspaceSection, string> = {
  dashboard: "Portfolio snapshot and command control panel.",
  "flow-analysis": "Flow and position analysis context.",
  portfolio: "Current portfolio-focused controls and risk summary.",
  scanner: "Candidate discovery and scan-driven alerts.",
  discover: "Opportunity discovery and watchlist growth.",
  journal: "Trade decision logs and history review.",
};
