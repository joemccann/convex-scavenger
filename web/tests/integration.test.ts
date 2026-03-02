import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NextRequest } from "next/server";

type CommandResult = {
  status: number;
  stdout: string;
  stderr: string;
};

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const runPython = (args: string[]): CommandResult => {
  const result = spawnSync("python3", args, {
    cwd: projectRoot,
    encoding: "utf8",
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });

  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
};

const runPiRequest = async (input: string) => {
  const { POST } = await import("../app/api/pi/route");
  const req = new NextRequest("http://localhost/api/pi", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input }),
  });

  const response = await POST(req);
  const body = await response.json();
  return { response, body };
};

test("pi API returns local portfolio payload", async () => {
  const { response, body } = await runPiRequest("/portfolio");

  assert.equal(response.status, 200);
  assert.equal(body.command, "portfolio");
  assert.equal(body.status, "ok");
  assert.ok(typeof body.output === "string");
  assert.ok(body.output.includes("bankroll"));
});

test("pi API returns journal entries with limit", async () => {
  const { response, body } = await runPiRequest("/journal --limit 2");

  assert.equal(response.status, 200);
  assert.equal(body.command, "journal");
  assert.equal(body.status, "ok");
  const parsed = JSON.parse(body.output);
  assert.ok(Array.isArray(parsed.trades));
  assert.ok(parsed.trades.length <= 2);
});

test("pi API blocks unsupported commands", async () => {
  const { response, body } = await runPiRequest("rm -rf /");

  assert.equal(response.status, 400);
  assert.equal(typeof body.error, "string");
});

test("assistant API route returns mock response when mock mode is enabled", async () => {
  const { POST } = await import("../app/api/assistant/route");
  const req = new NextRequest("http://localhost/api/assistant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{ role: "user", content: "analyze brze" }],
    }),
  });

  const response = await POST(req);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(typeof body.content, "string");
  assert.ok(body.content.includes("Mock Claude response"));
  assert.equal(body.model, "mock");
});

test("pi command --help screens are available", () => {
  const helpCommands = [
    { command: ["scripts/fetch_flow.py", "--help"], expectedStatus: 0 },
    { command: ["scripts/discover.py", "--help"], expectedStatus: 0 },
    { command: ["scripts/scanner.py", "--help"], expectedStatus: 0 },
    { command: ["scripts/fetch_ticker.py"], expectedStatus: 1 },
  ];

  for (const item of helpCommands) {
    const result = runPython(item.command);
    assert.equal(result.status, item.expectedStatus, `Expected ${item.command.join(" ")} to return status ${item.expectedStatus}`);
    const text = `${result.stdout} ${result.stderr}`.toLowerCase();
    assert.ok(text.includes("usage") || text.includes("description"), `Expected usage text for ${item.command.join(" ")}`);
  }
});

test("kelly command returns valid risk sizing JSON", () => {
  const result = runPython([
    "scripts/kelly.py",
    "--prob",
    "0.35",
    "--odds",
    "3.5",
    "--fraction",
    "0.25",
    "--bankroll",
    "100000",
  ]);

  assert.equal(result.status, 0);

  const payload = JSON.parse(result.stdout);
  assert.equal(payload.recommendation, "STRONG");
  assert.equal(typeof payload.full_kelly_pct, "number");
  assert.equal(typeof payload.fractional_kelly_pct, "number");
  assert.ok(payload.use_size > 0);
});
