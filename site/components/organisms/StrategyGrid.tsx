import { StrategyCard } from "@/components/molecules/StrategyCard";
import { strategies } from "@/lib/landing-content";

export function StrategyGrid() {
  return (
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
      {strategies.map((strategy) => (
        <StrategyCard key={strategy.name} strategy={strategy} />
      ))}
    </div>
  );
}
