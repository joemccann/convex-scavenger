import { AuditSection } from "@/components/sections/AuditSection";
import { ExecutionSection } from "@/components/sections/ExecutionSection";
import { FinalCTASection } from "@/components/sections/FinalCTASection";
import { FooterSection } from "@/components/sections/FooterSection";
import { HeaderShell } from "@/components/sections/HeaderShell";
import { HeroSection } from "@/components/sections/HeroSection";
import { PreviewSection } from "@/components/sections/PreviewSection";
import { StrategySection } from "@/components/sections/StrategySection";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-canvas text-primary selection:bg-accent selection:text-canvas">
      <div className="pointer-events-none fixed inset-0 z-0 instrument-grid opacity-[0.05]" />
      <div className="pointer-events-none fixed inset-0 z-10 projection-lines opacity-[0.08]" />
      <HeaderShell />
      <main className="relative z-20">
        <div className="mx-auto w-full max-w-[1440px] px-4 pb-14 pt-24 sm:px-6 lg:px-8">
          <HeroSection />
          <StrategySection />
          <ExecutionSection />
          <PreviewSection />
          <AuditSection />
          <FinalCTASection />
          <FooterSection />
        </div>
      </main>
    </div>
  );
}
