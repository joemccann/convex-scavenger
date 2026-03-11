import type { ReactNode } from "react";

type TelemetryTone = "primary" | "muted" | "core" | "warn";

type TelemetryLabelProps = {
  children: ReactNode;
  tone?: TelemetryTone;
  className?: string;
};

const toneClass: Record<TelemetryTone, string> = {
  primary: "text-primary",
  muted: "text-muted",
  core: "text-accent",
  warn: "text-warn",
};

export function TelemetryLabel({
  children,
  tone = "muted",
  className,
}: TelemetryLabelProps) {
  return (
    <div
      className={[
        "font-mono text-[11px] uppercase tracking-[0.2em]",
        toneClass[tone],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}
