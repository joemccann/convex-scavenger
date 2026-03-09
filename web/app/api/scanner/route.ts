import { NextResponse } from "next/server";
import { readFile, writeFile } from "fs/promises";
import { statSync } from "fs";
import { join } from "path";
import { spawn } from "child_process";

export const runtime = "nodejs";

const CACHE_PATH = join(process.cwd(), "..", "data", "scanner.json");
const SCRIPTS_DIR = join(process.cwd(), "..", "scripts");
const STALE_THRESHOLD_SECONDS = 600;

interface CacheMeta {
  last_refresh: string | null;
  age_seconds: number | null;
  is_stale: boolean;
  stale_threshold_seconds: number;
}

function buildCacheMeta(filePath: string): CacheMeta {
  try {
    const s = statSync(filePath);
    const ageSeconds = (Date.now() - s.mtime.getTime()) / 1000;
    return {
      last_refresh: s.mtime.toISOString(),
      age_seconds: Math.round(ageSeconds),
      is_stale: ageSeconds > STALE_THRESHOLD_SECONDS,
      stale_threshold_seconds: STALE_THRESHOLD_SECONDS,
    };
  } catch {
    return {
      last_refresh: null,
      age_seconds: null,
      is_stale: true,
      stale_threshold_seconds: STALE_THRESHOLD_SECONDS,
    };
  }
}

function runScanner(): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("python3", ["scanner.py", "--top", "25"], {
      cwd: SCRIPTS_DIR,
      timeout: 120_000,
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    proc.on("close", (code) => {
      if (code !== 0) reject(new Error(stderr || `scanner.py exited with code ${code}`));
      else resolve(stdout);
    });
    proc.on("error", reject);
  });
}

export async function GET(): Promise<Response> {
  try {
    const raw = await readFile(CACHE_PATH, "utf-8");
    const data = JSON.parse(raw);
    const cache_meta = buildCacheMeta(CACHE_PATH);
    return NextResponse.json({ ...data, cache_meta });
  } catch {
    const cache_meta = buildCacheMeta(CACHE_PATH);
    return NextResponse.json({
      scan_time: "",
      tickers_scanned: 0,
      signals_found: 0,
      top_signals: [],
      cache_meta,
    });
  }
}

export async function POST(): Promise<Response> {
  try {
    const stdout = await runScanner();
    const jsonStart = stdout.indexOf("{");
    if (jsonStart === -1) throw new Error("No JSON output from scanner.py");
    const jsonStr = stdout.slice(jsonStart);
    const data = JSON.parse(jsonStr);

    await writeFile(CACHE_PATH, JSON.stringify(data, null, 2));

    const cache_meta = buildCacheMeta(CACHE_PATH);
    return NextResponse.json({ ...data, cache_meta });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scanner failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
