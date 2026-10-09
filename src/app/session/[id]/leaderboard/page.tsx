"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SKILL_LEVELS, SkillLevel, PlayerSessionScore, PairScore, Match } from "@/lib/types";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BackButton } from "@/components/BackButton";
import dynamic from "next/dynamic";
import { useScrollPosition } from "@/hooks/useScroll";
import { SkeletonLeaderboardRow } from "@/components/Skeleton";

const DownloadButton = dynamic(() => import("@/components/DownloadButton").then(mod => mod.DownloadButton), { ssr: false });

import { Trophy, Medal, Award, Filter, Flame, TrendingUp, TrendingDown, ClipboardList } from "lucide-react";

const SKILL_COLORS: Record<SkillLevel, string> = {
  beginner:          "#3b82f6",
  advanced_beginner: "#8b5cf6",
  novice:            "#f59e0b",
  intermediate:      "#f97316",
  advanced:          "#ef4444",
};

function RankBadge({ rank }: { rank: number }) {
  if (rank === 0) return (
    <span className="animate-trophy-luminous flex items-center justify-center">
      <Trophy size={18} style={{ color: "#eab308" }} />
    </span>
  );
  if (rank === 1) return <Medal size={18} className="drop-shadow-sm" style={{ color: "#94a3b8" }} />;  // Silver
  if (rank === 2) return <Award size={18} className="drop-shadow-sm" style={{ color: "#cd7f32" }} />;  // Bronze
  return <span className="text-sm font-bold" style={{ color: "var(--text-faint)" }}>{rank + 1}</span>;
}

export default function LeaderboardPage() {
  const params    = useParams();
  const sessionId = params.id as string;

  const [scores, setScores]           = useState<PlayerSessionScore[]>([]);
  const [pairs, setPairs]             = useState<PairScore[]>([]);
  const [matches, setMatches]         = useState<Match[]>([]);
  const [loading, setLoading]         = useState(true);
  const [activeTab, setActiveTab]     = useState<"individual" | "pairs">("individual");
  const [selectedSkill, setSelectedSkill] = useState<SkillLevel | "all">("all");
  const scrollY = useScrollPosition();

  const fetchData = useCallback(async () => {
    const supabase = createClient();
    const [{ data: sd }, { data: pd }, { data: md }] = await Promise.all([
      supabase.from("player_session_scores")
        .select("*, player:players(*)")
        .eq("session_id", sessionId)
        .order("total_score", { ascending: false }),
      supabase.from("pair_scores")
        .select("*, player1:players!pair_scores_player1_id_fkey(*), player2:players!pair_scores_player2_id_fkey(*)")
        .eq("session_id", sessionId)
        .order("total_score", { ascending: false }),
      supabase.from("matches")
        .select("*")
        .eq("session_id", sessionId)
        .order("played_at", { ascending: false }),
    ]);
    setScores((sd as PlayerSessionScore[]) || []);
    setPairs((pd as PairScore[]) || []);
    setMatches((md as Match[]) || []);
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    fetchData();
    const supabase = createClient();
    const ch = supabase.channel("lb-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "player_session_scores", filter: `session_id=eq.${sessionId}` }, fetchData)
      .on("postgres_changes", { event: "*", schema: "public", table: "pair_scores",           filter: `session_id=eq.${sessionId}` }, fetchData)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches",               filter: `session_id=eq.${sessionId}` }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId, fetchData]);

  const getScoresForSkill = (skill: SkillLevel) =>
    scores.filter((s) => s.player?.skill_level === skill)
      .sort((a, b) => b.total_score - a.total_score || b.games_played - a.games_played);

  const getPairsForSkill = (skill: SkillLevel) =>
    pairs.filter((p) => p.player1?.skill_level === skill)
      .sort((a, b) => b.total_score - a.total_score || b.games_played - a.games_played);

  const getPlayerStreak = (playerId: string) => {
    let streak = 0;
    let wonLast = null;
    for (const match of matches) {
      const isTeam1 = match.team1_player_ids.includes(playerId);
      const isTeam2 = match.team2_player_ids.includes(playerId);
      if (!isTeam1 && !isTeam2) continue;
      
      const myScore = isTeam1 ? match.team1_score : match.team2_score;
      const theirScore = isTeam1 ? match.team2_score : match.team1_score;
      
      if (wonLast === null) wonLast = myScore > theirScore;

      if (myScore > theirScore) streak++;
      else break;
    }
    return { streak, wonLast };
  };

  const getPairStreak = (p1: string, p2: string) => {
    let streak = 0;
    for (const match of matches) {
      const onTeam1 = match.team1_player_ids.includes(p1) && match.team1_player_ids.includes(p2);
      const onTeam2 = match.team2_player_ids.includes(p1) && match.team2_player_ids.includes(p2);
      if (!onTeam1 && !onTeam2) continue;

      const myScore = onTeam1 ? match.team1_score : match.team2_score;
      const theirScore = onTeam1 ? match.team2_score : match.team1_score;
      
      if (myScore > theirScore) streak++;
      else break;
    }
    return streak;
  };

  if (loading) return (
    <main className="min-h-screen max-w-5xl mx-auto px-4 sm:px-6 pt-5" style={{ background: "var(--bg-page)" }}>
      <div className="rounded-2xl overflow-hidden mb-6" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <div className="p-4 border-b border-[var(--separator)]">
          <div className="h-4 w-32 animate-pulse rounded" style={{ background: "var(--bg-subtle)" }} />
        </div>
        <SkeletonLeaderboardRow />
        <SkeletonLeaderboardRow />
        <SkeletonLeaderboardRow />
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
        className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 sm:px-6 py-3 transition-all duration-300"
        style={{
          background: scrollY > 10 ? "var(--bg-page)" : "transparent",
          borderBottom: scrollY > 10 ? "1px solid var(--border-subtle)" : "1px solid transparent",
          backdropFilter: scrollY > 10 ? "blur(12px)" : "none",
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <BackButton fallback={`/session/${sessionId}`} />
          <div className="w-px h-4 flex-shrink-0 hidden sm:block" style={{ background: "var(--border)" }} />
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 hidden sm:flex"
            style={{ background: "linear-gradient(135deg, #7c3aed, #9333ea)", color: "#fff" }}>
            <Trophy size={16} className="text-amber-300" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-black tracking-tight truncate leading-tight" style={{ color: "var(--text-heading)" }}>
              Leaderboard
            </h1>
            <p className="text-[10px] truncate hidden sm:block" style={{ color: "var(--text-muted)" }}>
              Live rankings
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <DownloadButton scores={scores} pairs={pairs} sessionId={sessionId} />
          <ThemeToggle />
        </div>
      </header>

      <div className="px-4 sm:px-6 pt-4 pb-6 animate-slide-up">

      {/* Skill Filter Pills */}
      <div
        className="flex items-center gap-2 overflow-x-auto pb-1 mb-5 no-scrollbar"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}
      >
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

      {/* Mobile tab switcher header labels — shown above the per-category rows on desktop */}
      <div className="hidden lg:grid lg:grid-cols-2 gap-6 mb-2 animate-slide-up">
        <h2 className="text-xs font-bold uppercase tracking-widest flex items-center gap-1.5"
          style={{ color: "var(--text-faint)" }}>
          <Trophy size={13} className="text-amber-400" /> Individual Rankings
        </h2>
        <h2 className="text-xs font-bold uppercase tracking-widest flex items-center gap-1.5"
          style={{ color: "var(--text-faint)" }}>
          <Award size={13} className="text-purple-400" /> Best Pairs
        </h2>
      </div>

      {/* Per-category rows: each skill level gets its own row with Individual + Pairs side by side */}
      <div className="space-y-6 animate-slide-up">

        {/* Empty state — shown only when truly nothing exists */}
        {!hasIndividual && !hasPairs && (
          <div className="rounded-3xl p-12 flex flex-col items-center text-center gap-4 transition-all"
            style={{ background: "var(--bg-card)", border: "1px dashed var(--border-hover)" }}>
            <div className="relative w-20 h-20 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ background: "#7c3aed" }} />
              <div className="relative z-10 w-16 h-16 rounded-3xl flex items-center justify-center shadow-lg transform -rotate-6"
                style={{ background: "linear-gradient(135deg, #7c3aed, #9333ea)", color: "#fff" }}>
                <Trophy size={32} />
              </div>
              <div className="absolute -bottom-2 -right-2 z-20 w-8 h-8 rounded-full flex items-center justify-center shadow-md border-2"
                style={{ background: "var(--bg-card)", borderColor: "var(--bg-card)" }}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(124,58,237,0.15)", color: "#a78bfa" }}>
                  <Award size={14} />
                </div>
              </div>
            </div>
            <div>
              <p className="text-lg font-black tracking-tight mb-2" style={{ color: "var(--text-heading)" }}>No rankings yet</p>
              <p className="text-sm max-w-xs mx-auto leading-relaxed" style={{ color: "var(--text-faint)" }}>
                {selectedSkill === "all"
                  ? "Play matches and enter scores to start climbing the leaderboard!"
                  : `No matches have been played for the ${SKILL_LEVELS.find(s => s.value === selectedSkill)?.label} skill level.`}
              </p>
            </div>
          </div>
        )}

        {activeSkills.map((s) => {
          const skillScores = getScoresForSkill(s.value);
          const skillPairs  = getPairsForSkill(s.value);
          if (!skillScores.length && !skillPairs.length) return null;

          const color = SKILL_COLORS[s.value];

          return (
            <div key={s.value}>
              {/* Category divider — visible separator between skill groups */}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
                <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{s.label}</span>
                <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
              </div>

              {/* Mobile: tab-based single column */}
              <div className="lg:hidden">
                {/* Mobile: Individual */}
                {activeTab === "individual" && (
                  skillScores.length > 0 ? (
                    <div className="rounded-2xl overflow-hidden shadow-sm"
                      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                      <div className="divide-y divide-[var(--separator)]">
                        {skillScores.map((entry, idx) => {
                          const { streak, wonLast } = getPlayerStreak(entry.player_id);
                          const isChamp = idx === 0;
                          const hasStreak = streak >= 2;
                          return (
                            <div
                              key={`${selectedSkill}-${entry.player_id}`}
                              className={`flex items-center gap-3 px-5 py-3 transition-all duration-200 hover:translate-x-0.5 animate-cascade-row ${
                                isChamp
                                  ? "champion-gold-card"
                                  : hasStreak
                                  ? "row-streak-highlight hover:bg-[var(--bg-card-hover)]"
                                  : "hover:bg-[var(--bg-card-hover)]"
                              }`}
                              style={{ animationDelay: `${idx * 45}ms` }}
                            >
                              <span className="w-8 flex justify-center flex-shrink-0"><RankBadge rank={idx} /></span>
                              <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                                <span className={`text-sm font-semibold truncate ${isChamp ? "text-amber-400 font-bold" : ""}`}
                                  style={{ color: isChamp ? undefined : "var(--text-primary)" }}>
                                  {entry.player?.name}
                                </span>
                                {hasStreak && (
                                  <span
                                    className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full flex-shrink-0 shadow-sm"
                                    style={{
                                      background: "linear-gradient(135deg, #ef4444 0%, #f97316 100%)",
                                      color: "#ffffff",
                                      boxShadow: "0 2px 6px rgba(239, 68, 68, 0.35)",
                                    }}
                                    title={`${streak} consecutive match wins!`}
                                  >
                                    <Flame size={10} className="fill-white text-white animate-flame-soft" />
                                    <span className="tracking-wide uppercase text-[9px]">{streak} streak</span>
                                  </span>
                                )}
                              </div>
                              {wonLast !== null && (
                                <span className="flex-shrink-0">
                                  {wonLast ? <TrendingUp size={14} className="text-green-500" /> : <TrendingDown size={14} className="text-red-500" />}
                                </span>
                              )}
                              <span className="text-xs font-mono mx-2" style={{ color: "var(--text-muted)" }}>{entry.games_played}g</span>
                              <span className="text-base font-black font-mono"
                                style={{ color: isChamp ? "#eab308" : "var(--score-normal)" }}>{entry.total_score}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-center py-4" style={{ color: "var(--text-faint)" }}>No individual scores yet</p>
                  )
                )}

                {/* Mobile: Pairs */}
                {activeTab === "pairs" && (
                  skillPairs.length > 0 ? (
                    <div className="rounded-2xl overflow-hidden shadow-sm"
                      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                      <div className="divide-y divide-[var(--separator)]">
                        {skillPairs.map((pair, idx) => {
                          const streak = getPairStreak(pair.player1_id, pair.player2_id);
                          const isChamp = idx === 0;
                          const hasStreak = streak >= 2;
                          return (
                            <div
                              key={`${selectedSkill}-${pair.player1_id}-${pair.player2_id}`}
                              className={`flex items-center gap-3 px-5 py-3 transition-all duration-200 hover:translate-x-0.5 animate-cascade-row ${
                                isChamp
                                  ? "champion-pair-card"
                                  : hasStreak
                                  ? "row-streak-highlight hover:bg-[var(--bg-card-hover)]"
                                  : "hover:bg-[var(--bg-card-hover)]"
                              }`}
                              style={{ animationDelay: `${idx * 45}ms` }}
                            >
                              <span className="w-8 flex justify-center flex-shrink-0"><RankBadge rank={idx} /></span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold truncate flex items-center gap-1.5 flex-wrap"
                                  style={{ color: isChamp ? "var(--pair-top)" : "var(--text-primary)" }}>
                                  <span>{pair.player1?.name} &amp; {pair.player2?.name}</span>
                                  {hasStreak && (
                                    <span
                                      className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full flex-shrink-0 shadow-sm"
                                      style={{
                                        background: "linear-gradient(135deg, #ef4444 0%, #f97316 100%)",
                                        color: "#ffffff",
                                        boxShadow: "0 2px 6px rgba(239, 68, 68, 0.35)",
                                      }}
                                      title={`${streak} consecutive match wins!`}
                                    >
                                      <Flame size={10} className="fill-white text-white animate-flame-soft" />
                                      <span className="tracking-wide uppercase text-[9px]">{streak} streak</span>
                                    </span>
                                  )}
                                </p>
                                <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                                  {pair.games_played} game{pair.games_played !== 1 ? "s" : ""} together
                                </p>
                              </div>
                              <span className="text-base font-black font-mono"
                                style={{ color: isChamp ? "var(--pair-top)" : "var(--pair-normal)" }}>{pair.total_score}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-center py-4" style={{ color: "var(--text-faint)" }}>No pair data yet</p>
                  )
                )}
              </div>

              {/* Desktop: side-by-side cards in the same row */}
              <div className="hidden lg:grid lg:grid-cols-2 gap-6">

                {/* Individual card */}
                <div className="rounded-2xl overflow-hidden shadow-sm transition-all hover:shadow-md"
                  style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                  {skillScores.length > 0 ? (
                    <>
                      <div className="flex items-center gap-2 px-5 py-2.5"
                        style={{ background: color + "0d", borderBottom: `1px solid ${color}25` }}>
                        <Trophy size={12} style={{ color }} />
                        <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Individual</span>
                        <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: color + "20", color }}>
                          {skillScores.length} player{skillScores.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="divide-y divide-[var(--separator)]">
                        {skillScores.map((entry, idx) => {
                          const { streak, wonLast } = getPlayerStreak(entry.player_id);
                          const isChamp = idx === 0;
                          const hasStreak = streak >= 2;
                          return (
                            <div
                              key={`${selectedSkill}-${entry.player_id}`}
                              className={`flex items-center gap-3 px-5 py-3 transition-all duration-200 hover:translate-x-0.5 animate-cascade-row ${
                                isChamp
                                  ? "champion-gold-card"
                                  : hasStreak
                                  ? "row-streak-highlight hover:bg-[var(--bg-card-hover)]"
                                  : "hover:bg-[var(--bg-card-hover)]"
                              }`}
                              style={{ animationDelay: `${idx * 45}ms` }}
                            >
                              <span className="w-8 flex justify-center flex-shrink-0"><RankBadge rank={idx} /></span>
                              <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                                <span className={`text-sm font-semibold truncate ${isChamp ? "text-amber-400 font-bold" : ""}`}
                                  style={{ color: isChamp ? undefined : "var(--text-primary)" }}>
                                  {entry.player?.name}
                                </span>
                                {hasStreak && (
                                  <span
                                    className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full flex-shrink-0 shadow-sm"
                                    style={{
                                      background: "linear-gradient(135deg, #ef4444 0%, #f97316 100%)",
                                      color: "#ffffff",
                                      boxShadow: "0 2px 6px rgba(239, 68, 68, 0.35)",
                                    }}
                                    title={`${streak} consecutive match wins!`}
                                  >
                                    <Flame size={10} className="fill-white text-white animate-flame-soft" />
                                    <span className="tracking-wide uppercase text-[9px]">{streak} streak</span>
                                  </span>
                                )}
                              </div>
                              {wonLast !== null && (
                                <span className="flex-shrink-0">
                                  {wonLast ? <TrendingUp size={14} className="text-green-500" /> : <TrendingDown size={14} className="text-red-500" />}
                                </span>
                              )}
                              <span className="text-xs font-mono mx-2" style={{ color: "var(--text-muted)" }}>{entry.games_played}g</span>
                              <span className="text-base font-black font-mono"
                                style={{ color: isChamp ? "#eab308" : "var(--score-normal)" }}>{entry.total_score}</span>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-center py-10 px-5">
                      <p className="text-sm" style={{ color: "var(--text-faint)" }}>No individual scores yet</p>
                    </div>
                  )}
                </div>

                {/* Pairs card */}
                <div className="rounded-2xl overflow-hidden shadow-sm transition-all hover:shadow-md"
                  style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                  {skillPairs.length > 0 ? (
                    <>
                      <div className="flex items-center gap-2 px-5 py-2.5"
                        style={{ background: color + "0d", borderBottom: `1px solid ${color}20` }}>
                        <Award size={12} style={{ color }} />
                        <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>Best Pairs</span>
                      </div>
                      <div className="divide-y divide-[var(--separator)]">
                        {skillPairs.map((pair, idx) => {
                          const streak = getPairStreak(pair.player1_id, pair.player2_id);
                          const isChamp = idx === 0;
                          const hasStreak = streak >= 2;
                          return (
                            <div
                              key={`${selectedSkill}-${pair.player1_id}-${pair.player2_id}`}
                              className={`flex items-center gap-3 px-5 py-3 transition-all duration-200 hover:translate-x-0.5 animate-cascade-row ${
                                isChamp
                                  ? "champion-pair-card"
                                  : hasStreak
                                  ? "row-streak-highlight hover:bg-[var(--bg-card-hover)]"
                                  : "hover:bg-[var(--bg-card-hover)]"
                              }`}
                              style={{ animationDelay: `${idx * 45}ms` }}
                            >
                              <span className="w-8 flex justify-center flex-shrink-0"><RankBadge rank={idx} /></span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold truncate flex items-center gap-1.5 flex-wrap"
                                  style={{ color: isChamp ? "var(--pair-top)" : "var(--text-primary)" }}>
                                  <span>{pair.player1?.name} &amp; {pair.player2?.name}</span>
                                  {hasStreak && (
                                    <span
                                      className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full flex-shrink-0 shadow-sm"
                                      style={{
                                        background: "linear-gradient(135deg, #ef4444 0%, #f97316 100%)",
                                        color: "#ffffff",
                                        boxShadow: "0 2px 6px rgba(239, 68, 68, 0.35)",
                                      }}
                                      title={`${streak} consecutive match wins!`}
                                    >
                                      <Flame size={10} className="fill-white text-white animate-flame-soft" />
                                      <span className="tracking-wide uppercase text-[9px]">{streak} streak</span>
                                    </span>
                                  )}
                                </p>
                                <p className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                                  {pair.games_played} game{pair.games_played !== 1 ? "s" : ""} together
                                </p>
                              </div>
                              <span className="text-base font-black font-mono"
                                style={{ color: isChamp ? "var(--pair-top)" : "var(--pair-normal)" }}>{pair.total_score}</span>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-center py-10 px-5">
                      <p className="text-sm" style={{ color: "var(--text-faint)" }}>No pair data yet</p>
                    </div>
                  )}
                </div>

              </div>{/* end desktop grid */}
            </div>
          );
        })}

      </div>{/* end space-y-6 */}

      {/* Remove the old mobile tab switcher since tabs are now per-category on mobile */}

      </div>{/* end px-4 sm:px-6 pt-4 pb-6 animate-slide-up wrapper */}

    </main>
  );
}
