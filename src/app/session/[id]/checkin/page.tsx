"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SKILL_LEVELS, SkillLevel } from "@/lib/types";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BackButton } from "@/components/BackButton";
import { Check, Loader2, ArrowRight, User } from "lucide-react";
import { useToast } from "@/lib/toast";
import { tryFillCourts } from "@/lib/queue-helpers";

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

      // After check-in, immediately try to fill any available courts
      const { data: sd } = await supabase
        .from("sessions")
        .select("game_mode")
        .eq("id", sessionId)
        .single();
      const gameMode = (sd?.game_mode ?? "doubles") as "singles" | "doubles";
      await tryFillCourts(sessionId, gameMode);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to check in");
    } finally { setLoading(false); }
  };

  return (
    <main className="min-h-screen max-w-4xl mx-auto" style={{ background: "var(--bg-page)" }}>
      <header
        className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 sm:px-6 py-3"
        style={{
          background: "var(--bg-page)",
          borderBottom: "1px solid var(--border-subtle)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <BackButton fallback={`/session/${sessionId}`} />
          <div className="w-px h-4 flex-shrink-0" style={{ background: "var(--border)" }} />
          <div>
            <h1 className="text-sm font-black tracking-tight" style={{ color: "var(--text-heading)" }}>Player Check-in</h1>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>Join the session queue</p>
          </div>
        </div>
        <ThemeToggle />
      </header>

      <div className="px-4 sm:px-6 pt-6 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Left: Name input + Avatar preview + CTA */}
          <div className="flex flex-col gap-4">
            <div
              className="p-6 rounded-3xl relative overflow-hidden"
              style={{
                background: "linear-gradient(145deg, var(--bg-card) 0%, rgba(124,58,237,0.06) 100%)",
                border: "1px solid var(--border)",
                boxShadow: "0 8px 30px rgba(0,0,0,0.06)",
              }}
            >
              {/* Radial glow */}
              <div
                className="absolute -top-10 -right-10 w-28 h-28 rounded-full pointer-events-none"
                style={{ background: `radial-gradient(circle, ${SKILL_COLORS[skillLevel]}20 0%, transparent 70%)` }}
              />

              {/* Live avatar preview */}
              <div className="flex items-center gap-3.5 mb-5 relative z-10">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-black transition-all duration-300 shadow-sm"
                  style={{
                    background: SKILL_COLORS[skillLevel] + "25",
                    color: SKILL_COLORS[skillLevel],
                    border: `1.5px solid ${SKILL_COLORS[skillLevel]}50`,
                  }}
                >
                  {name.trim() ? name.trim().slice(0, 2).toUpperCase() : <User size={20} />}
                </div>
                <div>
                  <p className="text-sm font-bold leading-tight" style={{ color: "var(--text-heading)" }}>
                    {name.trim() || "Player Name"}
                  </p>
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-bold capitalize mt-0.5"
                    style={{ color: SKILL_COLORS[skillLevel] }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: SKILL_COLORS[skillLevel] }} />
                    {skillLevel.replace(/_/g, " ")} Rating
                  </span>
                </div>
              </div>

              {/* Input field */}
              <div className="relative z-10">
                <label className="block text-[10px] font-bold mb-2 tracking-widest uppercase"
                  style={{ color: "var(--text-faint)" }}>
                  Your Full Name or Nickname
                </label>
                <div
                  className="flex items-center gap-2.5 px-4 py-3.5 rounded-2xl mb-4 transition-all"
                  style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}
                >
                  <User size={16} style={{ color: "var(--text-faint)", flexShrink: 0 }} />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCheckin()}
                    placeholder="e.g. Alex Johnson"
                    className="w-full text-sm bg-transparent outline-none font-bold"
                    style={{ color: "var(--text-primary)" }}
                    autoFocus
                  />
                </div>
              </div>

              <button
                onClick={handleCheckin}
                disabled={loading || !name.trim()}
                className="btn-primary w-full py-4 text-sm font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:scale-[1.01] active:scale-[0.99] transition-all relative z-10"
                style={{
                  background: "var(--gradient-green)",
                  boxShadow: name.trim() ? "0 8px 24px rgba(34,197,94,0.35)" : "none",
                  opacity: !name.trim() ? 0.4 : 1,
                }}
              >
                {loading ? (
                  <><Loader2 size={17} className="animate-spin" /> Adding to queue...</>
                ) : (
                  <><ArrowRight size={17} /> Check In to Play</>
                )}
              </button>
            </div>
          </div>

          {/* Right: Skill level options */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>
                Select Skill Level
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "var(--bg-card)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                5 Levels
              </span>
            </div>

            <div className="space-y-2.5">
              {SKILL_LEVELS.map((s) => {
                const color = SKILL_COLORS[s.value];
                const isSelected = skillLevel === s.value;
                return (
                  <button
                    key={s.value}
                    onClick={() => setSkillLevel(s.value)}
                    className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-left transition-all duration-200 cursor-pointer group"
                    style={{
                      background: isSelected
                        ? `linear-gradient(135deg, var(--bg-card) 0%, ${color}12 100%)`
                        : "var(--bg-card)",
                      border: `1.5px solid ${isSelected ? color + "60" : "var(--border)"}`,
                      boxShadow: isSelected ? `0 4px 20px ${color}18` : "none",
                      transform: isSelected ? "scale(1.01)" : "scale(1)",
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105"
                      style={{ background: color + "20", color }}
                    >
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-bold leading-tight"
                        style={{ color: isSelected ? color : "var(--text-heading)" }}
                      >
                        {s.label}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {SKILL_DESC[s.value]}
                      </p>
                    </div>
                    {isSelected && (
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: color + "20", color }}
                      >
                        <Check size={12} strokeWidth={3} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}
