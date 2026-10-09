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
      className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all hover:opacity-90 flex-shrink-0 ${className}`}
      style={{
        background: "rgba(255,255,255,0.06)",
        color: "var(--text-muted)",
        border: "1px solid var(--border-hover)",
        backdropFilter: "blur(12px)",
      }}
    >
      <span
        className="transition-transform duration-300"
        style={{ transform: isDark ? "rotate(0deg)" : "rotate(20deg)" }}
      >
        {isDark
          ? <Sun size={13} strokeWidth={2} />
          : <Moon size={13} strokeWidth={2} />
        }
      </span>
      <span>{isDark ? "Light" : "Dark"}</span>
    </button>
  );
}
