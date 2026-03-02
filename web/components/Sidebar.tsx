"use client";

import Link from "next/link";
import type { WorkspaceSection } from "@/lib/types";
import { navItems } from "@/lib/data";

type SidebarProps = {
  activeSection: WorkspaceSection;
  actionTone: string;
};

export default function Sidebar({ activeSection, actionTone }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo-icon" />
        <span className="logo-text">Convex Scavenger</span>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={item.route === activeSection ? "nav-item active" : "nav-item"}
            >
              <span className="nav-icon">
                <Icon size={14} color={actionTone} strokeWidth={2} />
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="status-row">
          <span>IB Gateway</span>
          <span className="status-dot-wrap">
            <span className="status-dot" />
            CONNECTED
          </span>
        </div>
        <div className="status-row">
          <span>Last Sync</span>
          <span>18:04:20</span>
        </div>
        <div className="status-row">
          <span>Port</span>
          <span>4001</span>
        </div>
      </div>
    </aside>
  );
}
