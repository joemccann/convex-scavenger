import { metricCards } from "@/lib/data";

export default function MetricCards() {
  return (
    <div className="metrics-grid">
      {metricCards.map((item) => (
        <div key={item.label} className="metric-card">
          <div className="metric-label">{item.label}</div>
          <div className="metric-value">{item.value}</div>
          <div
            className={`metric-change ${
              item.tone === "positive" ? "positive" : item.tone === "negative" ? "negative" : "neutral"
            }`}
          >
            {item.change}
          </div>
        </div>
      ))}
    </div>
  );
}
