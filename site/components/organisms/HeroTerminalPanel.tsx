export function HeroTerminalPanel() {
  return (
    <div className="relative self-center">
      {/* Ambient glow */}
      <div
        className="absolute inset-[-2px] opacity-10 blur-[20px] rounded-[2px]"
        style={{ background: "linear-gradient(135deg, #49ecd0 0%, #0fcfb5 100%)" }}
      />

      {/* Outer wrapper */}
      <div className="relative bg-panel-raised p-1 rounded-[2px]">
        {/* Terminal body */}
        <div className="bg-canvas border border-[rgba(59,74,70,0.15)] min-h-[480px] p-[25px] rounded-[2px] flex flex-col">

          {/* Title bar */}
          <div className="flex items-center justify-between pb-[17px] border-b border-[rgba(59,74,70,0.1)] mb-8">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[rgba(255,180,171,0.4)]" />
              <div className="w-3 h-3 rounded-full bg-[rgba(255,203,135,0.4)]" />
              <div className="w-3 h-3 rounded-full bg-[rgba(73,236,208,0.4)]" />
            </div>
            <span className="font-mono text-[10px] tracking-[0.1em] text-[rgba(186,202,197,0.5)] uppercase">
              REALTIME_EXECUTION_STREAM
            </span>
          </div>

          {/* Log entries */}
          <div className="flex-1 flex flex-col gap-4 font-mono text-[12px]">
            {/* RECON */}
            <div className="flex gap-4 items-start">
              <span className="text-muted shrink-0 w-[58px]">10:42:01</span>
              <span className="text-accent shrink-0">[RECON]</span>
              <span className="text-secondary leading-[16px]">
                Kelly calc complete. Strategy<br />&ldquo;Bull Call Spread&rdquo; verified.
              </span>
            </div>

            {/* SIGNAL */}
            <div className="flex gap-4 items-start">
              <span className="text-muted shrink-0 w-[58px]">10:42:04</span>
              <span className="text-warn shrink-0">[SIGNAL]</span>
              <span className="text-secondary leading-[16px]">
                IV rank divergence detected in AAPL<br />chain (+12.4 pts).
              </span>
            </div>

            {/* EXECUTE — highlighted */}
            <div className="flex gap-4 items-start bg-[rgba(38,43,47,0.5)] border-l-2 border-accent pl-[10px] pr-2 py-2 rounded-[2px]">
              <span className="text-muted shrink-0 w-[58px]">10:42:10</span>
              <span className="text-accent font-semibold shrink-0">[EXECUTE]</span>
              <span className="text-primary leading-[16px]">
                Placing &ldquo;Order #43&rdquo; → TSLA<br />$400/$440 Apr 17. IB Direct.
              </span>
            </div>

            {/* LATENCY */}
            <div className="flex gap-4 items-start opacity-60">
              <span className="text-muted shrink-0 w-[58px]">10:42:12</span>
              <span className="text-[rgba(186,202,197,0.4)] shrink-0">[LATENCY]</span>
              <span className="text-[rgba(186,202,197,0.4)] leading-[16px]">
                32ms transit. IB confirmed. Fill logged.
              </span>
            </div>
          </div>

          {/* Stats row */}
          <div className="border-t border-[rgba(59,74,70,0.1)] pt-[33px] mt-8 grid grid-cols-3 gap-4">
            {/* Alpha Yield */}
            <div className="flex flex-col gap-1">
              <p className="font-mono text-[9px] uppercase text-muted tracking-[0.2em]">Alpha Yield</p>
              <p className="font-mono text-[18px] text-accent font-semibold leading-[28px]">+18.42%</p>
              <div className="h-1 bg-panel-raised overflow-hidden">
                <div className="h-full bg-accent" style={{ width: "72%" }} />
              </div>
            </div>

            {/* Risk Parity */}
            <div className="flex flex-col gap-1">
              <p className="font-mono text-[9px] uppercase text-muted tracking-[0.2em]">Risk Parity</p>
              <p className="font-mono text-[18px] text-warn font-semibold leading-[28px]">0.84</p>
              <div className="h-1 bg-panel-raised overflow-hidden">
                <div className="h-full bg-warn" style={{ width: "44%" }} />
              </div>
            </div>

            {/* System Health */}
            <div className="flex flex-col gap-1">
              <p className="font-mono text-[9px] uppercase text-muted tracking-[0.2em]">System Health</p>
              <p className="font-mono text-[18px] text-primary font-semibold leading-[28px]">99.9%</p>
              <div className="h-1 bg-panel-raised overflow-hidden">
                <div className="h-full bg-primary" style={{ width: "99%" }} />
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
