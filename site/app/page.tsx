import { FeatureCardsSection } from "@/components/sections/FeatureCardsSection";
import { FooterSection } from "@/components/sections/FooterSection";
import { HeaderShell } from "@/components/sections/HeaderShell";
import { HeroSection } from "@/components/sections/HeroSection";
import { TickerStrip } from "@/components/sections/TickerStrip";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0f1418] text-primary">
      <div className="pointer-events-none fixed inset-0 z-0 instrument-grid opacity-[0.04]" />
      <HeaderShell />
      <main className="relative z-20">
        <div className="mx-auto w-full max-w-[1440px] px-8 pt-24">
          <HeroSection />
          <FeatureCardsSection />
        </div>
        <TickerStrip />
        <FooterSection />
      </main>
    </div>
  );
}
