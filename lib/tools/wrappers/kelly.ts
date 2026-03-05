import { runScript, type ScriptResult } from "../runner";
import { KellyOutput, type KellyInput } from "../schemas/kelly";
import type { Static } from "@sinclair/typebox";

export async function kelly(input: KellyInput): Promise<ScriptResult<Static<typeof KellyOutput>>> {
  const args = ["--prob", String(input.prob), "--odds", String(input.odds)];

  if (input.fraction != null) {
    args.push("--fraction", String(input.fraction));
  }
  if (input.bankroll != null) {
    args.push("--bankroll", String(input.bankroll));
  }

  return runScript("scripts/kelly.py", {
    args,
    outputSchema: KellyOutput,
  });
}
