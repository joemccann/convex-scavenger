import assert from "node:assert/strict";
import { test } from "node:test";
import {
  titleCase,
  formatCurrency,
  parsePossibleJson,
  normalizeForCell,
  normalizeTextLines,
  valueToText,
  formatArrayAsTable,
  formatPortfolioPayload,
  formatJournalPayload,
  formatAssistantPayload,
  formatPiPayload,
} from "../lib/utils";

test("titleCase converts snake_case to Title Case", () => {
  assert.equal(titleCase("hello_world"), "Hello World");
  assert.equal(titleCase("dark-pool-flow"), "Dark Pool Flow");
  assert.equal(titleCase("single"), "Single");
  assert.equal(titleCase(""), "");
});

test("formatCurrency formats numbers as USD", () => {
  assert.equal(formatCurrency(1000), "$1,000");
  assert.equal(formatCurrency(981353), "$981,353");
  assert.equal(formatCurrency(0), "$0");
  assert.equal(formatCurrency("5000"), "$5,000");
  assert.equal(formatCurrency("not a number"), "N/A");
  assert.equal(formatCurrency(NaN), "N/A");
  assert.equal(formatCurrency(Infinity), "N/A");
});

test("parsePossibleJson parses valid JSON objects and arrays", () => {
  assert.deepEqual(parsePossibleJson('{"a":1}'), { a: 1 });
  assert.deepEqual(parsePossibleJson('[1,2,3]'), [1, 2, 3]);
  assert.equal(parsePossibleJson("not json"), null);
  assert.equal(parsePossibleJson(""), null);
  assert.equal(parsePossibleJson("  "), null);
  assert.equal(parsePossibleJson("hello world"), null);
});

test("normalizeForCell converts values to display strings", () => {
  assert.equal(normalizeForCell(null), "N/A");
  assert.equal(normalizeForCell(undefined), "N/A");
  assert.equal(normalizeForCell("hello"), "hello");
  assert.equal(normalizeForCell(42), "42");
  assert.equal(normalizeForCell(true), "true");
  assert.equal(normalizeForCell({ a: 1 }), '{"a":1}');
});

test("normalizeTextLines trims whitespace and line endings", () => {
  assert.equal(normalizeTextLines("hello  \nworld  \n"), "hello\nworld");
  assert.equal(normalizeTextLines("  hello  \n  world  "), "hello\n  world");
  assert.equal(normalizeTextLines(""), "");
  assert.equal(normalizeTextLines("   "), "");
});

test("valueToText handles all value types", () => {
  assert.equal(valueToText(null), "N/A");
  assert.equal(valueToText(undefined), "N/A");
  assert.equal(valueToText(true), "true");
  assert.equal(valueToText(42), "42");
  assert.equal(valueToText("hello"), "hello");
  assert.equal(valueToText({}), "");
});

test("formatArrayAsTable produces markdown table from objects", () => {
  const data = [
    { ticker: "AAPL", score: 80 },
    { ticker: "MSFT", score: 75 },
  ];
  const result = formatArrayAsTable(data);
  assert.ok(result);
  assert.ok(result.includes("| Ticker | Score |"));
  assert.ok(result.includes("| AAPL | 80 |"));
  assert.ok(result.includes("| MSFT | 75 |"));
});

test("formatArrayAsTable returns message for empty array", () => {
  assert.equal(formatArrayAsTable([]), "No rows available.");
});

test("formatPortfolioPayload formats portfolio data", () => {
  const data = {
    bankroll: 100000,
    position_count: 3,
    defined_risk_count: 1,
    undefined_risk_count: 2,
    last_sync: "2026-01-01",
    positions: [],
  };
  const result = formatPortfolioPayload(data);
  assert.ok(result.includes("Portfolio Snapshot"));
  assert.ok(result.includes("$100,000"));
  assert.ok(result.includes("Positions: 3"));
  assert.ok(result.includes("No positions found."));
});

test("formatJournalPayload formats trade journal", () => {
  const data = { trades: [] };
  const result = formatJournalPayload(data);
  assert.ok(result.includes("Recent Journal"));
  assert.ok(result.includes("No trades logged."));
});

test("formatAssistantPayload passes through plain text", () => {
  assert.equal(formatAssistantPayload("Hello world"), "Hello world");
});

test("formatPiPayload routes portfolio command", () => {
  const json = JSON.stringify({ bankroll: 50000, positions: [] });
  const result = formatPiPayload("portfolio", json);
  assert.ok(result.includes("Portfolio Snapshot"));
  assert.ok(result.includes("$50,000"));
});

test("formatPiPayload routes journal command", () => {
  const json = JSON.stringify({ trades: [] });
  const result = formatPiPayload("journal", json);
  assert.ok(result.includes("Recent Journal"));
});
