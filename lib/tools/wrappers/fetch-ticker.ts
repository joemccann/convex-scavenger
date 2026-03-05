import { runScript, type ScriptResult } from "../runner";
import { FetchTickerOutput, type FetchTickerInput } from "../schemas/fetch-ticker";
import type { Static } from "@sinclair/typebox";

export async function fetchTicker(
  input: FetchTickerInput,
): Promise<ScriptResult<Static<typeof FetchTickerOutput>>> {
  return runScript("scripts/fetch_ticker.py", {
    args: [input.ticker],
    outputSchema: FetchTickerOutput,
  });
}
