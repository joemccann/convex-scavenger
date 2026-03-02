import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isPiCommandInput,
  normalizeCommandInput,
  routeToPiPrompt,
  fallbackReply,
  resolveSectionFromPath,
} from "../lib/chat";

test("isPiCommandInput identifies valid PI commands", () => {
  assert.equal(isPiCommandInput("scan"), true);
  assert.equal(isPiCommandInput("/scan"), true);
  assert.equal(isPiCommandInput("scan --top 20"), true);
  assert.equal(isPiCommandInput("discover"), true);
  assert.equal(isPiCommandInput("evaluate AAPL"), true);
  assert.equal(isPiCommandInput("portfolio"), true);
  assert.equal(isPiCommandInput("journal --limit 5"), true);
  assert.equal(isPiCommandInput("help"), true);
  assert.equal(isPiCommandInput("sync"), true);
  assert.equal(isPiCommandInput("leap-scan"), true);
});

test("isPiCommandInput rejects non-commands", () => {
  assert.equal(isPiCommandInput("hello world"), false);
  assert.equal(isPiCommandInput("analyze brze"), false);
  assert.equal(isPiCommandInput(""), false);
  assert.equal(isPiCommandInput("   "), false);
});

test("normalizeCommandInput adds leading slash", () => {
  assert.equal(normalizeCommandInput("scan"), "/scan");
  assert.equal(normalizeCommandInput("/scan"), "/scan");
  assert.equal(normalizeCommandInput("  scan --top 5  "), "/scan --top 5");
});

test("routeToPiPrompt routes direct commands", () => {
  assert.equal(routeToPiPrompt("scan"), "/scan");
  assert.equal(routeToPiPrompt("/scan --top 20"), "/scan --top 20");
  assert.equal(routeToPiPrompt("portfolio"), "/portfolio");
  assert.equal(routeToPiPrompt("discover"), "/discover");
});

test("routeToPiPrompt routes aliases", () => {
  assert.equal(routeToPiPrompt("compare support vs against"), "/scan --top 20");
  assert.equal(routeToPiPrompt("action items"), "/journal --limit 25");
  assert.equal(routeToPiPrompt("watch list"), "/scan --top 12");
  assert.equal(routeToPiPrompt("watchlist"), "/scan --top 12");
});

test("routeToPiPrompt routes analyze to evaluate", () => {
  assert.equal(routeToPiPrompt("analyze AAPL"), "/evaluate AAPL");
  assert.equal(routeToPiPrompt("analyze brze"), "/evaluate BRZE");
});

test("routeToPiPrompt routes keyword matches", () => {
  assert.equal(routeToPiPrompt("show me the portfolio"), "/portfolio");
  assert.equal(routeToPiPrompt("check positions"), "/portfolio");
  assert.equal(routeToPiPrompt("run a scan"), "/scan");
  assert.equal(routeToPiPrompt("open journal"), "/journal");
  assert.equal(routeToPiPrompt("let me discover opportunities"), "/discover");
});

test("routeToPiPrompt returns null for unrecognized input", () => {
  assert.equal(routeToPiPrompt("hello world"), null);
  assert.equal(routeToPiPrompt("what is the weather"), null);
  assert.equal(routeToPiPrompt(""), null);
  assert.equal(routeToPiPrompt("   "), null);
});

test("fallbackReply returns contextual replies", () => {
  assert.ok(fallbackReply("").length > 0);
  assert.ok(fallbackReply("brze").includes("BRZE"));
  assert.ok(fallbackReply("analyze rr").includes("RR"));
  assert.ok(fallbackReply("portfolio").includes("19 positions"));
  assert.ok(fallbackReply("compare support vs against").includes("6 positions"));
});

test("resolveSectionFromPath maps URL paths to sections", () => {
  assert.equal(resolveSectionFromPath("/", "dashboard"), "dashboard");
  assert.equal(resolveSectionFromPath("/dashboard", "dashboard"), "dashboard");
  assert.equal(resolveSectionFromPath("/flow-analysis", "dashboard"), "flow-analysis");
  assert.equal(resolveSectionFromPath("/portfolio", "dashboard"), "portfolio");
  assert.equal(resolveSectionFromPath("/scanner", "dashboard"), "scanner");
  assert.equal(resolveSectionFromPath("/discover", "dashboard"), "discover");
  assert.equal(resolveSectionFromPath("/journal", "dashboard"), "journal");
  assert.equal(resolveSectionFromPath("/unknown", "dashboard"), "dashboard");
  assert.equal(resolveSectionFromPath(null, "dashboard"), "dashboard");
});
