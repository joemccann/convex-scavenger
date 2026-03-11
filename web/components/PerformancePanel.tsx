"use client";

import { AlertTriangle, BarChart3, Gauge, ShieldAlert, Sigma, TrendingDown } from "lucide-react";
import { useMemo } from "react";
import type { PerformanceData, PerformanceSeriesPoint } from "@/lib/types";
import { usePerformance } from "@/lib/usePerformance";

function fmtUsd(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `${value < 0 ? "-" : ""}$${(abs / 1_000_000).toFixed(2)}M`;
  }
  return `${value < 0 ? "-" : ""}$${abs.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

function fmtUsdExact(value: number): string {
  return `${value < 0 ? "-" : ""}$${Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function fmtPct(value: number, digits = 2): string {
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(digits)}%`;
}

function fmtRatio(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : "---";
}

function toneClass(value: number): "positive" | "negative" | "neutral" {
  return value > 0 ? "positive" : value < 0 ? "negative" : "neutral";
}

function StatCard({
  label,
  value,
  change,
  tone = "neutral",
}: {
  label: string;
  value: string;
  change: string;
  tone?: "positive" | "negative" | "neutral";
}) {
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className={`metric-value ${tone !== "neutral" ? tone : ""}`}>{value}</div>
      <div className={`metric-change ${tone}`}>{change}</div>
    </div>
  );
}

function buildLinePath(values: number[], width: number, height: number, padding: number): string {
  if (values.length === 0) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return values
    .map((value, index) => {
      const x = padding + (index / Math.max(values.length - 1, 1)) * (width - padding * 2);
      const y = height - padding - ((value - min) / span) * (height - padding * 2);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function buildAreaPath(values: number[], width: number, height: number, padding: number): string {
  if (values.length === 0) return "";
  const line = buildLinePath(values, width, height, padding);
  const endX = width - padding;
  const startX = padding;
  return `${line} L ${endX} ${height - padding} L ${startX} ${height - padding} Z`;
}

function PerformanceChart({ data }: { data: PerformanceData }) {
  const width = 820;
  const height = 280;
  const padding = 24;

  const { equityPath, benchmarkPath, areaPath, latestEquity, latestBenchmark } = useMemo(() => {
    const startEquity = data.summary.starting_equity;
    const startBenchmark = data.series[0]?.benchmark_close ?? 1;
    const equityValues = data.series.map((point) => point.equity);
    const benchmarkValues = data.series.map((point) => (point.benchmark_close / startBenchmark) * startEquity);
    return {
      equityPath: buildLinePath(equityValues, width, height, padding),
      benchmarkPath: buildLinePath(benchmarkValues, width, height, padding),
      areaPath: buildAreaPath(equityValues, width, height, padding),
      latestEquity: equityValues[equityValues.length - 1] ?? startEquity,
      latestBenchmark: benchmarkValues[benchmarkValues.length - 1] ?? startEquity,
    };
  }, [data]);

  return (
    <div className="section">
      <div className="section-header">
        <div className="section-title">
          <BarChart3 size={14} />
          YTD Equity Curve
        </div>
        <span className="pill neutral">{data.series.length} SESSIONS</span>
      </div>
      <div className="section-body performance-chart-shell">
        <div className="performance-chart-legend">
          <span><span className="performance-swatch performance-swatch-equity" /> Portfolio</span>
          <span><span className="performance-swatch performance-swatch-benchmark" /> {data.benchmark} rebased</span>
        </div>
        <svg
          data-testid="performance-equity-chart"
          viewBox={`0 0 ${width} ${height}`}
          className="performance-chart"
          role="img"
          aria-label="YTD portfolio equity curve versus benchmark"
        >
          <defs>
            <linearGradient id="performanceAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(5,173,152,0.22)" />
              <stop offset="100%" stopColor="rgba(5,173,152,0.02)" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3].map((step) => {
            const y = padding + ((height - padding * 2) / 3) * step;
            return <line key={step} x1={padding} x2={width - padding} y1={y} y2={y} className="performance-grid-line" />;
          })}
          <path d={areaPath} fill="url(#performanceAreaGradient)" />
          <path d={benchmarkPath} className="performance-line performance-line-benchmark" />
          <path d={equityPath} className="performance-line performance-line-equity" />
        </svg>
        <div className="performance-chart-meta">
          <div className="performance-meta-item">
            <span className="performance-meta-label">Portfolio</span>
            <span className="performance-meta-value">{fmtUsdExact(latestEquity)}</span>
          </div>
          <div className="performance-meta-item">
            <span className="performance-meta-label">{data.benchmark} Rebased</span>
            <span className="performance-meta-value">{fmtUsdExact(latestBenchmark)}</span>
          </div>
          <div className="performance-meta-item">
            <span className="performance-meta-label">Benchmark Return</span>
            <span className={`performance-meta-value ${toneClass(data.benchmark_total_return)}`}>{fmtPct(data.benchmark_total_return)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function drawdownLeader(series: PerformanceSeriesPoint[]): string {
  if (series.length === 0) return "---";
  const worst = series.reduce((acc, point) => (point.drawdown < acc.drawdown ? point : acc), series[0]);
  return worst?.date ?? "---";
}

export default function PerformancePanel() {
  const { data, loading, error } = usePerformance(true);

  if (loading && !data) {
    return (
      <div className="section">
        <div className="section-header">
          <div className="section-title">
            <Gauge size={14} />
            Performance
          </div>
          <span className="pill neutral">LOADING</span>
        </div>
        <div className="section-body performance-empty">
          Reconstructing YTD portfolio performance...
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="section">
        <div className="section-header">
          <div className="section-title">
            <ShieldAlert size={14} />
            Performance
          </div>
          <span className="pill undefined">UNAVAILABLE</span>
        </div>
        <div className="section-body performance-empty">
          {error ?? "No performance data available."}
        </div>
      </div>
    );
  }

  const { summary } = data;

  return (
    <div className="performance-panel" data-testid="performance-panel">
      <div className="section performance-hero">
        <div className="section-body performance-hero-body">
          <div>
            <div className="section-label-mono">RECONSTRUCTED {data.period_label}</div>
            <div className="performance-hero-value">
              <span className={toneClass(summary.total_return)}>{fmtPct(summary.total_return)}</span>
            </div>
            <div className="performance-hero-subtitle">
              Ending equity {fmtUsdExact(summary.ending_equity)} • {data.benchmark} {fmtPct(data.benchmark_total_return)} • as of {data.as_of}
            </div>
          </div>
          <div className="performance-hero-pills">
            <span className="pill neutral">{data.trades_source === "ib_flex" ? "IB FLEX" : "CACHE"}</span>
            <span className="pill neutral">{summary.trading_days} DAYS</span>
            <span className={`pill ${summary.max_drawdown < -0.1 ? "undefined" : "defined"}`}>MAX DD {fmtPct(summary.max_drawdown)}</span>
          </div>
        </div>
      </div>

      <div className="section">
        <div className="section-header">
          <div className="section-title">
            <Gauge size={14} />
            Core Performance
          </div>
          <span className="pill defined">INSTITUTIONAL</span>
        </div>
        <div className="section-body">
          <div className="metrics-grid">
            <StatCard label="YTD Return" value={fmtPct(summary.total_return)} change={`${fmtUsd(summary.pnl)} P&L`} tone={toneClass(summary.total_return)} />
            <StatCard label="Sharpe Ratio" value={fmtRatio(summary.sharpe_ratio)} change={`VOL ${fmtPct(summary.annualized_volatility)}`} tone={toneClass(summary.sharpe_ratio)} />
            <StatCard label="Sortino Ratio" value={fmtRatio(summary.sortino_ratio)} change={`DN DEV ${fmtPct(summary.downside_deviation)}`} tone={toneClass(summary.sortino_ratio)} />
            <StatCard label="Max Drawdown" value={fmtPct(summary.max_drawdown)} change={`${summary.max_drawdown_duration_days} DAYS`} tone={toneClass(summary.max_drawdown)} />
          </div>

          <div className="metrics-grid">
            <StatCard label="Beta" value={fmtRatio(summary.beta)} change={data.benchmark} tone={toneClass(summary.beta - 1)} />
            <StatCard label="Alpha" value={fmtPct(summary.alpha)} change="ANNUALIZED" tone={toneClass(summary.alpha)} />
            <StatCard label="Information Ratio" value={fmtRatio(summary.information_ratio)} change={`TE ${fmtPct(summary.tracking_error)}`} tone={toneClass(summary.information_ratio)} />
            <StatCard label="Calmar Ratio" value={fmtRatio(summary.calmar_ratio)} change={`CUR DD ${fmtPct(summary.current_drawdown)}`} tone={toneClass(summary.calmar_ratio)} />
          </div>
        </div>
      </div>

      <PerformanceChart data={data} />

      <div className="performance-grid-2">
        <div className="section">
          <div className="section-header">
            <div className="section-title">
              <TrendingDown size={14} />
              Tail And Path Risk
            </div>
            <span className="pill neutral">DAILY</span>
          </div>
          <div className="section-body">
            <div className="performance-metric-list">
              <div><span>VaR 95%</span><strong>{fmtPct(summary.var_95)}</strong></div>
              <div><span>CVaR 95%</span><strong>{fmtPct(summary.cvar_95)}</strong></div>
              <div><span>Tail Ratio</span><strong>{fmtRatio(summary.tail_ratio)}</strong></div>
              <div><span>Ulcer Index</span><strong>{fmtRatio(summary.ulcer_index)}</strong></div>
              <div><span>Worst Day</span><strong>{fmtPct(summary.worst_day)}</strong></div>
              <div><span>Drawdown Trough</span><strong>{drawdownLeader(data.series)}</strong></div>
            </div>
          </div>
        </div>

        <div className="section">
          <div className="section-header">
            <div className="section-title">
              <Sigma size={14} />
              Distribution And Capture
            </div>
            <span className="pill neutral">{data.benchmark}</span>
          </div>
          <div className="section-body">
            <div className="performance-metric-list">
              <div><span>Hit Rate</span><strong>{fmtPct(summary.hit_rate)}</strong></div>
              <div><span>Upside Capture</span><strong>{fmtRatio(summary.upside_capture)}</strong></div>
              <div><span>Downside Capture</span><strong>{fmtRatio(summary.downside_capture)}</strong></div>
              <div><span>Correlation</span><strong>{fmtRatio(summary.correlation)}</strong></div>
              <div><span>Skew</span><strong>{fmtRatio(summary.skew)}</strong></div>
              <div><span>Kurtosis</span><strong>{fmtRatio(summary.kurtosis)}</strong></div>
            </div>
          </div>
        </div>
      </div>

      <div className="performance-grid-2">
        <div className="section">
          <div className="section-header">
            <div className="section-title">
              <AlertTriangle size={14} />
              Methodology
            </div>
            <span className="pill neutral">{data.methodology.return_basis.replace(/_/g, " ").toUpperCase()}</span>
          </div>
          <div className="section-body performance-meta-grid">
            <div className="performance-meta-item">
              <span className="performance-meta-label">Curve Type</span>
              <span className="performance-meta-value">{data.methodology.curve_type.replace(/_/g, " ")}</span>
            </div>
            <div className="performance-meta-item">
              <span className="performance-meta-label">Stock History</span>
              <span className="performance-meta-value">{data.price_sources.stocks}</span>
            </div>
            <div className="performance-meta-item">
              <span className="performance-meta-label">Option History</span>
              <span className="performance-meta-value">{data.price_sources.options}</span>
            </div>
            <div className="performance-meta-item">
              <span className="performance-meta-label">Risk-Free Assumption</span>
              <span className="performance-meta-value">{fmtPct(data.methodology.risk_free_rate)}</span>
            </div>
          </div>
        </div>

        <div className="section">
          <div className="section-header">
            <div className="section-title">
              <AlertTriangle size={14} />
              Warnings
            </div>
            <span className="pill undefined">{data.warnings.length} FLAGS</span>
          </div>
          <div className="section-body">
            <ul className="performance-note-list">
              {data.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
              {data.contracts_missing_history.length > 0 && (
                <li>{data.contracts_missing_history.length} contract(s) were missing historical marks and were marked to zero where no price history was available.</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
