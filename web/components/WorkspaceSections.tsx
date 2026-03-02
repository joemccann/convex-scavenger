"use client";

import { useCallback } from "react";
import {
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  ClipboardList,
  Search,
  Sparkles,
  TrendingDown,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import type { ExecutedOrder, OpenOrder, OrdersData, PortfolioData, PortfolioPosition, WorkspaceSection } from "@/lib/types";
import { against, neutralRows, supports, watchRows } from "@/lib/data";
import { useSort, type SortDirection } from "@/lib/useSort";

/* ─── Sortable header cell ──────────────────────────────── */

function SortTh<K extends string>({
  label,
  sortKey,
  activeKey,
  direction,
  onToggle,
  className,
}: {
  label: string;
  sortKey: K;
  activeKey: K | null;
  direction: SortDirection;
  onToggle: (key: K) => void;
  className?: string;
}) {
  const active = activeKey === sortKey;
  return (
    <th
      className={`sortable-th ${className ?? ""} ${active ? "sort-active" : ""}`}
      onClick={() => onToggle(sortKey)}
    >
      <span className="sort-label">
        {label}
        <span className="sort-icon">
          {active ? (
            direction === "asc" ? <ChevronUp size={10} /> : <ChevronDown size={10} />
          ) : (
            <ChevronDown size={10} className="sort-icon-idle" />
          )}
        </span>
      </span>
    </th>
  );
}

/* ─── Flow tables ───────────────────────────────────────── */

type FlowKey = "ticker" | "position" | "flowLabel" | "strength" | "note";

const flowExtract = (item: { ticker: string; position: string; flowLabel: string; strength: string; note: string }, key: FlowKey) => {
  if (key === "strength") return parseFloat(item[key]);
  return item[key];
};

function FlowSections() {
  const supSort = useSort(supports, flowExtract);
  const againstSort = useSort(against, flowExtract);

  type WatchKey = "ticker" | "position" | "flow" | "note";
  const watchExtract = useCallback((item: (typeof watchRows)[number], key: WatchKey) => item[key], []);
  const wSort = useSort(watchRows, watchExtract);

  type NeutralKey = "ticker" | "strength" | "prints";
  const neutralExtract = useCallback((item: (typeof neutralRows)[number], key: NeutralKey) => {
    if (key === "prints") return parseInt(item[key].replace(/,/g, ""), 10);
    if (key === "strength") return parseInt(item[key], 10);
    return item[key];
  }, []);
  const nSort = useSort(neutralRows, neutralExtract);

  return (
    <>
      <div className="section">
        <div className="alert-box">
          <div className="alert-title">
            <TriangleAlert size={14} />
            ACTION ITEMS
          </div>
          <div className="alert-item">
            <span className="alert-ticker">BRZE</span> — Long calls expiring Mar 20 (20 days) with 42% distribution flow. Consider exit or reduced exposure.
          </div>
          <div className="alert-item">
            <span className="alert-ticker">RR</span> — Sustained distribution. Review thesis for continued hold.
          </div>
          <div className="alert-item">
            <span className="alert-ticker">MSFT</span> — $469K position saw massive Friday selling (0.8% buy ratio). Monitor Monday.
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-header">
          <div className="section-title">
            <CheckCircle2 size={14} />
            Flow Supports Position
          </div>
          <span className="pill defined">6 POSITIONS</span>
        </div>
        <div className="section-body">
          <table>
            <thead>
              <tr>
                <SortTh label="Ticker" sortKey="ticker" activeKey={supSort.sort.key} direction={supSort.sort.direction} onToggle={supSort.toggle} />
                <SortTh label="Position" sortKey="position" activeKey={supSort.sort.key} direction={supSort.sort.direction} onToggle={supSort.toggle} />
                <SortTh label="Flow" sortKey="flowLabel" activeKey={supSort.sort.key} direction={supSort.sort.direction} onToggle={supSort.toggle} />
                <SortTh label="Strength" sortKey="strength" activeKey={supSort.sort.key} direction={supSort.sort.direction} onToggle={supSort.toggle} />
                <SortTh label="Signal" sortKey="note" activeKey={supSort.sort.key} direction={supSort.sort.direction} onToggle={supSort.toggle} />
              </tr>
            </thead>
            <tbody>
              {supSort.sorted.map((item) => (
                <tr key={`support-${item.ticker}`}>
                  <td><strong>{item.ticker}</strong></td>
                  <td>{item.position}</td>
                  <td><span className={`pill ${item.flowClass}`}>{item.flowLabel}</span></td>
                  <td>
                    <div className="strength-bar">
                      <div className="strength-fill" style={{ width: `${item.strength}%` }} />
                    </div>
                    <div className="strength-value">{item.strength}</div>
                  </td>
                  <td>{item.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="section">
        <div className="section-header">
          <div className="section-title">
            <TrendingDown size={14} />
            Flow Against Position
          </div>
          <span className="pill distrib">2 POSITIONS</span>
        </div>
        <div className="section-body">
          <table>
            <thead>
              <tr>
                <SortTh label="Ticker" sortKey="ticker" activeKey={againstSort.sort.key} direction={againstSort.sort.direction} onToggle={againstSort.toggle} />
                <SortTh label="Position" sortKey="position" activeKey={againstSort.sort.key} direction={againstSort.sort.direction} onToggle={againstSort.toggle} />
                <SortTh label="Flow" sortKey="flowLabel" activeKey={againstSort.sort.key} direction={againstSort.sort.direction} onToggle={againstSort.toggle} />
                <SortTh label="Strength" sortKey="strength" activeKey={againstSort.sort.key} direction={againstSort.sort.direction} onToggle={againstSort.toggle} />
                <SortTh label="Concern" sortKey="note" activeKey={againstSort.sort.key} direction={againstSort.sort.direction} onToggle={againstSort.toggle} />
              </tr>
            </thead>
            <tbody>
              {againstSort.sorted.map((item) => (
                <tr key={`against-${item.ticker}`}>
                  <td><strong>{item.ticker}</strong></td>
                  <td>{item.position}</td>
                  <td><span className={`pill ${item.flowClass}`}>{item.flowLabel}</span></td>
                  <td>
                    <div className="strength-bar">
                      <div className="strength-fill" style={{ width: `${item.strength}%` }} />
                    </div>
                    <div className="strength-value">{item.strength}</div>
                  </td>
                  <td>{item.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="two-col">
        <div className="section">
          <div className="section-header">
            <div className="section-title">
              <Bell size={14} />
              Watch Closely
            </div>
            <span className="pill undefined">2 POSITIONS</span>
          </div>
          <div className="section-body">
            <table>
              <thead>
                <tr>
                  <SortTh label="Ticker" sortKey="ticker" activeKey={wSort.sort.key} direction={wSort.sort.direction} onToggle={wSort.toggle} />
                  <SortTh label="Position" sortKey="position" activeKey={wSort.sort.key} direction={wSort.sort.direction} onToggle={wSort.toggle} />
                  <SortTh label="Flow" sortKey="flow" activeKey={wSort.sort.key} direction={wSort.sort.direction} onToggle={wSort.toggle} />
                  <SortTh label="Note" sortKey="note" activeKey={wSort.sort.key} direction={wSort.sort.direction} onToggle={wSort.toggle} />
                </tr>
              </thead>
              <tbody>
                {wSort.sorted.map((item) => (
                  <tr key={item.ticker}>
                    <td><strong>{item.ticker}</strong></td>
                    <td>{item.position}</td>
                    <td><span className={`pill ${item.className}`}>{item.flow}</span></td>
                    <td>{item.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="section">
          <div className="section-header">
            <div className="section-title">
              <Circle size={14} />
              Neutral / Low Signal
            </div>
            <span className="pill neutral">8 POSITIONS</span>
          </div>
          <div className="section-body">
            <table>
              <thead>
                <tr>
                  <SortTh label="Ticker" sortKey="ticker" activeKey={nSort.sort.key} direction={nSort.sort.direction} onToggle={nSort.toggle} />
                  <SortTh label="Flow" sortKey="strength" activeKey={nSort.sort.key} direction={nSort.sort.direction} onToggle={nSort.toggle} />
                  <SortTh label="Prints" sortKey="prints" className="right" activeKey={nSort.sort.key} direction={nSort.sort.direction} onToggle={nSort.toggle} />
                </tr>
              </thead>
              <tbody>
                {nSort.sorted.map((row) => (
                  <tr key={`neutral-${row.ticker}`}>
                    <td>{row.ticker}</td>
                    <td><span className={`pill ${row.className}`}>{row.strength}</span></td>
                    <td className="right">{row.prints}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="report-meta">
          Report Generated: 2026-02-28 18:12:12 PST • Source: IB Gateway (4001) • Dark Pool Lookback: 5 Trading Days
        </div>
      </div>
    </>
  );
}

/* ─── Portfolio tables ──────────────────────────────────── */

const fmtUsd = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const fmtPrice = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function resolveMarketValue(pos: PortfolioPosition): number | null {
  // For multi-leg positions, always recompute sign-aware from legs
  if (pos.legs.length > 1) {
    const known = pos.legs.filter((l) => l.market_value != null);
    if (known.length === 0) return null;
    return known.reduce((s, l) => {
      const sign = l.direction === "LONG" ? 1 : -1;
      return s + sign * Math.abs(l.market_value!);
    }, 0);
  }
  if (pos.market_value != null) return pos.market_value;
  const single = pos.legs[0];
  return single?.market_value ?? null;
}

function getMultiplier(pos: PortfolioPosition): number {
  return pos.structure_type === "Stock" ? 1 : 100;
}

function resolveEntryCost(pos: PortfolioPosition): number {
  if (pos.legs.length > 1) {
    return pos.legs.reduce((s, l) => {
      const sign = l.direction === "LONG" ? 1 : -1;
      return s + sign * Math.abs(l.entry_cost);
    }, 0);
  }
  return pos.entry_cost;
}

function getAvgEntry(pos: PortfolioPosition): number {
  const mult = getMultiplier(pos);
  return resolveEntryCost(pos) / (pos.contracts * mult);
}

function getLastPrice(pos: PortfolioPosition): number | null {
  const mv = resolveMarketValue(pos);
  if (mv == null) return null;
  const mult = getMultiplier(pos);
  return mv / (pos.contracts * mult);
}

function PositionRow({ pos, showExpiry = true }: { pos: PortfolioPosition; showExpiry?: boolean }) {
  const mv = resolveMarketValue(pos);
  const entryCost = resolveEntryCost(pos);
  const pnl = mv != null ? mv - entryCost : null;
  const pnlPct = pnl != null && entryCost !== 0 ? (pnl / Math.abs(entryCost)) * 100 : null;
  const avgEntry = getAvgEntry(pos);
  const lastPrice = getLastPrice(pos);

  return (
    <>
      <tr>
        <td><strong>{pos.ticker}</strong></td>
        <td>{pos.structure}</td>
        <td>
          <span className={`pill ${pos.risk_profile === "defined" ? "defined" : pos.risk_profile === "equity" ? "neutral" : "undefined"}`}>
            {pos.direction}
          </span>
        </td>
        <td className="right">{fmtPrice(avgEntry)}</td>
        <td className="right">{lastPrice != null ? fmtPrice(lastPrice) : "—"}</td>
        <td className="right">{fmtUsd(entryCost)}</td>
        <td className="right">{mv != null ? fmtUsd(mv) : "—"}</td>
        <td className={`right ${pnl != null ? (pnl >= 0 ? "positive" : "negative") : ""}`}>
          {pnl != null ? `${pnl >= 0 ? "+" : ""}${fmtUsd(Math.abs(pnl))} (${pnlPct!.toFixed(1)}%)` : "—"}
        </td>
        {showExpiry && <td>{pos.expiry !== "N/A" ? pos.expiry : "—"}</td>}
      </tr>
      {pos.legs.length > 1 && pos.legs.map((leg, i) => (
        <tr key={`${pos.id}-leg-${i}`} className="leg-row">
          <td></td>
          <td colSpan={2} style={{ paddingLeft: "1.5rem", opacity: 0.7, fontSize: "0.85em" }}>
            {leg.direction} {leg.contracts}x {leg.type}{leg.strike ? ` $${leg.strike}` : ""}
          </td>
          <td className="right" style={{ opacity: 0.7, fontSize: "0.85em" }}>{fmtPrice(Math.abs(leg.avg_cost) / (leg.type === "Stock" ? 1 : 100))}</td>
          <td className="right" style={{ opacity: 0.7, fontSize: "0.85em" }}>{leg.market_price != null ? fmtPrice(Math.abs(leg.market_price)) : "—"}</td>
          <td className="right" style={{ opacity: 0.7, fontSize: "0.85em" }}>{fmtUsd(Math.abs(leg.entry_cost))}</td>
          <td className="right" style={{ opacity: 0.7, fontSize: "0.85em" }}>{leg.market_value != null ? fmtUsd(Math.abs(leg.market_value)) : "—"}</td>
          <td></td>
          {showExpiry && <td></td>}
        </tr>
      ))}
    </>
  );
}

type PositionSortKey = "ticker" | "structure" | "direction" | "avg_entry" | "last_price" | "entry_cost" | "market_value" | "pnl" | "expiry";

const positionExtract = (pos: PortfolioPosition, key: PositionSortKey): string | number | null => {
  const mv = resolveMarketValue(pos);
  switch (key) {
    case "ticker": return pos.ticker;
    case "structure": return pos.structure;
    case "direction": return pos.direction;
    case "avg_entry": return getAvgEntry(pos);
    case "last_price": return getLastPrice(pos);
    case "entry_cost": return resolveEntryCost(pos);
    case "market_value": return mv;
    case "pnl": return mv != null ? mv - resolveEntryCost(pos) : null;
    case "expiry": return pos.expiry === "N/A" ? null : pos.expiry;
    default: return null;
  }
};

function PositionTable({ positions, showExpiry = true }: { positions: PortfolioPosition[]; showExpiry?: boolean }) {
  const { sorted, sort, toggle } = useSort(positions, positionExtract);

  return (
    <table>
      <thead>
        <tr>
          <SortTh<PositionSortKey> label="Ticker" sortKey="ticker" activeKey={sort.key} direction={sort.direction} onToggle={toggle} />
          <SortTh<PositionSortKey> label="Structure" sortKey="structure" activeKey={sort.key} direction={sort.direction} onToggle={toggle} />
          <SortTh<PositionSortKey> label="Direction" sortKey="direction" activeKey={sort.key} direction={sort.direction} onToggle={toggle} />
          <SortTh<PositionSortKey> label="Avg Entry" sortKey="avg_entry" className="right" activeKey={sort.key} direction={sort.direction} onToggle={toggle} />
          <SortTh<PositionSortKey> label="Last Price" sortKey="last_price" className="right" activeKey={sort.key} direction={sort.direction} onToggle={toggle} />
          <SortTh<PositionSortKey> label="Entry Cost" sortKey="entry_cost" className="right" activeKey={sort.key} direction={sort.direction} onToggle={toggle} />
          <SortTh<PositionSortKey> label="Market Value" sortKey="market_value" className="right" activeKey={sort.key} direction={sort.direction} onToggle={toggle} />
          <SortTh<PositionSortKey> label="P&L" sortKey="pnl" className="right" activeKey={sort.key} direction={sort.direction} onToggle={toggle} />
          {showExpiry && <SortTh<PositionSortKey> label="Expiry" sortKey="expiry" activeKey={sort.key} direction={sort.direction} onToggle={toggle} />}
        </tr>
      </thead>
      <tbody>
        {sorted.map((pos) => (
          <PositionRow key={pos.id} pos={pos} showExpiry={showExpiry} />
        ))}
      </tbody>
    </table>
  );
}

function PortfolioSections({ portfolio }: { portfolio: PortfolioData | null }) {
  if (!portfolio) {
    return (
      <div className="section">
        <div className="section-header">
          <div className="section-title">
            <Circle size={14} />
            Portfolio
          </div>
          <span className="pill neutral">LOADING</span>
        </div>
        <div className="section-body">
          <div className="alert-item">Waiting for portfolio data...</div>
        </div>
      </div>
    );
  }

  const definedPositions = portfolio.positions.filter((p) => p.risk_profile === "defined");
  const equityPositions = portfolio.positions.filter((p) => p.risk_profile === "equity");
  const undefinedPositions = portfolio.positions.filter((p) => p.risk_profile === "undefined");

  return (
    <>
      {definedPositions.length > 0 && (
        <div className="section">
          <div className="section-header">
            <div className="section-title">
              <CheckCircle2 size={14} />
              Defined Risk Positions
            </div>
            <span className="pill defined">{definedPositions.length} POSITIONS</span>
          </div>
          <div className="section-body">
            <PositionTable positions={definedPositions} />
          </div>
        </div>
      )}

      {equityPositions.length > 0 && (
        <div className="section">
          <div className="section-header">
            <div className="section-title">
              <Circle size={14} />
              Equity Positions
            </div>
            <span className="pill neutral">{equityPositions.length} POSITIONS</span>
          </div>
          <div className="section-body">
            <PositionTable positions={equityPositions} showExpiry={false} />
          </div>
        </div>
      )}

      {undefinedPositions.length > 0 && (
        <div className="section">
          <div className="section-header">
            <div className="section-title">
              <TriangleAlert size={14} />
              Undefined Risk Positions
            </div>
            <span className="pill undefined">{undefinedPositions.length} POSITIONS</span>
          </div>
          <div className="section-body">
            <PositionTable positions={undefinedPositions} />
          </div>
        </div>
      )}

      <div className="section">
        <div className="report-meta">
          Last Sync: {new Date(portfolio.last_sync).toLocaleString()} • Source: IB Gateway (4001)
        </div>
      </div>
    </>
  );
}

/* ─── Scanner table ─────────────────────────────────────── */

type ScannerKey = "ticker" | "signal" | "strength";

function ScannerSections() {
  const data = neutralRows.slice(0, 4);
  const scannerExtract = useCallback((item: (typeof neutralRows)[number], key: ScannerKey) => {
    if (key === "signal") return "Neutral Flow";
    if (key === "strength") return parseInt(item.strength, 10);
    return item[key];
  }, []);
  const { sorted, sort, toggle } = useSort(data, scannerExtract);

  return (
    <>
      <div className="section">
        <div className="section-header">
          <div className="section-title">
            <Sparkles size={14} />
            Scanner Signals
          </div>
          <span className="pill defined">SCANNER</span>
        </div>
        <div className="section-body">
          <table>
            <thead>
              <tr>
                <SortTh<ScannerKey> label="Ticker" sortKey="ticker" activeKey={sort.key} direction={sort.direction} onToggle={toggle} />
                <SortTh<ScannerKey> label="Signal" sortKey="signal" activeKey={sort.key} direction={sort.direction} onToggle={toggle} />
                <SortTh<ScannerKey> label="Signal Strength" sortKey="strength" activeKey={sort.key} direction={sort.direction} onToggle={toggle} />
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr key={`scanner-${row.ticker}`}>
                  <td>{row.ticker}</td>
                  <td>Neutral Flow</td>
                  <td>{row.strength}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ─── Non-table sections ────────────────────────────────── */

function DiscoverSections() {
  return (
    <>
      <div className="section">
        <div className="section-header">
          <div className="section-title">
            <Search size={14} />
            Discovery Queue
          </div>
          <span className="pill defined">DISCOVER</span>
        </div>
        <div className="section-body">
          <div className="alert-item">Discovering by premise and options flow strength.</div>
          <div className="alert-item">BKD, MSFT, and IGV currently in active watch set.</div>
        </div>
      </div>
      <div className="section">
        <div className="section-header">
          <div className="section-title">
            <Bell size={14} />
            Watch candidates
          </div>
          <span className="pill neutral">LIVE</span>
        </div>
        <div className="section-body">
          <div className="report-meta">
            Report Generated: 2026-02-28 18:12:12 PST • Source: Internal Market Scanner
          </div>
        </div>
      </div>
    </>
  );
}

function JournalSections() {
  return (
    <>
      <div className="section">
        <div className="section-header">
          <div className="section-title">
            <Wrench size={14} />
            Journal Log
          </div>
          <span className="pill defined">JOURNAL</span>
        </div>
        <div className="section-body">
          <div className="alert-item">No trade decision yet. Request `/journal --limit N` for most recent entries.</div>
          <div className="alert-item">BRZE and RR flagged by recent flow event.</div>
        </div>
      </div>
    </>
  );
}

/* ─── Orders tables ────────────────────────────────────── */

type OpenOrderKey = "symbol" | "action" | "orderType" | "totalQuantity" | "limitPrice" | "status" | "tif";

const openOrderExtract = (item: OpenOrder, key: OpenOrderKey): string | number | null => {
  switch (key) {
    case "symbol": return item.symbol;
    case "action": return item.action;
    case "orderType": return item.orderType;
    case "totalQuantity": return item.totalQuantity;
    case "limitPrice": return item.limitPrice;
    case "status": return item.status;
    case "tif": return item.tif;
    default: return null;
  }
};

type ExecOrderKey = "symbol" | "side" | "quantity" | "avgPrice" | "commission" | "realizedPNL" | "time";

const execOrderExtract = (item: ExecutedOrder, key: ExecOrderKey): string | number | null => {
  switch (key) {
    case "symbol": return item.symbol;
    case "side": return item.side;
    case "quantity": return item.quantity;
    case "avgPrice": return item.avgPrice;
    case "commission": return item.commission;
    case "realizedPNL": return item.realizedPNL;
    case "time": return item.time;
    default: return null;
  }
};

function OrdersSections({ orders }: { orders: OrdersData | null }) {
  const openSort = useSort(orders?.open_orders ?? [], openOrderExtract);
  const execSort = useSort<ExecutedOrder, ExecOrderKey>(orders?.executed_orders ?? [], execOrderExtract, "time", "desc");

  if (!orders) {
    return (
      <div className="section">
        <div className="section-header">
          <div className="section-title">
            <ClipboardList size={14} />
            Orders
          </div>
          <span className="pill neutral">LOADING</span>
        </div>
        <div className="section-body">
          <div className="alert-item">Waiting for orders data...</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="section">
        <div className="section-header">
          <div className="section-title">
            <ClipboardList size={14} />
            Open Orders
          </div>
          <span className="pill defined">{orders.open_count} ORDERS</span>
        </div>
        <div className="section-body">
          {orders.open_orders.length === 0 ? (
            <div className="alert-item">No open orders</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <SortTh<OpenOrderKey> label="Symbol" sortKey="symbol" activeKey={openSort.sort.key} direction={openSort.sort.direction} onToggle={openSort.toggle} />
                  <SortTh<OpenOrderKey> label="Action" sortKey="action" activeKey={openSort.sort.key} direction={openSort.sort.direction} onToggle={openSort.toggle} />
                  <SortTh<OpenOrderKey> label="Type" sortKey="orderType" activeKey={openSort.sort.key} direction={openSort.sort.direction} onToggle={openSort.toggle} />
                  <SortTh<OpenOrderKey> label="Quantity" sortKey="totalQuantity" className="right" activeKey={openSort.sort.key} direction={openSort.sort.direction} onToggle={openSort.toggle} />
                  <SortTh<OpenOrderKey> label="Limit Price" sortKey="limitPrice" className="right" activeKey={openSort.sort.key} direction={openSort.sort.direction} onToggle={openSort.toggle} />
                  <SortTh<OpenOrderKey> label="Status" sortKey="status" activeKey={openSort.sort.key} direction={openSort.sort.direction} onToggle={openSort.toggle} />
                  <SortTh<OpenOrderKey> label="TIF" sortKey="tif" activeKey={openSort.sort.key} direction={openSort.sort.direction} onToggle={openSort.toggle} />
                </tr>
              </thead>
              <tbody>
                {openSort.sorted.map((o) => (
                  <tr key={o.orderId}>
                    <td><strong>{o.symbol}</strong></td>
                    <td>
                      <span className={`pill ${o.action === "BUY" ? "accum" : "distrib"}`}>
                        {o.action}
                      </span>
                    </td>
                    <td>{o.orderType}</td>
                    <td className="right">{o.totalQuantity}</td>
                    <td className="right">{o.limitPrice != null ? fmtPrice(o.limitPrice) : "—"}</td>
                    <td>{o.status}</td>
                    <td>{o.tif}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="section">
        <div className="section-header">
          <div className="section-title">
            <CheckCircle2 size={14} />
            Executed Orders
          </div>
          <span className="pill neutral">{orders.executed_count} FILLS</span>
        </div>
        <div className="section-body">
          {orders.executed_orders.length === 0 ? (
            <div className="alert-item">No fills this session</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <SortTh<ExecOrderKey> label="Symbol" sortKey="symbol" activeKey={execSort.sort.key} direction={execSort.sort.direction} onToggle={execSort.toggle} />
                  <SortTh<ExecOrderKey> label="Action" sortKey="side" activeKey={execSort.sort.key} direction={execSort.sort.direction} onToggle={execSort.toggle} />
                  <SortTh<ExecOrderKey> label="Quantity" sortKey="quantity" className="right" activeKey={execSort.sort.key} direction={execSort.sort.direction} onToggle={execSort.toggle} />
                  <SortTh<ExecOrderKey> label="Avg Fill Price" sortKey="avgPrice" className="right" activeKey={execSort.sort.key} direction={execSort.sort.direction} onToggle={execSort.toggle} />
                  <SortTh<ExecOrderKey> label="Commission" sortKey="commission" className="right" activeKey={execSort.sort.key} direction={execSort.sort.direction} onToggle={execSort.toggle} />
                  <SortTh<ExecOrderKey> label="Realized P&L" sortKey="realizedPNL" className="right" activeKey={execSort.sort.key} direction={execSort.sort.direction} onToggle={execSort.toggle} />
                  <SortTh<ExecOrderKey> label="Time" sortKey="time" activeKey={execSort.sort.key} direction={execSort.sort.direction} onToggle={execSort.toggle} />
                </tr>
              </thead>
              <tbody>
                {execSort.sorted.map((e) => {
                  const displaySide = e.side === "BOT" ? "BUY" : e.side === "SLD" ? "SELL" : e.side;
                  return (
                    <tr key={e.execId}>
                      <td><strong>{e.symbol}</strong></td>
                      <td>
                        <span className={`pill ${displaySide === "BUY" ? "accum" : "distrib"}`}>
                          {displaySide}
                        </span>
                      </td>
                      <td className="right">{e.quantity}</td>
                      <td className="right">{e.avgPrice != null ? fmtPrice(e.avgPrice) : "—"}</td>
                      <td className="right">{e.commission != null ? fmtPrice(e.commission) : "—"}</td>
                      <td className={`right ${e.realizedPNL != null ? (e.realizedPNL >= 0 ? "positive" : "negative") : ""}`}>
                        {e.realizedPNL != null ? `${e.realizedPNL >= 0 ? "+" : ""}${fmtPrice(e.realizedPNL)}` : "—"}
                      </td>
                      <td>{new Date(e.time).toLocaleTimeString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {orders.last_sync && (
        <div className="section">
          <div className="report-meta">
            Last Sync: {new Date(orders.last_sync).toLocaleString()} • Source: IB Gateway (4001)
          </div>
        </div>
      )}
    </>
  );
}

/* ─── Root switch ───────────────────────────────────────── */

type WorkspaceSectionsProps = {
  section: WorkspaceSection;
  portfolio?: PortfolioData | null;
  orders?: OrdersData | null;
};

export default function WorkspaceSections({ section, portfolio, orders }: WorkspaceSectionsProps) {
  switch (section) {
    case "dashboard":
      return null;
    case "flow-analysis":
      return <FlowSections />;
    case "portfolio":
      return <PortfolioSections portfolio={portfolio ?? null} />;
    case "orders":
      return <OrdersSections orders={orders ?? null} />;
    case "scanner":
      return <ScannerSections />;
    case "discover":
      return <DiscoverSections />;
    case "journal":
      return <JournalSections />;
    default:
      return <FlowSections />;
  }
}
