"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { HelpCircle } from "lucide-react";
import { useHelp, type HelpPageKey } from "@/hooks/useHelp";
import { HELP_CONTENT } from "@/lib/help-content";

interface HelpButtonProps {
  pageKey: HelpPageKey;
  /** When true, auto-opens the walkthrough once (unless already dismissed). */
  autoOpen?: boolean;
}

export function HelpButton({ pageKey, autoOpen = false }: HelpButtonProps) {
  const { open, isOpen, currentStep, totalSteps, isDismissed } = useHelp();
  const [mounted, setMounted] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const steps = HELP_CONTENT[pageKey];

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-open logic — fires once per page key if not dismissed
  useEffect(() => {
    if (!autoOpen || !steps) return;
    const timer = setTimeout(() => {
      if (!isDismissed(pageKey)) {
        open(pageKey, steps.length);
      }
    }, 600); // slight delay so the page renders first
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageKey]);

  if (!mounted) return null;

  const handleClick = () => {
    if (steps) {
      open(pageKey, steps.length);
    }
  };

  const button = (
    <div className="fixed bottom-5 right-5 z-[9998] flex flex-col items-end gap-2">
      {/* Tooltip */}
      {showTooltip && !isOpen && (
        <div
          className="px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap pointer-events-none"
          style={{
            background: "var(--bg-card)",
            color: "var(--text-primary)",
            border: "1px solid var(--border)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
          }}
        >
          Help &amp; Walkthrough
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={handleClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        aria-label="Open help walkthrough"
        title="Help & Walkthrough"
        className="relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer shadow-xl"
        style={{
          background: "linear-gradient(135deg, #7c3aed, #9333ea)",
          color: "#fff",
          boxShadow: isOpen
            ? "0 0 0 3px rgba(124,58,237,0.4), 0 8px 24px rgba(124,58,237,0.5)"
            : "0 4px 20px rgba(124,58,237,0.45)",
        }}
      >
        <HelpCircle size={22} />

        {/* Active step badge */}
        {isOpen && (
          <span
            className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center text-[9px] font-black px-1 rounded-full"
            style={{ background: "#fbbf24", color: "#000" }}
          >
            {currentStep + 1}/{totalSteps}
          </span>
        )}

        {/* Pulse ring when not open */}
        {!isOpen && (
          <span
            className="absolute inset-0 rounded-full animate-ping opacity-20 pointer-events-none"
            style={{ background: "#a78bfa", animationDuration: "3s" }}
          />
        )}
      </button>
    </div>
  );

  return createPortal(button, document.body);
}
