"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SKILL_LEVELS, SkillLevel } from "@/lib/types";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BackButton } from "@/components/BackButton";
import { Check, Loader2, ArrowRight, User } from "lucide-react";
import { useToast } from "@/lib/toast";

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

  const [name, setName]             = useState("");
  const [skillLevel, setSkillLevel] = useState<SkillLevel>("beginner");
  const [loading, setLoading]       = useState(false);
  const toast = useToast();

  const handleCheckin = async () => {
    if (!name.trim()) { toast.error("Please enter your name"); return; }
    setLoading(true);
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
      toast.success(`${name} joined the ${skillLevel.replace(/_/g, " ")} queue!`);
      setName("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to check in");
    } finally { setLoading(false); }
  };

  return (
    <main className="min-h-screen max-w-4xl mx-auto" style={{ background: "var(--bg-page)" }}>
      <header
        className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 sm:px-6 py-3"
        style={{background: "var(--bg-page)",
          borderBottom: "1px solid var(--border-subtle)",
          backdropFilter: "blur(12px)",}}
      >
        <div className="flex items-center gap-2 min-w-0">
          <BackButton fallback={`/session/${sessionId}`} />
          <div className="w-px h-4 flex-shrink-0" style={{background: "var(--border)"}} />
          <div>
            <h1 className="text-sm font-black tracking-tight" style={{color: "var(--text-heading)"}}>Player Check-in</h1>
            <p className="text-xs" style={{color: "var(--text-muted)"}}>Join the queue</p>
          </div>
        </div>
        <ThemeToggle />
      </header>

      <div className="px-4 sm:px-6 pt-5 pb-6">
      {/* 2-col on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Left: name + CTA */}
        <div className="flex flex-col gap-4 mt-2">
          {/* Name input */}
          <div className="feature-card p-5">
            <label className="block text-xs font-semibold mb-3 tracking-widest uppercase"
              style={{ color: "var(--text-faint)" }}>
              Player Name
            </label>
            <div className="input-field flex items-center gap-2">
              <User size={15} style={{color: "var(--text-faint)", flexShrink: 0}} />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCheckin()}
                placeholder="Enter player name..."
                className="w-full text-base bg-transparent outline-none font-semibold"
                style={{color: "var(--text-primary)"}}
                autoFocus
              />
            </div>
          </div>

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
      </div>
    </main>
  );
}
