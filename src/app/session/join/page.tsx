"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ArrowRight, Hash, Loader2 } from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { useToast } from "@/lib/toast";

export default function JoinSessionPage() {
  const router = useRouter();
  const toast  = useToast();
  const [sessionId, setSessionId] = useState("");
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    if (!sessionId.trim()) { toast.error("Please enter a session ID"); return; }
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from("sessions")
        .select("id, status")
        .eq("id", sessionId.trim())
        .single();
      if (fetchError || !data) { toast.error("Session not found. Check the ID and try again."); return; }
      if (data.status === "ended") { toast.error("This session has already ended."); return; }
      router.push(`/session/${data.id}`);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden"
      style={{ background: "var(--gradient-hero)" }}
    >
      {/* Decorative orb */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[400px] pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(124,58,237,0.14) 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />

      <div className="relative z-10 max-w-md w-full">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-8">
          <BackButton fallback="/" />
          <ThemeToggle />
        </div>

        {/* Card */}
        <div
          className="p-8 rounded-3xl relative overflow-hidden"
          style={{
            background: "linear-gradient(145deg, var(--bg-card) 0%, rgba(124,58,237,0.06) 100%)",
            border: "1px solid var(--border)",
            boxShadow: "0 12px 40px rgba(0,0,0,0.12)",
          }}
        >
          {/* Glow blob */}
          <div
            className="absolute -top-12 -right-12 w-32 h-32 rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(124,58,237,0.2) 0%, transparent 70%)" }}
          />

          {/* Heading */}
          <div className="mb-6 relative z-10">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 shadow-md"
              style={{ background: "var(--gradient-cta)" }}
            >
              <Hash size={24} className="text-white" strokeWidth={2.5} />
            </div>
            <h1
              className="text-2xl font-black tracking-tight mb-1.5"
              style={{ color: "var(--text-heading)" }}
            >
              Join Session
            </h1>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Enter the session ID provided by your session coordinator or court manager.
            </p>
          </div>

          {/* Input */}
          <div className="mb-5 relative z-10">
            <label
              className="block text-[10px] font-bold mb-2 tracking-widest uppercase"
              style={{ color: "var(--text-faint)" }}
            >
              Session Code / ID
            </label>
            <div
              className="flex items-center gap-2.5 px-4 py-3.5 rounded-2xl transition-all"
              style={{
                background: "var(--bg-subtle)",
                border: "1px solid var(--border)",
              }}
            >
              <Hash size={16} style={{ color: "var(--text-faint)", flexShrink: 0 }} />
              <input
                type="text"
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                placeholder="e.g. cbf8a77b-4fef..."
                className="w-full text-sm bg-transparent outline-none font-mono font-medium"
                style={{ color: "var(--text-primary)" }}
                autoFocus
              />
            </div>
          </div>

          {/* CTA */}
          <button
            onClick={handleJoin}
            disabled={loading || !sessionId.trim()}
            className="btn-primary w-full py-3.5 text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg hover:scale-[1.01] active:scale-[0.99] relative z-10"
            style={{
              background: "var(--gradient-green)",
              boxShadow: sessionId.trim() ? "0 8px 24px rgba(34,197,94,0.35)" : "none",
              opacity: !sessionId.trim() ? 0.5 : 1,
            }}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                Join Session
                <ArrowRight size={16} />
              </>
            )}
          </button>

          <div className="mt-5 text-center relative z-10">
            <span className="text-xs" style={{ color: "var(--text-faint)" }}>Looking to host? </span>
            <a
              href="/session/new"
              className="text-xs font-bold hover:underline"
              style={{ color: "#a78bfa" }}
            >
              Create session instead →
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
