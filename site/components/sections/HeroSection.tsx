import { HeroTerminalPanel } from "@/components/organisms/HeroTerminalPanel";

export function HeroSection() {
  return (
    <section id="top" className="relative py-24 md:py-32">
      <div className="grid gap-16 xl:grid-cols-2 xl:items-center">
        {/* Left: copy */}
        <div className="flex flex-col gap-8 max-w-[768px]">
          {/* Status badge */}
          <div className="inline-flex items-center gap-2 bg-panel-raised px-3 py-1 rounded-[2px] self-start">
            <div className="w-2 h-2 rounded-full bg-signal-strong" />
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
              System Online: v2.4.0-Stable
            </span>
          </div>

          {/* Heading */}
          <h1 className="font-sans text-[72px] font-extrabold leading-[72px] tracking-[-3.6px] text-primary">
            Strategies,<br />
            execution, and<br />
            state<br />
            reconstruction<br />
            in one<br />
            instrument.
          </h1>

          {/* Subtext */}
          <p className="text-[20px] leading-[28px] text-[#bacac5] max-w-[576px]">
            Radon is built for traders and investors who want deployable strategy
            logic, explicit execution discipline, and explainable metrics without
            outsourcing conviction to a black box.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap gap-4 pt-4">
            <a
              href="#strategies"
              className="inline-flex items-center gap-6 px-[45px] py-4 rounded-[2px] font-mono text-[14px] uppercase tracking-[0.1em] text-[#00382f] font-semibold transition-opacity hover:opacity-90"
              style={{ background: "linear-gradient(134deg, #49ecd0 0%, #0fcfb5 100%)" }}
            >
              Inspect Strategy Matrix
              <span className="text-[18px] leading-none">→</span>
            </a>
            <a
              href="#execution"
              className="inline-flex items-center justify-center px-[37px] py-4 rounded-[2px] bg-panel-raised font-mono text-[14px] uppercase tracking-[0.1em] text-accent transition-colors hover:bg-grid"
            >
              Review Execution Rail
            </a>
          </div>
        </div>

        {/* Right: terminal */}
        <HeroTerminalPanel />
      </div>
    </section>
  );
}
