"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight, Lightbulb } from "lucide-react";
import { useHelp, type HelpPageKey } from "@/hooks/useHelp";
import { HELP_CONTENT, type HelpStep } from "@/lib/help-content";

interface HelpModalProps {
  pageKey: HelpPageKey;
}

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface PopoverPos {
  top: number;
  left: number;
  isMobileTop?: boolean;
}

export function HelpModal({ pageKey }: HelpModalProps) {
  const { isOpen, currentStep, totalSteps, close, next, prev, dismiss } = useHelp();
  const popoverRef = useRef<HTMLDivElement>(null);

  const steps = HELP_CONTENT[pageKey];
  const step: HelpStep | undefined = steps?.[currentStep];

  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [popoverPos, setPopoverPos] = useState<PopoverPos | null>(null);

  const updatePosition = useCallback(() => {
    if (!step?.targetSelector) {
      setTargetRect(null);
      setPopoverPos(null);
      return;
    }

    const el = document.querySelector(step.targetSelector);
    if (!el) {
      setTargetRect(null);
      setPopoverPos(null);
      return;
    }

    const rect = el.getBoundingClientRect();
    const padding = 6;
    const highlightRect: TargetRect = {
      top: Math.max(0, rect.top - padding),
      left: Math.max(0, rect.left - padding),
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
    };
    setTargetRect(highlightRect);

    const isMobile = window.innerWidth < 640;

    if (isMobile) {
      // Mobile positioning: intelligently choose top vs bottom sheet so highlighted element is NEVER covered
      const targetCenterY = rect.top + rect.height / 2;
      const viewportCenterY = window.innerHeight / 2;

      // If the highlighted element is in the lower half of viewport, dock at top!
      // If it's in the upper half of viewport, dock at bottom!
      const placeAtTop = targetCenterY > viewportCenterY;
      setPopoverPos({ top: 0, left: 0, isMobileTop: placeAtTop });
      return;
    }

    // Desktop: calculate floating coordinates beside or above/below target
    const popoverWidth = 320;
    const popoverHeight = 220;
    const margin = 12;
    const placement = step.preferredPlacement || "bottom";

    let top = 0;
    let left = 0;

    if (placement === "bottom") {
      if (rect.bottom + popoverHeight + margin <= window.innerHeight) {
        top = rect.bottom + margin;
      } else {
        top = Math.max(16, rect.top - popoverHeight - margin);
      }
      left = Math.max(16, Math.min(window.innerWidth - popoverWidth - 16, rect.left + rect.width / 2 - popoverWidth / 2));
    } else if (placement === "top") {
      if (rect.top - popoverHeight - margin >= 0) {
        top = rect.top - popoverHeight - margin;
      } else {
        top = rect.bottom + margin;
      }
      left = Math.max(16, Math.min(window.innerWidth - popoverWidth - 16, rect.left + rect.width / 2 - popoverWidth / 2));
    } else if (placement === "right") {
      if (rect.right + popoverWidth + margin <= window.innerWidth) {
        left = rect.right + margin;
        top = Math.max(16, Math.min(window.innerHeight - popoverHeight - 16, rect.top + rect.height / 2 - popoverHeight / 2));
      } else {
        top = rect.bottom + margin;
        left = Math.max(16, Math.min(window.innerWidth - popoverWidth - 16, rect.left));
      }
    } else if (placement === "left") {
      if (rect.left - popoverWidth - margin >= 0) {
        left = rect.left - popoverWidth - margin;
        top = Math.max(16, Math.min(window.innerHeight - popoverHeight - 16, rect.top + rect.height / 2 - popoverHeight / 2));
      } else {
        top = rect.bottom + margin;
        left = Math.max(16, Math.min(window.innerWidth - popoverWidth - 16, rect.left));
      }
    }

    setPopoverPos({ top, left });
  }, [step]);

  // Scroll target element into view smoothly so that it leaves ample room for the popover
  useEffect(() => {
    if (!isOpen || !step?.targetSelector) return;
    const el = document.querySelector(step.targetSelector);
    if (!el) return;

    const isMobile = window.innerWidth < 640;
    if (isMobile) {
      const rect = el.getBoundingClientRect();
      const elTopInDoc = window.scrollY + rect.top;
      const targetCenter = elTopInDoc + rect.height / 2;

      // Check current position in document
      // If it's near the top of document, scroll to top so top-placed items are visible and popover sits below
      // If it's near bottom of document, scroll so bottom-placed items are visible and popover sits above
      el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    } else {
      el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    }
  }, [isOpen, currentStep, step]);

  // Update bounds on step change or resize/scroll
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(updatePosition, 100);
    const scrollTimer = setTimeout(updatePosition, 300);

    const handleResize = () => updatePosition();
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleResize, true);

    return () => {
      clearTimeout(timer);
      clearTimeout(scrollTimer);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize, true);
    };
  }, [isOpen, currentStep, updatePosition]);

  if (!isOpen || !step) return null;

  const Icon = step.icon;
  const isLast = currentStep === totalSteps - 1;
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
  const isCentered = !targetRect || (!popoverPos && !isMobile);
  const isMobileTop = isMobile && popoverPos?.isMobileTop;

  const modal = (
    <div
      className="fixed inset-0 z-[9999] pointer-events-auto select-none"
      style={{ overflow: "hidden" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      {/* ── Dimmed Backdrop with SVG Cutout Hole ── */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none transition-all duration-300 ease-out"
        style={{ width: "100vw", height: "100vh" }}
      >
        <defs>
          <mask id="spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.left}
                y={targetRect.top}
                width={targetRect.width}
                height={targetRect.height}
                rx="14"
                ry="14"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(4, 4, 10, 0.72)"
          mask="url(#spotlight-mask)"
        />
      </svg>

      {/* ── Glowing Spotlight Border ── */}
      {targetRect && (
        <div
          className="fixed pointer-events-none transition-all duration-300 ease-out rounded-xl"
          style={{
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height,
            border: "2px solid #a78bfa",
            boxShadow: "0 0 0 3px rgba(167,139,250,0.25), 0 0 20px rgba(124,58,237,0.45)",
          }}
        />
      )}

      {/* ── Popover Dialog ── */}
      <div
        ref={popoverRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Guide: ${step.title}`}
        className={`fixed z-[10000] rounded-2xl p-4 sm:p-5 flex flex-col gap-3 shadow-2xl transition-all duration-300 ease-out animate-scale-in ${
          isMobile
            ? isCentered
              ? "top-1/2 left-4 right-4 -translate-y-1/2 max-h-[50vh] overflow-y-auto"
              : isMobileTop
              ? "top-4 left-3 right-3 max-h-[46vh] overflow-y-auto"
              : "bottom-4 left-3 right-3 max-h-[46vh] overflow-y-auto"
            : isCentered
            ? "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px]"
            : "w-[320px]"
        }`}
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)",
          ...(isMobile || isCentered || !popoverPos
            ? {}
            : {
                top: `${popoverPos.top}px`,
                left: `${popoverPos.left}px`,
              }),
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar: Step pill & Close button */}
        <div className="flex items-center justify-between">
          <span
            className="text-[9px] font-black px-2 py-0.5 rounded-full tracking-wider uppercase"
            style={{
              background: "rgba(124,58,237,0.15)",
              color: "#a78bfa",
              border: "1px solid rgba(124,58,237,0.25)",
            }}
          >
            Step {currentStep + 1} of {totalSteps}
          </span>

          <button
            onClick={close}
            aria-label="Close walkthrough"
            className="w-6 h-6 rounded-full flex items-center justify-center transition-all hover:opacity-80 active:scale-95 cursor-pointer"
            style={{ background: "var(--bg-subtle)", color: "var(--text-muted)" }}
          >
            <X size={12} />
          </button>
        </div>

        {/* Header: Icon + Title */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: step.iconBg, color: step.iconColor }}
          >
            <Icon size={16} />
          </div>
          <h3
            className="text-sm font-black tracking-tight leading-tight"
            style={{ color: "var(--text-heading)" }}
          >
            {step.title}
          </h3>
        </div>

        {/* Content */}
        <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
          {step.body}
        </p>

        {/* Pro Tip */}
        {step.tip && (
          <div
            className="flex items-start gap-1.5 p-2 rounded-xl"
            style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)" }}
          >
            <Lightbulb size={12} className="flex-shrink-0 mt-0.5 text-amber-500" />
            <p className="text-[10px] leading-tight font-medium text-amber-500">
              {step.tip}
            </p>
          </div>
        )}

        {/* Step Dots */}
        <div className="flex items-center justify-center gap-1 py-0.5">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <span
              key={i}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === currentStep ? "14px" : "5px",
                height: "5px",
                background:
                  i === currentStep
                    ? "#a78bfa"
                    : i < currentStep
                    ? "rgba(167,139,250,0.4)"
                    : "var(--border)",
              }}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-0.5">
          <button
            onClick={prev}
            disabled={currentStep === 0}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all disabled:opacity-30 disabled:pointer-events-none hover:opacity-80 active:scale-95 cursor-pointer"
            style={{ background: "var(--bg-subtle)", color: "var(--text-muted)" }}
          >
            <ChevronLeft size={13} /> Back
          </button>

          <button
            onClick={dismiss}
            className="flex-1 text-center text-[10px] font-semibold transition-all hover:opacity-70 active:scale-95 cursor-pointer truncate"
            style={{ color: "var(--text-faint)" }}
          >
            Dismiss
          </button>

          <button
            onClick={isLast ? close : next}
            className="flex items-center gap-1 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all hover:opacity-90 active:scale-95 cursor-pointer shadow-md"
            style={{
              background: "linear-gradient(135deg, #7c3aed, #9333ea)",
              color: "#fff",
              boxShadow: "0 3px 10px rgba(124,58,237,0.35)",
            }}
          >
            {isLast ? "Done" : <>Next <ChevronRight size={13} /></>}
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof window === "undefined") return null;
  return createPortal(modal, document.body);
}
