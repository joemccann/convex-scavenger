export function FeatureCardsSection() {
  return (
    <section className="py-16">
      {/* Bento grid: 3 cols × 2 rows */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Large Card — State Reconstruction (col 1–2, row 1) */}
        <div className="md:col-span-2 relative bg-panel border border-[rgba(59,74,70,0.1)] rounded-[2px] p-[33px] overflow-hidden min-h-[229px] flex flex-col justify-between">
          {/* Decorative circuit grid top-right */}
          <div className="absolute right-0 top-0 w-[170px] h-[160px] opacity-30">
            <svg viewBox="0 0 170 160" fill="none" className="w-full h-full">
              <rect x="40" y="20" width="24" height="24" stroke="#49ecd0" strokeWidth="1" />
              <rect x="72" y="20" width="24" height="24" stroke="#49ecd0" strokeWidth="1" />
              <rect x="40" y="52" width="24" height="24" stroke="#49ecd0" strokeWidth="1" />
              <rect x="72" y="52" width="24" height="24" stroke="#49ecd0" strokeWidth="1" />
              <line x1="52" y1="44" x2="52" y2="52" stroke="#49ecd0" strokeWidth="1" />
              <line x1="84" y1="44" x2="84" y2="52" stroke="#49ecd0" strokeWidth="1" />
              <line x1="64" y1="32" x2="72" y2="32" stroke="#49ecd0" strokeWidth="1" />
              <line x1="64" y1="64" x2="72" y2="64" stroke="#49ecd0" strokeWidth="1" />
            </svg>
          </div>

          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent mb-8">
              Engine Architecture
            </p>
            <h3 className="font-sans text-[24px] font-bold text-primary leading-[32px] mb-4">
              State Reconstruction
            </h3>
            <p className="text-[14px] leading-[22.75px] text-[#bacac5] max-w-[448px]">
              Rewind the market state to any nanosecond. Inspect why your strategy triggered,
              what the book looked like, and how execution was routed. Absolute transparency
              for every byte of logic.
            </p>
          </div>
        </div>

        {/* Small Card — Strategy DSL (col 3, row 1) */}
        <div className="bg-panel-raised border border-[rgba(59,74,70,0.1)] rounded-[2px] p-[33px] flex flex-col justify-between min-h-[229px]">
          {/* Icon */}
          <div>
            <div className="w-5 h-4 mb-12">
              <svg viewBox="0 0 20 16" fill="none" className="w-full h-full">
                <rect x="1" y="1" width="18" height="14" rx="1" stroke="#49ecd0" strokeWidth="1.5" />
                <path d="M5 6l3 3-3 3" stroke="#49ecd0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <line x1="10" y1="11" x2="15" y2="11" stroke="#49ecd0" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <h3 className="font-sans text-[20px] font-bold text-primary leading-[28px] mb-3">
              Strategy DSL
            </h3>
            <p className="text-[12px] leading-[19.5px] text-[#bacac5]">
              Write complex execution logic in our low-latency domain specific language.
            </p>
          </div>
          <a href="#strategies" className="inline-flex items-center gap-2 mt-6">
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-accent">View Schema</span>
            <span className="text-accent text-[10px]">→</span>
          </a>
        </div>

        {/* Small Card — Execution Rail (col 1, row 2) */}
        <div className="bg-[#1c2227] border border-[rgba(59,74,70,0.1)] rounded-[2px] p-[33px] flex flex-col justify-between min-h-[229px]">
          {/* Icon */}
          <div>
            <div className="w-[22px] h-[17px] mb-12">
              <svg viewBox="0 0 22 17" fill="none" className="w-full h-full">
                <path d="M2 8.5h18M14 3l6 5.5-6 5.5" stroke="#ffcb87" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 className="font-sans text-[20px] font-bold text-primary leading-[28px] mb-3">
              Execution Rail
            </h3>
            <p className="text-[12px] leading-[19.5px] text-[#bacac5]">
              Ultra-direct routing to major liquidity pools with zero-knowledge hardware enclaves.
            </p>
          </div>
          <a href="#execution" className="inline-flex items-center gap-2 mt-6">
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-warn">Live Latency</span>
            <span className="text-warn text-[10px]">→</span>
          </a>
        </div>

        {/* Large Card 2 — Multi-Tenant Vaults (col 2–3, row 2) */}
        <div className="md:col-span-2 bg-panel border border-[rgba(59,74,70,0.1)] rounded-[2px] p-[33px] flex items-center min-h-[229px]">
          <div className="grid grid-cols-2 gap-8 w-full">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent mb-8">
                Institutional Grade
              </p>
              <h3 className="font-sans text-[24px] font-bold text-primary leading-[32px] mb-4">
                Multi-Tenant Vaults
              </h3>
              <p className="text-[14px] leading-[22.75px] text-[#bacac5]">
                Secure asset management with programmable governance. No central counterparty
                risk, just hard-coded protocol logic.
              </p>
            </div>
            {/* Icon grid */}
            <div className="flex items-center justify-center">
              <div className="grid grid-cols-3 gap-2">
                {[
                  /* key icon */
                  <svg key="key" viewBox="0 0 23 12" fill="none" className="w-full h-full">
                    <circle cx="4.5" cy="6" r="3.5" stroke="#49ecd0" strokeWidth="1.4" />
                    <line x1="8" y1="6" x2="22" y2="6" stroke="#49ecd0" strokeWidth="1.4" strokeLinecap="round" />
                    <line x1="18" y1="6" x2="18" y2="9" stroke="#49ecd0" strokeWidth="1.4" strokeLinecap="round" />
                    <line x1="20.5" y1="6" x2="20.5" y2="8" stroke="#49ecd0" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>,
                  /* shield icon */
                  <svg key="shield1" viewBox="0 0 16 20" fill="none" className="w-full h-full">
                    <path d="M8 1L2 4v6c0 4 3 7 6 8 3-1 6-4 6-8V4L8 1z" stroke="#49ecd0" strokeWidth="1.4" strokeLinejoin="round" />
                    <path d="M5.5 10l2 2 3-3.5" stroke="#49ecd0" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>,
                  /* lock icon */
                  <svg key="lock" viewBox="0 0 16 20" fill="none" className="w-full h-full">
                    <rect x="2" y="9" width="12" height="10" rx="1" stroke="#49ecd0" strokeWidth="1.4" />
                    <path d="M5 9V6a3 3 0 016 0v3" stroke="#49ecd0" strokeWidth="1.4" strokeLinecap="round" />
                    <circle cx="8" cy="14" r="1.5" fill="#49ecd0" />
                  </svg>,
                ].map((icon, i) => (
                  <div
                    key={i}
                    className="w-12 h-12 bg-[#30353a] rounded-[2px] flex items-center justify-center p-3"
                  >
                    {icon}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
