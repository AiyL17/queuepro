"use client";

import { useLayoutEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useLayoutEffect(() => {
    const stored = (localStorage.getItem("qp-theme") ?? "dark") as "dark" | "light";
    setTheme(stored);
    document.documentElement.setAttribute("data-theme", stored);
  }, []);

  function toggle() {
    const next: "dark" | "light" = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("qp-theme", next); } catch (_) {}
  }

  const isDark = theme === "dark";

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={`h-9 px-2.5 sm:px-3 rounded-xl text-xs font-bold transition-all hover:opacity-90 active:scale-95 flex items-center gap-1.5 flex-shrink-0 cursor-pointer shadow-sm ${className}`}
      style={{
        background: "var(--bg-card)",
        color: "var(--text-muted)",
        border: "1px solid var(--border)",
      }}
    >
      <span
        className="transition-transform duration-300"
        style={{ transform: isDark ? "rotate(0deg)" : "rotate(20deg)" }}
      >
        {isDark
          ? <Sun size={14} strokeWidth={2.2} />
          : <Moon size={14} strokeWidth={2.2} />
        }
      </span>
      <span className="hidden sm:inline">{isDark ? "Light" : "Dark"}</span>
    </button>
  );
}
