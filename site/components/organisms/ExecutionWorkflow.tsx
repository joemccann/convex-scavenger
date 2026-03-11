import { SignalPill } from "@/components/atoms/SignalPill";
import { TelemetryLabel } from "@/components/atoms/TelemetryLabel";
import { ExecutionStep } from "@/components/molecules/ExecutionStep";
import { executionItems } from "@/lib/landing-content";

export function ExecutionWorkflow() {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_320px]">
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {executionItems.map((item, index) => (
          <ExecutionStep key={item.step} item={item} index={index} />
        ))}
      </div>
      <aside className="border border-grid bg-panel px-5 py-5">
        <TelemetryLabel tone="core">Execution Guarantees</TelemetryLabel>
        <h3 className="mt-3 font-sans text-2xl font-semibold text-primary">
          No hidden handoff between signal and risk.
        </h3>
        <p className="mt-4 text-sm leading-6 text-secondary">
          Radon carries every position from candidate selection through structure
          design, bankroll sizing, execution, and post-trade auditability. Nothing
          falls through the gap between conviction and capital deployment.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <SignalPill tone="core">Source Linked</SignalPill>
          <SignalPill tone="strong">Kelly Bounded</SignalPill>
          <SignalPill tone="neutral">Portfolio Aware</SignalPill>
        </div>
        <div className="mt-6 border-t border-grid pt-5">
          <TelemetryLabel>Operator Notes</TelemetryLabel>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-secondary">
            <li>Every step exposes methodology, not just an output state.</li>
            <li>Motion only explains progression and scan status.</li>
            <li>Defined-risk structures remain first-class citizens.</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}
