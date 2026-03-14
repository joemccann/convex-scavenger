"use client";

import { useCallback, useState } from "react";
import type { OpenOrder, PortfolioPosition } from "@/lib/types";
import type { PriceData } from "@/lib/pricesProtocol";
import { fmtPrice } from "@/lib/positionUtils";

/* ─── Types ─── */

type BookTabProps = {
  ticker: string;
  position: PortfolioPosition | null;
  prices: Record<string, PriceData>;
  openOrders: OpenOrder[];
  tickerPriceData: PriceData | null;
};

type OrderAction = "BUY" | "SELL";

/* ─── L1 Order Book ─── */

function L1OrderBook({
  bid,
  ask,
  spread,
  last,
  bidSize,
  askSize,
}: {
  bid: number | null;
  ask: number | null;
  spread: number | null;
  last: number | null;
  bidSize: number | null;
  askSize: number | null;
}) {
  return (
    <div className="book-l1">
      <div
        className="book-s-hd"
      >
        ORDER BOOK
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          gap: "16px",
          alignItems: "center",
        }}
      >
        {/* Bid side */}
        <div style={{ textAlign: "center" }}>
          <div
            className="font-mono t-s uppercase"
            style={{ fontSize: "10px", marginBottom: "4px" }}
          >
            BID
          </div>
          <div
            className="positive font-mono"
            style={{ fontSize: "16px", fontWeight: 600 }}
          >
            {bid != null ? fmtPrice(bid) : "---"}
          </div>
          <div
            className="font-mono t-s"
            style={{ fontSize: "11px", marginTop: "2px" }}
          >
            {bidSize != null ? bidSize : "---"}
          </div>
        </div>

        {/* Spread */}
        <div style={{ textAlign: "center" }}>
          <div
            className="font-mono t-s uppercase"
            style={{ fontSize: "10px", marginBottom: "4px" }}
          >
            SPREAD
          </div>
          <div
            className="font-mono"
            style={{ fontSize: "14px", color: "var(--text-primary, #e2e8f0)" }}
          >
            {spread != null ? spread.toFixed(2) : "---"}
          </div>
          <div
            className="font-mono t-s"
            style={{ fontSize: "10px", marginTop: "2px" }}
          >
            {last != null ? `LAST ${fmtPrice(last)}` : ""}
          </div>
        </div>

        {/* Ask side */}
        <div style={{ textAlign: "center" }}>
          <div
            className="font-mono t-s uppercase"
            style={{ fontSize: "10px", marginBottom: "4px" }}
          >
            ASK
          </div>
          <div
            className="negative font-mono"
            style={{ fontSize: "16px", fontWeight: 600 }}
          >
            {ask != null ? fmtPrice(ask) : "---"}
          </div>
          <div
            className="font-mono t-s"
            style={{ fontSize: "11px", marginTop: "2px" }}
          >
            {askSize != null ? askSize : "---"}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Position Summary ─── */

function PositionSummary({ position }: { position: PortfolioPosition }) {
  return (
    <div style={{ marginTop: "16px" }}>
      <div
        className="book-s-hd"
      >
        POSITION
      </div>
      <div className="isg">
        <div className="ps">
          <span className="ps-l">DIRECTION</span>
          <span className="ps-v">
            {position.direction} {position.contracts}x
          </span>
        </div>
        <div className="ps">
          <span className="ps-l">STRUCTURE</span>
          <span className="ps-v">{position.structure}</span>
        </div>
        <div className="ps">
          <span className="ps-l">AVG COST</span>
          <span className="ps-v">
            {position.entry_cost != null
              ? fmtPrice(
                  Math.abs(position.entry_cost) /
                    (position.contracts *
                      (position.structure_type === "Stock" ? 1 : 100))
                )
              : "---"}
          </span>
        </div>
        <div className="ps">
          <span className="ps-l">MKT VALUE</span>
          <span className="ps-v">
            {position.market_value != null
              ? fmtPrice(Math.abs(position.market_value))
              : "---"}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─── Open Orders List ─── */

function OpenOrdersList({ orders }: { orders: OpenOrder[] }) {
  return (
    <div style={{ marginTop: "16px" }}>
      <div
        className="book-s-hd"
      >
        OPEN ORDERS ({orders.length})
      </div>
      {orders.map((o, i) => {
        const c = o.contract;
        const desc =
          c.secType === "OPT"
            ? `${c.symbol} ${c.expiry ?? ""} $${c.strike ?? ""} ${c.right ?? ""}`
            : c.symbol;

        return (
          <div
            key={o.permId || o.orderId || i}
            className="font-mono fc"
            style={{
              justifyContent: "space-between",
              padding: "6px 0",
              borderBottom: "1px solid var(--line-grid, #1e293b)",
              fontSize: "12px",
            }}
          >
            <div className="fc" style={{ gap: "8px" }}>
              <span
                className={`pill ${o.action === "BUY" ? "accum" : "distrib"}`}
                style={{ fontSize: "9px" }}
              >
                {o.action}
              </span>
              <span>{desc}</span>
              <span className="t-s">
                {o.totalQuantity}x
              </span>
            </div>
            <div className="fc" style={{ gap: "12px" }}>
              <span>
                {o.limitPrice != null ? fmtPrice(o.limitPrice) : "MKT"}
              </span>
              <span className="t-s" style={{ fontSize: "10px" }}>
                {o.tif} / {o.status}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Stock Order Form ─── */

function StockOrderForm({
  ticker,
  position,
  bid,
  ask,
  mid,
}: {
  ticker: string;
  position: PortfolioPosition | null;
  bid: number | null;
  ask: number | null;
  mid: number | null;
}) {
  const defaultAction: OrderAction = position != null ? "SELL" : "BUY";
  const [action, setAction] = useState<OrderAction>(defaultAction);
  const [quantity, setQuantity] = useState(() => {
    if (position && position.structure_type === "Stock")
      return String(position.contracts);
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
  const isValid =
    !isNaN(parsedQty) &&
    parsedQty > 0 &&
    !isNaN(parsedPrice) &&
    parsedPrice > 0;

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
        setSuccess(
          `Order placed: ${action} ${parsedQty} ${ticker} @ ${fmtPrice(parsedPrice)}`
        );
        setConfirmStep(false);
      }
    } catch {
      setError("Network error placing order");
    } finally {
      setLoading(false);
    }
  }, [confirmStep, ticker, action, parsedQty, parsedPrice, tif, position]);

  return (
    <div className="of" style={{ marginTop: "16px" }}>
      <div
        className="book-s-hd"
      >
        STOCK ORDER
      </div>

      <div className="o-f">
        <label className="o-l">Action</label>
        <div className="o-ab">
          <button
            className={`order-action-btn ${action === "BUY" ? "oaa oby" : ""}`}
            onClick={() => {
              setAction("BUY");
              setConfirmStep(false);
            }}
          >
            BUY
          </button>
          <button
            className={`order-action-btn ${action === "SELL" ? "oaa oas" : ""}`}
            onClick={() => {
              setAction("SELL");
              setConfirmStep(false);
            }}
          >
            SELL
          </button>
        </div>
      </div>

      <div className="o-f">
        <label className="o-l">Quantity</label>
        <input
          className="oi"
          type="number"
          min="1"
          step="1"
          value={quantity}
          onChange={(e) => {
            setQuantity(e.target.value);
            setConfirmStep(false);
          }}
          placeholder="Shares"
        />
      </div>

      <div className="o-f">
        <label className="o-l">Limit Price</label>
        <div className="mp-ir">
          <span className="mp-p">$</span>
          <input
            className="modify-price-input"
            type="number"
            step="0.01"
            min="0.01"
            value={limitPrice}
            onChange={(e) => {
              setLimitPrice(e.target.value);
              setConfirmStep(false);
            }}
            placeholder="0.00"
          />
        </div>
        <div className="mq-b">
          <button
            className="bq"
            disabled={bid == null}
            onClick={() => {
              if (bid != null) {
                setLimitPrice(bid.toFixed(2));
                setConfirmStep(false);
              }
            }}
          >
            BID
          </button>
          <button
            className="bq"
            disabled={mid == null}
            onClick={() => {
              if (mid != null) {
                setLimitPrice(mid.toFixed(2));
                setConfirmStep(false);
              }
            }}
          >
            MID
          </button>
          <button
            className="bq"
            disabled={ask == null}
            onClick={() => {
              if (ask != null) {
                setLimitPrice(ask.toFixed(2));
                setConfirmStep(false);
              }
            }}
          >
            ASK
          </button>
        </div>
      </div>

      <div className="o-f">
        <label className="o-l">Time in Force</label>
        <div className="o-ab">
          <button
            className={`order-action-btn ${tif === "DAY" ? "oaa" : ""}`}
            onClick={() => setTif("DAY")}
          >
            DAY
          </button>
          <button
            className={`order-action-btn ${tif === "GTC" ? "oaa" : ""}`}
            onClick={() => setTif("GTC")}
          >
            GTC
          </button>
        </div>
      </div>

      {error && <div className="order-error">{error}</div>}
      {success && <div className="order-success">{success}</div>}

      <div className="os">
        {confirmStep ? (
          <div className="oc-r">
            <button
              className="bt-s"
              onClick={() => setConfirmStep(false)}
              disabled={loading}
            >
              Back
            </button>
            <button
              className={`btn-primary ${action === "SELL" ? "btn-danger" : ""}`}
              onClick={handlePlace}
              disabled={!isValid || loading}
            >
              {loading
                ? "Placing..."
                : `Confirm: ${action} ${parsedQty} ${ticker} @ ${fmtPrice(parsedPrice)}`}
            </button>
          </div>
        ) : (
          <button
            className="bp w-full"
            onClick={handlePlace}
            disabled={!isValid || loading}
          >
            Place Order
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Main BookTab ─── */

export default function BookTab({
  ticker,
  position,
  prices,
  openOrders,
  tickerPriceData,
}: BookTabProps) {
  const priceData = tickerPriceData ?? prices[ticker] ?? null;
  const bid = priceData?.bid ?? null;
  const ask = priceData?.ask ?? null;
  const mid = bid != null && ask != null ? (bid + ask) / 2 : null;
  const spread = bid != null && ask != null ? ask - bid : null;
  const last = priceData?.last ?? null;

  return (
    <div className="book-tab" style={{ padding: "16px 0" }}>
      <L1OrderBook
        bid={bid}
        ask={ask}
        spread={spread}
        last={last}
        bidSize={priceData?.bidSize ?? null}
        askSize={priceData?.askSize ?? null}
      />

      {position && <PositionSummary position={position} />}

      <StockOrderForm
        ticker={ticker}
        position={position}
        bid={bid}
        ask={ask}
        mid={mid}
      />

      {openOrders.length > 0 && <OpenOrdersList orders={openOrders} />}
    </div>
  );
}
