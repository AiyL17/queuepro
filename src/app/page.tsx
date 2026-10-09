"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Zap, Link2, Target, Trophy, Users, ClipboardList, UserCheck, Play, CheckCircle2, XCircle, Sparkles, Shield, Smartphone, Download, ArrowRightCircle, X, QrCode, Copy, ExternalLink, Share2, Check, Lightbulb, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface ActiveSession { id: string; game_mode: string; status: string; start_time: string; }

export default function Home() {
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [activeTier, setActiveTier] = useState<"all" | "beginner" | "intermediate" | "advanced">("all");
  const [showPwaBanner, setShowPwaBanner] = useState(true);
  const [showMobileModal, setShowMobileModal] = useState(false);
  const [showJoinQrModal, setShowJoinQrModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedJoin, setCopiedJoin] = useState(false);
  const [currentUrl, setCurrentUrl] = useState("");
  const [joinUrl, setJoinUrl] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setCurrentUrl(window.location.href);
      setJoinUrl(`${window.location.origin}/session/join`);
      const dismissed = localStorage.getItem("qp-pwa-dismissed");
      if (dismissed) setShowPwaBanner(false);
    }
  }, []);

  const handleCopyJoinLink = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(joinUrl || (typeof window !== "undefined" ? `${window.location.origin}/session/join` : ""));
      setCopiedJoin(true);
      setTimeout(() => setCopiedJoin(false), 2000);
    }
  };

  const handleMobileNavClick = async () => {
    if (typeof navigator !== "undefined" && navigator.share && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
      try {
        await navigator.share({
          title: "QueuePro - Pickleball Queue System",
          text: "Play pickleball with real-time queues & leaderboards directly in your browser!",
          url: window.location.href,
        });
        return;
      } catch {
        // Fallback to modal if share is cancelled or fails
      }
    }
    setShowMobileModal(true);
  };

  const handleCopyLink = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(currentUrl || (typeof window !== "undefined" ? window.location.href : ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const dismissPwaBanner = () => {
    localStorage.setItem("qp-pwa-dismissed", "true");
    setShowPwaBanner(false);
  };

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
          >
            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            <Image
              src="/icon.jpg"
              alt="QueuePro Logo"
              width={40}
              height={40}
              className="rounded-2xl object-cover"
            />
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
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleMobileNavClick}
            title="Open on Mobile Phone Browser"
            className="group flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer"
            style={{
              background: "var(--bg-card)",
              color: "var(--text-heading)",
              border: "1.5px solid rgba(124,58,237,0.35)",
              boxShadow: "0 4px 16px rgba(124,58,237,0.12)",
            }}
          >
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center transition-transform group-hover:scale-110 flex-shrink-0"
              style={{ background: "var(--gradient-cta)", color: "#ffffff" }}
            >
              <Smartphone size={11} strokeWidth={2.5} />
            </div>
            <span className="tracking-tight hidden sm:inline">Use on Phone</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse hidden sm:block" />
          </button>
          <ThemeToggle />
        </div>
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

      {/* ── How it Works ── */}
      <section className="relative z-10 py-16 px-6 w-full max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>
            How it works
          </span>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight mt-2" style={{ color: "var(--text-heading)" }}>
            Up and running in <span className="gradient-text">60 seconds</span>
          </h2>
          <p className="text-sm mt-3 max-w-md mx-auto" style={{ color: "var(--text-muted)" }}>
            No setup headaches, no learning curve. Three steps and you&apos;re on the court.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 relative">
          {/* Connecting line (desktop only) */}
          <div
            className="hidden sm:block absolute top-10 left-[38%] right-[38%] h-px pointer-events-none"
            style={{ background: "linear-gradient(90deg, transparent, var(--border-hover), transparent)" }}
          />

          {[
            {
              step: "01",
              icon: <ClipboardList size={24} strokeWidth={2} />,
              color: "#8b5cf6",
              bg: "rgba(139,92,246,0.12)",
              label: "Create a Session",
              sub: "Pick Singles or Doubles, set up your courts and assign skill-level targets to each one.",
            },
            {
              step: "02",
              icon: <UserCheck size={24} strokeWidth={2} />,
              color: "#06b6d4",
              bg: "rgba(6,182,212,0.12)",
              label: "Add Players",
              sub: "Register players with their skill level. They're auto-assigned to the right court instantly.",
            },
            {
              step: "03",
              icon: <Play size={24} strokeWidth={2} />,
              color: "#22c55e",
              bg: "rgba(34,197,94,0.12)",
              label: "Play & Track",
              sub: "Courts fill automatically. Scores update live and the leaderboard builds itself as matches finish.",
            },
          ].map((s) => (
            <div
              key={s.step}
              className="relative flex flex-col items-center text-center p-7 rounded-3xl transition-all duration-300 hover:scale-[1.02]"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                boxShadow: "0 4px 20px rgba(0,0,0,0.04)",
              }}
            >
              {/* Step badge */}
              <div
                className="absolute -top-3 left-6 text-[10px] font-black px-2.5 py-0.5 rounded-full"
                style={{ background: s.color + "20", color: s.color, border: `1px solid ${s.color}40` }}
              >
                {s.step}
              </div>
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 shadow-sm"
                style={{ background: s.bg, color: s.color }}
              >
                {s.icon}
              </div>
              <p className="text-base font-bold mb-2 tracking-tight" style={{ color: "var(--text-heading)" }}>
                {s.label}
              </p>
              <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {s.sub}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Skill-Tier Visual Diagram (#5) ── */}
      <section className="relative z-10 py-12 px-6 w-full max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold mb-3"
            style={{ background: "rgba(124,58,237,0.12)", color: "#a78bfa", border: "1px solid rgba(124,58,237,0.25)" }}>
            <Shield size={13} />
            <span>Fair Matchmaking Engine</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight" style={{ color: "var(--text-heading)" }}>
            Smart Skill-Tier <span className="gradient-text">Court Routing</span>
          </h2>
          <p className="text-sm mt-2 max-w-lg mx-auto" style={{ color: "var(--text-muted)" }}>
            Zero blowouts. Players are automatically sorted into balanced court brackets based on skill level.
          </p>

          {/* Interactive Tier Filter Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
            {[
              { id: "all", label: "All Active Courts", color: "#a78bfa" },
              { id: "beginner", label: "Beginner / Novice (2.0 - 2.5)", color: "#3b82f6" },
              { id: "intermediate", label: "Intermediate (3.0 - 3.5)", color: "#f97316" },
              { id: "advanced", label: "Advanced (4.0+)", color: "#ef4444" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTier(tab.id as typeof activeTier)}
                className="px-3.5 py-1.5 rounded-full text-xs font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer"
                style={{
                  background: activeTier === tab.id ? tab.color + "22" : "var(--bg-card)",
                  color: activeTier === tab.id ? tab.color : "var(--text-muted)",
                  border: `1px solid ${activeTier === tab.id ? tab.color + "55" : "var(--border)"}`,
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Visual Courts Display */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Court 1: Beginner */}
          {(activeTier === "all" || activeTier === "beginner") && (
            <div
              className="p-5 rounded-3xl flex flex-col justify-between transition-all duration-300 hover:scale-[1.01]"
              style={{
                background: "var(--bg-card)",
                border: "1px solid rgba(59,130,246,0.3)",
                boxShadow: "0 4px 24px rgba(59,130,246,0.06)",
              }}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" />
                    <span className="text-sm font-black" style={{ color: "var(--text-heading)" }}>Court 1</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30">
                    Beginner / Novice
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl mb-3 space-y-2" style={{ background: "var(--bg-subtle)" }}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold" style={{ color: "var(--text-primary)" }}>Liam &amp; Sophie</span>
                    <span className="font-black text-blue-400 px-2 py-0.5 rounded-lg bg-blue-500/10">8</span>
                  </div>
                  <div className="h-px w-full" style={{ background: "var(--border-subtle)" }} />
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold" style={{ color: "var(--text-primary)" }}>Noah &amp; Emma</span>
                    <span className="font-black text-blue-400 px-2 py-0.5 rounded-lg bg-blue-500/10">6</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between text-[11px]" style={{ color: "var(--text-muted)" }}>
                <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Live Match (Doubles)
                </span>
                <span>2 in waiting queue</span>
              </div>
            </div>
          )}

          {/* Court 2: Intermediate */}
          {(activeTier === "all" || activeTier === "intermediate") && (
            <div
              className="p-5 rounded-3xl flex flex-col justify-between transition-all duration-300 hover:scale-[1.01]"
              style={{
                background: "var(--bg-card)",
                border: "1px solid rgba(249,115,22,0.3)",
                boxShadow: "0 4px 24px rgba(249,115,22,0.06)",
              }}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                    <span className="text-sm font-black" style={{ color: "var(--text-heading)" }}>Court 2</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    Intermediate
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl mb-3 space-y-2" style={{ background: "var(--bg-subtle)" }}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold" style={{ color: "var(--text-primary)" }}>Carlos &amp; Elena</span>
                    <span className="font-black text-amber-400 px-2 py-0.5 rounded-lg bg-amber-500/10">10</span>
                  </div>
                  <div className="h-px w-full" style={{ background: "var(--border-subtle)" }} />
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold" style={{ color: "var(--text-primary)" }}>Marcus &amp; Chloe</span>
                    <span className="font-black text-amber-400 px-2 py-0.5 rounded-lg bg-amber-500/10">9</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between text-[11px]" style={{ color: "var(--text-muted)" }}>
                <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" /> Match Point!
                </span>
                <span>Auto-fills next</span>
              </div>
            </div>
          )}

          {/* Court 3: Advanced */}
          {(activeTier === "all" || activeTier === "advanced") && (
            <div
              className="p-5 rounded-3xl flex flex-col justify-between transition-all duration-300 hover:scale-[1.01]"
              style={{
                background: "var(--bg-card)",
                border: "1px solid rgba(239,68,68,0.3)",
                boxShadow: "0 4px 24px rgba(239,68,68,0.06)",
              }}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                    <span className="text-sm font-black" style={{ color: "var(--text-heading)" }}>Court 3</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30">
                    Advanced 4.0+
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl mb-3 space-y-2" style={{ background: "var(--bg-subtle)" }}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold" style={{ color: "var(--text-primary)" }}>David (4.5)</span>
                    <span className="flex items-center gap-1 font-black text-emerald-400 px-2 py-0.5 rounded-lg bg-emerald-500/10">
                      11 <Check size={11} strokeWidth={3} />
                    </span>
                  </div>
                  <div className="h-px w-full" style={{ background: "var(--border-subtle)" }} />
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold" style={{ color: "var(--text-primary)" }}>Jordan (4.5)</span>
                    <span className="font-black text-rose-400 px-2 py-0.5 rounded-lg bg-rose-500/10">7</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between text-[11px]" style={{ color: "var(--text-muted)" }}>
                <span className="flex items-center gap-1.5 text-blue-400 font-semibold">
                  <ArrowRightCircle size={13} /> Next match rotating in
                </span>
                <span>Live sync</span>
              </div>
            </div>
          )}
        </div>

        {/* Live Auto-Fill Queue Flow Strip */}
        <div
          className="mt-5 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(124,58,237,0.15)", color: "#a78bfa" }}>
              <Users size={18} />
            </div>
            <div>
              <p className="text-xs font-bold" style={{ color: "var(--text-heading)" }}>
                Waiting Queue Auto-Rotation
              </p>
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                When Court 2 finishes, Maya &amp; Ryan (Intermediate) are automatically seated next.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Zap size={10} className="fill-amber-400 text-amber-400" /> Next: Maya (3.5)
            </span>
            <span className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Zap size={10} className="fill-amber-400 text-amber-400" /> Next: Ryan (3.5)
            </span>
          </div>
        </div>
      </section>

      {/* ── QR / Join Callout ── */}
      <section className="relative z-10 py-4 px-6 w-full max-w-5xl mx-auto">
        <div
          className="rounded-3xl p-8 sm:p-10 relative overflow-hidden flex flex-col sm:flex-row items-center gap-8"
          style={{
            background: "linear-gradient(135deg, var(--bg-card) 0%, rgba(6,182,212,0.06) 100%)",
            border: "1px solid rgba(6,182,212,0.25)",
            boxShadow: "0 8px 40px rgba(6,182,212,0.08)",
          }}
        >
          {/* BG glow */}
          <div
            className="absolute -bottom-20 -right-20 w-72 h-72 rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%)",
              filter: "blur(40px)",
            }}
          />

          {/* QR code mockup */}
          <div className="flex-shrink-0 flex flex-col items-center gap-3">
            <div
              className="w-28 h-28 rounded-2xl p-3 grid gap-1 relative overflow-hidden group cursor-pointer"
              onClick={() => setShowJoinQrModal(true)}
              title="Click to view real scannable QR Code"
              style={{
                background: "var(--bg-subtle)",
                border: "2px solid rgba(6,182,212,0.4)",
                boxShadow: "0 0 20px rgba(6,182,212,0.15)",
                gridTemplateColumns: "repeat(5, 1fr)",
                gridTemplateRows: "repeat(5, 1fr)",
              }}
            >
              {/* Moving Laser Scanner Line */}
              <div
                className="absolute left-2 right-2 h-0.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#06b6d4] pointer-events-none animate-scan-line z-10"
              />

              {[
                1,1,1,1,1,
                1,0,0,0,1,
                1,0,1,0,1,
                1,0,0,0,1,
                1,1,1,1,1,
              ].map((on, i) => (
                <div
                  key={i}
                  className="rounded-[2px] transition-all duration-300"
                  style={{
                    background: on ? "#06b6d4" : "transparent",
                    opacity: on ? 0.9 : 0,
                    boxShadow: on ? "0 0 4px rgba(6,182,212,0.5)" : "none",
                    animation: on ? `qrPixelPulse ${1.6 + (i % 5) * 0.3}s ease-in-out infinite ${(i % 4) * 0.2}s` : "none",
                  }}
                />
              ))}
            </div>
            <button
              onClick={() => setShowJoinQrModal(true)}
              className="text-[10px] font-black px-3 py-0.5 rounded-full transition-transform hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-1"
              style={{ background: "rgba(6,182,212,0.12)", color: "#06b6d4", border: "1px solid rgba(6,182,212,0.3)" }}
            >
              <QrCode size={10} /> Tap to View QR
            </button>
          </div>

          {/* Text content */}
          <div className="relative z-10 text-center sm:text-left">
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#06b6d4" }}>
              Instant Join
            </span>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight mt-1 mb-3" style={{ color: "var(--text-heading)" }}>
              Players join from their phone<br className="hidden sm:block" /> in seconds
            </h2>
            <p className="text-sm mb-5 max-w-sm" style={{ color: "var(--text-muted)" }}>
              Share a session code or display the QR code at your court for instant check-in with zero app download.
            </p>
            <div className="flex flex-wrap gap-2 justify-center sm:justify-start mb-6">
              {["No app download", "No account needed", "Instant sync"].map((t) => (
                <span
                  key={t}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full"
                  style={{ background: "rgba(6,182,212,0.1)", color: "#06b6d4", border: "1px solid rgba(6,182,212,0.25)" }}
                >
                  <CheckCircle2 size={11} /> {t}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
              <button
                onClick={() => setShowJoinQrModal(true)}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-md"
                style={{
                  background: "var(--gradient-cta)",
                  color: "#ffffff",
                  boxShadow: "0 4px 20px rgba(6,182,212,0.3)",
                }}
              >
                <QrCode size={16} /> Scan QR Code
              </button>
              <Link
                href="/session/join"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold transition-all hover:scale-105 active:scale-95"
                style={{
                  background: "var(--bg-card)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border)",
                }}
              >
                <Link2 size={16} style={{ color: "var(--text-muted)" }} /> Join with a Code
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Comparison Section ── */}
      <section className="relative z-10 py-16 px-6 w-full max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold mb-3"
            style={{ background: "rgba(124,58,237,0.12)", color: "#a78bfa", border: "1px solid rgba(124,58,237,0.25)" }}>
            <Sparkles size={13} />
            <span>Why Switch</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight" style={{ color: "var(--text-heading)" }}>
            Why QueuePro <span className="gradient-text">beats the whiteboard</span>
          </h2>
          <p className="text-sm mt-2 max-w-md mx-auto" style={{ color: "var(--text-muted)" }}>
            Say goodbye to chaotic court rotations, lost scores, and mismatched games.
          </p>
        </div>

        <div
          className="rounded-3xl overflow-hidden"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.06)",
          }}
        >
          {/* Table Header */}
          <div
            className="grid grid-cols-2 p-4 sm:p-5 text-xs sm:text-sm font-black"
            style={{ borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-card-alt)" }}
          >
            <div className="flex items-center gap-2 text-rose-400 pl-2">
              <XCircle size={16} />
              <span>Traditional Clipboards & Spreadsheets</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-400 pl-2">
              <CheckCircle2 size={16} />
              <span>The QueuePro Experience</span>
            </div>
          </div>

          {/* Comparison Rows */}
          <div>
            {[
              {
                old: "Shouting names across courts and guessing who has waited the longest",
                qp: "Automated queue order with live next-up alerts on player phones",
              },
              {
                old: "Beginners stuck playing against advanced players in unbalanced blowouts",
                qp: "Smart skill-tier sorting ensures balanced, competitive matchups every round",
              },
              {
                old: "Forgotten scores, lost paper sheets, and no historical tournament ranking",
                qp: "Live leaderboard calculation updating instant win/loss & pair standings",
              },
              {
                old: "Arguments over who sits out next when courts free up",
                qp: "Fair rotational court filling that fills open courts the second a match ends",
              },
              {
                old: "Requiring app downloads, passwords, or clumsy sign-ups just to join",
                qp: "Zero barrier to entry — 1-click room code or instant QR camera scan",
              },
            ].map((row, i, arr) => (
              <div
                key={i}
                className="grid grid-cols-2 p-4 sm:p-5 text-xs sm:text-sm transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                style={{
                  borderBottom: i < arr.length - 1 ? "1px solid var(--border-subtle)" : "none",
                }}
              >
                <div className="pr-3 flex items-start gap-2.5 text-left" style={{ color: "var(--text-muted)" }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500/60 mt-1.5 flex-shrink-0" />
                  <span className="leading-relaxed">{row.old}</span>
                </div>
                <div className="pl-3 flex items-start gap-2.5 text-left font-medium" style={{ color: "var(--text-primary)" }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
                  <span className="leading-relaxed">{row.qp}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Mobile PWA Add to Home Screen Section (#6) ── */}
      <section className="relative z-10 py-12 px-6 w-full max-w-5xl mx-auto">
        <div
          className="rounded-3xl p-7 sm:p-9 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6"
          style={{
            background: "linear-gradient(135deg, var(--bg-card) 0%, rgba(124,58,237,0.08) 100%)",
            border: "1px solid rgba(124,58,237,0.25)",
            boxShadow: "0 8px 32px rgba(124,58,237,0.06)",
          }}
        >
          <div className="flex items-center gap-4 text-center md:text-left flex-col md:flex-row">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg relative overflow-hidden"
              style={{ background: "var(--gradient-cta)" }}
            >
              <Smartphone size={28} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 justify-center md:justify-start mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/30">
                  Instant Mobile App
                </span>
                <span className="text-xs" style={{ color: "var(--text-faint)" }}>· Progressive Web App</span>
              </div>
              <h3 className="text-lg sm:text-xl font-black tracking-tight" style={{ color: "var(--text-heading)" }}>
                Add QueuePro to your Home Screen
              </h3>
              <p className="text-xs sm:text-sm mt-1 max-w-md leading-relaxed" style={{ color: "var(--text-muted)" }}>
                Enjoy full-screen view with zero address bar clutter and instant 1-tap court check-in on iOS and Android.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 flex-shrink-0 w-full md:w-auto">
            <div
              className="px-4 py-3 rounded-2xl text-xs flex flex-col gap-1.5 w-full sm:w-auto"
              style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-2 font-semibold" style={{ color: "var(--text-primary)" }}>
                <Smartphone size={13} className="text-violet-400 flex-shrink-0" />
                <span>iOS Safari:</span>
                <span className="font-normal text-[11px]" style={{ color: "var(--text-muted)" }}>Share &rarr; Add to Home Screen</span>
              </div>
              <div className="flex items-center gap-2 font-semibold" style={{ color: "var(--text-primary)" }}>
                <Download size={13} className="text-cyan-400 flex-shrink-0" />
                <span>Chrome / Android:</span>
                <span className="font-normal text-[11px]" style={{ color: "var(--text-muted)" }}>Menu &rarr; Install App</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Floating Quick Nudge for Mobile Screens */}
      {showPwaBanner && (
        <div className="fixed bottom-5 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-50 animate-slide-up">
          <div
            className="p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-3 backdrop-blur-xl"
            style={{
              background: "var(--bg-card)",
              border: "1px solid rgba(124,58,237,0.35)",
              boxShadow: "0 10px 40px rgba(0,0,0,0.35), 0 0 20px rgba(124,58,237,0.15)",
            }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md relative overflow-hidden"
                style={{ background: "var(--gradient-cta)" }}
              >
                <Image
                  src="/icon.jpg"
                  alt="QueuePro"
                  width={40}
                  height={40}
                  className="rounded-xl object-cover"
                />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold truncate" style={{ color: "var(--text-heading)" }}>
                  QueuePro on Mobile
                </p>
                <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
                  Add to home screen for 1-tap play
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={dismissPwaBanner}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-opacity hover:opacity-70 cursor-pointer"
                style={{ color: "var(--text-faint)" }}
                aria-label="Close"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      <footer
        className="relative z-10 text-center py-6 text-xs font-medium"
        style={{ color: "var(--text-faint)", borderTop: "1px solid var(--border-subtle)" }}
      >
        © {new Date().getFullYear()} QueuePro · Built for competitive pickleball communities
      </footer>

      {/* ── Instant Mobile Browser Modal ── */}
      {showMobileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
          <div
            className="w-full max-w-md rounded-3xl p-6 sm:p-7 relative overflow-hidden shadow-2xl animate-scale-in"
            style={{
              background: "var(--bg-card)",
              border: "1px solid rgba(124,58,237,0.3)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 30px rgba(124,58,237,0.15)",
            }}
          >
            {/* Close Button */}
            <button
              onClick={() => setShowMobileModal(false)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full flex items-center justify-center transition-all hover:opacity-70 cursor-pointer"
              style={{ background: "var(--bg-subtle)", color: "var(--text-muted)" }}
              aria-label="Close modal"
            >
              <X size={16} />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md relative overflow-hidden"
                style={{ background: "var(--gradient-cta)" }}
              >
                <Smartphone size={24} className="text-white" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/30">
                  Zero Download Required
                </span>
                <h3 className="text-lg font-black tracking-tight mt-0.5" style={{ color: "var(--text-heading)" }}>
                  Open QueuePro on Phone
                </h3>
              </div>
            </div>

            <p className="text-xs mb-5 leading-relaxed" style={{ color: "var(--text-muted)" }}>
              Scan this QR code with your phone camera or copy the link to launch QueuePro directly inside your phone browser — no app store download needed!
            </p>

            {/* QR Code Container */}
            <div
              className="p-5 rounded-2xl flex flex-col items-center justify-center mb-5"
              style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}
            >
              <div
                className="p-3 bg-white rounded-2xl shadow-md mb-3 flex items-center justify-center"
                style={{ minHeight: "164px", minWidth: "164px" }}
              >
                {/* Dynamic QR image that opens current URL */}
                <Image
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&margin=0&data=${encodeURIComponent(currentUrl || "https://localhost:3000")}`}
                  alt="Scan QR code to open on mobile"
                  width={150}
                  height={150}
                  unoptimized
                  className="rounded-lg"
                />
              </div>
              <span className="text-[11px] font-bold flex items-center gap-1.5" style={{ color: "#a78bfa" }}>
                <QrCode size={13} /> Scan with any phone camera
              </span>
            </div>

            {/* Copy Link Strip */}
            <div
              className="flex items-center justify-between gap-2 p-2.5 rounded-xl mb-4 text-xs font-semibold"
              style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}
            >
              <span className="truncate pl-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                {currentUrl || "http://localhost:3000"}
              </span>
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer flex-shrink-0"
                style={{
                  background: copied ? "rgba(34,197,94,0.15)" : "var(--gradient-cta)",
                  color: copied ? "#4ade80" : "#ffffff",
                  border: copied ? "1px solid rgba(34,197,94,0.3)" : "none",
                }}
              >
                {copied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                {copied ? "Copied!" : "Copy Link"}
              </button>
            </div>

            {/* Platform Quick Tip */}
            <div className="text-[11px] p-3 rounded-xl text-left flex items-start gap-2" style={{ background: "var(--bg-card-alt)", color: "var(--text-faint)" }}>
              <Lightbulb size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <p><strong style={{ color: "var(--text-muted)" }}>Pro tip:</strong> On iPhone Safari, tap <strong style={{ color: "var(--text-muted)" }}>Share &rarr; Add to Home Screen</strong> for full-screen mode.</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Join Session QR Code Modal ── */}
      {showJoinQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
          <div
            className="w-full max-w-md rounded-3xl p-6 sm:p-7 relative overflow-hidden shadow-2xl animate-scale-in"
            style={{
              background: "var(--bg-card)",
              border: "1px solid rgba(6,182,212,0.35)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 30px rgba(6,182,212,0.15)",
            }}
          >
            {/* Close Button */}
            <button
              onClick={() => setShowJoinQrModal(false)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full flex items-center justify-center transition-all hover:opacity-70 cursor-pointer"
              style={{ background: "var(--bg-subtle)", color: "var(--text-muted)" }}
              aria-label="Close modal"
            >
              <X size={16} />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md relative overflow-hidden"
                style={{ background: "linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)" }}
              >
                <QrCode size={24} className="text-white" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                  Instant Player Check-in
                </span>
                <h3 className="text-lg font-black tracking-tight mt-0.5" style={{ color: "var(--text-heading)" }}>
                  Scan to Join Session
                </h3>
              </div>
            </div>

            <p className="text-xs mb-5 leading-relaxed" style={{ color: "var(--text-muted)" }}>
              Players can scan this QR code with any smartphone camera to open the Join Session page and enter their room code instantly.
            </p>

            {/* QR Code Container */}
            <div
              className="p-5 rounded-2xl flex flex-col items-center justify-center mb-5"
              style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}
            >
              <div
                className="p-3 bg-white rounded-2xl shadow-md mb-3 flex items-center justify-center"
                style={{ minHeight: "164px", minWidth: "164px" }}
              >
                {/* Dynamic QR image that opens /session/join */}
                <Image
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&margin=0&data=${encodeURIComponent(joinUrl || "https://localhost:3000/session/join")}`}
                  alt="Scan QR code to join session"
                  width={150}
                  height={150}
                  unoptimized
                  className="rounded-lg"
                />
              </div>
              <span className="text-[11px] font-bold flex items-center gap-1.5" style={{ color: "#06b6d4" }}>
                <QrCode size={13} /> Scannable from any phone camera
              </span>
            </div>

            {/* Copy Link Strip */}
            <div
              className="flex items-center justify-between gap-2 p-2.5 rounded-xl mb-4 text-xs font-semibold"
              style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}
            >
              <span className="truncate pl-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                {joinUrl || "http://localhost:3000/session/join"}
              </span>
              <button
                onClick={handleCopyJoinLink}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer flex-shrink-0"
                style={{
                  background: copiedJoin ? "rgba(34,197,94,0.15)" : "linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)",
                  color: copiedJoin ? "#4ade80" : "#ffffff",
                  border: copiedJoin ? "1px solid rgba(34,197,94,0.3)" : "none",
                }}
              >
                {copiedJoin ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                {copiedJoin ? "Copied!" : "Copy Link"}
              </button>
            </div>

            <div className="flex justify-end">
              <Link
                href="/session/join"
                className="w-full py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 text-white shadow-md transition-all hover:scale-[1.01]"
                style={{ background: "var(--gradient-cta)" }}
              >
                Go to Join Page Directly &rarr;
              </Link>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
