import { SignalPill } from "@/components/atoms/SignalPill";

type TerminalNavItemProps = {
  label: string;
  active?: boolean;
  description?: string;
};

export function TerminalNavItem({
  label,
  active = false,
  description,
}: TerminalNavItemProps) {
  return (
    <div
      className={`border-l-2 px-3 py-2 ${
        active
          ? "border-accent bg-panel-raised text-primary"
          : "border-transparent text-muted"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="font-mono text-[11px] uppercase tracking-[0.16em]">{label}</div>
        {active ? <SignalPill tone="strong">Active</SignalPill> : null}
      </div>
      {description ? (
        <p className="mt-2 text-[12px] leading-5 text-secondary">{description}</p>
      ) : null}
    </div>
  );
}
