"use client";

import { useState, useRef, useEffect } from "react";
import { HelpCircle } from "lucide-react";

interface HelpTooltipProps {
  text: string;
  /** Position of the popover relative to the icon. Defaults to "top". */
  position?: "top" | "bottom" | "left" | "right";
}

export function HelpTooltip({ text, position = "top" }: HelpTooltipProps) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!visible) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setVisible(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [visible]);

  const posStyles: Record<string, React.CSSProperties> = {
    top:    { bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)" },
    bottom: { top: "calc(100% + 8px)",    left: "50%", transform: "translateX(-50%)" },
    left:   { right: "calc(100% + 8px)",  top: "50%",  transform: "translateY(-50%)" },
    right:  { left: "calc(100% + 8px)",   top: "50%",  transform: "translateY(-50%)" },
  };

  return (
    <span className="relative inline-flex items-center ml-1.5">
      <button
        ref={ref}
        type="button"
        onClick={() => setVisible((v) => !v)}
        onKeyDown={(e) => e.key === "Escape" && setVisible(false)}
        aria-label="Show field help"
        className="w-4 h-4 rounded-full flex items-center justify-center transition-all hover:opacity-80 cursor-pointer"
        style={{ color: "var(--text-faint)" }}
      >
        <HelpCircle size={13} />
      </button>

      {visible && (
        <div
          className="absolute z-50 w-56 p-3 rounded-2xl text-xs leading-relaxed font-medium shadow-xl"
          style={{
            ...posStyles[position],
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
            color: "var(--text-muted)",
          }}
        >
          {text}
        </div>
      )}
    </span>
  );
}
