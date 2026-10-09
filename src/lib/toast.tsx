"use client";

/**
 * Lightweight toast system — no external dependency.
 *
 * Usage:
 *   const toast = useToast();
 *   toast.error("Something went wrong");
 *   toast.success("Saved!");
 *   toast.warning("Watch out");
 *   toast.info("FYI...");
 *
 * Mount <Toaster /> once in the root layout.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ToastVariant = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  /** ms before auto-dismiss; 0 = never */
  duration: number;
  /** whether the toast is in the slide-out phase */
  leaving: boolean;
}

interface ToastAPI {
  success: (msg: string, duration?: number) => void;
  error:   (msg: string, duration?: number) => void;
  warning: (msg: string, duration?: number) => void;
  info:    (msg: string, duration?: number) => void;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastAPI | null>(null);

// ─── Styles per variant ───────────────────────────────────────────────────────

const VARIANT_STYLES: Record<
  ToastVariant,
  { icon: React.ReactNode; bg: string; border: string; text: string; iconColor: string }
> = {
  success: {
    icon:      <CheckCircle   size={17} />,
    bg:        "var(--success-bg)",
    border:    "var(--success-border)",
    text:      "var(--success-text)",
    iconColor: "var(--success-text)",
  },
  error: {
    icon:      <XCircle       size={17} />,
    bg:        "var(--error-bg)",
    border:    "var(--error-border)",
    text:      "var(--error-text)",
    iconColor: "var(--error-text)",
  },
  warning: {
    icon:      <AlertTriangle size={17} />,
    bg:        "rgba(251,191,36,0.10)",
    border:    "rgba(251,191,36,0.30)",
    text:      "#fbbf24",
    iconColor: "#fbbf24",
  },
  info: {
    icon:      <Info          size={17} />,
    bg:        "rgba(124,58,237,0.10)",
    border:    "rgba(124,58,237,0.28)",
    text:      "#a78bfa",
    iconColor: "#a78bfa",
  },
};

// ─── Provider + Toaster ──────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    // Start slide-out animation
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, leaving: true } : t))
    );
    // Remove after animation completes (300 ms)
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 320);
  }, []);

  const add = useCallback(
    (message: string, variant: ToastVariant, duration = 4000) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setToasts((prev) => [...prev, { id, message, variant, duration, leaving: false }]);

      if (duration > 0) {
        const timer = setTimeout(() => dismiss(id), duration);
        timers.current.set(id, timer);
      }
    },
    [dismiss]
  );

  // Clean up timers on unmount
  useEffect(() => {
    const t = timers.current;
    return () => { t.forEach((timer) => clearTimeout(timer)); };
  }, []);

  const api: ToastAPI = {
    success: (m, d) => add(m, "success", d),
    error:   (m, d) => add(m, "error",   d),
    warning: (m, d) => add(m, "warning", d),
    info:    (m, d) => add(m, "info",    d),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}

      {/* ── Toast container — fixed top-right ── */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 w-[calc(100vw-2rem)] max-w-sm pointer-events-none"
      >
        {toasts.map((toast) => {
          const s = VARIANT_STYLES[toast.variant];
          return (
            <div
              key={toast.id}
              role="alert"
              className="pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-2xl shadow-lg text-sm font-medium"
              style={{
                background:    s.bg,
                border:        `1px solid ${s.border}`,
                color:         s.text,
                boxShadow:     "0 8px 24px rgba(0,0,0,0.35)",
                // Slide in from the right on enter; slide out on leave
                animation: toast.leaving
                  ? "toastLeave 0.3s cubic-bezier(0.4,0,1,1) forwards"
                  : "toastEnter 0.35s cubic-bezier(0.16,1,0.3,1) forwards",
              }}
            >
              {/* Icon */}
              <span
                className="flex-shrink-0 mt-px"
                style={{ color: s.iconColor }}
              >
                {s.icon}
              </span>

              {/* Message */}
              <span className="flex-1 leading-snug">{toast.message}</span>

              {/* Dismiss button */}
              <button
                onClick={() => dismiss(toast.id)}
                className="flex-shrink-0 mt-px opacity-60 hover:opacity-100 transition-opacity"
                aria-label="Dismiss"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useToast(): ToastAPI {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
