"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Match, Player, Court, SkillLevel } from "@/lib/types";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BackButton } from "@/components/BackButton";
import { useScrollPosition } from "@/hooks/useScroll";
import {
  History,
  Trophy,
  Swords,
  Search,
  Users,
  User,
  Clock,
  X,
} from "lucide-react";

const SKILL_COLORS: Record<string, string> = {
  beginner:          "#3b82f6",
  advanced_beginner: "#8b5cf6",
  novice:            "#f59e0b",
  intermediate:      "#f97316",
  advanced:          "#ef4444",
};

function formatTimeAgo(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffSeconds < 60) return "Just now";
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

function formatExactTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default function HistoryPage() {
  const params    = useParams();
  const sessionId = params.id as string;
  const scrollY   = useScrollPosition();

  const [matches, setMatches]     = useState<Match[]>([]);
  const [players, setPlayers]     = useState<Player[]>([]);
  const [courts, setCourts]       = useState<Court[]>([]);
  const [loading, setLoading]     = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCourtId, setSelectedCourtId] = useState<string>("all");

  const fetchData = useCallback(async () => {
    const supabase = createClient();
    const [{ data: md }, { data: pd }, { data: cd }] = await Promise.all([
      supabase.from("matches").select("*").eq("session_id", sessionId).order("played_at", { ascending: false }),
      supabase.from("players").select("*").eq("session_id", sessionId),
      supabase.from("courts").select("*").eq("session_id", sessionId).order("name"),
    ]);

    setMatches((md as Match[]) || []);
    setPlayers((pd as Player[]) || []);
    setCourts((cd as Court[]) || []);
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    fetchData();
    const supabase = createClient();
    const ch = supabase.channel("history-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `session_id=eq.${sessionId}` }, fetchData)
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `session_id=eq.${sessionId}` }, fetchData)
      .on("postgres_changes", { event: "*", schema: "public", table: "courts",  filter: `session_id=eq.${sessionId}` }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId, fetchData]);

  const playerMap = useMemo(() => {
    const map = new Map<string, Player>();
    players.forEach((p) => map.set(p.id, p));
    return map;
  }, [players]);

  const courtMap = useMemo(() => {
    const map = new Map<string, Court>();
    courts.forEach((c) => map.set(c.id, c));
    return map;
  }, [courts]);

  const filteredMatches = useMemo(() => {
    return matches.filter((m) => {
      if (selectedCourtId !== "all" && m.court_id !== selectedCourtId) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const allPlayerIds = [...(m.team1_player_ids || []), ...(m.team2_player_ids || [])];
        const matchHasPlayer = allPlayerIds.some((id) => {
          const p = playerMap.get(id);
          return p?.name.toLowerCase().includes(query);
        });
        if (!matchHasPlayer) return false;
      }
      return true;
    });
  }, [matches, selectedCourtId, searchQuery, playerMap]);

  return (
    <main className="min-h-screen max-w-5xl mx-auto" style={{ background: "var(--bg-page)" }}>
      {/* ── Header ── */}
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
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 hidden sm:flex"
            style={{
              background: "linear-gradient(135deg, rgba(124,58,237,0.2), rgba(245,158,11,0.2))",
              border: "1px solid rgba(124,58,237,0.3)",
            }}
          >
            <History size={16} className="text-amber-400" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-black tracking-tight truncate leading-tight" style={{ color: "var(--text-heading)" }}>
              Match History
            </h1>
            <p className="text-[10px] truncate hidden sm:block" style={{ color: "var(--text-muted)" }}>
              Previous matches, courts & scores
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <ThemeToggle />
        </div>
      </header>

      {/* ── Page Content ── */}
      <div className="px-4 sm:px-6 pt-4 pb-8">
        {/* Controls Bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          {/* Player Search Input */}
          <div className="relative flex-1">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2"
              style={{ color: "var(--text-faint)" }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search player name..."
              className="w-full pl-9 pr-8 py-2.5 rounded-2xl text-xs font-semibold outline-none transition-all"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs opacity-60 hover:opacity-100"
                style={{ color: "var(--text-muted)" }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Court Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5" style={{ scrollbarWidth: "none" }}>
            <button
              onClick={() => setSelectedCourtId("all")}
              className="px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer"
              style={{
                background: selectedCourtId === "all" ? "var(--text-heading)" : "var(--bg-card)",
                color: selectedCourtId === "all" ? "var(--bg-page)" : "var(--text-muted)",
                border: `1px solid ${selectedCourtId === "all" ? "transparent" : "var(--border)"}`,
              }}
            >
              All Courts
            </button>
            {courts.map((court) => {
              const isSelected = selectedCourtId === court.id;
              const skillColor = SKILL_COLORS[court.assigned_skill_level] || "#8b5cf6";
              return (
                <button
                  key={court.id}
                  onClick={() => setSelectedCourtId(court.id)}
                  className="px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer"
                  style={{
                    background: isSelected ? skillColor : "var(--bg-card)",
                    color: isSelected ? "#ffffff" : "var(--text-muted)",
                    border: `1px solid ${isSelected ? skillColor : "var(--border)"}`,
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: isSelected ? "#ffffff" : skillColor }}
                  />
                  <span>{court.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Matches List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-28 rounded-2xl animate-pulse"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
              />
            ))}
          </div>
        ) : matches.length === 0 ? (
          <div
            className="rounded-3xl p-12 flex flex-col items-center justify-center text-center shadow-sm"
            style={{ background: "var(--bg-card)", border: "1px dashed var(--border)" }}
          >
            <div
              className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4 shadow-sm"
              style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}
            >
              <Swords size={28} style={{ color: "var(--text-faint)" }} />
            </div>
            <h3 className="text-base font-bold mb-1" style={{ color: "var(--text-heading)" }}>
              No matches recorded yet
            </h3>
            <p className="text-xs max-w-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
              When games finish and final scores are saved, each match with the involved players, court, and results will appear here.
            </p>
          </div>
        ) : filteredMatches.length === 0 ? (
          <div
            className="rounded-3xl p-10 flex flex-col items-center justify-center text-center"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
          >
            <Search size={22} className="mb-2" style={{ color: "var(--text-faint)" }} />
            <p className="text-sm font-bold" style={{ color: "var(--text-heading)" }}>No matches match your filter</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Try searching a different name or clearing court filters.</p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {filteredMatches.map((match) => {
              const court = courtMap.get(match.court_id);
              const courtName = court?.name || "Court";
              const courtSkill = court?.assigned_skill_level;
              const skillColor = courtSkill ? SKILL_COLORS[courtSkill] : "#8b5cf6";

              const t1Score = match.team1_score;
              const t2Score = match.team2_score;
              const t1Won = t1Score > t2Score;
              const t2Won = t2Score > t1Score;
              const isTie = t1Score === t2Score;

              const team1Players = (match.team1_player_ids || []).map((id) => {
                const p = playerMap.get(id);
                return p || { id, name: "Player", skill_level: "beginner" as SkillLevel, is_guest: true, session_id: match.session_id, account_id: null };
              });

              const team2Players = (match.team2_player_ids || []).map((id) => {
                const p = playerMap.get(id);
                return p || { id, name: "Player", skill_level: "beginner" as SkillLevel, is_guest: true, session_id: match.session_id, account_id: null };
              });

              const isDoubles = match.game_mode === "doubles" || team1Players.length > 1;

              return (
                <div
                  key={match.id}
                  className="rounded-3xl p-4 sm:p-5 transition-all duration-200"
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    boxShadow: "0 2px 10px rgba(0,0,0,0.03)",
                  }}
                >
                  {/* Top Bar */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider"
                        style={{ background: "var(--bg-subtle)", color: "var(--text-faint)", border: "1px solid var(--border)" }}
                      >
                        Match #{matches.length - matches.indexOf(match)}
                      </span>

                      <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md" style={{ background: `${skillColor}15` }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: skillColor }} />
                        <span className="text-[11px] font-bold" style={{ color: skillColor }}>
                          {courtName}
                        </span>
                        {courtSkill && (
                          <span className="text-[10px] font-medium capitalize opacity-70 hidden sm:inline" style={{ color: skillColor }}>
                            ({courtSkill.replace(/_/g, " ")})
                          </span>
                        )}
                      </div>

                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md"
                        style={{
                          background: isDoubles ? "rgba(124,58,237,0.1)" : "rgba(6,182,212,0.1)",
                          color: isDoubles ? "#a78bfa" : "#06b6d4",
                        }}
                      >
                        {isDoubles ? <Users size={10} /> : <User size={10} />}
                        {isDoubles ? "Doubles" : "Singles"}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
                      <Clock size={11} className="opacity-70" />
                      <span title={formatExactTime(match.played_at)}>
                        {formatTimeAgo(match.played_at)}
                      </span>
                    </div>
                  </div>

                  {/* Teams and Scores Display */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Team 1 Card */}
                    <div
                      className="p-3.5 rounded-2xl flex items-center justify-between gap-3 relative overflow-hidden transition-all"
                      style={{
                        background: t1Won ? "rgba(34, 197, 94, 0.08)" : "var(--bg-subtle)",
                        border: t1Won ? "1.5px solid rgba(34, 197, 94, 0.35)" : "1px solid var(--border)",
                      }}
                    >
                      {t1Won && <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500" />}

                      <div className="flex-1 min-w-0 pl-1">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          {t1Won ? (
                            <span
                              className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
                              style={{
                                background: "rgba(34,197,94,0.18)",
                                color: "var(--success-text)",
                                border: "1px solid rgba(34,197,94,0.3)",
                              }}
                            >
                              <Trophy size={10} className="fill-emerald-400 text-emerald-400" />
                              WINNER
                            </span>
                          ) : isTie ? (
                            <span
                              className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                              style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}
                            >
                              DRAW
                            </span>
                          ) : (
                            <span
                              className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                              style={{ background: "var(--bg-card)", color: "var(--text-faint)" }}
                            >
                              DEFEAT
                            </span>
                          )}
                          <span className="text-[10px] font-semibold" style={{ color: "var(--text-faint)" }}>
                            Team 1
                          </span>
                        </div>

                        <div className="space-y-1">
                          {team1Players.map((player) => {
                            const pColor = SKILL_COLORS[player.skill_level] || "#3b82f6";
                            return (
                              <div key={player.id} className="flex items-center gap-2 min-w-0">
                                <div
                                  className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black flex-shrink-0"
                                  style={{ background: `${pColor}25`, color: pColor }}
                                >
                                  {player.name.slice(0, 1).toUpperCase()}
                                </div>
                                <span className="text-xs font-bold truncate leading-tight" style={{ color: "var(--text-primary)" }}>
                                  {player.name}
                                </span>
                                <span className="text-[9px] font-semibold capitalize opacity-70 truncate hidden sm:inline" style={{ color: pColor }}>
                                  · {player.skill_level.replace(/_/g, " ")}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex flex-col items-center justify-center flex-shrink-0 px-2">
                        <span
                          className={`text-2xl sm:text-3xl font-black tracking-tight leading-none ${t1Won ? "scale-105" : "opacity-80"}`}
                          style={{ color: t1Won ? "var(--success-text)" : "var(--text-muted)" }}
                        >
                          {t1Score}
                        </span>
                        <span className="text-[9px] font-bold uppercase tracking-wider mt-0.5" style={{ color: "var(--text-faint)" }}>
                          pts
                        </span>
                      </div>
                    </div>

                    {/* Team 2 Card */}
                    <div
                      className="p-3.5 rounded-2xl flex items-center justify-between gap-3 relative overflow-hidden transition-all"
                      style={{
                        background: t2Won ? "rgba(34, 197, 94, 0.08)" : "var(--bg-subtle)",
                        border: t2Won ? "1.5px solid rgba(34, 197, 94, 0.35)" : "1px solid var(--border)",
                      }}
                    >
                      {t2Won && <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500" />}

                      <div className="flex-1 min-w-0 pl-1">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          {t2Won ? (
                            <span
                              className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
                              style={{
                                background: "rgba(34,197,94,0.18)",
                                color: "var(--success-text)",
                                border: "1px solid rgba(34,197,94,0.3)",
                              }}
                            >
                              <Trophy size={10} className="fill-emerald-400 text-emerald-400" />
                              WINNER
                            </span>
                          ) : isTie ? (
                            <span
                              className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                              style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}
                            >
                              DRAW
                            </span>
                          ) : (
                            <span
                              className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                              style={{ background: "var(--bg-card)", color: "var(--text-faint)" }}
                            >
                              DEFEAT
                            </span>
                          )}
                          <span className="text-[10px] font-semibold" style={{ color: "var(--text-faint)" }}>
                            Team 2
                          </span>
                        </div>

                        <div className="space-y-1">
                          {team2Players.map((player) => {
                            const pColor = SKILL_COLORS[player.skill_level] || "#3b82f6";
                            return (
                              <div key={player.id} className="flex items-center gap-2 min-w-0">
                                <div
                                  className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black flex-shrink-0"
                                  style={{ background: `${pColor}25`, color: pColor }}
                                >
                                  {player.name.slice(0, 1).toUpperCase()}
                                </div>
                                <span className="text-xs font-bold truncate leading-tight" style={{ color: "var(--text-primary)" }}>
                                  {player.name}
                                </span>
                                <span className="text-[9px] font-semibold capitalize opacity-70 truncate hidden sm:inline" style={{ color: pColor }}>
                                  · {player.skill_level.replace(/_/g, " ")}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex flex-col items-center justify-center flex-shrink-0 px-2">
                        <span
                          className={`text-2xl sm:text-3xl font-black tracking-tight leading-none ${t2Won ? "scale-105" : "opacity-80"}`}
                          style={{ color: t2Won ? "var(--success-text)" : "var(--text-muted)" }}
                        >
                          {t2Score}
                        </span>
                        <span className="text-[9px] font-bold uppercase tracking-wider mt-0.5" style={{ color: "var(--text-faint)" }}>
                          pts
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
