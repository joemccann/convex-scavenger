import { runScript, type ScriptResult } from "../runner";
import { readDataFile } from "../data-reader";
import { PortfolioData, type IBSyncInput } from "../schemas/ib-sync";
import type { Static } from "@sinclair/typebox";

/**
 * Run ib_sync.py to sync IB portfolio to data/portfolio.json.
 *
 * Note: ib_sync.py writes to the JSON file and prints human-readable output
 * to stdout. The actual data comes from reading the file afterwards.
 */
export async function ibSync(
  input: IBSyncInput = {},
): Promise<ScriptResult<Static<typeof PortfolioData>>> {
  const args: string[] = [];

  if (input.sync !== false) args.push("--sync");
  if (input.host) args.push("--host", input.host);
  if (input.port != null) args.push("--port", String(input.port));
  if (input.clientId != null) args.push("--client-id", String(input.clientId));
  if (input.noPrices) args.push("--no-prices");

  const result = await runScript("scripts/ib_sync.py", {
    args,
    timeout: 30_000,
  });

  if (!result.ok) return result;

  // ib_sync.py writes to file rather than stdout JSON — read the file
  const fileResult = await readDataFile("data/portfolio.json", PortfolioData);
  if (!fileResult.ok) {
    return { ok: false, exitCode: 0, stderr: fileResult.error };
  }

  return { ok: true, data: fileResult.data };
}
