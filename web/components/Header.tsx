"use client";

import { useRef, useEffect } from "react";
import { Search } from "lucide-react";

type HeaderProps = {
  activeLabel: string;
  onToggleTheme: () => void;
};

export default function Header({ activeLabel, onToggleTheme }: HeaderProps) {
  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const handler = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <header className="header">
      <div className="breadcrumb">
        WORKSPACE / <span>{activeLabel.toUpperCase()}</span>
      </div>
      <div className="header-actions" suppressHydrationWarning>
        <input
          suppressHydrationWarning
          ref={searchRef}
          type="text"
          className="search-input"
          placeholder="CMD+K to search..."
        />
        <button
          suppressHydrationWarning
          className="theme-toggle"
          onClick={onToggleTheme}
          title="Toggle theme"
          aria-label="Toggle theme"
        >
          <Search size={14} />
        </button>
      </div>
    </header>
  );
}
