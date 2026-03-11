import { TelemetryLabel } from "@/components/atoms/TelemetryLabel";

type MonoTone = "primary" | "core" | "strong";

type MonoMetricProps = {
  value: string;
  suffix?: string;
  className?: string;
  label?: string;
  detail?: string;
  tone?: MonoTone;
};

const toneClass: Record<MonoTone, string> = {
  primary: "text-primary",
  core: "text-accent",
  strong: "text-signal-strong",
};

export function MonoMetric({
  label,
  value,
  detail,
  suffix,
  tone = "primary",
  className,
}: MonoMetricProps) {
  if (label || detail) {
    return (
      <div className={["border border-grid bg-panel px-4 py-4", className].filter(Boolean).join(" ")}>
        {label ? <TelemetryLabel>{label}</TelemetryLabel> : null}
        <div className={["mt-3 font-mono text-[28px] leading-[1.05]", toneClass[tone]].join(" ")}>
          {value}
        </div>
        {detail ? (
          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.14em] text-secondary">
            {detail}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={[
        "font-mono text-[28px] leading-[1.05] text-primary",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {value}
      {suffix ? <span className="ml-1 text-[14px] text-secondary">{suffix}</span> : null}
    </div>
  );
}
