import { runScript, type ScriptResult } from "../runner";
import { readDataFile } from "../data-reader";
import { OrdersData, type IBOrdersInput } from "../schemas/ib-orders";
import type { Static } from "@sinclair/typebox";

/**
 * Run ib_orders.py to sync IB orders to data/orders.json.
 *
 * Like ib_sync.py, this writes to the file and prints human-readable stdout.
 * The typed data comes from reading the file afterwards.
 */
export async function ibOrders(
  input: IBOrdersInput = {},
): Promise<ScriptResult<Static<typeof OrdersData>>> {
  const args: string[] = [];

  if (input.sync !== false) args.push("--sync");
  if (input.host) args.push("--host", input.host);
  if (input.port != null) args.push("--port", String(input.port));
  if (input.clientId != null) args.push("--client-id", String(input.clientId));

  const result = await runScript("scripts/ib_orders.py", {
    args,
    timeout: 30_000,
  });

  if (!result.ok) return result;

  const fileResult = await readDataFile("data/orders.json", OrdersData);
  if (!fileResult.ok) {
    return { ok: false, exitCode: 0, stderr: fileResult.error };
  }

  return { ok: true, data: fileResult.data };
}
