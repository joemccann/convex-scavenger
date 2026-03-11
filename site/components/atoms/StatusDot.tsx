type StatusTone =
  | "core"
  | "strong"
  | "warn"
  | "fault"
  | "clear"
  | "emerging"
  | "dislocated"
  | "muted";

type StatusDotProps = {
  tone?: StatusTone;
  pulse?: boolean;
  className?: string;
};

const toneClass: Record<StatusTone, string> = {
  core: "bg-accent border-accent shadow-[0_0_10px_rgba(5,173,152,0.45)]",
  strong: "bg-signal-strong border-signal-strong shadow-[0_0_10px_rgba(15,207,181,0.45)]",
  warn: "bg-warn border-warn shadow-[0_0_10px_rgba(245,166,35,0.35)]",
  fault: "bg-negative border-negative shadow-[0_0_10px_rgba(232,93,108,0.35)]",
  clear: "bg-accent border-accent shadow-[0_0_10px_rgba(5,173,152,0.45)]",
  emerging: "bg-signal-deep border-signal-deep shadow-[0_0_10px_rgba(4,138,122,0.35)]",
  dislocated: "bg-dislocation border-dislocation shadow-[0_0_10px_rgba(217,70,168,0.35)]",
  muted: "bg-secondary border-secondary",
};

export function StatusDot({
  tone = "core",
  pulse = false,
  className,
}: StatusDotProps) {
  return (
    <span
      aria-hidden="true"
      className={[
        "inline-flex h-2.5 w-2.5 rounded-full border",
        toneClass[tone],
        pulse ? "animate-pulse" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    />
  );
}
