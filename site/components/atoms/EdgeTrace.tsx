type EdgeTone =
  | "core"
  | "warn"
  | "violet"
  | "clear"
  | "strong"
  | "emerging"
  | "dislocated"
  | "muted";

type EdgeTraceProps = {
  tone?: EdgeTone;
  className?: string;
};

const toneClass: Record<EdgeTone, string> = {
  core: "from-accent via-signal-strong to-accent",
  warn: "from-warn via-warn/80 to-warn",
  violet: "from-dislocation via-extreme to-dislocation",
  clear: "from-accent via-signal-strong to-accent",
  strong: "from-signal-strong via-signal-strong/80 to-signal-strong/10",
  emerging: "from-signal-deep via-signal-deep/80 to-signal-deep/10",
  dislocated: "from-dislocation via-extreme to-dislocation",
  muted: "from-secondary/60 via-secondary/40 to-secondary/0",
};

export function EdgeTrace({ tone = "core", className }: EdgeTraceProps) {
  return (
    <span
      aria-hidden="true"
      className={[
        "absolute inset-y-3 left-0 w-px bg-gradient-to-b",
        toneClass[tone],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    />
  );
}
