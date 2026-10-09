"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SKILL_LEVELS, SkillLevel, QueueEntry, Court, PlayerSessionScore } from "@/lib/types";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BackButton } from "@/components/BackButton";
import { Target, Trophy, Users } from "lucide-react";

const SKILL_COLORS: Record<SkillLevel, string> = {
  beginner: "#3b82f6",
  advanced_beginner: "#8b5cf6",
  novice: "#f59e0b",
  intermediate: "#f97316",
  advanced: "#ef4444",
};

export default function DisplayPage() {
  const params = useParams();
  const sessionId = params.id as string;
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [scores, setScores] = useState<PlayerSessionScore[]>([]);
  const [time, setTime] = useState(new Date());

  const fetchData = useCallback(async () => {
    const supabase = createClient();
    const [{ data: qd }, { data: cd }, { data: sd }] = await Promise.all([
      supabase.from("queue_entries").select("*, player:players(*)").eq("session_id", sessionId).eq("status", "waiting").order("joined_at"),
      supabase.from("courts").select("*").eq("session_id", sessionId).order("name"),
      supabase.from("player_session_scores").select("*, player:players(*)").eq("session_id", sessionId).order("total_score", { ascending: false }),
    ]);
    const seen = new Set<string>();
    const uniqueQueue: QueueEntry[] = [];
    for (const q of (qd as QueueEntry[]) || []) {
      if (q.player && !seen.has(q.player_id)) {
        seen.add(q.player_id);
        uniqueQueue.push(q);
      }
    }

    setQueue(uniqueQueue);
    setCourts((cd as Court[]) || []);
    setScores((sd as PlayerSessionScore[]) || []);
  }, [sessionId]);

  useEffect(() => {
    fetchData();
    const supabase = createClient();
    const ch = supabase.channel("display-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "queue_entries", filter: `session_id=eq.${sessionId}` }, fetchData)
      .on("postgres_changes", { event: "*", schema: "public", table: "courts", filter: `session_id=eq.${sessionId}` }, fetchData)
      .on("postgres_changes", { event: "*", schema: "public", table: "player_session_scores", filter: `session_id=eq.${sessionId}` }, fetchData)
      .subscribe();
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => { supabase.removeChannel(ch); clearInterval(timer); };
  }, [sessionId, fetchData]);

  const getQueueForSkill = (skill: SkillLevel) => queue.filter((q) => q.skill_level === skill);
  const getCourtsForSkill = (skill: SkillLevel) => courts.filter((c) => c.assigned_skill_level === skill);
  const getTopScores = (skill: SkillLevel) =>
    scores.filter((s) => s.player?.skill_level === skill)
      .sort((a, b) => b.total_score - a.total_score).slice(0, 5);

  const activeSkills = SKILL_LEVELS.filter((s) =>
    getQueueForSkill(s.value).length > 0 || getCourtsForSkill(s.value).length > 0 || getTopScores(s.value).length > 0
  );

  const availableCourts = courts.filter((c) => c.status === "available").length;

  return (
    <main className="min-h-screen p-4 sm:p-6" style={{ background: "var(--bg-page)" }}>
      {/* Header bar */}
      <div
        className="sticky top-0 z-10 flex items-center justify-between gap-3 mb-6 pb-4 px-4 sm:px-6 -mx-4 sm:-mx-6"
        style={{ borderBottom: "1px solid var(--border)",
          backdropFilter: "blur(12px)",
          background: "var(--bg-page)", }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}
          >
            <Target size={20} className="text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold truncate" style={{ color: "var(--text-heading)" }}>QueuePro</h1>
            <p className="text-xs hidden sm:block" style={{ color: "var(--text-faint)" }}>Live Session Display</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
          <BackButton fallback={`/session/${sessionId}`} />
          <div className="text-right hidden sm:block">
            <p className="text-xl sm:text-2xl font-bold font-mono" style={{ color: "var(--text-primary)" }}>
              {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
            <p className="text-xs" style={{ color: "var(--text-faint)" }}>
              {availableCourts}/{courts.length} courts free
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full animate-pulse flex-shrink-0" style={{ background: "var(--court-available-text)" }} />
            <span className="text-xs hidden sm:inline" style={{ color: "var(--court-available-text)" }}>Live</span>
          </div>
          <ThemeToggle />
        </div>
      </div>

      {/* Courts row — auto-responsive grid */}
      {courts.length > 0 && (
        <div className="pt-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
          {courts.map((court) => {
            const color = SKILL_COLORS[court.assigned_skill_level as SkillLevel] || "#8b5cf6";
            const isOccupied = court.status === "occupied";
            return (
              <div
                key={court.id}
                className="rounded-3xl p-3.5 text-center relative overflow-hidden transition-all duration-300"
                style={{
                  background: isOccupied
                    ? `linear-gradient(145deg, var(--bg-card) 0%, ${color}12 100%)`
                    : "var(--bg-card)",
                  border: `1.5px solid ${isOccupied ? color + "50" : "var(--border)"}`,
                  boxShadow: isOccupied ? `0 4px 20px ${color}15` : "none",
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="font-bold text-sm truncate" style={{ color: "var(--text-heading)" }}>
                    {court.name}
                  </p>
                  <span
                    className={`w-2 h-2 rounded-full ${isOccupied ? "animate-pulse" : ""}`}
                    style={{ background: isOccupied ? color : "var(--court-available-text)" }}
                  />
                </div>
                <p
                  className="text-[10px] font-bold uppercase tracking-wider mb-2 text-left"
                  style={{ color }}
                >
                  {court.assigned_skill_level.replace(/_/g, " ")}
                </p>
                <div
                  className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold w-full"
                  style={{
                    background: isOccupied ? color + "18" : "var(--court-available-bg)",
                    color: isOccupied ? color : "var(--court-available-text)",
                  }}
                >
                  {isOccupied ? "In Play" : "Available"}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Main content */}
      {activeSkills.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32">
          <div className="p-4 rounded-3xl mb-4 shadow-sm" style={{ background: "rgba(22,163,74,0.12)", color: "#4ade80" }}>
            <Users size={48} />
          </div>
          <p className="text-2xl font-bold mb-1" style={{ color: "var(--text-heading)" }}>
            Waiting for players...
          </p>
          <p className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
            Check in players to begin live matching
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {activeSkills.map((s) => {
            const skillQueue = getQueueForSkill(s.value);
            const topScores = getTopScores(s.value);
            const color = SKILL_COLORS[s.value];
            return (
              <div
                key={s.value}
                className="rounded-3xl overflow-hidden transition-all duration-300"
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  boxShadow: "0 6px 24px rgba(0,0,0,0.04)",
                }}
              >
                {/* Skill header */}
                <div
                  className="px-5 py-3.5 flex items-center justify-between"
                  style={{ background: color + "10", borderBottom: `1px solid ${color}25` }}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-3 h-3 rounded-full" style={{ background: color }} />
                    <h2 className="font-bold text-sm tracking-tight" style={{ color: "var(--text-heading)" }}>{s.label}</h2>
                  </div>
                  {skillQueue.length > 0 && (
                    <span
                      className="text-[10px] font-bold px-2.5 py-0.5 rounded-full"
                      style={{ background: color + "20", color, border: `1px solid ${color}35` }}
                    >
                      {skillQueue.length} waiting
                    </span>
                  )}
                </div>

                <div className="p-5 space-y-5">
                  {/* Queue */}
                  {skillQueue.length > 0 && (
                    <div>
                      <p
                        className="text-[10px] font-bold mb-2.5 uppercase tracking-widest"
                        style={{ color: "var(--text-faint)" }}
                      >
                        Active Queue
                      </p>
                      <div className="space-y-1.5">
                        {skillQueue.slice(0, 8).map((entry, idx) => {
                          const initials = (entry.player?.name ?? "?").slice(0, 2).toUpperCase();
                          return (
                            <div
                              key={entry.id}
                              className="flex items-center gap-2.5 px-3 py-2 rounded-2xl"
                              style={{ background: "var(--bg-subtle)" }}
                            >
                              <div
                                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0"
                                style={{ background: color + "25", color }}
                              >
                                {initials}
                              </div>
                              <span className="text-xs font-bold truncate flex-1" style={{ color: "var(--text-primary)" }}>
                                {entry.player?.name}
                              </span>
                              <span
                                className="text-[10px] font-bold px-1.5 py-0.2 rounded-full"
                                style={{ background: "var(--bg-card)", color: "var(--text-faint)", border: "1px solid var(--border)" }}
                              >
                                #{idx + 1}
                              </span>
                            </div>
                          );
                        })}
                        {skillQueue.length > 8 && (
                          <p className="text-xs text-center pt-1" style={{ color: "var(--text-faint)" }}>
                            +{skillQueue.length - 8} more in line
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Top scores */}
                  {topScores.length > 0 && (
                    <div>
                      <p
                        className="text-[10px] font-bold mb-2.5 uppercase tracking-widest"
                        style={{ color: "var(--text-faint)" }}
                      >
                        Tier Leaders
                      </p>
                      <div className="space-y-1.5">
                        {topScores.map((entry, idx) => (
                          <div
                            key={entry.player_id}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-2xl"
                            style={{ background: "var(--bg-subtle)" }}
                          >
                            <span className="w-5 flex items-center justify-center flex-shrink-0">
                              {idx === 0 ? <Trophy size={14} className="text-amber-400" /> : <span className="text-xs font-bold" style={{ color: "var(--text-faint)" }}>{idx + 1}</span>}
                            </span>
                            <span className="flex-1 text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                              {entry.player?.name}
                            </span>
                            <span className="text-xs font-black" style={{ color: "var(--score-normal)" }}>
                              {entry.total_score} pts
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
