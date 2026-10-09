"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SKILL_LEVELS, SkillLevel } from "@/lib/types";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BackButton } from "@/components/BackButton";
import { Check, Loader2, ArrowRight } from "lucide-react";

const SKILL_COLORS: Record<SkillLevel, string> = {
  beginner:          "#3b82f6",
  advanced_beginner: "#8b5cf6",
  novice:            "#f59e0b",
  intermediate:      "#f97316",
  advanced:          "#ef4444",
};

const SKILL_DESC: Record<SkillLevel, string> = {
  beginner:          "Just learning the basics",
  advanced_beginner: "Basic rallies & positioning",
  novice:            "Consistent serves & strategy",
  intermediate:      "Dinking & third-shot drops",
  advanced:          "Tournament-level play",
};

export default function CheckinPage() {
  const params    = useParams();
  const sessionId = params.id as string;

  const [name, setName]           = useState("");
  const [skillLevel, setSkillLevel] = useState<SkillLevel>("beginner");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [success, setSuccess]     = useState("");

  const handleCheckin = async () => {
    if (!name.trim()) { setError("Please enter your name"); return; }
    setLoading(true); setError(""); setSuccess("");
    try {
      const supabase = createClient();
      const { data: player, error: pe } = await supabase
        .from("players")
        .insert({ session_id: sessionId, name: name.trim(), skill_level: skillLevel, is_guest: true })
        .select().single();
      if (pe) throw pe;
      const { error: qe } = await supabase
        .from("queue_entries")
        .insert({ session_id: sessionId, player_id: player.id, skill_level: skillLevel, status: "waiting" });
      if (qe) throw qe;
      setSuccess(`${name} joined the ${skillLevel.replace(/_/g, " ")} queue!`);
      setName("");
      setTimeout(() => setSuccess(""), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to check in");
    } finally { setLoading(false); }
  };

  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-4xl mx-auto" style={{ background: "var(--bg-page)" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <BackButton fallback={`/session/${sessionId}`} />
        <ThemeToggle />
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-black tracking-tight mb-1" style={{ color: "var(--text-heading)" }}>
          Player Check-in
        </h1>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Enter a name and select a skill level to join the queue.
        </p>
      </div>

      {/* 2-col on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Left: name + CTA */}
        <div className="flex flex-col gap-4">
          {/* Name input */}
          <div className="feature-card p-5">
            <label className="block text-xs font-semibold mb-3 tracking-widest uppercase"
              style={{ color: "var(--text-faint)" }}>
              Player Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCheckin()}
              placeholder="Enter player name..."
              className="w-full text-base bg-transparent outline-none font-semibold"
              style={{ color: "var(--text-primary)" }}
              autoFocus
            />
          </div>

          {error && (
            <div className="rounded-2xl px-4 py-3 text-sm"
              style={{ background: "var(--error-bg)", color: "var(--error-text)", border: "1px solid var(--error-border)" }}>
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-2xl px-4 py-3 text-sm flex items-center gap-2"
              style={{ background: "var(--success-bg)", color: "var(--success-text)", border: "1px solid var(--success-border)" }}>
              <Check size={14} /> {success}
            </div>
          )}

          <button
            onClick={handleCheckin}
            disabled={loading || !name.trim()}
            className="btn-primary w-full py-4 text-base flex items-center justify-center gap-2"
            style={{ background: "var(--gradient-green)", boxShadow: "var(--glow-green)" }}
          >
            {loading
              ? <><Loader2 size={18} className="animate-spin" /> Joining...</>
              : <><ArrowRight size={18} /> Join Queue</>
            }
          </button>
        </div>

        {/* Right: skill level selector */}
        <div>
          <p className="text-xs font-semibold mb-3 tracking-widest uppercase"
            style={{ color: "var(--text-faint)" }}>
            Skill Level
          </p>
          <div className="space-y-2">
            {SKILL_LEVELS.map((s) => (
              <button
                key={s.value}
                onClick={() => setSkillLevel(s.value)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition-all"
                style={{
                  background: skillLevel === s.value ? SKILL_COLORS[s.value] + "15" : "var(--bg-card)",
                  border: `1px solid ${skillLevel === s.value ? SKILL_COLORS[s.value] + "55" : "var(--border)"}`,
                }}
              >
                <div className="w-3 h-3 rounded-full flex-shrink-0 transition-all"
                  style={{ background: skillLevel === s.value ? SKILL_COLORS[s.value] : "var(--border-hover)" }} />
                <div>
                  <p className="text-sm font-semibold"
                    style={{ color: skillLevel === s.value ? SKILL_COLORS[s.value] : "var(--text-primary)" }}>
                    {s.label}
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-faint)" }}>
                    {SKILL_DESC[s.value]}
                  </p>
                </div>
                {skillLevel === s.value && (
                  <Check size={14} className="ml-auto flex-shrink-0"
                    style={{ color: SKILL_COLORS[s.value] }} />
                )}
              </button>
            ))}
          </div>
        </div>

      </div>
    </main>
  );
}
