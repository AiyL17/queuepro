"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Zap, Link2, Target, Trophy, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface ActiveSession { id: string; game_mode: string; status: string; start_time: string; }

export default function Home() {
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);

  useEffect(() => {
    const id = localStorage.getItem("qp-last-session");
    if (!id) return;
    const supabase = createClient();
    supabase
      .from("sessions")
      .select("id, game_mode, status, start_time")
      .eq("id", id)
      .single()
      .then(({ data }) => {
        if (data && data.status === "active") {
          setActiveSession(data as ActiveSession);
        } else {
          localStorage.removeItem("qp-last-session");
        }
      });
  }, []);

  const dismissSession = () => {
    localStorage.removeItem("qp-last-session");
    setActiveSession(null);
  };

  return (
    <main
      className="min-h-screen flex flex-col relative overflow-hidden"
      style={{ background: "var(--gradient-hero)" }}
    >
      {/* ── Decorative orbs ── */}
      <div
        className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />
      <div
        className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(6,182,212,0.1) 0%, transparent 70%)",
          filter: "blur(80px)",
        }}
      />

      {/* ── Dot-grid background ── */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage: "radial-gradient(circle, #a78bfa 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* ── Nav ── */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg relative overflow-hidden group"
            style={{ background: "var(--gradient-cta)" }}
          >
            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="8" y1="11" x2="14" y2="11" />
              <line x1="11" y1="8" x2="11" y2="14" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-xl tracking-tight leading-none" style={{ color: "var(--text-heading)" }}>
                QueuePro
              </span>
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black tracking-widest uppercase"
                style={{
                  background: "rgba(124,58,237,0.15)",
                  color: "#a78bfa",
                  border: "1px solid rgba(124,58,237,0.3)",
                }}
              >
                PRO
              </span>
            </div>
            <p className="text-[10px] font-semibold tracking-wide hidden sm:block" style={{ color: "var(--text-faint)" }}>
              Pickleball Session Engine
            </p>
          </div>
        </div>
        <ThemeToggle />
      </nav>

      {/* ── Hero ── */}
      <section className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-16 sm:py-20 text-center">

        {/* Badge */}
        <div
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold mb-6 transition-all"
          style={{
            background: "rgba(124,58,237,0.12)",
            color: "#c084fc",
            border: "1px solid rgba(124,58,237,0.25)",
            boxShadow: "0 2px 12px rgba(124,58,237,0.15)"
          }}
        >
          <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
          <span>Smart Pickleball Queue &amp; Rotation</span>
        </div>

        {/* Headline */}
        <h1
          className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.08] mb-6 max-w-3xl"
          style={{ color: "var(--text-heading)" }}
        >
          Run your session
          <br />
          <span className="gradient-text">like a champion.</span>
        </h1>

        <p
          className="text-base sm:text-lg max-w-xl mx-auto mb-9 leading-relaxed font-normal"
          style={{ color: "var(--text-muted)" }}
        >
          Automated skill-based court assignments, live waiting queues, instant score recording, and real-time leaderboards.
        </p>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row gap-3.5 mb-8 w-full sm:w-auto justify-center">
          <Link
            href="/session/new"
            className="btn-primary flex items-center justify-center gap-2.5 px-8 py-4 text-base font-bold shadow-xl hover:scale-105 active:scale-95 transition-all duration-200"
            style={{ background: "var(--gradient-cta)", boxShadow: "0 8px 30px rgba(124,58,237,0.35)" }}
          >
            <Zap size={18} className="text-amber-300" />
            Start New Session
          </Link>
          <Link
            href="/session/join"
            className="flex items-center justify-center gap-2.5 px-8 py-4 text-base font-bold rounded-2xl transition-all duration-200 hover:scale-105 active:scale-95"
            style={{
              background: "var(--bg-card)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
            }}
          >
            <Link2 size={18} style={{ color: "var(--text-muted)" }} />
            Join with Code
          </Link>
        </div>

        {/* Social proof strip */}
        <div
          className="inline-flex items-center gap-3 px-4 py-2 rounded-full text-xs font-semibold mb-12"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
        >
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Free to use</span>
          <span className="w-1 h-1 rounded-full opacity-40" style={{ background: "var(--text-faint)" }} />
          <span>No login required</span>
          <span className="w-1 h-1 rounded-full opacity-40" style={{ background: "var(--text-faint)" }} />
          <span>Real-time sync</span>
        </div>

        {/* Continue Session card */}
        {activeSession && (
          <div
            className="p-5 text-left w-full max-w-2xl mb-10 rounded-3xl relative overflow-hidden transition-all duration-300 group"
            style={{
              background: "linear-gradient(135deg, var(--bg-card) 0%, rgba(34,197,94,0.06) 100%)",
              border: "1px solid rgba(34,197,94,0.35)",
              boxShadow: "0 8px 32px rgba(34,197,94,0.14)",
            }}
          >
            <div
              className="absolute -top-10 -right-10 w-32 h-32 rounded-full pointer-events-none"
              style={{ background: "radial-gradient(circle, rgba(34,197,94,0.2) 0%, transparent 70%)" }}
            />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full"
                    style={{
                      background: "rgba(34,197,94,0.15)",
                      color: "#4ade80",
                      border: "1px solid rgba(34,197,94,0.3)",
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Session Active
                  </span>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase"
                    style={{ background: "var(--bg-subtle)", color: "var(--text-muted)" }}
                  >
                    {activeSession.game_mode}
                  </span>
                </div>
                <p className="text-base font-bold mb-0.5 leading-snug" style={{ color: "var(--text-heading)" }}>
                  {activeSession.game_mode === "doubles" ? "2v2 Doubles Session" : "1v1 Singles Session"}
                </p>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Started {new Date(activeSession.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · Ready to resume
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={dismissSession}
                  className="text-xs font-semibold px-3 py-2 rounded-xl transition-all hover:opacity-80"
                  style={{ color: "var(--text-faint)", background: "var(--bg-subtle)" }}
                >
                  Dismiss
                </button>
                <Link
                  href={`/session/${activeSession.id}`}
                  className="flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:scale-105 active:scale-95"
                  style={{
                    background: "var(--gradient-green)",
                    boxShadow: "0 4px 16px rgba(34,197,94,0.35)",
                  }}
                >
                  Resume Session →
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Feature cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-4xl">
          {[
            {
              icon: <Target size={22} strokeWidth={2} />,
              iconBg: "rgba(124,58,237,0.15)",
              iconColor: "#a78bfa",
              gradient: "rgba(124,58,237,0.06)",
              border: "rgba(124,58,237,0.25)",
              label: "Skill-based Queuing",
              sub: "Players are matched and queued by rating for fair, competitive games on every court.",
            },
            {
              icon: <Trophy size={22} strokeWidth={2} />,
              iconBg: "rgba(245,158,11,0.15)",
              iconColor: "#fbbf24",
              gradient: "rgba(245,158,11,0.06)",
              border: "rgba(245,158,11,0.25)",
              label: "Live Leaderboard",
              sub: "Track individual and pair rankings that update automatically with every score saved.",
            },
            {
              icon: <Users size={22} strokeWidth={2} />,
              iconBg: "rgba(6,182,212,0.15)",
              iconColor: "#06b6d4",
              gradient: "rgba(6,182,212,0.06)",
              border: "rgba(6,182,212,0.25)",
              label: "Auto Court Fill",
              sub: "Courts automatically populate with waiting players as soon as matches finish.",
            },
          ].map((f) => (
            <div
              key={f.label}
              className="p-6 text-left rounded-3xl relative overflow-hidden transition-all duration-300 hover:scale-[1.02] group"
              style={{
                background: `linear-gradient(145deg, var(--bg-card) 0%, ${f.gradient} 100%)`,
                border: `1px solid ${f.border}`,
                boxShadow: "0 4px 20px rgba(0,0,0,0.04)",
              }}
            >
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110 shadow-sm"
                style={{ background: f.iconBg, color: f.iconColor }}
              >
                {f.icon}
              </div>
              <div
                className="text-base font-bold mb-1.5 tracking-tight"
                style={{ color: "var(--text-heading)" }}
              >
                {f.label}
              </div>
              <div className="text-xs leading-relaxed font-normal" style={{ color: "var(--text-muted)" }}>
                {f.sub}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer
        className="relative z-10 text-center py-6 text-xs font-medium"
        style={{ color: "var(--text-faint)", borderTop: "1px solid var(--border-subtle)" }}
      >
        © {new Date().getFullYear()} QueuePro · Built for competitive pickleball communities
      </footer>
    </main>
  );
}
