"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import type { WorkspaceSection } from "@/lib/types";
import { navItems } from "@/lib/data";
import { resolveSectionFromPath } from "@/lib/chat";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import ChatPanel from "@/components/ChatPanel";
import MetricCards from "@/components/MetricCards";
import WorkspaceSections from "@/components/WorkspaceSections";

type WorkspacePageProps = {
  section?: WorkspaceSection;
};

export default function Page({ section }: WorkspacePageProps) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const pathname = usePathname();
  const activeSection = section ?? resolveSectionFromPath(pathname, "dashboard");
  const activeLabel = navItems.find((item) => item.route === activeSection)?.label ?? "Dashboard";

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") {
      setTheme(saved);
      document.documentElement.setAttribute("data-theme", saved);
    }
  }, []);

  const actionTone = useMemo(() => {
    return theme === "dark" ? "#f0f0f0" : "#0a0a0a";
  }, [theme]);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  };

  return (
    <div className="app-shell" suppressHydrationWarning>
      <Sidebar activeSection={activeSection} actionTone={actionTone} />

      <main className="main">
        <Header activeLabel={activeLabel} onToggleTheme={toggleTheme} />

        <div className="content">
          <ChatPanel activeSection={activeSection} />

          {activeSection !== "dashboard" ? <MetricCards /> : null}

          {activeSection !== "dashboard" ? <WorkspaceSections section={activeSection} /> : null}
        </div>
      </main>
    </div>
  );
}
