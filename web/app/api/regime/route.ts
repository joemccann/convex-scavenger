import { NextResponse } from "next/server";
import { readFile, readdir, writeFile, stat, mkdir } from "fs/promises";
import { join } from "path";
import { isCriDataStale } from "@/lib/criStaleness";
import { spawn } from "child_process";

export const runtime = "nodejs";

const DATA_DIR = join(process.cwd(), "..", "data");
const CACHE_PATH = join(DATA_DIR, "cri.json");
const SCHEDULED_DIR = join(DATA_DIR, "cri_scheduled");
const SCRIPTS_DIR = join(process.cwd(), "..", "scripts");

/** Today's date in ET (YYYY-MM-DD) — the trading calendar reference */
function todayET(): string {
  return new Date().toLocaleDateString("sv", { timeZone: "America/New_York" });
}

const EMPTY_CRI = {
  scan_time: "",
  date: "",
  vix: 0,
  vvix: 0,
  spy: 0,
  vix_5d_roc: 0,
  vvix_vix_ratio: null,
  spx_100d_ma: null,
  spx_distance_pct: 0,
  cor1m: null,
  cor1m_5d_change: null,
  realized_vol: null,
  cri: { score: 0, level: "LOW", components: { vix: 0, vvix: 0, correlation: 0, momentum: 0 } },
  cta: { realized_vol: 0, exposure_pct: 200, forced_reduction_pct: 0, est_selling_bn: 0 },
  menthorq_cta: null,
  crash_trigger: { triggered: false, conditions: { spx_below_100d_ma: false, realized_vol_gt_25: false, cor1m_gt_60: false }, values: {} },
  history: [],
  spy_closes: [],
};

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeCriPayload(raw: Record<string, unknown>): Record<string, unknown> {
  const crashTrigger = (raw.crash_trigger ?? {}) as Record<string, unknown>;
  const conditions = (crashTrigger.conditions ?? {}) as Record<string, unknown>;

  return {
    ...EMPTY_CRI,
    ...raw,
    cor1m: asNumber(raw.cor1m),
    cor1m_5d_change: asNumber(raw.cor1m_5d_change),
    crash_trigger: {
      ...EMPTY_CRI.crash_trigger,
      ...crashTrigger,
      conditions: {
        ...EMPTY_CRI.crash_trigger.conditions,
        ...conditions,
        cor1m_gt_60: typeof conditions.cor1m_gt_60 === "boolean" ? conditions.cor1m_gt_60 : false,
      },
    },
  };
}

let bgScanInFlight = false;

/** Read the latest CRI JSON — scheduled dir first, then legacy cri.json */
async function readLatestCri(): Promise<{ data: object; path: string } | null> {
  // 1. Try scheduled dir — files sort lexicographically by timestamp
  try {
    const files = await readdir(SCHEDULED_DIR);
    const jsonFiles = files.filter((f) => f.startsWith("cri-") && f.endsWith(".json")).sort();
    if (jsonFiles.length > 0) {
      const latest = join(SCHEDULED_DIR, jsonFiles[jsonFiles.length - 1]);
      const raw = await readFile(latest, "utf-8");
      return { data: JSON.parse(raw), path: latest };
    }
  } catch { /* dir may not exist yet */ }

  // 2. Fall back to legacy cache
  try {
    const raw = await readFile(CACHE_PATH, "utf-8");
    return { data: JSON.parse(raw), path: CACHE_PATH };
  } catch { /* no cache */ }

  return null;
}

/** Check if the latest cached data is stale (market-hours aware).
 *  - Different day            → always stale (new trading day)
 *  - market_open=false+today  → NOT stale (EOD data is final; launchd handles schedule)
 *  - market_open=true+today   → stale if mtime > 60s (intraday refresh) */
async function isCacheStale(filePath: string, data: Record<string, unknown>): Promise<boolean> {
  try {
    const s = await stat(filePath);
    return isCriDataStale(data, s.mtimeMs, todayET());
  } catch {
    return true;
  }
}

function runCriScan(): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("python3", ["cri_scan.py", "--json"], {
      cwd: SCRIPTS_DIR,
      timeout: 120_000,
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    proc.on("close", (code) => {
      if (code !== 0) reject(new Error(stderr || `cri_scan.py exited with code ${code}`));
      else resolve(stdout);
    });
    proc.on("error", reject);
  });
}

/** Fire-and-forget: run CRI scan and overwrite the latest scheduled file */
function triggerBackgroundScan(): void {
  if (bgScanInFlight) return;
  bgScanInFlight = true;

  console.log("[CRI] Background scan triggered");
  runCriScan()
    .then(async (stdout) => {
      const jsonStart = stdout.indexOf("{");
      if (jsonStart === -1) return;
      const data = JSON.parse(stdout.slice(jsonStart));
      await mkdir(SCHEDULED_DIR, { recursive: true });
      const ts = new Date().toLocaleString("sv", { timeZone: "America/New_York" })
        .replace(" ", "T").slice(0, 16).replace(":", "-");
      const outPath = join(SCHEDULED_DIR, `cri-${ts}.json`);
      await writeFile(outPath, JSON.stringify(data, null, 2));
      console.log(`[CRI] Background scan complete → ${outPath}`);
    })
    .catch((err) => { console.error("[CRI] Background scan failed:", err.message); })
    .finally(() => { bgScanInFlight = false; });
}

export async function GET(): Promise<Response> {
  const result = await readLatestCri();
  const data = normalizeCriPayload((result?.data ?? EMPTY_CRI) as Record<string, unknown>);

  // Stale-while-revalidate: return cached data immediately,
  // kick off a background scan if data date != today (ET) or file mtime > TTL
  if (!result || await isCacheStale(result.path, data)) {
    triggerBackgroundScan();
  }

  return NextResponse.json(data);
}

export async function POST(): Promise<Response> {
  try {
    const stdout = await runCriScan();
    const jsonStart = stdout.indexOf("{");
    if (jsonStart === -1) throw new Error("No JSON output from cri_scan.py");
    const jsonStr = stdout.slice(jsonStart);
    const data = normalizeCriPayload(JSON.parse(jsonStr));

    await writeFile(CACHE_PATH, JSON.stringify(data, null, 2));

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "CRI scan failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
