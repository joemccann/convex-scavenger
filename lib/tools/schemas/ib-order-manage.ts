import { Type, type Static } from "@sinclair/typebox";

// ── Cancel Input ──────────────────────────────────────────────────────

export const IBCancelInput = Type.Object({
  orderId: Type.Number({ description: "IB order ID" }),
  permId: Type.Number({ description: "IB permanent order ID" }),
  host: Type.Optional(Type.String()),
  port: Type.Optional(Type.Number()),
});

export type IBCancelInput = Static<typeof IBCancelInput>;

// ── Modify Input ──────────────────────────────────────────────────────

export const IBModifyInput = Type.Object({
  orderId: Type.Number({ description: "IB order ID" }),
  permId: Type.Number({ description: "IB permanent order ID" }),
  newPrice: Type.Number({ description: "New limit price" }),
  host: Type.Optional(Type.String()),
  port: Type.Optional(Type.Number()),
});

export type IBModifyInput = Static<typeof IBModifyInput>;

// ── Output (matches ib_order_manage.py JSON) ──────────────────────────

export const IBOrderManageOutput = Type.Object({
  status: Type.Union([Type.Literal("ok"), Type.Literal("error")]),
  message: Type.String(),
  orderId: Type.Optional(Type.Number()),
  finalStatus: Type.Optional(Type.String()),
  oldPrice: Type.Optional(Type.Number()),
  newPrice: Type.Optional(Type.Number()),
});

export type IBOrderManageOutput = Static<typeof IBOrderManageOutput>;
