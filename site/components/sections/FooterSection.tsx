export function FooterSection() {
  return (
    <footer className="bg-canvas border-t border-[rgba(59,74,70,0.1)] flex items-center justify-between px-12 py-[49px]">
      {/* Left: branding + copyright */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 pb-2">
          <span className="font-mono text-[12px] tracking-[0.1em] text-signal-strong">RADON</span>
          <div className="w-1 h-1 rounded-full bg-[rgba(59,74,70,0.3)]" />
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Institutional</span>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          © 2026 Radon Terminal. Institutional Grade Execution.
        </p>
      </div>

      {/* Center: links */}
      <div className="hidden md:flex items-center gap-8">
        {["Privacy", "Terms", "API", "Network"].map((label) => (
          <a
            key={label}
            href="#"
            className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-secondary"
          >
            {label}
          </a>
        ))}
      </div>

      {/* Right: status */}
      <div className="flex items-center gap-4">
        <div className="w-2 h-2 rounded-full bg-signal-strong" />
        <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-secondary">
          Status: Optimal
        </span>
      </div>
    </footer>
  );
}
