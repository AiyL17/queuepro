"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SKILL_LEVELS, SkillLevel, QueueEntry, Court, GameMode } from "@/lib/types";

/** Fisher-Yates shuffle — returns a new shuffled array. */
function shuffled<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
import { ThemeToggle } from "@/components/ThemeToggle";
import { RefreshCw, UserPlus, Volume2, Users, User, X } from "lucide-react";
import { BackButton } from "@/components/BackButton";

const SKILL_COLORS: Record<SkillLevel, string> = {
  beginner:          "#3b82f6",
  advanced_beginner: "#8b5cf6",
  novice:            "#f59e0b",
  intermediate:      "#f97316",
  advanced:          "#ef4444",
};

export default function QueuePage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const [queue, setQueue]       = useState<QueueEntry[]>([]);
  const [courts, setCourts]     = useState<Court[]>([]);
  const [gameMode, setGameMode] = useState<GameMode>("doubles");
  const [loading, setLoading]   = useState(true);
  const [calling, setCalling]   = useState<string | null>(null);

  const playersPerMatch    = gameMode === "singles" ? 2 : 4;
  const minPlayersToStart  = gameMode === "singles" ? 2 : 3; // doubles can start 2v1

  const fetchData = useCallback(async () => {
    const supabase = createClient();
    const [{ data: qd }, { data: cd }, { data: sd }] = await Promise.all([
      supabase.from("queue_entries").select("*, player:players(*)").eq("session_id", sessionId).eq("status", "waiting").order("joined_at"),
      supabase.from("courts").select("*").eq("session_id", sessionId).order("name"),
      supabase.from("sessions").select("game_mode").eq("id", sessionId).single(),
    ]);
    setQueue((qd as QueueEntry[]) || []);
    setCourts((cd as Court[]) || []);
    if (sd?.game_mode) setGameMode(sd.game_mode as GameMode);
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    fetchData();
    const supabase = createClient();
    const ch = supabase.channel("queue-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "queue_entries", filter: `session_id=eq.${sessionId}` }, fetchData)
      .on("postgres_changes", { event: "*", schema: "public", table: "courts",        filter: `session_id=eq.${sessionId}` }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId, fetchData]);

  const callToPlay = async (courtId: string, playerIds: string[]) => {
    setCalling(courtId);
    const supabase = createClient();
    await supabase.from("courts").update({ status: "occupied" }).eq("id", courtId);
    await supabase.from("queue_entries").update({ status: "playing" }).in("player_id", playerIds).eq("session_id", sessionId);
    await fetchData();
    setCalling(null);
  };

  const removeFromQueue = async (queueEntryId: string) => {
    setQueue((prev) => prev.filter((q) => q.id !== queueEntryId));
    const supabase = createClient();
    await supabase.from("queue_entries").update({ status: "done" }).eq("id", queueEntryId);
    await supabase.from("queue_entries").delete().eq("id", queueEntryId);
  };

  const getQueueForSkill  = (skill: SkillLevel) => queue.filter((q) => q.skill_level === skill);
  const getCourtsForSkill = (skill: SkillLevel) => courts.filter((c) => c.assigned_skill_level === skill);

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-page)" }}>
      <div className="text-center">
        <div
          className="w-8 h-8 rounded-full border-2 animate-spin mx-auto mb-3"
          style={{ borderColor: "#16a34a", borderTopColor: "transparent" }}
        />
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Loading queue...</p>
      </div>
    </main>
  );

  const activeSkills = SKILL_LEVELS.filter(
    (s) => getQueueForSkill(s.value).length > 0 || getCourtsForSkill(s.value).length > 0
  );

  return (
    <main className="min-h-screen p-4 sm:p-6 max-w-5xl mx-auto" style={{ background: "var(--bg-page)" }}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-6 sm:mb-8">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <BackButton fallback={`/session/${sessionId}`} />
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-black tracking-tight" style={{ color: "var(--text-heading)" }}>
              Live Queue
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>{queue.length} waiting</p>
              {/* Game mode pill */}
              <span
                className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{
                  background: gameMode === "doubles" ? "rgba(124,58,237,0.12)" : "rgba(6,182,212,0.12)",
                  color:      gameMode === "doubles" ? "#a78bfa" : "#06b6d4",
                }}
              >
                {gameMode === "doubles" ? <Users size={10} /> : <User size={10} />}
                {gameMode}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2 items-center flex-shrink-0">
          <button
            onClick={() => router.push(`/session/${sessionId}/checkin`)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-full text-xs font-semibold hover:opacity-80 transition-all"
            style={{ background: "rgba(22,163,74,0.12)", color: "#4ade80", border: "1px solid rgba(22,163,74,0.3)" }}
          >
            <UserPlus size={13} />
            <span className="hidden sm:inline">Check-in</span>
          </button>
          <button
            onClick={fetchData}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:opacity-80 transition-all"
            style={{ background: "var(--bg-card)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
          >
            <RefreshCw size={14} />
          </button>
          <ThemeToggle />
        </div>
      </div>

      {/* Empty state */}
      {activeSkills.length === 0 ? (
        <div className="text-center py-24">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: "var(--bg-card)" }}
          >
            {gameMode === "doubles"
              ? <Users size={28} style={{ color: "var(--text-faint)" }} />
              : <User  size={28} style={{ color: "var(--text-faint)" }} />
            }
          </div>
          <p className="font-semibold mb-1" style={{ color: "var(--text-muted)" }}>No players in queue</p>
          <p className="text-sm mb-6" style={{ color: "var(--text-faint)" }}>Check in players to get started</p>
          <button
            onClick={() => router.push(`/session/${sessionId}/checkin`)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold mx-auto"
            style={{ background: "rgba(22,163,74,0.12)", color: "#4ade80", border: "1px solid rgba(22,163,74,0.3)" }}
          >
            <UserPlus size={15} />
            Check in a player
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {SKILL_LEVELS.map((s) => {
            const skillQueue   = getQueueForSkill(s.value);
            const skillCourts  = getCourtsForSkill(s.value);
            if (skillQueue.length === 0 && skillCourts.length === 0) return null;

            const availableCourts = skillCourts.filter((c) => c.status === "available");
            const canCall         = availableCourts.length > 0 && skillQueue.length >= minPlayersToStart;
            const color           = SKILL_COLORS[s.value];
            // Shuffle the waitlist so every rotation produces different pairings,
            // then take the first N (up to playersPerMatch, min minPlayersToStart).
            const shuffledQueue   = shuffled(skillQueue);
            const nextCount       = Math.min(shuffledQueue.length, playersPerMatch);
            const nextPlayers     = shuffledQueue.slice(0, nextCount);

            return (
              <div
                key={s.value}
                className="rounded-2xl overflow-hidden"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
              >
                {/* Skill header */}
                <div
                  className="flex items-center justify-between px-5 py-3"
                  style={{ borderBottom: "1px solid var(--separator)" }}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                    <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>
                      {s.label}
                    </span>
                  </div>
                  <div className="flex gap-3 text-xs">
                    <span style={{ color: "var(--text-muted)" }}>{skillQueue.length} waiting</span>
                    <span
                      style={{
                        color: availableCourts.length > 0
                          ? "var(--court-available-text)"
                          : "var(--court-occupied-text)",
                      }}
                    >
                      {availableCourts.length}/{skillCourts.length} courts free
                    </span>
                  </div>
                </div>

                {/* Queue list */}
                <div className="p-3">
                  {skillQueue.length === 0 ? (
                    <p className="text-xs text-center py-3" style={{ color: "var(--text-faint)" }}>
                      No players waiting
                    </p>
                  ) : (
                    <div className="space-y-1.5 mb-3">
                      {skillQueue.map((entry, idx) => {
                        const isNext = canCall && nextPlayers.some((n) => n.id === entry.id);
                        return (
                          <div
                            key={entry.id}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                            style={{ background: isNext ? color + "0d" : "var(--bg-card-alt)" }}
                          >
                            <span
                              className="text-xs font-bold w-5 text-center flex-shrink-0"
                              style={{ color: isNext ? color : "var(--text-faint)" }}
                            >
                              {idx + 1}
                            </span>
                            <span className="flex-1 text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                              {entry.player?.name}
                            </span>
                            {isNext && (
                              <span
                                className="text-xs px-2 py-0.5 rounded-full font-semibold"
                                style={{ background: color + "20", color }}
                              >
                                next up
                              </span>
                            )}
                            <span className="text-xs flex-shrink-0" style={{ color: "var(--text-faint)" }}>
                              {new Date(entry.joined_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeFromQueue(entry.id)}
                              title={`Remove ${entry.player?.name ?? "player"} from queue`}
                              className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 transition-all opacity-70 hover:opacity-100 hover:scale-110 cursor-pointer"
                              style={{ background: "var(--error-bg)", color: "var(--error-text)", border: "1px solid var(--error-border)" }}
                            >
                              <X size={12} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Call to court button */}
                  {canCall && (
                    <button
                      onClick={() => callToPlay(availableCourts[0].id, nextPlayers.map((q) => q.player_id))}
                      disabled={calling === availableCourts[0].id}
                      className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      style={{ background: color + "20", color, border: `1px solid ${color}40` }}
                    >
                      <Volume2 size={14} />
                      {calling === availableCourts[0].id
                        ? "Calling..."
                        : `Send next ${nextCount} to ${availableCourts[0].name}`}
                    </button>
                  )}

                  {/* Not enough players yet */}
                  {availableCourts.length > 0 && skillQueue.length > 0 && skillQueue.length < minPlayersToStart && (
                    <p className="text-xs text-center py-2" style={{ color: "var(--text-faint)" }}>
                      Need {minPlayersToStart - skillQueue.length} more player{minPlayersToStart - skillQueue.length !== 1 ? "s" : ""} to start a match
                    </p>
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
