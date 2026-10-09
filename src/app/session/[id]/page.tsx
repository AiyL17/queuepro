"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Court, Player, QueueEntry, GameMode, SkillLevel } from "@/lib/types";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Trophy, Users, User, Check, Loader2, Copy, CheckCheck, Plus, Minus, X } from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { useToast } from "@/lib/toast";

const SKILL_COLORS: Record<string, string> = {
  beginner:          "#3b82f6",
  advanced_beginner: "#8b5cf6",
  novice:            "#f59e0b",
  intermediate:      "#f97316",
  advanced:          "#ef4444",
};

interface CourtWithPlayers extends Court {
  playingPlayers: (Player & { queueEntryId: string })[];
}

interface ScoreModal {
  court: CourtWithPlayers;
  team1: (Player & { queueEntryId: string })[];
  team2: (Player & { queueEntryId: string })[];
}

export default function SessionPage() {
  const params    = useParams();
  const router    = useRouter();
  const sessionId = params.id as string;

  const [gameMode, setGameMode]       = useState<GameMode>("doubles");
  const [courts, setCourts]           = useState<CourtWithPlayers[]>([]);
  const [waitlist, setWaitlist]       = useState<QueueEntry[]>([]);
  const [loading, setLoading]         = useState(true);
  const [copied, setCopied]           = useState(false);
  const [scoreModal, setScoreModal]   = useState<ScoreModal | null>(null);
  const [team1Score, setTeam1Score]   = useState("");
  const [team2Score, setTeam2Score]   = useState("");
  const [saving, setSaving]           = useState(false);
  const [endConfirm, setEndConfirm]   = useState(false);
  const [ending, setEnding]           = useState(false);
  const toast = useToast();

  const fetchData = useCallback(async () => {
    const supabase = createClient();
    const [{ data: sd }, { data: cd }, { data: qd }] = await Promise.all([
      supabase.from("sessions").select("game_mode").eq("id", sessionId).single(),
      supabase.from("courts").select("*").eq("session_id", sessionId).order("name"),
      supabase.from("queue_entries")
        .select("*, player:players(*)")
        .eq("session_id", sessionId)
        .in("status", ["playing", "waiting"])
        .order("joined_at"),
    ]);

    const mode = (sd?.game_mode ?? "doubles") as GameMode;
    setGameMode(mode);

    const allQueue = (qd ?? []) as QueueEntry[];

    const courtsWithPlayers: CourtWithPlayers[] = ((cd ?? []) as Court[]).map((court) => {
      const playingEntries = allQueue.filter(
        (q) => q.status === "playing" && q.skill_level === court.assigned_skill_level
      );
      const playingPlayers = playingEntries
        .filter((q) => q.player)
        .map((q) => ({ ...(q.player as Player), queueEntryId: q.id }));
      return { ...court, playingPlayers };
    });

    setCourts(courtsWithPlayers);
    setWaitlist(allQueue.filter((q) => q.status === "waiting"));
    setLoading(false);
  }, [sessionId]);

  useEffect(() => {
    fetchData();
    const supabase = createClient();
    const ch = supabase.channel("session-hub")
      .on("postgres_changes", { event: "*", schema: "public", table: "courts",        filter: `session_id=eq.${sessionId}` }, fetchData)
      .on("postgres_changes", { event: "*", schema: "public", table: "queue_entries", filter: `session_id=eq.${sessionId}` }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId, fetchData]);

  const removeFromWaitlist = async (queueEntryId: string) => {
    setWaitlist((prev) => prev.filter((w) => w.id !== queueEntryId));
    const supabase = createClient();
    // Update status to 'done' so fetchData (which queries 'playing' or 'waiting') won't reload it even if DELETE fails RLS
    await supabase.from("queue_entries").update({ status: "done" }).eq("id", queueEntryId);
    await supabase.from("queue_entries").delete().eq("id", queueEntryId);
  };

  const openScoreModal = (court: CourtWithPlayers) => {
    if (court.status !== "occupied") return;
    const half = gameMode === "singles" ? 1 : 2;
    setScoreModal({
      court,
      team1: court.playingPlayers.slice(0, half),
      team2: court.playingPlayers.slice(half, half * 2),
    });
    setTeam1Score(""); setTeam2Score("");
  };

  const closeModal = () => { setScoreModal(null); setTeam1Score(""); setTeam2Score(""); };

  const handleSaveScore = async () => {
    if (!scoreModal) return;
    const s1 = parseInt(team1Score), s2 = parseInt(team2Score);
    if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0) { toast.error("Enter valid scores"); return; }
    setSaving(true);

    const { court, team1, team2 } = scoreModal;
    const allPlayers = [...team1, ...team2];

    try {
      const supabase = createClient();

      // Insert match
      await supabase.from("matches").insert({
        session_id: sessionId,
        court_id: court.id,
        game_mode: gameMode,
        team1_player_ids: team1.map((p) => p.id),
        team2_player_ids: team2.map((p) => p.id),
        team1_score: s1,
        team2_score: s2,
      });

      // Individual scores
      for (const { id: pid, score } of [
        ...team1.map((p) => ({ id: p.id, score: s1 })),
        ...team2.map((p) => ({ id: p.id, score: s2 })),
      ]) {
        const { data: ex } = await supabase.from("player_session_scores")
          .select("*").eq("player_id", pid).eq("session_id", sessionId).single();
        if (ex) await supabase.from("player_session_scores")
          .update({ total_score: ex.total_score + score, games_played: ex.games_played + 1 })
          .eq("player_id", pid).eq("session_id", sessionId);
        else await supabase.from("player_session_scores")
          .insert({ player_id: pid, session_id: sessionId, total_score: score, games_played: 1 });
      }

      // Pair scores (doubles only)
      if (gameMode === "doubles" && team1.length === 2 && team2.length === 2) {
        for (const { pair, score } of [
          { pair: [team1[0].id, team1[1].id], score: s1 },
          { pair: [team2[0].id, team2[1].id], score: s2 },
        ]) {
          const [pid1, pid2] = [...pair].sort();
          const { data: ex } = await supabase.from("pair_scores")
            .select("*").eq("player1_id", pid1).eq("player2_id", pid2).eq("session_id", sessionId).single();
          if (ex) await supabase.from("pair_scores")
            .update({ total_score: ex.total_score + score, games_played: ex.games_played + 1 })
            .eq("player1_id", pid1).eq("player2_id", pid2).eq("session_id", sessionId);
          else await supabase.from("pair_scores")
            .insert({ player1_id: pid1, player2_id: pid2, session_id: sessionId, total_score: score, games_played: 1 });
        }
      }

      // Free court + mark players done
      await supabase.from("courts").update({ status: "available" }).eq("id", court.id);
      await supabase.from("queue_entries").update({ status: "done" })
        .in("player_id", allPlayers.map((p) => p.id))
        .eq("session_id", sessionId).eq("status", "playing");

      // Auto-assign next players to this freed court.
      // Priority 1: players in the waitlist for this skill level.
      // Priority 2: if no waitlist, re-queue the players who just finished.
      const needed = gameMode === "singles" ? 2 : 4;
      const nextWaiting = waitlist
        .filter((w) => w.skill_level === court.assigned_skill_level)
        .slice(0, needed);

      if (nextWaiting.length >= needed) {
        // Enough waitlisted players — assign them
        await supabase.from("courts").update({ status: "occupied" }).eq("id", court.id);
        await supabase.from("queue_entries").update({ status: "playing" })
          .in("player_id", nextWaiting.map((w) => w.player_id))
          .eq("session_id", sessionId);
      } else {
        // No (or not enough) waitlisted players — re-queue the same players
        // with a RANDOM pairing so teammates change each match.
        //
        // For doubles (4 players) there are exactly 3 unique pairings:
        //   [P0,P1] vs [P2,P3]
        //   [P0,P2] vs [P1,P3]
        //   [P0,P3] vs [P1,P2]
        // We pick one at random but EXCLUDE the pairing that was just played
        // so the same teammates are guaranteed not to repeat back-to-back.
        //
        // Singles: only 1 possible pairing — re-assign as-is.

        let rotatedPlayerIds: string[];

        if (gameMode === "doubles" && allPlayers.length === 4) {
          // Use sorted IDs as stable references
          const sorted = allPlayers.map((p) => p.id).sort();
          const [P0, P1, P2, P3] = sorted;

          // The 3 unique pairings expressed as [team1pair, team2pair]
          const allPairings: [string[], string[]][] = [
            [[P0, P1], [P2, P3]],
            [[P0, P2], [P1, P3]],
            [[P0, P3], [P1, P2]],
          ];

          // Identify which pairing was just played by comparing sorted team IDs
          const lastTeam1 = team1.map((p) => p.id).sort().join(",");
          const lastTeam2 = team2.map((p) => p.id).sort().join(",");

          const available = allPairings.filter(([t1, t2]) => {
            const t1key = [...t1].sort().join(",");
            const t2key = [...t2].sort().join(",");
            // Exclude if it's the same pairing in either orientation
            return !(
              (t1key === lastTeam1 && t2key === lastTeam2) ||
              (t1key === lastTeam2 && t2key === lastTeam1)
            );
          });

          // Pick randomly from the remaining 2 pairings
          const chosen = available[Math.floor(Math.random() * available.length)];
          rotatedPlayerIds = [...chosen[0], ...chosen[1]];
        } else {
          // Singles — only one possible match-up, re-assign as-is
          rotatedPlayerIds = allPlayers.map((p) => p.id);
        }

        // Re-insert queue entries as "waiting" in rotated order
        await supabase.from("queue_entries").insert(
          rotatedPlayerIds.map((pid) => ({
            session_id: sessionId,
            player_id: pid,
            skill_level: court.assigned_skill_level as SkillLevel,
            status: "waiting",
          }))
        );

        // Immediately flip them to "playing" and mark court occupied again
        await supabase.from("courts").update({ status: "occupied" }).eq("id", court.id);
        await supabase.from("queue_entries").update({ status: "playing" })
          .in("player_id", rotatedPlayerIds)
          .eq("session_id", sessionId)
          .eq("status", "waiting");
      }

      closeModal();
      fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally { setSaving(false); }
  };

  const copyId = () => {
    navigator.clipboard.writeText(sessionId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleEndSession = async () => {
    setEnding(true);
    try {
      const supabase = createClient();
      await supabase.from("sessions").update({ status: "ended" }).eq("id", sessionId);
      localStorage.removeItem("qp-last-session");
      router.push("/");
    } catch {
      setEnding(false);
      setEndConfirm(false);
    }
  };

  const s1num = parseInt(team1Score) || 0;
  const s2num = parseInt(team2Score) || 0;

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-page)" }}>
      <Loader2 size={28} className="animate-spin" style={{ color: "var(--text-faint)" }} />
    </main>
  );

  return (
    <main className="min-h-screen max-w-5xl mx-auto" style={{ background: "var(--bg-page)" }}>

      {/* ── Sticky top nav bar ── */}
      <header
        className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 sm:px-6 py-3"
        style={{
          background: "var(--bg-page)",
          borderBottom: "1px solid var(--border-subtle)",
          backdropFilter: "blur(12px)",
        }}
      >
        {/* Left cluster */}
        <div className="flex items-center gap-2 min-w-0">
          <BackButton href="/" label="Home" />
          <div className="hidden sm:block w-px h-5 flex-shrink-0" style={{ background: "var(--border)" }} />
          <div className="hidden sm:block min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-black tracking-tight leading-none" style={{ color: "var(--text-heading)" }}>
                Session Dashboard
              </h1>
              <span
                className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                style={{
                  background: gameMode === "doubles" ? "rgba(124,58,237,0.12)" : "rgba(6,182,212,0.12)",
                  color:      gameMode === "doubles" ? "#a78bfa" : "#06b6d4",
                }}
              >
                {gameMode === "doubles" ? <Users size={10} /> : <User size={10} />}
                {gameMode === "doubles" ? "2v2 Doubles" : "1v1 Singles"}
              </span>
            </div>
            <button
              onClick={copyId}
              className="flex items-center gap-1 text-[11px] font-mono mt-0.5 transition-all hover:opacity-80"
              style={{ color: copied ? "var(--success-text)" : "var(--text-faint)" }}
            >
              {copied ? <CheckCheck size={11} /> : <Copy size={11} />}
              <span className="truncate max-w-[140px]">{sessionId.slice(0, 16)}…</span>
            </button>
          </div>
        </div>

        {/* Right cluster */}
        <div className="flex gap-2 items-center flex-shrink-0">
          <button
            onClick={() => router.push(`/session/${sessionId}/leaderboard`)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold transition-all hover:opacity-90 hover:scale-105 active:scale-95 cursor-pointer"
            style={{ background: "linear-gradient(135deg, #7c3aed, #9333ea)", color: "#ffffff", boxShadow: "0 4px 14px rgba(124,58,237,0.35)" }}
          >
            <Trophy size={13} className="text-amber-300" />
            <span className="hidden sm:inline">Leaderboard</span>
          </button>
          <ThemeToggle />
        </div>
      </header>

      {/* ── Page content ── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-5">

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div
            className="rounded-2xl p-3 text-center"
            style={{ background: "var(--error-bg)", color: "var(--error-text)" }}
          >
            <p className="text-xl font-black leading-none mb-1">
              {courts.filter((c) => c.status === "occupied").length}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">Courts in play</p>
          </div>
          <div
            className="rounded-2xl p-3 text-center"
            style={{ background: "var(--success-bg)", color: "var(--success-text)" }}
          >
            <p className="text-xl font-black leading-none mb-1">
              {courts.filter((c) => c.status === "available").length}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">Courts available</p>
          </div>
          <div
            className="rounded-2xl p-3 text-center"
            style={{ background: "rgba(245,158,11,0.10)", color: "#f59e0b" }}
          >
            <p className="text-xl font-black leading-none mb-1">{waitlist.length}</p>
            <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">Waiting</p>
          </div>
        </div>

        {/* Main layout: Courts + Waitlist — stacked on mobile, side-by-side on lg+ */}
        <div className="flex flex-col lg:flex-row gap-5">

          {/* Courts */}
          <div className="flex-1 min-w-0">
            <h2 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "var(--text-faint)" }}>
              Courts
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {courts.map((court) => {
                const color      = SKILL_COLORS[court.assigned_skill_level] || "#6b7280";
                const isOccupied = court.status === "occupied";

                return (
                  <div
                    key={court.id}
                    onClick={() => openScoreModal(court)}
                    className="rounded-2xl p-4 relative overflow-hidden transition-all duration-200 group"
                    style={{
                      background: "var(--bg-card)",
                      border: `1px solid ${isOccupied ? color + "55" : "var(--border)"}`,
                      cursor: isOccupied ? "pointer" : "default",
                      boxShadow: isOccupied ? `0 4px 24px ${color}18` : undefined,
                    }}
                  >
                    {/* Skill color bar */}
                    <div className="absolute top-0 left-0 w-1 h-full rounded-l-2xl" style={{ background: color }} />

                    <div className="pl-2">
                      {/* Name + status */}
                      <div className="flex items-start justify-between mb-1">
                        <p className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>{court.name}</p>
                        <span
                          className="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-0.5 rounded-full font-bold"
                          style={{
                            background: isOccupied ? "var(--court-occupied-bg)"  : "var(--court-available-bg)",
                            color:      isOccupied ? "var(--court-occupied-text)" : "var(--court-available-text)",
                          }}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${isOccupied ? "pulse-ring" : ""}`}
                            style={{ background: isOccupied ? "var(--court-occupied-text)" : "var(--court-available-text)" }}
                          />
                          {isOccupied ? "In Play" : "Available"}
                        </span>
                      </div>

                      {/* Skill level pill badge */}
                      <span
                        className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full capitalize mb-3"
                        style={{ background: color + "22", color }}
                      >
                        {court.assigned_skill_level.replace(/_/g, " ")}
                      </span>

                      {/* Players currently playing */}
                      {isOccupied && court.playingPlayers.length > 0 && (
                        <>
                          {gameMode === "doubles" ? (
                            /* Doubles: show as 2 teams */
                            <div className="space-y-2 mb-3">
                              {[court.playingPlayers.slice(0, 2), court.playingPlayers.slice(2, 4)].map((team, ti) => (
                                <div key={ti}>
                                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1"
                                    style={{ color: "var(--text-faint)" }}>Team {ti + 1}</p>
                                  <div className="flex flex-wrap gap-1">
                                    {team.map((p) => (
                                      <span key={p.id}
                                        className="text-xs px-2 py-1 rounded-lg font-medium"
                                        style={{ background: color + "18", color }}>
                                        {p.name}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            /* Singles: show as Player 1 vs Player 2 */
                            <div className="flex items-center gap-2 mb-3">
                              {court.playingPlayers.map((p, pi) => (
                                <div key={p.id} className="flex items-center gap-1.5">
                                  {pi === 1 && <span className="text-xs font-bold" style={{ color: "var(--text-faint)" }}>vs</span>}
                                  <span className="text-xs px-2 py-1 rounded-lg font-medium"
                                    style={{ background: color + "18", color }}>{p.name}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {/* Tap hint — fades in on hover */}
                          <div className="flex items-center gap-1.5 text-xs font-semibold opacity-60 group-hover:opacity-100 transition-opacity" style={{ color }}>
                            <Trophy size={11} /> Tap to end match &amp; enter score
                          </div>
                        </>
                      )}

                      {/* Available: show who's next */}
                      {!isOccupied && (
                        <p className="text-xs" style={{ color: "var(--text-faint)" }}>
                          {waitlist.filter((w) => w.skill_level === court.assigned_skill_level).length} player(s) waiting
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Waitlist — full width on mobile, fixed sidebar on lg+ */}
          <div className="w-full lg:w-72 lg:flex-shrink-0">
            <h2 className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "var(--text-faint)" }}>
              Waitlist · {waitlist.length}
            </h2>

            {waitlist.length === 0 ? (
              <div
                className="rounded-2xl p-6 flex flex-col items-center text-center gap-2"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
              >
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center mb-1" style={{ background: "var(--bg-subtle)" }}>
                  <Users size={18} style={{ color: "var(--text-faint)" }} />
                </div>
                <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Queue is empty</p>
                <p className="text-xs leading-relaxed" style={{ color: "var(--text-faint)" }}>No players are waiting. Check in players to fill the courts.</p>
              </div>
            ) : (
              <div
                className="rounded-2xl overflow-hidden"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
              >
                {waitlist.map((entry, idx) => {
                  const color = SKILL_COLORS[entry.skill_level] || "#6b7280";
                  return (
                    <div
                      key={entry.id}
                      className="flex items-center gap-2.5 px-3.5 py-2.5 transition-all hover:bg-[var(--bg-card-hover)] min-w-0 group"
                      style={{ borderBottom: idx < waitlist.length - 1 ? "1px solid var(--separator)" : undefined }}
                    >
                      {/* Position badge */}
                      <span
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                        style={{ background: "var(--bg-subtle)", color: "var(--text-faint)" }}
                      >{idx + 1}</span>
                      {/* Player name + skill level */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{entry.player?.name}</p>
                        <p className="text-[10px] capitalize" style={{ color }}>{entry.skill_level.replace(/_/g, " ")}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFromWaitlist(entry.id)}
                        title={`Remove ${entry.player?.name ?? "player"} from waitlist`}
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

            {/* Check-in shortcut */}
            <button
              onClick={() => router.push(`/session/${sessionId}/checkin`)}
              className="w-full mt-3 py-2.5 rounded-2xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all hover:opacity-80"
              style={{ background: "rgba(22,163,74,0.10)", color: "#4ade80", border: "1px solid rgba(22,163,74,0.25)" }}
            >
              + Check in player
            </button>

            {/* End Session button — inside sidebar */}
            <button
              onClick={() => setEndConfirm(true)}
              className="w-full mt-2 py-2.5 rounded-2xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all hover:opacity-90"
              style={{ background: "var(--error-bg)", color: "var(--error-text)", border: "1px solid var(--error-border)" }}
            >
              End Session
            </button>
          </div>
        </div>

      </div>

      {/* ── End Session confirmation modal ── */}
      {endConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(10px)" }}
          onClick={(e) => { if (e.target === e.currentTarget && !ending) setEndConfirm(false); }}
        >
          <div
            className="w-full max-w-sm rounded-3xl p-6 animate-scale-in"
            style={{ background: "var(--bg-card)", border: "1px solid var(--error-border)", boxShadow: "0 20px 50px rgba(0,0,0,0.5)" }}
          >
            {/* Icon */}
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: "var(--error-bg)" }}
            >
              <X size={22} style={{ color: "var(--error-text)" }} />
            </div>

            {/* Copy */}
            <h3 className="text-lg font-black text-center tracking-tight mb-1" style={{ color: "var(--text-heading)" }}>
              End this session?
            </h3>
            <p className="text-sm text-center leading-relaxed mb-6" style={{ color: "var(--text-muted)" }}>
              This will close the session for all players. Scores and leaderboard data will be preserved, but the session cannot be reopened.
            </p>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => setEndConfirm(false)}
                disabled={ending}
                className="flex-1 py-3 rounded-2xl text-sm font-semibold transition-all hover:opacity-80 disabled:opacity-40"
                style={{ background: "var(--bg-subtle)", color: "var(--text-muted)" }}
              >
                Cancel
              </button>
              <button
                onClick={handleEndSession}
                disabled={ending}
                className="flex-1 py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: "var(--error-text)", color: "#fff" }}
              >
                {ending ? <><Loader2 size={15} className="animate-spin" /> Ending...</> : "End Session"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Score Modal ── */}
      {scoreModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 animate-fade-in"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(10px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div
            className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl p-4 sm:p-6 relative animate-scale-in"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-hover)", boxShadow: "0 20px 50px rgba(0,0,0,0.5)" }}
          >
            {/* Modal header */}
            <div className="mb-4 sm:mb-5 flex items-center justify-between min-w-0">
              <div className="min-w-0 flex-1 pr-2">
                <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: "var(--text-faint)" }}>
                  End Match
                </p>
                <h3 className="text-lg sm:text-xl font-black tracking-tight truncate" style={{ color: "var(--text-heading)" }}>
                  {scoreModal.court.name}
                </h3>
                <p className="text-xs capitalize truncate" style={{ color: "var(--text-muted)" }}>
                  {gameMode} · {scoreModal.court.assigned_skill_level.replace(/_/g, " ")}
                </p>
              </div>
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(124,58,237,0.12)", color: "#a78bfa" }}>
                <Trophy size={18} />
              </div>
            </div>

            {/* Score Cards */}
            <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-5">
              {/* Team 1 Card */}
              <div
                className="p-3 sm:p-3.5 rounded-2xl transition-all duration-200 min-w-0 flex flex-col justify-between"
                style={{
                  background: s1num > s2num && s1num > 0 ? "rgba(34,197,94,0.08)" : "var(--bg-card-alt)",
                  border: `1px solid ${s1num > s2num && s1num > 0 ? "rgba(34,197,94,0.3)" : "var(--border)"}`,
                }}
              >
                <div className="text-center mb-2 min-w-0">
                  <div className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full max-w-full truncate"
                    style={{
                      background: s1num > s2num && s1num > 0 ? "rgba(34,197,94,0.15)" : "var(--bg-subtle)",
                      color: s1num > s2num && s1num > 0 ? "var(--success-text)" : "var(--text-muted)",
                    }}>
                    {s1num > s2num && s1num > 0 && <Trophy size={10} className="flex-shrink-0" />}
                    <span className="truncate">{gameMode === "singles" ? "Player 1" : "Team 1"}</span>
                  </div>
                  <p className="text-xs mt-1 font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                    {gameMode === "singles" ? scoreModal.team1[0]?.name : scoreModal.team1.map((p) => p.name).join(" & ")}
                  </p>
                </div>

                {/* Score Stepper */}
                <div className="flex items-center justify-center gap-1 my-1.5">
                  <button
                    type="button"
                    onClick={() => setTeam1Score(String(Math.max(0, s1num - 1)))}
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer flex-shrink-0"
                    style={{ background: "var(--bg-subtle)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                  >
                    <Minus size={14} />
                  </button>

                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={team1Score}
                    onChange={(e) => setTeam1Score(e.target.value.replace(/[^0-9]/g, ""))}
                    className="w-12 sm:w-14 text-center text-3xl sm:text-4xl font-black bg-transparent outline-none min-w-0"
                    style={{ color: s1num > s2num && s1num > 0 ? "var(--success-text)" : "var(--text-primary)" }}
                    placeholder="0"
                  />

                  <button
                    type="button"
                    onClick={() => setTeam1Score(String(s1num + 1))}
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer flex-shrink-0"
                    style={{ background: "var(--bg-subtle)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                  >
                    <Plus size={14} />
                  </button>
                </div>

                {/* Pickleball Winner Preset (11 pts) */}
                <div className="flex items-center justify-center mt-1.5">
                  <button
                    type="button"
                    onClick={() => setTeam1Score("11")}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all hover:opacity-90 active:scale-95 cursor-pointer"
                    style={{
                      background: s1num === 11 ? "var(--gradient-green)" : "var(--bg-subtle)",
                      color: s1num === 11 ? "#fff" : "var(--text-muted)",
                      border: `1px solid ${s1num === 11 ? "rgba(34,197,94,0.4)" : "var(--border)"}`,
                    }}
                  >
                    11 pts
                  </button>
                </div>
              </div>

              {/* Team 2 Card */}
              <div
                className="p-3 sm:p-3.5 rounded-2xl transition-all duration-200 min-w-0 flex flex-col justify-between"
                style={{
                  background: s2num > s1num && s2num > 0 ? "rgba(34,197,94,0.08)" : "var(--bg-card-alt)",
                  border: `1px solid ${s2num > s1num && s2num > 0 ? "rgba(34,197,94,0.3)" : "var(--border)"}`,
                }}
              >
                <div className="text-center mb-2 min-w-0">
                  <div className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full max-w-full truncate"
                    style={{
                      background: s2num > s1num && s2num > 0 ? "rgba(34,197,94,0.15)" : "var(--bg-subtle)",
                      color: s2num > s1num && s2num > 0 ? "var(--success-text)" : "var(--text-muted)",
                    }}>
                    {s2num > s1num && s2num > 0 && <Trophy size={10} className="flex-shrink-0" />}
                    <span className="truncate">{gameMode === "singles" ? "Player 2" : "Team 2"}</span>
                  </div>
                  <p className="text-xs mt-1 font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                    {gameMode === "singles" ? scoreModal.team2[0]?.name : scoreModal.team2.map((p) => p.name).join(" & ")}
                  </p>
                </div>

                {/* Score Stepper */}
                <div className="flex items-center justify-center gap-1 my-1.5">
                  <button
                    type="button"
                    onClick={() => setTeam2Score(String(Math.max(0, s2num - 1)))}
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer flex-shrink-0"
                    style={{ background: "var(--bg-subtle)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                  >
                    <Minus size={14} />
                  </button>

                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={team2Score}
                    onChange={(e) => setTeam2Score(e.target.value.replace(/[^0-9]/g, ""))}
                    className="w-12 sm:w-14 text-center text-3xl sm:text-4xl font-black bg-transparent outline-none min-w-0"
                    style={{ color: s2num > s1num && s2num > 0 ? "var(--success-text)" : "var(--text-primary)" }}
                    placeholder="0"
                  />

                  <button
                    type="button"
                    onClick={() => setTeam2Score(String(s2num + 1))}
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer flex-shrink-0"
                    style={{ background: "var(--bg-subtle)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
                  >
                    <Plus size={14} />
                  </button>
                </div>

                {/* Pickleball Winner Preset (11 pts) */}
                <div className="flex items-center justify-center mt-1.5">
                  <button
                    type="button"
                    onClick={() => setTeam2Score("11")}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all hover:opacity-90 active:scale-95 cursor-pointer"
                    style={{
                      background: s2num === 11 ? "var(--gradient-green)" : "var(--bg-subtle)",
                      color: s2num === 11 ? "#fff" : "var(--text-muted)",
                      border: `1px solid ${s2num === 11 ? "rgba(34,197,94,0.4)" : "var(--border)"}`,
                    }}
                  >
                    11 pts
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={closeModal}
                className="flex-1 py-3 rounded-2xl text-sm font-semibold hover:opacity-80 transition-all cursor-pointer"
                style={{ background: "var(--bg-subtle)", color: "var(--text-muted)" }}>
                Cancel
              </button>
              <button onClick={handleSaveScore} disabled={saving}
                className="flex-1 py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                style={{ background: "linear-gradient(135deg, #16a34a, #059669)", color: "#fff", boxShadow: "0 4px 16px rgba(22,163,74,0.35)" }}>
                {saving ? <><Loader2 size={15} className="animate-spin" /> Saving...</> : <><Check size={15} /> Save Score</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
