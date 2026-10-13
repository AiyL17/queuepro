"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";

export type HelpPageKey =
  | "home"
  | "new-session-step1"
  | "new-session-step2"
  | "dashboard-organizer"
  | "dashboard-player"
  | "checkin"
  | "leaderboard"
  | "join";

interface HelpContextValue {
  isOpen: boolean;
  currentStep: number;
  totalSteps: number;
  pageKey: HelpPageKey | null;
  open: (key: HelpPageKey, steps: number) => void;
  close: () => void;
  next: () => void;
  prev: () => void;
  dismiss: () => void;
  isDismissed: (key: HelpPageKey) => boolean;
  resetDismiss: (key: HelpPageKey) => void;
}

const HelpContext = createContext<HelpContextValue | null>(null);

export function HelpProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen]         = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps, setTotalSteps]   = useState(0);
  const [pageKey, setPageKey]         = useState<HelpPageKey | null>(null);

  const isDismissed = useCallback((key: HelpPageKey) => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(`qp-help-dismissed-${key}`) === "true";
  }, []);

  const open = useCallback((key: HelpPageKey, steps: number) => {
    setPageKey(key);
    setTotalSteps(steps);
    setCurrentStep(0);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const dismiss = useCallback(() => {
    if (pageKey) {
      localStorage.setItem(`qp-help-dismissed-${pageKey}`, "true");
    }
    setIsOpen(false);
  }, [pageKey]);

  const next = useCallback(() => {
    setCurrentStep((s) => {
      if (s >= totalSteps - 1) {
        setIsOpen(false);
        return s;
      }
      return s + 1;
    });
  }, [totalSteps]);

  const prev = useCallback(() => {
    setCurrentStep((s) => Math.max(0, s - 1));
  }, []);

  const resetDismiss = useCallback((key: HelpPageKey) => {
    localStorage.removeItem(`qp-help-dismissed-${key}`);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || (e.key === "Enter" && document.activeElement?.tagName !== "BUTTON")) next();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, next, prev, close]);

  return (
    <HelpContext.Provider
      value={{ isOpen, currentStep, totalSteps, pageKey, open, close, next, prev, dismiss, isDismissed, resetDismiss }}
    >
      {children}
    </HelpContext.Provider>
  );
}

export function useHelp() {
  const ctx = useContext(HelpContext);
  if (!ctx) throw new Error("useHelp must be used within HelpProvider");
  return ctx;
}
