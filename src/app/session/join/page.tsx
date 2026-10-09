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

        {/* Heading */}
        <div className="mb-8">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
            style={{background: "var(--gradient-cta)"}}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 12h8M12 8v8" />
            </svg>
          </div>
          <h1
            className="text-3xl font-black tracking-tight mb-2"
            style={{ color: "var(--text-heading)" }}
          >
            Join Session
          </h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Enter the session ID shared by the host.
          </p>
        </div>

        {/* Input card */}
        <div className="feature-card p-5 mb-4">
          <label
            className="block text-xs font-semibold mb-3 tracking-widest uppercase"
            style={{ color: "var(--text-faint)" }}
          >
            Session ID
          </label>
          <div className="input-field flex items-center gap-2">
            <Hash size={15} style={{ color: "var(--text-faint)", flexShrink: 0 }} />
            <input
              type="text"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              placeholder="Paste session ID here..."
              className="w-full text-sm bg-transparent outline-none font-mono"
              style={{ color: "var(--text-primary)" }}
            />
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={handleJoin}
          disabled={loading}
          className="btn-primary w-full py-4 text-base flex items-center justify-center gap-2"
          style={{ background: "var(--gradient-green)", boxShadow: "var(--glow-green)" }}
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Looking up...
            </>
          ) : (
            <>
              Join Session
              <ArrowRight size={18} />
            </>
          )}
        </button>

        <div className="mt-5 text-center">
          <span className="text-sm" style={{color: "var(--text-faint)"}}>or </span>
          <a
            href="/session/new"
            className="text-sm font-semibold hover:underline"
            style={{color: "var(--text-faint)"}}
          >
            Start new session instead →
          </a>
        </div>
      </div>
    </main>
  );
}
