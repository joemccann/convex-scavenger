import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Portfolio Flow Analysis | Convex Scavenger",
  description: "Embedded conversational dashboard inspired by the Convex Scavenger flow report.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body className="app-root">{children}</body>
    </html>
  );
}
