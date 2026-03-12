"use client";

import { useEffect, useMemo, useState } from "react";
import type { OpenOrder, PortfolioPosition } from "@/lib/types";
import type { PriceData } from "@/lib/pricesProtocol";
import { useTickerDetail } from "@/lib/TickerDetailContext";
import { legPriceKey, resolveSpreadPriceData } from "@/lib/positionUtils";
import Modal from "./Modal";
import PriceChart from "./PriceChart";
import PositionTab from "./ticker-detail/PositionTab";
import OrderTab from "./ticker-detail/OrderTab";
import NewsTab from "./ticker-detail/NewsTab";
import RatingsTab from "./ticker-detail/RatingsTab";
import SeasonalityTab from "./ticker-detail/SeasonalityTab";
import CompanyTab from "./ticker-detail/CompanyTab";
import { TickerQuoteTelemetry } from "./QuoteTelemetry";
import BookTab from "./ticker-detail/BookTab";
import OptionsChainTab from "./ticker-detail/OptionsChainTab";

type TabId = "company" | "book" | "chain" | "position" | "order" | "news" | "ratings" | "seasonality";

/**
 * Resolve the best price data for the shared ticker quote telemetry wrapper.
 * - Stock positions → underlying ticker price
 * - Single-leg option → option contract price (bid/ask from WS)
 * - Multi-leg → net spread price computed from per-leg WS bid/ask (falls back to underlying)
 * - No position → underlying ticker price
 */
function resolveTickerQuoteTelemetry(
  ticker: string,
  position: PortfolioPosition | null,
  prices: Record<string, PriceData>,
): { priceData: PriceData | null; label?: string; priceKey?: string } {
  if (!position || position.structure_type === "Stock") {
    return { priceData: prices[ticker] ?? null };
  }

  // Single-leg option: use option-level prices
  if (position.legs.length === 1) {
    const leg = position.legs[0];
    const key = legPriceKey(ticker, position.expiry, leg);
    if (key && prices[key]) {
      const strike = leg.strike ? `$${leg.strike}` : "";
      const type = leg.type === "Call" ? "C" : leg.type === "Put" ? "P" : "";
      return {
        priceData: prices[key],
        priceKey: key,
        label: `${ticker} ${position.expiry} ${strike} ${type}`,
      };
    }
  }

  // Multi-leg: compute net spread price from per-leg WS prices
  const spreadData = resolveSpreadPriceData(ticker, position, prices);
  if (spreadData) {
    return { priceData: spreadData, label: `${ticker} ${position.structure}` };
  }

  // Fallback to underlying if leg prices unavailable
  return { priceData: prices[ticker] ?? null, label: `${ticker} (underlying)` };
}

export default function TickerDetailModal({ theme = "dark" }: { theme?: "dark" | "light" }) {
  const { activeTicker, activePositionId, closeTicker, getPrices, getFundamentals, getPortfolio, getOrders } = useTickerDetail();
  const [activeTab, setActiveTab] = useState<TabId | null>(null);

  const prices = getPrices();
  const fundStore = getFundamentals();
  const portfolio = getPortfolio();
  const ordersData = getOrders();

  const position: PortfolioPosition | null = useMemo(() => {
    if (!activeTicker || !portfolio) return null;
    // If a specific position ID was provided (e.g. duplicate tickers), use it
    if (activePositionId != null) {
      return portfolio.positions.find((p) => p.id === activePositionId) ?? null;
    }
    return portfolio.positions.find((p) => p.ticker === activeTicker) ?? null;
  }, [activeTicker, activePositionId, portfolio]);

  // Find open orders for this ticker
  const tickerOrders: OpenOrder[] = useMemo(() => {
    if (!activeTicker || !ordersData) return [];
    return ordersData.open_orders.filter((o) => o.contract.symbol === activeTicker);
  }, [activeTicker, ordersData]);

  // Resolve quote telemetry data (option-level for single-leg options)
  const { priceData, label: priceLabel, priceKey: chartPriceKey } = useMemo(
    () => resolveTickerQuoteTelemetry(activeTicker ?? "", position, prices),
    [activeTicker, position, prices],
  );

  // Reset tab when ticker changes
  useEffect(() => {
    setActiveTab(null);
  }, [activeTicker]);

  // Default tab: always company
  const resolvedTab = activeTab ?? "company";

  if (!activeTicker) return null;

  const tabs: { id: TabId; label: string; hidden?: boolean }[] = [
    { id: "company", label: "Company" },
    { id: "book", label: "Book" },
    { id: "chain", label: "Chain" },
    { id: "position", label: "Position", hidden: !position },
    { id: "order", label: tickerOrders.length > 0 ? `Orders (${tickerOrders.length})` : "Order" },
    { id: "news", label: "News" },
    { id: "ratings", label: "Ratings" },
    { id: "seasonality", label: "Seasonal" },
  ];

  const positionSummary = position
    ? `${position.direction} ${position.contracts}x ${position.structure}`
    : "No Position";

  return (
    <Modal open={true} onClose={closeTicker} title={activeTicker} className="ticker-detail-modal">
      <div className="ticker-detail-content">
        {/* Hero row: telemetry (left) + chart (right) */}
        <div className="ticker-detail-hero">
          <div className="ticker-detail-hero-left">
            <div className="ticker-detail-header">
              <span className={`pill ${position ? "defined" : "neutral"}`} style={{ fontSize: "9px" }}>
                {positionSummary}
              </span>
            </div>
            <TickerQuoteTelemetry priceData={priceData} label={priceLabel} />
          </div>
          <div className="ticker-detail-hero-right">
            <PriceChart ticker={activeTicker} prices={prices} priceKey={chartPriceKey} theme={theme} />
          </div>
        </div>

        {/* Tab bar */}
        <div className="ticker-tabs">
          {tabs.filter((t) => !t.hidden).map((tab) => (
            <button
              key={tab.id}
              className={`ticker-tab ${resolvedTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="ticker-tab-content">
          {resolvedTab === "company" && (
            <CompanyTab ticker={activeTicker} active={resolvedTab === "company"} priceData={prices[activeTicker] ?? null} fundamentals={fundStore[activeTicker] ?? null} />
          )}
          {resolvedTab === "book" && (
            <BookTab
              ticker={activeTicker}
              position={position}
              prices={prices}
              openOrders={tickerOrders}
              tickerPriceData={priceData}
            />
          )}
          {resolvedTab === "chain" && (
            <OptionsChainTab
              ticker={activeTicker}
              prices={prices}
              tickerPriceData={prices[activeTicker] ?? null}
            />
          )}
          {resolvedTab === "position" && position && (
            <PositionTab position={position} prices={prices} />
          )}
          {resolvedTab === "order" && (
            <OrderTab
              ticker={activeTicker}
              position={position}
              portfolio={portfolio}
              prices={prices}
              openOrders={tickerOrders}
              tickerPriceData={priceData}
            />
          )}
          {resolvedTab === "news" && (
            <NewsTab ticker={activeTicker} active={resolvedTab === "news"} />
          )}
          {resolvedTab === "ratings" && (
            <RatingsTab
              ticker={activeTicker}
              active={resolvedTab === "ratings"}
              currentPrice={prices[activeTicker]?.last ?? priceData?.last}
            />
          )}
          {resolvedTab === "seasonality" && (
            <SeasonalityTab
              ticker={activeTicker}
              active={resolvedTab === "seasonality"}
            />
          )}
        </div>
      </div>
    </Modal>
  );
}
