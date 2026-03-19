const tickers = [
  { pair: "SPY", value: "500.12", change: "+0.42%", positive: true },
  { pair: "VIX", value: "22.77", change: "-3.24%", positive: false },
  { pair: "AAPL", value: "213.45", change: "+1.15%", positive: true },
  { pair: "NVDA", value: "875.20", change: "+2.31%", positive: true },
  { pair: "TSLA", value: "400.15", change: "+1.84%", positive: true },
  { pair: "RADON_INDEX", value: "1,092.88", change: "+3.82%", positive: true },
  { pair: "SPX", value: "5,234.18", change: "+0.38%", positive: true },
  { pair: "QQQ", value: "440.65", change: "+0.71%", positive: true },
];

// Duplicate for seamless loop
const allTickers = [...tickers, ...tickers];

export function TickerStrip() {
  return (
    <div className="border-t border-b border-[rgba(59,74,70,0.1)] bg-canvas overflow-hidden py-[33px]">
      <div className="flex gap-12 animate-ticker whitespace-nowrap" style={{ width: "max-content" }}>
        {allTickers.map((t, i) => (
          <div key={i} className="inline-flex items-center gap-4 px-4">
            <span className="font-mono text-[10px] text-muted">{t.pair}</span>
            <span className={`font-mono text-[10px] ${t.positive ? "text-accent" : "text-[#bacac5]"}`}>
              {t.value}
            </span>
            <span className={`font-mono text-[9px] ${t.positive ? "text-accent" : "text-negative"}`}>
              {t.change}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
