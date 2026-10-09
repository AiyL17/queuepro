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
    setQueue((qd as QueueEntry[]) || []);
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
          {courts.map((court) => (
            <div
              key={court.id}
              className="rounded-2xl p-3 text-center relative overflow-hidden"
              style={{
                background: "var(--bg-card)",
                border: `1px solid ${court.status === "available" ? "#16a34a40" : "#ef444440"}`,
              }}
            >
              <div
                className="absolute inset-0 opacity-5"
                style={{ background: court.status === "available" ? "#16a34a" : "#ef4444" }}
              />
              <p className="font-bold text-sm relative" style={{ color: "var(--text-primary)" }}>
                {court.name}
              </p>
              <p
                className="text-xs relative capitalize mt-0.5"
                style={{ color: SKILL_COLORS[court.assigned_skill_level as SkillLevel] || "var(--text-muted)" }}
              >
                {court.assigned_skill_level.replace(/_/g, " ")}
              </p>
              <div className="flex items-center justify-center gap-1 mt-2 relative">
                <div
                  className={`w-1.5 h-1.5 rounded-full${court.status === "occupied" ? " pulse-ring" : ""}`}
                  style={{
                    background: court.status === "available"
                      ? "var(--court-available-text)"
                      : "var(--court-occupied-text)",
                  }}
                />
                <span
                  className="text-xs font-medium"
                  style={{
                    color: court.status === "available"
                      ? "var(--court-available-text)"
                      : "var(--court-occupied-text)",
                  }}
                >
                  {court.status === "available" ? "Free" : "Playing"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main content */}
      {activeSkills.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32">
          <div className="p-4 rounded-2xl mb-4" style={{ background: "rgba(22,163,74,0.12)", color: "#4ade80" }}>
            <Users size={48} />
          </div>
          <p className="text-2xl font-semibold mb-2" style={{ color: "var(--text-muted)" }}>
            Waiting for players...
          </p>
          <p className="text-base" style={{ color: "var(--text-faint)" }}>
            Check in players to get started
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {activeSkills.map((s) => {
            const skillQueue = getQueueForSkill(s.value);
            const topScores = getTopScores(s.value);
            const color = SKILL_COLORS[s.value];
            return (
              <div
                key={s.value}
                className="rounded-2xl overflow-hidden"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
              >
                {/* Skill header */}
                <div
                  className="px-5 py-3 flex items-center gap-2"
                  style={{ background: color + "12", borderBottom: `1px solid ${color}30` }}
                >
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                  <h2 className="font-bold text-base" style={{ color: "var(--text-primary)" }}>{s.label}</h2>
                  {skillQueue.length > 0 && (
                    <span
                      className="ml-auto text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ background: color + "20", color }}
                    >
                      {skillQueue.length} waiting
                    </span>
                  )}
                </div>

                <div className="p-4 space-y-4">
                  {/* Queue */}
                  {skillQueue.length > 0 && (
                    <div>
                      <p
                        className="text-xs font-bold mb-2 uppercase tracking-widest"
                        style={{ color: "var(--text-faint)" }}
                      >
                        Queue
                      </p>
                      <ol className="space-y-1.5">
                        {skillQueue.slice(0, 8).map((entry, idx) => (
                          <li key={entry.id} className="flex items-center gap-2">
                            <span
                              className="text-xs font-bold w-5 text-center"
                              style={{ color: idx < 4 ? color : "var(--text-faint)" }}
                            >
                              {idx + 1}
                            </span>
                            <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                              {entry.player?.name}
                            </span>
                          </li>
                        ))}
                        {skillQueue.length > 8 && (
                          <li className="text-xs pl-7" style={{ color: "var(--text-faint)" }}>
                            +{skillQueue.length - 8} more
                          </li>
                        )}
                      </ol>
                    </div>
                  )}

                  {/* Top scores */}
                  {topScores.length > 0 && (
                    <div>
                      <p
                        className="text-xs font-bold mb-2 uppercase tracking-widest"
                        style={{ color: "var(--text-faint)" }}
                      >
                        Top Scores
                      </p>
                      <ol className="space-y-1.5">
                        {topScores.map((entry, idx) => (
                          <li key={entry.player_id} className="flex items-center gap-2">
                            <span className="w-5 flex items-center justify-center flex-shrink-0">
                              {idx === 0 ? <Trophy size={14} className="text-amber-400" /> : <span className="text-xs font-bold" style={{ color: "var(--text-faint)" }}>{idx + 1}.</span>}
                            </span>
                            <span className="flex-1 text-sm" style={{ color: "var(--text-primary)" }}>
                              {entry.player?.name}
                            </span>
                            <span className="text-sm font-bold" style={{ color: "var(--score-normal)" }}>
                              {entry.total_score}
                            </span>
                          </li>
                        ))}
                      </ol>
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
