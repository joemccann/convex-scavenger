"use client";

import type { ExecutedOrder } from "@/lib/types";
import { fmtSignedUsdExact, fmtPrice, fmtPct as fmtPctBase } from "@/lib/format";

type Props = {
  open: boolean;
  fills: ExecutedOrder[];
  totalRealizedPnl: number;
  netLiquidation?: number;
  onClose: () => void;
};

const fmtPnl = fmtSignedUsdExact;

const fmtTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  } catch {
    return iso;
  }
};

const fmtPct = (n: number) => fmtPctBase(n, 2, true);

export default function FillsModal({ open, fills, totalRealizedPnl, netLiquidation, onClose }: Props) {
  if (!open) return null;

  const fillsWithPnl = fills.filter((f) => f.realizedPNL != null);
  const hasFills = fills.length > 0;

  return (
    <div className="fills-modal mb135" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="mh165">
          <span className="mt">TODAY&apos;S FILLS</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {!hasFills ? (
          <div className="fills-empty">
            <p>No fills this session.</p>
            <p className="fs113">Realized P&L = $0.00</p>
          </div>
        ) : (
          <>
            <table className="fills-table">
              <thead>
                <tr>
                  <th>TIME</th>
                  <th>SYMBOL</th>
                  <th>SIDE</th>
                  <th className="tr">QTY</th>
                  <th className="tr">PRICE</th>
                  <th className="tr">COMMISSION</th>
                  <th className="tr">REALIZED P&L</th>
                </tr>
              </thead>
              <tbody>
                {fills.map((fill) => (
                  <tr key={fill.execId} className={fill.realizedPNL != null ? (fill.realizedPNL >= 0 ? "fills-row-positive" : "fills-row-negative") : ""}>
                    <td className="mn">{fmtTime(fill.time)}</td>
                    <td className="mn">{fill.symbol}</td>
                    <td className={`mono fills-side fills-side-${fill.side.toLowerCase()}`}>{fill.side}</td>
                    <td className="mono tr">{fill.quantity}</td>
                    <td className="mono tr">{fmtPrice(fill.avgPrice)}</td>
                    <td className="mono tr">{fill.commission != null ? fmtPnl(fill.commission) : "---"}</td>
                    <td className={`mono tr ${fill.realizedPNL != null ? (fill.realizedPNL >= 0 ? "positive" : "negative") : ""}`}>
                      {fmtPnl(fill.realizedPNL)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="fs149">
              <div className="ff47">
                {fillsWithPnl.map((f, i) => (
                  <span key={f.execId}>
                    {i > 0 && <span className="fills-op">{f.realizedPNL! >= 0 ? " + " : " "}</span>}
                    <span className={f.realizedPNL! >= 0 ? "positive" : "negative"}>
                      {fmtPnl(f.realizedPNL)}
                    </span>
                    <span className="fl"> ({f.symbol})</span>
                  </span>
                ))}
                {fillsWithPnl.length === 0 && <span className="fl">No closed positions this session</span>}
              </div>
              <div className="ft64">
                <span className="fl93">REALIZED P&L</span>
                <span className={`fills-total-value ${totalRealizedPnl >= 0 ? "positive" : "negative"}`}>
                  {fmtPnl(totalRealizedPnl)}
                  {netLiquidation != null && netLiquidation > 0 && (
                    <span className="fp114"> ({fmtPct(totalRealizedPnl / netLiquidation * 100)})</span>
                  )}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
