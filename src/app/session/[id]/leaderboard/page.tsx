"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SKILL_LEVELS, SkillLevel, PlayerSessionScore, PairScore } from "@/lib/types";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BackButton } from "@/components/BackButton";

import { Trophy, Medal, Award, Filter } from "lucide-react";

const SKILL_COLORS: Record<SkillLevel, string> = {
  beginner:          "#3b82f6",
  advanced_beginner: "#8b5cf6",
  novice:            "#f59e0b",
  intermediate:      "#f97316",
  advanced:          "#ef4444",
};

function RankBadge({ rank }: { rank: number }) {
  if (rank === 0) return <Trophy size={18} style={{ color: "#eab308" }} />; // Gold
  if (rank === 1) return <Medal size={18} style={{ color: "#94a3b8" }} />;  // Silver
  if (rank === 2) return <Award size={18} style={{ color: "#cd7f32" }} />;  // Bronze
  return <span className="text-sm font-bold" style={{ color: "var(--text-faint)" }}>{rank + 1}</span>;
}

export default function LeaderboardPage() {
  const params    = useParams();
  const sessionId = params.id as string;

  const [scores, setScores]           = useState<PlayerSessionScore[]>([]);
  const [pairs, setPairs]             = useState<PairScore[]>([]);
  const [loading, setLoading]         = useState(true);
  const [activeTab, setActiveTab]     = useState<"individual" | "pairs">("individual");
  const [selectedSkill, setSelectedSkill] = useState<SkillLevel | "all">("all");

  const fetchData = useCallback(async () => {
    const supabase = createClient();
    const [{ data: sd }, { data: pd }] = await Promise.all([
      supabase.from("player_session_scores")
        .select("*, player:players(*)")
        .eq("session_id", sessionId)
        .order("total_score", { ascending: false }),
      supabase.from("pair_scores")
        .select("*, player1:players!pair_scores_player1_id_fkey(*), player2:players!pair_scores_player2_id_fkey(*)")
        .eq("session_id", sessionId)
        .order("total_score", { ascending: false }),
    ]);
    setScores((sd as PlayerSessionScore[]) || []);
    setPairs((pd as PairScore[]) || []);
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    fetchData();
    const supabase = createClient();
    const ch = supabase.channel("lb-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "player_session_scores", filter: `session_id=eq.${sessionId}` }, fetchData)
      .on("postgres_changes", { event: "*", schema: "public", table: "pair_scores",           filter: `session_id=eq.${sessionId}` }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId, fetchData]);

  const getScoresForSkill = (skill: SkillLevel) =>
    scores.filter((s) => s.player?.skill_level === skill)
      .sort((a, b) => b.total_score - a.total_score || b.games_played - a.games_played);

  const getPairsForSkill = (skill: SkillLevel) =>
    pairs.filter((p) => p.player1?.skill_level === skill)
      .sort((a, b) => b.total_score - a.total_score || b.games_played - a.games_played);

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-page)" }}>
      <div className="text-center">
        <div className="w-8 h-8 rounded-full border-2 animate-spin mx-auto mb-3"
          style={{ borderColor: "#7c3aed", borderTopColor: "transparent" }} />
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Loading leaderboard...</p>
      </div>
    </main>
  );

  const activeSkills = SKILL_LEVELS.filter(
    (s) => selectedSkill === "all" || s.value === selectedSkill
  );

  const hasIndividual = activeSkills.some((s) => getScoresForSkill(s.value).length > 0);
  const hasPairs      = activeSkills.some((s) => getPairsForSkill(s.value).length > 0);

  return (
    <main className="min-h-screen max-w-5xl mx-auto" style={{ background: "var(--bg-page)" }}>

      <header
        className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 sm:px-6 py-3"
        style={{background: "var(--bg-page)",
          borderBottom: "1px solid var(--border-subtle)",
          backdropFilter: "blur(12px)",}}
      >
        <div className="flex items-center gap-2 min-w-0">
          <BackButton fallback={`/session/${sessionId}`} />
          <div className="w-px h-4 flex-shrink-0" style={{background: "var(--border)"}} />
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{background: "linear-gradient(135deg, #7c3aed, #9333ea)", color: "#fff"}}>
            <Trophy size={16} className="text-amber-300" />
          </div>
          <div>
            <h1 className="text-sm font-black tracking-tight" style={{color: "var(--text-heading)"}}>Leaderboard</h1>
            <p className="text-xs" style={{color: "var(--text-muted)"}}>Live session rankings</p>
          </div>
        </div>
        <ThemeToggle />
      </header>

      <div className="px-4 sm:px-6 pt-4 pb-6 animate-slide-up">

      {/* Skill Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-6 no-scrollbar">
        <button
          onClick={() => setSelectedSkill("all")}
          className="px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex-shrink-0 flex items-center gap-1.5"
          style={{
            background: selectedSkill === "all" ? "var(--text-heading)" : "var(--bg-card)",
            color: selectedSkill === "all" ? "var(--bg-page)" : "var(--text-muted)",
            border: `1px solid ${selectedSkill === "all" ? "transparent" : "var(--border)"}`,
          }}
        >
          <Filter size={12} />
          All Skills
        </button>
        {SKILL_LEVELS.map((s) => {
          const isSelected = selectedSkill === s.value;
          const color = SKILL_COLORS[s.value];
          return (
            <button
              key={s.value}
              onClick={() => setSelectedSkill(s.value)}
              className="px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer flex-shrink-0 flex items-center gap-1.5"
              style={{
                background: isSelected ? color : "var(--bg-card)",
                color: isSelected ? "#ffffff" : "var(--text-muted)",
                border: `1px solid ${isSelected ? color : "var(--border)"}`,
                boxShadow: isSelected ? `0 2px 10px ${color}40` : "none",
              }}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: isSelected ? "#ffffff" : color }} />
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Mobile tab switcher — hidden on lg+ */}
      <div className="flex gap-2 mb-6 p-1 rounded-2xl lg:hidden" style={{ background: "var(--tab-bg)" }}>
        {[
          { key: "individual", label: "Individual", color: "#16a34a" },
          { key: "pairs",      label: "Best Pairs",  color: "#7c3aed" },
        ].map((tab) => (
          <button key={tab.key}
            onClick={() => setActiveTab(tab.key as "individual" | "pairs")}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer"
            style={{
              background: activeTab === tab.key ? tab.color : "transparent",
              color: activeTab === tab.key ? "#fff" : "var(--text-muted)",
              boxShadow: activeTab === tab.key ? "0 4px 12px rgba(0,0,0,0.15)" : "none",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 2-col on desktop, single panel on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-slide-up">

        {/* ── Individual ── */}
        <div className={activeTab === "individual" ? "block" : "hidden lg:block"}>
          <h2 className="text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-1.5"
            style={{ color: "var(--text-faint)" }}>
            <Trophy size={13} className="text-amber-400" /> Individual Rankings
          </h2>

          {!hasIndividual ? (
            <div className="rounded-2xl p-12 text-center"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: "rgba(124,58,237,0.1)", color: "#a78bfa" }}>
                <Trophy size={24} />
              </div>
              <p className="font-bold mb-1" style={{ color: "var(--text-heading)" }}>No scores found</p>
              <p className="text-sm" style={{ color: "var(--text-faint)" }}>
                {selectedSkill === "all" ? "Play matches & enter scores to populate the leaderboard" : `No players with scores found for ${SKILL_LEVELS.find(s=>s.value===selectedSkill)?.label}`}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeSkills.map((s) => {
                const skillScores = getScoresForSkill(s.value);
                if (!skillScores.length) return null;
                const color = SKILL_COLORS[s.value];
                return (
                  <div key={s.value} className="rounded-2xl overflow-hidden shadow-sm transition-all hover:shadow-md"
                    style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                    <div className="flex items-center gap-2 px-5 py-3"
                      style={{ background: color + "0d", borderBottom: `1px solid ${color}25` }}>
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                      <span className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>{s.label}</span>
                      <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: color + "20", color }}>
                        {skillScores.length} player{skillScores.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="divide-y divide-[var(--separator)]">
                      {skillScores.map((entry, idx) => (
                        <div key={entry.player_id}
                          className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[var(--bg-card-hover)]"
                          style={{
                            background: idx === 0 ? "rgba(234,179,8,0.04)" : undefined,
                          }}
                        >
                          <span className="w-8 flex justify-center flex-shrink-0">
                            <RankBadge rank={idx} />
                          </span>
                          <span className={`flex-1 text-sm font-semibold truncate ${idx === 0 ? "text-amber-400" : ""}`}
                            style={{ color: idx === 0 ? undefined : "var(--text-primary)" }}>
                            {entry.player?.name}
                          </span>
                          <span className="text-xs font-mono mr-3" style={{ color: "var(--text-muted)" }}>
                            {entry.games_played}g
                          </span>
                          <span className="text-base font-black font-mono"
                            style={{ color: idx === 0 ? "#eab308" : "var(--score-normal)" }}>
                            {entry.total_score}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Best Pairs ── */}
        <div className={activeTab === "pairs" ? "block" : "hidden lg:block"}>
          <h2 className="text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-1.5"
            style={{ color: "var(--text-faint)" }}>
            <Award size={13} className="text-purple-400" /> Best Pairs
          </h2>

          {!hasPairs ? (
            <div className="rounded-2xl p-12 text-center"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: "rgba(124,58,237,0.1)", color: "#a78bfa" }}>
                <Award size={24} />
              </div>
              <p className="font-bold mb-1" style={{ color: "var(--text-heading)" }}>No pair data found</p>
              <p className="text-sm" style={{ color: "var(--text-faint)" }}>
                {selectedSkill === "all" ? "Tracked automatically as doubles matches are completed" : `No pair data found for ${SKILL_LEVELS.find(s=>s.value===selectedSkill)?.label}`}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeSkills.map((s) => {
                const skillPairs = getPairsForSkill(s.value);
                if (!skillPairs.length) return null;
                const color = SKILL_COLORS[s.value];
                return (
                  <div key={s.value} className="rounded-2xl overflow-hidden shadow-sm transition-all hover:shadow-md"
                    style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                    <div className="flex items-center gap-2 px-5 py-3"
                      style={{ background: color + "0d", borderBottom: `1px solid ${color}20` }}>
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                      <span className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>{s.label}</span>
                    </div>
                    <div className="divide-y divide-[var(--separator)]">
                      {skillPairs.map((pair, idx) => (
                        <div key={`${pair.player1_id}-${pair.player2_id}`}
                          className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[var(--bg-card-hover)]"
                          style={{
                            background: idx === 0 ? "rgba(192,132,252,0.06)" : undefined,
                          }}
                        >
                          <span className="w-8 flex justify-center flex-shrink-0">
                            <RankBadge rank={idx} />
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate" style={{ color: idx === 0 ? "var(--pair-top)" : "var(--text-primary)" }}>
                              {pair.player1?.name} &amp; {pair.player2?.name}
                            </p>
                            <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                              {pair.games_played} game{pair.games_played !== 1 ? "s" : ""} together
                            </p>
                          </div>
                          <span className="text-base font-black font-mono"
                            style={{ color: idx === 0 ? "var(--pair-top)" : "var(--pair-normal)" }}>
                            {pair.total_score}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>{/* end grid */}

      </div>{/* end px-4 sm:px-6 pt-4 pb-6 animate-slide-up wrapper */}

    </main>
  );
}
