import { NextResponse } from "next/server";
import { ibCancelOrder } from "@tools/wrappers/ib-order-manage";
import { ibOrders } from "@tools/wrappers/ib-orders";
import { readDataFile } from "@tools/data-reader";
import { OrdersData } from "@tools/schemas/ib-orders";

export const runtime = "nodejs";

type CancelBody = {
  orderId?: number;
  permId?: number;
};

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as CancelBody;
    const orderId = body.orderId ?? 0;
    const permId = body.permId ?? 0;

    if (orderId === 0 && permId === 0) {
      return NextResponse.json(
        { error: "Must provide orderId or permId" },
        { status: 400 },
      );
    }

    const result = await ibCancelOrder({ orderId, permId, port: 4001 });

    if (!result.ok) {
      return NextResponse.json(
        { error: "Cancel failed", stderr: result.stderr },
        { status: 502 },
      );
    }

    if (result.data.status === "error") {
      return NextResponse.json(
        { error: result.data.message, detail: result.data },
        { status: 502 },
      );
    }

    // Refresh orders after cancel
    await ibOrders({ sync: true, port: 4001, clientId: 11 });
    const ordersResult = await readDataFile("data/orders.json", OrdersData);

    return NextResponse.json({
      status: "ok",
      message: result.data.message,
      orders: ordersResult.ok ? ordersResult.data : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cancel failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
