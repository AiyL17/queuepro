import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Zap, Link2, Target, Trophy, Users } from "lucide-react";

export default function Home() {
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
            className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg"
            style={{ background: "var(--gradient-cta)" }}
          >
            {/* Paddle icon using SVG */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="8" y1="11" x2="14" y2="11" />
              <line x1="11" y1="8" x2="11" y2="14" />
            </svg>
          </div>
          <span className="font-extrabold text-xl tracking-tight" style={{ color: "var(--text-heading)" }}>
            QueuePro
          </span>
          <span
            className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase"
            style={{
              background: "rgba(124,58,237,0.15)",
              color: "#a78bfa",
              border: "1px solid rgba(124,58,237,0.25)",
            }}
          >
            Beta
          </span>
        </div>
        <ThemeToggle />
      </nav>

      {/* ── Hero ── */}
      <section className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">

        {/* Badge */}
        <div className="hero-badge mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
          Pickleball Session Manager
        </div>

        {/* Headline */}
        <h1
          className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.06] mb-6 max-w-3xl"
          style={{ color: "var(--text-heading)" }}
        >
          Run your session
          <br />
          <span className="gradient-text">like a pro.</span>
        </h1>

        <p
          className="text-lg sm:text-xl max-w-lg mx-auto mb-10 leading-relaxed"
          style={{ color: "var(--text-muted)" }}
        >
          Skill-based queuing, live scoreboards, court management, and
          leaderboards — all in one place, instantly.
        </p>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row gap-3 mb-7">
          <Link
            href="/session/new"
            className="btn-primary flex items-center justify-center gap-2.5 px-8 py-4 text-base"
          >
            <Zap size={18} />
            Start New Session
          </Link>
          <Link
            href="/session/join"
            className="btn-secondary flex items-center justify-center gap-2.5 px-8 py-4 text-base"
          >
            <Link2 size={18} />
            Join with Code
          </Link>
        </div>

        {/* Social proof strip */}
        <div className="flex items-center gap-2 text-xs mb-20" style={{ color: "var(--text-faint)" }}>
          <span>Free forever</span>
          <span className="w-1 h-1 rounded-full" style={{ background: "var(--text-faintest)" }} />
          <span>No signup needed</span>
          <span className="w-1 h-1 rounded-full" style={{ background: "var(--text-faintest)" }} />
          <span>Works on any device</span>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-3xl">
          {[
            {
              icon: <Target size={22} strokeWidth={1.75} />,
              iconBg: "rgba(124,58,237,0.15)",
              iconColor: "#a78bfa",
              label: "Skill-based Queuing",
              sub: "Players are matched and queued based on their skill level for fair, balanced games.",
            },
            {
              icon: <Trophy size={22} strokeWidth={1.75} />,
              iconBg: "rgba(251,191,36,0.12)",
              iconColor: "#fbbf24",
              label: "Live Leaderboard",
              sub: "Real-time scores and rankings update automatically after every match.",
            },
            {
              icon: <Users size={22} strokeWidth={1.75} />,
              iconBg: "rgba(6,182,212,0.12)",
              iconColor: "#06b6d4",
              label: "Smart Pairing",
              sub: "Dynamic partner suggestions so everyone gets the best possible teammate.",
            },
          ].map((f) => (
            <div key={f.label} className="feature-card p-5 text-left">
              <div
                className="icon-circle mb-4"
                style={{ background: f.iconBg, color: f.iconColor }}
              >
                {f.icon}
              </div>
              <div
                className="text-sm font-bold mb-1.5 tracking-tight"
                style={{ color: "var(--text-heading)" }}
              >
                {f.label}
              </div>
              <div className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {f.sub}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer
        className="relative z-10 text-center py-5 text-xs"
        style={{ color: "var(--text-faint)", borderTop: "1px solid var(--border-subtle)" }}
      >
        © {new Date().getFullYear()} QueuePro · Made for pickleball players
      </footer>
    </main>
  );
}
