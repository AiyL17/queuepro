"use client";

import { useEffect, useState } from "react";
import { Clock, AlertTriangle, AlertCircle } from "lucide-react";

interface CourtTimerProps {
  courtId: string;
  courtStatus: "available" | "occupied";
  latestMatchTime?: string;
  sessionStartTime?: string;
  className?: string;
}

export function CourtTimer({
  courtId,
  courtStatus,
  latestMatchTime,
  sessionStartTime,
  className = "",
}: CourtTimerProps) {
  const [startTime, setStartTime] = useState<number | null>(null);
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    if (courtStatus !== "occupied") {
      setStartTime(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem(`qp-court-start-${courtId}`);
      }
      return;
    }

    if (typeof window === "undefined") return;

    const storageKey = `qp-court-start-${courtId}`;
    const stored = localStorage.getItem(storageKey);
    let resolvedTime: number;

    const latestMatchMs = latestMatchTime ? new Date(latestMatchTime).getTime() : 0;

    if (stored) {
      const parsed = parseInt(stored, 10);
      // If stored time is earlier than the latest completed match on this court, it's stale
      if (!isNaN(parsed) && parsed >= latestMatchMs) {
        resolvedTime = parsed;
      } else if (latestMatchMs > 0) {
        resolvedTime = latestMatchMs;
      } else {
        resolvedTime = Date.now();
      }
    } else if (latestMatchMs > 0) {
      resolvedTime = latestMatchMs;
    } else if (sessionStartTime) {
      resolvedTime = new Date(sessionStartTime).getTime();
    } else {
      resolvedTime = Date.now();
    }

    localStorage.setItem(storageKey, String(resolvedTime));
    setStartTime(resolvedTime);
  }, [courtId, courtStatus, latestMatchTime, sessionStartTime]);

  useEffect(() => {
    if (courtStatus !== "occupied") return;
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [courtStatus]);

  if (courtStatus !== "occupied" || !startTime) return null;

  const elapsedSeconds = Math.max(0, Math.floor((now - startTime) / 1000));
  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  const timeFormatted = `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;

  // Thresholds: Normal (<15m), Warning (15m-20m), Overtime (>=20m)
  const isOvertime = minutes >= 20;
  const isWarning = minutes >= 15 && !isOvertime;

  if (isOvertime) {
    return (
      <span
        className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse flex-shrink-0 ${className}`}
        style={{
          background: "rgba(239, 68, 68, 0.18)",
          color: "#ef4444",
          border: "1px solid rgba(239, 68, 68, 0.4)",
        }}
        title={`Overtime — match has been in play for ${minutes} minutes`}
      >
        <AlertCircle size={10} className="stroke-[2.5]" />
        <span>{timeFormatted}</span>
      </span>
    );
  }

  if (isWarning) {
    return (
      <span
        className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${className}`}
        style={{
          background: "rgba(245, 158, 11, 0.15)",
          color: "#f59e0b",
          border: "1px solid rgba(245, 158, 11, 0.35)",
        }}
        title={`Match duration: ${minutes} minutes`}
      >
        <AlertTriangle size={10} className="stroke-[2.5]" />
        <span>{timeFormatted}</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${className}`}
      style={{
        background: "var(--bg-subtle)",
        color: "var(--text-muted)",
        border: "1px solid var(--border)",
      }}
      title={`Match duration: ${timeFormatted}`}
    >
      <Clock size={10} className="opacity-70" />
      <span>{timeFormatted}</span>
    </span>
  );
}
