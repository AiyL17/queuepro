"use client";

import { useState, useMemo } from "react";
import { Match, Player, Court, SKILL_LEVELS, SkillLevel } from "@/lib/types";
import { X, History, Trophy, Swords, Search, Users, User, Clock, Check, Sparkles } from "lucide-react";

interface MatchHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  matches: Match[];
  players: Player[];
  courts: Court[];
}

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

export function MatchHistoryModal({
  isOpen,
  onClose,
  matches,
  players,
  courts,
}: MatchHistoryModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCourtId, setSelectedCourtId] = useState<string>("all");

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
      // Filter by court
      if (selectedCourtId !== "all" && m.court_id !== selectedCourtId) {
        return false;
      }

      // Filter by player name search
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

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 animate-fade-in"
      style={{ background: "rgba(0,0,0,0.78)", backdropFilter: "blur(10px)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-3xl overflow-hidden shadow-2xl animate-scale-in"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Modal Header ── */}
        <div
          className="p-4 sm:p-5 border-b flex items-center justify-between flex-shrink-0"
          style={{ borderColor: "var(--separator)", background: "var(--bg-card)" }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm"
              style={{
                background: "linear-gradient(135deg, rgba(124,58,237,0.2), rgba(245,158,11,0.2))",
                border: "1px solid rgba(124,58,237,0.3)",
              }}
            >
              <History size={20} className="text-amber-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight" style={{ color: "var(--text-heading)" }}>
                  Match History
                </h2>
                <span
                  className="text-[11px] font-black px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(124,58,237,0.15)", color: "#c084fc" }}
                >
                  {matches.length}
                </span>
              </div>
              <p className="text-xs truncate mt-0.5" style={{ color: "var(--text-muted)" }}>
                Previous match results, players, and final scores
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:opacity-80 active:scale-95 cursor-pointer flex-shrink-0"
            style={{ background: "var(--bg-subtle)", color: "var(--text-muted)" }}
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Search & Filter Controls ── */}
        <div
          className="px-4 py-3 border-b flex flex-col sm:flex-row gap-2.5 flex-shrink-0"
          style={{ borderColor: "var(--separator)", background: "var(--bg-card-alt)" }}
        >
          {/* Player Search Input */}
          <div className="relative flex-1">
            <Search
              size={14}
              className="absolute left-3.5 top-1/2 -translate-y-1/2"
              style={{ color: "var(--text-faint)" }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search player name..."
              className="w-full pl-9 pr-8 py-2 rounded-xl text-xs font-semibold outline-none transition-all"
              style={{
                background: "var(--bg-subtle)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs opacity-60 hover:opacity-100"
                style={{ color: "var(--text-muted)" }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Court Filter Pills */}
          <div
            className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5"
            style={{ scrollbarWidth: "none" }}
          >
            <button
              onClick={() => setSelectedCourtId("all")}
              className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer"
              style={{
                background: selectedCourtId === "all" ? "var(--text-heading)" : "var(--bg-subtle)",
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
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer"
                  style={{
                    background: isSelected ? skillColor : "var(--bg-subtle)",
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

        {/* ── Match List Content ── */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-3.5">
          {matches.length === 0 ? (
            <div className="py-16 px-4 flex flex-col items-center justify-center text-center">
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
                When courts finish playing and the organizer enters the match scores, each game result with winners, losers, and scores will be listed here.
              </p>
            </div>
          ) : filteredMatches.length === 0 ? (
            <div className="py-14 px-4 flex flex-col items-center justify-center text-center">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
                style={{ background: "var(--bg-subtle)" }}
              >
                <Search size={20} style={{ color: "var(--text-faint)" }} />
              </div>
              <h3 className="text-sm font-bold mb-1" style={{ color: "var(--text-heading)" }}>
                No matching matches found
              </h3>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Try adjusting your search query or court filter.
              </p>
            </div>
          ) : (
            filteredMatches.map((match, idx) => {
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
                  className="rounded-2xl p-4 transition-all duration-200"
                  style={{
                    background: "var(--bg-card-alt)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {/* Match Top Bar */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Match Number Badge */}
                      <span
                        className="text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider"
                        style={{ background: "var(--bg-subtle)", color: "var(--text-faint)", border: "1px solid var(--border)" }}
                      >
                        Match #{matches.length - matches.indexOf(match)}
                      </span>

                      {/* Court Badge */}
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md" style={{ background: `${skillColor}15` }}>
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

                      {/* Mode Badge */}
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

                    {/* Timestamp */}
                    <div className="flex items-center gap-1 text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
                      <Clock size={11} className="opacity-70" />
                      <span title={formatExactTime(match.played_at)}>
                        {formatTimeAgo(match.played_at)}
                      </span>
                    </div>
                  </div>

                  {/* Teams and Scores Display */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* ── Team 1 Card ── */}
                    <div
                      className="p-3 rounded-xl flex items-center justify-between gap-3 relative overflow-hidden transition-all"
                      style={{
                        background: t1Won
                          ? "rgba(34, 197, 94, 0.08)"
                          : "var(--bg-subtle)",
                        border: t1Won
                          ? "1.5px solid rgba(34, 197, 94, 0.35)"
                          : "1px solid var(--border)",
                      }}
                    >
                      {/* Winner Accent Bar */}
                      {t1Won && (
                        <div
                          className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500"
                        />
                      )}

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

                        {/* Players List */}
                        <div className="space-y-1">
                          {team1Players.map((player) => {
                            const pColor = SKILL_COLORS[player.skill_level] || "#3b82f6";
                            return (
                              <div key={player.id} className="flex items-center gap-2 min-w-0">
                                <div
                                  className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black flex-shrink-0"
                                  style={{
                                    background: `${pColor}25`,
                                    color: pColor,
                                  }}
                                >
                                  {player.name.slice(0, 1).toUpperCase()}
                                </div>
                                <span
                                  className="text-xs font-bold truncate leading-tight"
                                  style={{ color: "var(--text-primary)" }}
                                >
                                  {player.name}
                                </span>
                                <span
                                  className="text-[9px] font-semibold capitalize opacity-70 truncate hidden sm:inline"
                                  style={{ color: pColor }}
                                >
                                  · {player.skill_level.replace(/_/g, " ")}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Team 1 Score */}
                      <div className="flex flex-col items-center justify-center flex-shrink-0 px-2">
                        <span
                          className={`text-2xl sm:text-3xl font-black tracking-tight leading-none ${
                            t1Won ? "scale-105" : "opacity-80"
                          }`}
                          style={{
                            color: t1Won ? "var(--success-text)" : "var(--text-muted)",
                          }}
                        >
                          {t1Score}
                        </span>
                        <span className="text-[9px] font-bold uppercase tracking-wider mt-0.5" style={{ color: "var(--text-faint)" }}>
                          pts
                        </span>
                      </div>
                    </div>

                    {/* ── Team 2 Card ── */}
                    <div
                      className="p-3 rounded-xl flex items-center justify-between gap-3 relative overflow-hidden transition-all"
                      style={{
                        background: t2Won
                          ? "rgba(34, 197, 94, 0.08)"
                          : "var(--bg-subtle)",
                        border: t2Won
                          ? "1.5px solid rgba(34, 197, 94, 0.35)"
                          : "1px solid var(--border)",
                      }}
                    >
                      {/* Winner Accent Bar */}
                      {t2Won && (
                        <div
                          className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500"
                        />
                      )}

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

                        {/* Players List */}
                        <div className="space-y-1">
                          {team2Players.map((player) => {
                            const pColor = SKILL_COLORS[player.skill_level] || "#3b82f6";
                            return (
                              <div key={player.id} className="flex items-center gap-2 min-w-0">
                                <div
                                  className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black flex-shrink-0"
                                  style={{
                                    background: `${pColor}25`,
                                    color: pColor,
                                  }}
                                >
                                  {player.name.slice(0, 1).toUpperCase()}
                                </div>
                                <span
                                  className="text-xs font-bold truncate leading-tight"
                                  style={{ color: "var(--text-primary)" }}
                                >
                                  {player.name}
                                </span>
                                <span
                                  className="text-[9px] font-semibold capitalize opacity-70 truncate hidden sm:inline"
                                  style={{ color: pColor }}
                                >
                                  · {player.skill_level.replace(/_/g, " ")}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Team 2 Score */}
                      <div className="flex flex-col items-center justify-center flex-shrink-0 px-2">
                        <span
                          className={`text-2xl sm:text-3xl font-black tracking-tight leading-none ${
                            t2Won ? "scale-105" : "opacity-80"
                          }`}
                          style={{
                            color: t2Won ? "var(--success-text)" : "var(--text-muted)",
                          }}
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
            })
          )}
        </div>

        {/* ── Footer ── */}
        <div
          className="p-3 sm:p-4 border-t flex items-center justify-between flex-shrink-0"
          style={{ borderColor: "var(--separator)", background: "var(--bg-card)" }}
        >
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Showing {filteredMatches.length} of {matches.length} match{matches.length === 1 ? "" : "es"}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-90 active:scale-95 cursor-pointer"
            style={{
              background: "var(--bg-subtle)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
