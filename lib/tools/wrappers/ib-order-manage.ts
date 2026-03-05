import { runScript, type ScriptResult } from "../runner";
import {
  IBOrderManageOutput,
  type IBCancelInput,
  type IBModifyInput,
} from "../schemas/ib-order-manage";
import type { Static } from "@sinclair/typebox";

type ManageResult = ScriptResult<Static<typeof IBOrderManageOutput>>;

export async function ibCancelOrder(input: IBCancelInput): Promise<ManageResult> {
  const args = [
    "cancel",
    "--order-id", String(input.orderId),
    "--perm-id", String(input.permId),
  ];

  if (input.host) args.push("--host", input.host);
  args.push("--port", String(input.port ?? 4001));

  return runScript("scripts/ib_order_manage.py", {
    args,
    timeout: 15_000,
    outputSchema: IBOrderManageOutput,
  });
}

export async function ibModifyOrder(input: IBModifyInput): Promise<ManageResult> {
  const args = [
    "modify",
    "--order-id", String(input.orderId),
    "--perm-id", String(input.permId),
    "--new-price", String(input.newPrice),
  ];

  if (input.host) args.push("--host", input.host);
  args.push("--port", String(input.port ?? 4001));

  return runScript("scripts/ib_order_manage.py", {
    args,
    timeout: 15_000,
    outputSchema: IBOrderManageOutput,
  });
}
