import type { Metadata } from "next";
import Providers from "@/components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Radon Terminal",
  description: "Market structure reconstruction instrument. Surfaces convex opportunities from institutional flow, volatility surfaces, and cross-asset positioning.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body className="app-root">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
