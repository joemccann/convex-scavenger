import {
  Bell,
  CheckCircle2,
  Circle,
  Search,
  Sparkles,
  TrendingDown,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import type { WorkspaceSection } from "@/lib/types";
import { against, neutralRows, supports, watchRows } from "@/lib/data";

function FlowSections() {
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
                <th>Ticker</th>
                <th>Position</th>
                <th>Flow</th>
                <th>Strength</th>
                <th>Signal</th>
              </tr>
            </thead>
            <tbody>
              {supports.map((item) => (
                <tr key={`support-${item.ticker}`}>
                  <td>
                    <strong>{item.ticker}</strong>
                  </td>
                  <td>{item.position}</td>
                  <td>
                    <span className={`pill ${item.flowClass}`}>{item.flowLabel}</span>
                  </td>
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
                <th>Ticker</th>
                <th>Position</th>
                <th>Flow</th>
                <th>Strength</th>
                <th>Concern</th>
              </tr>
            </thead>
            <tbody>
              {against.map((item) => (
                <tr key={`against-${item.ticker}`}>
                  <td>
                    <strong>{item.ticker}</strong>
                  </td>
                  <td>{item.position}</td>
                  <td>
                    <span className={`pill ${item.flowClass}`}>{item.flowLabel}</span>
                  </td>
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
                  <th>Ticker</th>
                  <th>Position</th>
                  <th>Flow</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {watchRows.map((item) => (
                  <tr key={item.ticker}>
                    <td>
                      <strong>{item.ticker}</strong>
                    </td>
                    <td>{item.position}</td>
                    <td>
                      <span className={`pill ${item.className}`}>{item.flow}</span>
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
              <Circle size={14} />
              Neutral / Low Signal
            </div>
            <span className="pill neutral">8 POSITIONS</span>
          </div>
          <div className="section-body">
            <table>
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th>Flow</th>
                  <th className="right">Prints</th>
                </tr>
              </thead>
              <tbody>
                {neutralRows.map((row) => (
                  <tr key={`neutral-${row.ticker}`}>
                    <td>{row.ticker}</td>
                    <td>
                      <span className={`pill ${row.className}`}>{row.strength}</span>
                    </td>
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

function PortfolioSections() {
  return (
    <>
      <div className="section">
        <div className="section-header">
          <div className="section-title">
            <Circle size={14} />
            Portfolio Snapshot
          </div>
          <span className="pill defined">POSITIONS</span>
        </div>
        <div className="section-body">
          <table>
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Position</th>
                <th>Flow</th>
                <th>Signal</th>
              </tr>
            </thead>
            <tbody>
              {supports.map((item) => (
                <tr key={`portfolio-support-${item.ticker}`}>
                  <td>{item.ticker}</td>
                  <td>{item.position}</td>
                  <td>{item.flowLabel}</td>
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
            Risk Review
          </div>
          <span className="pill distrib">ALERT LIST</span>
        </div>
        <div className="section-body">
          <div className="alert-item">BRZE and RR marked for direct review based on flow mismatch.</div>
        </div>
      </div>
    </>
  );
}

function ScannerSections() {
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
                <th>Ticker</th>
                <th>Signal</th>
                <th>Signal Strength</th>
              </tr>
            </thead>
            <tbody>
              {neutralRows.slice(0, 4).map((row) => (
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

export default function WorkspaceSections({ section }: { section: WorkspaceSection }) {
  switch (section) {
    case "dashboard":
      return null;
    case "flow-analysis":
      return <FlowSections />;
    case "portfolio":
      return <PortfolioSections />;
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
