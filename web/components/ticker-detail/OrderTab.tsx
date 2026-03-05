"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import type { OpenOrder, PortfolioPosition } from "@/lib/types";
import type { PriceData } from "@/lib/pricesProtocol";
import { optionKey } from "@/lib/pricesProtocol";
import { useOrderActions } from "@/lib/OrderActionsContext";
import { fmtPrice } from "@/components/WorkspaceSections";

type OrderTabProps = {
  ticker: string;
  position: PortfolioPosition | null;
  prices: Record<string, PriceData>;
  openOrders?: OpenOrder[];
};

/* ─── Resolve price data for an order's contract ─── */

function resolveOrderPriceData(order: OpenOrder, prices: Record<string, PriceData>): PriceData | null {
  const c = order.contract;
  if (c.secType === "STK") return prices[c.symbol] ?? null;
  if (c.secType === "OPT" && c.strike != null && c.right && c.expiry) {
    const expiryClean = c.expiry.replace(/-/g, "");
    if (expiryClean.length === 8) {
      const key = optionKey({
        symbol: c.symbol.toUpperCase(),
        expiry: expiryClean,
        strike: c.strike,
        right: c.right as "C" | "P",
      });
      return prices[key] ?? null;
    }
  }
  return null;
}

/* ─── Existing order row with modify/cancel ─── */

function ExistingOrderRow({
  order,
  prices,
}: {
  order: OpenOrder;
  prices: Record<string, PriceData>;
}) {
  const { pendingCancels, pendingModifies, requestCancel, requestModify } = useOrderActions();
  const [modifying, setModifying] = useState(false);
  const [newPrice, setNewPrice] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const isPendingCancel = pendingCancels.has(order.permId);
  const isPendingModify = pendingModifies.has(order.permId);
  const isPending = isPendingCancel || isPendingModify;

  const priceData = resolveOrderPriceData(order, prices);
  const bid = priceData?.bid ?? null;
  const ask = priceData?.ask ?? null;
  const mid = bid != null && ask != null ? (bid + ask) / 2 : null;
  const canModify = order.orderType === "LMT" || order.orderType === "STP LMT";

  // Reset modify form when opening
  useEffect(() => {
    if (modifying && order.limitPrice != null) {
      setNewPrice(order.limitPrice.toFixed(2));
    }
  }, [modifying, order.limitPrice]);

  const handleCancel = useCallback(async () => {
    setActionLoading(true);
    await requestCancel(order);
    setActionLoading(false);
  }, [order, requestCancel]);

  const handleModify = useCallback(async () => {
    const parsed = parseFloat(newPrice);
    if (isNaN(parsed) || parsed <= 0) return;
    setActionLoading(true);
    await requestModify(order, parsed);
    setActionLoading(false);
    setModifying(false);
  }, [order, newPrice, requestModify]);

  const parsedNew = parseFloat(newPrice);
  const isValidModify = !isNaN(parsedNew) && parsedNew > 0 && order.limitPrice != null && Math.abs(parsedNew - order.limitPrice) >= 0.005;

  // Contract description
  const c = order.contract;
  const desc = c.secType === "OPT"
    ? `${c.symbol} ${c.expiry ?? ""} $${c.strike ?? ""} ${c.right ?? ""}`
    : c.symbol;

  return (
    <div className={`existing-order ${isPendingCancel ? "existing-order-cancelling" : isPendingModify ? "existing-order-modifying" : ""}`}>
      <div className="existing-order-header">
        <div className="existing-order-info">
          <span className={`pill ${order.action === "BUY" ? "accum" : "distrib"}`} style={{ fontSize: "9px" }}>
            {order.action}
          </span>
          <span className="existing-order-desc">{desc}</span>
          <span className="existing-order-qty">{order.totalQuantity}x</span>
        </div>
        <div className="existing-order-status">
          {isPending && <Loader2 size={12} className="cancel-spinner" />}
          <span className="existing-order-status-text">
            {isPendingCancel ? "Cancelling..." : isPendingModify ? "Modifying..." : order.status}
          </span>
        </div>
      </div>

      <div className="existing-order-details">
        <div className="existing-order-detail">
          <span className="pos-stat-label">TYPE</span>
          <span className="pos-stat-value">{order.orderType}</span>
        </div>
        <div className="existing-order-detail">
          <span className="pos-stat-label">LIMIT</span>
          <span className="pos-stat-value">{order.limitPrice != null ? fmtPrice(order.limitPrice) : "---"}</span>
        </div>
        <div className="existing-order-detail">
          <span className="pos-stat-label">TIF</span>
          <span className="pos-stat-value">{order.tif}</span>
        </div>
        <div className="existing-order-detail">
          <span className="pos-stat-label">LAST</span>
          <span className="pos-stat-value">{priceData?.last != null ? fmtPrice(priceData.last) : "---"}</span>
        </div>
      </div>

      {/* Modify form (inline) */}
      {modifying && (
        <div className="existing-order-modify">
          <div className="modify-price-section">
            <label className="modify-price-label">New Limit Price</label>
            <div className="modify-price-input-row">
              <span className="modify-price-prefix">$</span>
              <input
                className="modify-price-input"
                type="number"
                step="0.01"
                min="0.01"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                autoFocus
              />
            </div>
            <div className="modify-quick-buttons">
              <button className="btn-quick" disabled={bid == null} onClick={() => bid != null && setNewPrice(bid.toFixed(2))}>BID</button>
              <button className="btn-quick" disabled={mid == null} onClick={() => mid != null && setNewPrice(mid.toFixed(2))}>MID</button>
              <button className="btn-quick" disabled={ask == null} onClick={() => ask != null && setNewPrice(ask.toFixed(2))}>ASK</button>
            </div>
          </div>
          <div className="modify-actions">
            <button className="btn-secondary" onClick={() => setModifying(false)} disabled={actionLoading}>Cancel</button>
            <button className="btn-primary" onClick={handleModify} disabled={!isValidModify || actionLoading}>
              {actionLoading ? "Modifying..." : "Modify Order"}
            </button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {!modifying && !isPending && (
        <div className="existing-order-actions">
          <button
            className="btn-order-action btn-modify"
            disabled={!canModify}
            title={canModify ? "Modify limit price" : "Only LMT orders can be modified"}
            onClick={() => setModifying(true)}
          >
            MODIFY
          </button>
          <button
            className="btn-order-action btn-cancel"
            onClick={handleCancel}
            disabled={actionLoading}
          >
            {actionLoading ? "..." : "CANCEL"}
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── New order form ─── */

type OrderAction = "BUY" | "SELL";

function NewOrderForm({
  ticker,
  position,
  prices,
  onOrderPlaced,
}: {
  ticker: string;
  position: PortfolioPosition | null;
  prices: Record<string, PriceData>;
  onOrderPlaced?: () => void;
}) {
  const priceData = prices[ticker] ?? null;
  const bid = priceData?.bid ?? null;
  const ask = priceData?.ask ?? null;
  const mid = bid != null && ask != null ? (bid + ask) / 2 : null;

  const defaultAction: OrderAction = position != null ? "SELL" : "BUY";
  const [action, setAction] = useState<OrderAction>(defaultAction);
  const [quantity, setQuantity] = useState(() => {
    if (position && position.structure_type === "Stock") return String(position.contracts);
    return "";
  });
  const [limitPrice, setLimitPrice] = useState("");
  const [tif, setTif] = useState<"DAY" | "GTC">("DAY");
  const [confirmStep, setConfirmStep] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const parsedQty = parseInt(quantity, 10);
  const parsedPrice = parseFloat(limitPrice);
  const isValid = !isNaN(parsedQty) && parsedQty > 0 && !isNaN(parsedPrice) && parsedPrice > 0;

  const handlePlace = useCallback(async () => {
    if (!confirmStep) {
      setConfirmStep(true);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/orders/place", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "stock",
          symbol: ticker,
          action,
          quantity: parsedQty,
          limitPrice: parsedPrice,
          tif,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Order placement failed");
      } else {
        setSuccess(`Order placed: ${action} ${parsedQty} ${ticker} @ ${fmtPrice(parsedPrice)}`);
        setConfirmStep(false);
        onOrderPlaced?.();
      }
    } catch {
      setError("Network error placing order");
    } finally {
      setLoading(false);
    }
  }, [confirmStep, ticker, action, parsedQty, parsedPrice, tif, onOrderPlaced]);

  return (
    <div className="order-form">
      <div className="order-field">
        <label className="order-label">Action</label>
        <div className="order-action-buttons">
          <button
            className={`order-action-btn ${action === "BUY" ? "order-action-active order-action-buy" : ""}`}
            onClick={() => { setAction("BUY"); setConfirmStep(false); }}
          >
            BUY
          </button>
          <button
            className={`order-action-btn ${action === "SELL" ? "order-action-active order-action-sell" : ""}`}
            onClick={() => { setAction("SELL"); setConfirmStep(false); }}
          >
            SELL
          </button>
        </div>
      </div>

      <div className="order-field">
        <label className="order-label">Quantity</label>
        <input
          className="order-input"
          type="number"
          min="1"
          step="1"
          value={quantity}
          onChange={(e) => { setQuantity(e.target.value); setConfirmStep(false); }}
          placeholder="Shares"
        />
      </div>

      <div className="order-field">
        <label className="order-label">Limit Price</label>
        <div className="modify-price-input-row">
          <span className="modify-price-prefix">$</span>
          <input
            className="modify-price-input"
            type="number"
            step="0.01"
            min="0.01"
            value={limitPrice}
            onChange={(e) => { setLimitPrice(e.target.value); setConfirmStep(false); }}
            placeholder="0.00"
          />
        </div>
        <div className="modify-quick-buttons">
          <button className="btn-quick" disabled={bid == null} onClick={() => { if (bid != null) { setLimitPrice(bid.toFixed(2)); setConfirmStep(false); } }}>BID</button>
          <button className="btn-quick" disabled={mid == null} onClick={() => { if (mid != null) { setLimitPrice(mid.toFixed(2)); setConfirmStep(false); } }}>MID</button>
          <button className="btn-quick" disabled={ask == null} onClick={() => { if (ask != null) { setLimitPrice(ask.toFixed(2)); setConfirmStep(false); } }}>ASK</button>
        </div>
      </div>

      <div className="order-field">
        <label className="order-label">Time in Force</label>
        <div className="order-action-buttons">
          <button className={`order-action-btn ${tif === "DAY" ? "order-action-active" : ""}`} onClick={() => setTif("DAY")}>DAY</button>
          <button className={`order-action-btn ${tif === "GTC" ? "order-action-active" : ""}`} onClick={() => setTif("GTC")}>GTC</button>
        </div>
      </div>

      {error && <div className="order-error">{error}</div>}
      {success && <div className="order-success">{success}</div>}

      <div className="order-submit">
        {confirmStep ? (
          <div className="order-confirm-row">
            <button className="btn-secondary" onClick={() => setConfirmStep(false)} disabled={loading}>Back</button>
            <button
              className={`btn-primary ${action === "SELL" ? "btn-danger" : ""}`}
              onClick={handlePlace}
              disabled={!isValid || loading}
            >
              {loading ? "Placing..." : `Confirm: ${action} ${parsedQty} ${ticker} @ ${fmtPrice(parsedPrice)}`}
            </button>
          </div>
        ) : (
          <button className="btn-primary" onClick={handlePlace} disabled={!isValid || loading} style={{ width: "100%" }}>
            Place Order
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Main OrderTab ─── */

export default function OrderTab({ ticker, position, prices, openOrders = [] }: OrderTabProps) {
  const isCombo = position != null && position.legs.length > 1 && position.structure_type !== "Stock";

  if (isCombo) {
    return (
      <div className="order-tab">
        <div className="order-combo-notice">
          This is a multi-leg position ({position.structure}). Close individual legs via the Orders page or use the CLI evaluate command for complex option orders.
        </div>
      </div>
    );
  }

  return (
    <div className="order-tab">
      {/* Existing open orders for this ticker */}
      {openOrders.length > 0 && (
        <div className="existing-orders-section">
          <div className="existing-orders-title">Open Orders</div>
          {openOrders.map((o) => (
            <ExistingOrderRow key={o.permId || o.orderId} order={o} prices={prices} />
          ))}
        </div>
      )}

      {/* New order form */}
      <div className={openOrders.length > 0 ? "new-order-section" : ""}>
        {openOrders.length > 0 && <div className="existing-orders-title">New Order</div>}
        <NewOrderForm ticker={ticker} position={position} prices={prices} />
      </div>
    </div>
  );
}
