"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Court, QueueEntry, GameMode } from "@/lib/types";
import { Users, User, Trophy, Clock } from "lucide-react";

const SKILL_COLORS: Record<string, string> = {
  beginner:          "#3b82f6",
  advanced_beginner: "#8b5cf6",
  novice:            "#f59e0b",
  intermediate:      "#f97316",
  advanced:          "#ef4444",
};

interface Props {
  sessionId: string;
  gameMode: GameMode;
  initialCourts: Court[];
}

interface CourtWithPlayers extends Court {
  playingEntries: QueueEntry[];   // currently on this court (status = playing)
  waitingEntries: QueueEntry[];   // next up in queue for this court's skill level
}

export function CourtsPanel({ sessionId, gameMode, initialCourts }: Props) {
  const router = useRouter();
  const [courts, setCourts] = useState<CourtWithPlayers[]>(
    initialCourts.map((c) => ({ ...c, playingEntries: [], waitingEntries: [] }))
  );

  const playersNeeded = gameMode === "singles" ? 2 : 4;

  const fetchCourts = useCallback(async () => {
    const supabase = createClient();
    const [{ data: cd }, { data: qd }] = await Promise.all([
      supabase.from("courts").select("*").eq("session_id", sessionId).order("name"),
      supabase
        .from("queue_entries")
        .select("*, player:players(*)")
        .eq("session_id", sessionId)
        .in("status", ["playing", "waiting"])
        .order("joined_at"),
    ]);

    const allCourts = (cd as Court[]) ?? [];
    const allQueue  = (qd as QueueEntry[]) ?? [];

    setCourts(
      allCourts.map((court) => {
        const playingEntries = allQueue.filter(
          (q) => q.status === "playing" && q.skill_level === court.assigned_skill_level
        );
        const seenPlaying = new Set<string>();
        const uniquePlaying: QueueEntry[] = [];
        for (const p of playingEntries) {
          if (p.player && !seenPlaying.has(p.player_id)) {
            seenPlaying.add(p.player_id);
            uniquePlaying.push(p);
          }
        }

        const waitingEntries = allQueue.filter(
          (q) => q.status === "waiting" && q.skill_level === court.assigned_skill_level
        );
        const seenWaiting = new Set<string>();
        const uniqueWaiting: QueueEntry[] = [];
        for (const w of waitingEntries) {
          if (w.player && !seenWaiting.has(w.player_id)) {
            seenWaiting.add(w.player_id);
            uniqueWaiting.push(w);
          }
        }

        return {
          ...court,
          playingEntries: uniquePlaying.slice(0, playersNeeded),
          waitingEntries: uniqueWaiting.slice(0, playersNeeded),
        };
      })
    );
  }, [sessionId, playersNeeded]);

  useEffect(() => {
    fetchCourts();
    const supabase = createClient();
    const ch = supabase
      .channel("courts-panel-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "courts",        filter: `session_id=eq.${sessionId}` }, fetchCourts)
      .on("postgres_changes", { event: "*", schema: "public", table: "queue_entries", filter: `session_id=eq.${sessionId}` }, fetchCourts)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId, fetchCourts]);

  const handleCourtClick = (court: CourtWithPlayers) => {
    if (court.status === "occupied") {
      // Go to score page with this court pre-selected
      router.push(`/session/${sessionId}/score?court=${court.id}`);
    }
    // Available courts are not clickable for scoring
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {courts.map((court) => {
        const color       = SKILL_COLORS[court.assigned_skill_level] || "#6b7280";
        const isOccupied  = court.status === "occupied";
        const hasNext     = court.waitingEntries.length >= playersNeeded;

        return (
          <div
            key={court.id}
            onClick={() => handleCourtClick(court)}
            className="rounded-2xl p-4 relative overflow-hidden transition-all duration-200"
            style={{
              background: "var(--bg-card)",
              border: `1px solid ${isOccupied ? color + "50" : "var(--border)"}`,
              cursor: isOccupied ? "pointer" : "default",
              boxShadow: isOccupied ? `0 4px 20px ${color}20` : undefined,
            }}
          >
            {/* Skill color bar */}
            <div
              className="absolute top-0 left-0 w-1 h-full rounded-l-2xl"
              style={{ background: color }}
            />

            <div className="pl-2">
              {/* Court name + status */}
              <div className="flex items-start justify-between mb-1">
                <p className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
                  {court.name}
                </p>
                <span
                  className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold"
                  style={{
                    background: isOccupied ? "var(--court-occupied-bg)"  : "var(--court-available-bg)",
                    color:      isOccupied ? "var(--court-occupied-text)" : "var(--court-available-text)",
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      background: isOccupied
                        ? "var(--court-occupied-text)"
                        : "var(--court-available-text)",
                      animation: isOccupied ? "pulse 2s infinite" : undefined,
                    }}
                  />
                  {isOccupied ? "In Play" : "Available"}
                </span>
              </div>

              {/* Skill level */}
              <p className="text-xs capitalize mb-3" style={{ color }}>
                {court.assigned_skill_level.replace(/_/g, " ")}
              </p>

              {/* Occupied: show who's playing */}
              {isOccupied && court.playingEntries.length > 0 && (
                <div className="mb-3">
                  <p
                    className="text-[10px] font-bold uppercase tracking-widest mb-1.5"
                    style={{ color: "var(--text-faint)" }}
                  >
                    Now Playing
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {court.playingEntries.map((entry) => (
                      <span
                        key={entry.id}
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-medium"
                        style={{ background: color + "18", color }}
                      >
                        {gameMode === "singles"
                          ? <User size={11} />
                          : <Users size={11} />
                        }
                        {entry.player?.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Available: show who's next */}
              {!isOccupied && (
                <div>
                  {hasNext ? (
                    <>
                      <p
                        className="text-[10px] font-bold uppercase tracking-widest mb-1.5"
                        style={{ color: "var(--text-faint)" }}
                      >
                        Next Up
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {court.waitingEntries.map((entry) => (
                          <span
                            key={entry.id}
                            className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-medium"
                            style={{ background: "var(--bg-subtle)", color: "var(--text-muted)" }}
                          >
                            <Clock size={11} />
                            {entry.player?.name}
                          </span>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs" style={{ color: "var(--text-faint)" }}>
                      Waiting for {playersNeeded} players in queue
                    </p>
                  )}
                </div>
              )}

              {/* Occupied: tap to enter score hint */}
              {isOccupied && (
                <div
                  className="mt-3 flex items-center gap-1.5 text-xs font-semibold"
                  style={{ color }}
                >
                  <Trophy size={12} />
                  Tap to enter score
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
