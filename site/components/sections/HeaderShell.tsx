"use client";

import { headerLinks } from "@/lib/landing-content";

export function HeaderShell() {
  return (
    <header className="fixed inset-x-0 top-0 z-40 backdrop-blur-[12px] bg-canvas/80 border-b border-[rgba(59,74,70,0.1)]">
      <div className="mx-auto flex h-[64px] w-full max-w-[1440px] items-center justify-between px-8">
        {/* Left: logo + nav */}
        <div className="flex items-center gap-8">
          <a href="#top" className="font-sans text-xl font-bold text-primary tracking-[-0.05em]">
            RADON
          </a>
          <nav aria-label="Primary" className="hidden items-center gap-6 lg:flex">
            {headerLinks.map((item, i) => (
              i === 0 ? (
                <a
                  key={item.href}
                  href={item.href}
                  className="border-b-2 border-accent pb-1.5 text-base font-semibold text-accent tracking-[-0.025em] transition-colors"
                >
                  {item.label}
                </a>
              ) : (
                <a
                  key={item.href}
                  href={item.href}
                  className="text-base text-secondary tracking-[-0.025em] transition-colors hover:text-primary"
                >
                  {item.label}
                </a>
              )
            ))}
          </nav>
        </div>

        {/* Right: search + CTA */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 bg-panel-raised px-3 py-1.5 rounded-[2px]">
            <svg className="w-[10.5px] h-[10.5px] text-muted" viewBox="0 0 12 12" fill="none">
              <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.4" />
              <line x1="7.8" y1="7.8" x2="10.5" y2="10.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <span className="font-mono text-[12px] uppercase text-muted tracking-[0.1em]">Command + K</span>
          </div>
          <a
            href="#strategies"
            className="bg-signal-strong px-4 py-2 rounded-[2px] font-mono text-[12px] uppercase tracking-[0.1em] text-[#005347] font-semibold hover:bg-accent transition-colors"
          >
            Connect Terminal
          </a>
        </div>
      </div>
    </header>
  );
}
