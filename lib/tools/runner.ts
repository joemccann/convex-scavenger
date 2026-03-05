/**
 * Universal Python script runner.
 *
 * Single implementation of spawn-and-parse replacing 5+ duplicated versions
 * across API routes and PI extensions.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { Value } from "@sinclair/typebox/value";
import type { TSchema, Static } from "@sinclair/typebox";

// ── Result types ──────────────────────────────────────────────────────

export type ScriptSuccess<T> = { ok: true; data: T };
export type ScriptFailure = { ok: false; exitCode: number | null; stderr: string };
export type ScriptResult<T> = ScriptSuccess<T> | ScriptFailure;

// ── Options ───────────────────────────────────────────────────────────

export interface RunScriptOptions<S extends TSchema | undefined = undefined> {
  /** CLI arguments passed after the script path. */
  args?: string[];
  /** Working directory (defaults to resolveProjectRoot()). */
  cwd?: string;
  /** Timeout in ms before SIGKILL. Default: 30 000. */
  timeout?: number;
  /** TypeBox schema to validate parsed JSON output against. */
  outputSchema?: S;
  /** If true, spawn in detached mode (fire-and-forget). */
  detached?: boolean;
  /** Max stdout chars to keep. Default: 200 000. */
  maxOutput?: number;
}

// ── Project root resolution ───────────────────────────────────────────

let _cachedRoot: string | null = null;

/**
 * Walk up from cwd looking for the project root.
 * Checks for `scripts/` AND `data/` directories.
 * Result is cached for the process lifetime.
 */
export function resolveProjectRoot(): string {
  if (_cachedRoot) return _cachedRoot;

  const candidates = [
    process.cwd(),
    path.resolve(process.cwd(), ".."),
    path.resolve(process.cwd(), "..", ".."),
  ];

  for (const candidate of candidates) {
    if (
      existsSync(path.join(candidate, "scripts")) &&
      existsSync(path.join(candidate, "data"))
    ) {
      _cachedRoot = candidate;
      return candidate;
    }
  }

  // Fallback — best effort
  return process.cwd();
}

/** Reset cached root (useful for tests). */
export function _resetRootCache(): void {
  _cachedRoot = null;
}

// ── Runner ────────────────────────────────────────────────────────────

/**
 * Spawn a Python script, collect stdout/stderr, parse JSON, optionally validate.
 *
 * @param scriptPath  Relative path from project root (e.g. "scripts/kelly.py").
 * @param opts        See {@link RunScriptOptions}.
 * @returns           Discriminated union: `{ ok, data }` or `{ ok, exitCode, stderr }`.
 */
export function runScript<T = unknown, S extends TSchema | undefined = undefined>(
  scriptPath: string,
  opts: RunScriptOptions<S> = {},
): Promise<ScriptResult<S extends TSchema ? Static<S> : T>> {
  const {
    args = [],
    cwd = resolveProjectRoot(),
    timeout = 30_000,
    outputSchema,
    detached = false,
    maxOutput = 200_000,
  } = opts;

  return new Promise((resolve) => {
    const fullPath = path.join(cwd, scriptPath);

    // Fail fast if script doesn't exist
    if (!existsSync(fullPath)) {
      resolve({
        ok: false,
        exitCode: null,
        stderr: `Script not found: ${fullPath}`,
      });
      return;
    }

    const proc: ChildProcess = spawn("python3", [scriptPath, ...args], {
      cwd,
      env: process.env,
      detached,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      if (stdout.length + text.length <= maxOutput) {
        stdout += text;
      }
    });

    proc.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
    }, timeout);

    proc.on("error", (err: Error) => {
      clearTimeout(timer);
      resolve({ ok: false, exitCode: null, stderr: err.message });
    });

    proc.on("close", (code: number | null) => {
      clearTimeout(timer);

      if (code !== 0) {
        resolve({ ok: false, exitCode: code, stderr });
        return;
      }

      // Parse JSON from stdout
      let parsed: unknown;
      try {
        parsed = JSON.parse(stdout);
      } catch {
        resolve({
          ok: false,
          exitCode: code,
          stderr: `Invalid JSON output: ${stdout.slice(0, 500)}`,
        });
        return;
      }

      // Optional schema validation
      if (outputSchema) {
        if (!Value.Check(outputSchema, parsed)) {
          const errors = [...Value.Errors(outputSchema, parsed)];
          const summary = errors
            .slice(0, 5)
            .map((e) => `${e.path}: ${e.message}`)
            .join("; ");
          resolve({
            ok: false,
            exitCode: code,
            stderr: `Schema validation failed: ${summary}`,
          });
          return;
        }
      }

      resolve({ ok: true, data: parsed as S extends TSchema ? Static<S> : T });
    });

    if (detached) {
      proc.unref();
    }
  });
}
