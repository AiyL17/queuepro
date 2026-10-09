"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Court, Player, GameMode } from "@/lib/types";
import { requeueAfterMatch } from "@/lib/queue-helpers";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Loader2, Users, User, Trophy, Plus, Minus, Check } from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { useToast } from "@/lib/toast";

interface PlayingPlayer extends Player {
  queueEntryId: string;
}

const SKILL_COLORS: Record<string, string> = {
  beginner:          "#3b82f6",
  advanced_beginner: "#8b5cf6",
  novice:            "#f59e0b",
  intermediate:      "#f97316",
  advanced:          "#ef4444",
};

export default function ScorePage() {
  const params       = useParams();
  const router       = useRouter();
  const searchParams = useSearchParams();
  const sessionId    = params.id as string;
  const preselectedCourtId = searchParams.get("court");

  const [court, setCourt]           = useState<Court | null>(null);
  const [gameMode, setGameMode]     = useState<GameMode>("doubles");
  const [team1, setTeam1]           = useState<PlayingPlayer[]>([]);
  const [team2, setTeam2]           = useState<PlayingPlayer[]>([]);
  const [team1Score, setTeam1Score] = useState("");
  const [team2Score, setTeam2Score] = useState("");
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const toast = useToast();

  const fetchData = useCallback(async () => {
    if (!preselectedCourtId) { setLoading(false); return; }
    const supabase = createClient();

    // Round 1: fetch court and session in parallel (queue needs court.assigned_skill_level)
    const [{ data: courtData }, { data: sessionData }] = await Promise.all([
      supabase.from("courts").select("*").eq("id", preselectedCourtId).single(),
      supabase.from("sessions").select("game_mode").eq("id", sessionId).single(),
    ]);

    const mode = (sessionData?.game_mode ?? "doubles") as GameMode;
    const typedCourt = courtData as Court;
    setGameMode(mode);
    setCourt(typedCourt);

    // Round 2: fetch playing entries scoped to this court's skill level
    // (avoids picking up players from other courts in a multi-court session)
    const { data: queueData } = await supabase
      .from("queue_entries")
      .select("*, player:players(*)")
      .eq("session_id", sessionId)
      .eq("status", "playing")
      .eq("skill_level", typedCourt?.assigned_skill_level ?? "")
      .order("joined_at", { ascending: true });

    // Players currently playing — split evenly into two sides by join order
    const playing: PlayingPlayer[] = ((queueData ?? []) as Array<{ id: string; player: Player }>)
      .filter((q) => q.player)
      .map((q) => ({ ...q.player, queueEntryId: q.id }));

    const half = mode === "singles" ? 1 : 2;
    setTeam1(playing.slice(0, half));
    setTeam2(playing.slice(half, half * 2));
    setLoading(false);
  }, [preselectedCourtId, sessionId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmit = async () => {
    if (!court) { toast.error("No court selected"); return; }
    const s1 = parseInt(team1Score), s2 = parseInt(team2Score);
    if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0) { toast.error("Enter valid scores"); return; }
    if (s1 > 11 || s2 > 11) { toast.error("Max score in pickleball is 11 points"); return; }

    const allPlayerIds = [...team1, ...team2].map((p) => p.id);
    if (allPlayerIds.length === 0) { toast.error("No players found for this court"); return; }

    setSaving(true);
    try {
      const supabase = createClient();

      // Idempotency guard — skip the insert if a match for this court with
      // exactly these players was already recorded (e.g. a retry after the
      // insert succeeded but requeueAfterMatch threw). Finding 5.
      const t1ids = team1.map((p) => p.id).sort().join(",");
      const t2ids = team2.map((p) => p.id).sort().join(",");
      const { data: existingMatches } = await supabase
        .from("matches")
        .select("id, team1_player_ids, team2_player_ids")
        .eq("session_id", sessionId)
        .eq("court_id", court.id)
        .order("played_at", { ascending: false })
        .limit(5);

      const alreadyRecorded = (existingMatches ?? []).some((m: { id: string; team1_player_ids: string[]; team2_player_ids: string[] }) => {
        const mt1 = [...m.team1_player_ids].sort().join(",");
        const mt2 = [...m.team2_player_ids].sort().join(",");
        return (mt1 === t1ids && mt2 === t2ids) || (mt1 === t2ids && mt2 === t1ids);
      });

      if (!alreadyRecorded) {
        const { error: me } = await supabase.from("matches").insert({
          session_id: sessionId,
          court_id: court.id,
          game_mode: gameMode,
          team1_player_ids: team1.map((p) => p.id),
          team2_player_ids: team2.map((p) => p.id),
          team1_score: s1,
          team2_score: s2,
        });
        if (me) throw me;
      }

      // Update individual scores
      for (const { id: player_id, score } of [
        ...team1.map((p) => ({ id: p.id, score: s1 })),
        ...team2.map((p) => ({ id: p.id, score: s2 })),
      ]) {
        const { data: ex } = await supabase
          .from("player_session_scores")
          .select("*").eq("player_id", player_id).eq("session_id", sessionId).single();
        if (ex) {
          await supabase.from("player_session_scores")
            .update({ total_score: ex.total_score + score, games_played: ex.games_played + 1 })
            .eq("player_id", player_id).eq("session_id", sessionId);
        } else {
          await supabase.from("player_session_scores")
            .insert({ player_id, session_id: sessionId, total_score: score, games_played: 1 });
        }
      }

      // Pair scores — doubles only
      if (gameMode === "doubles" && team1.length === 2 && team2.length === 2) {
        for (const { pair, score } of [
          { pair: [team1[0].id, team1[1].id], score: s1 },
          { pair: [team2[0].id, team2[1].id], score: s2 },
        ]) {
          const [pid1, pid2] = [...pair].sort();
          const { data: ex } = await supabase
            .from("pair_scores")
            .select("*").eq("player1_id", pid1).eq("player2_id", pid2).eq("session_id", sessionId).single();
          if (ex) {
            await supabase.from("pair_scores")
              .update({ total_score: ex.total_score + score, games_played: ex.games_played + 1 })
              .eq("player1_id", pid1).eq("player2_id", pid2).eq("session_id", sessionId);
          } else {
            await supabase.from("pair_scores")
              .insert({ player1_id: pid1, player2_id: pid2, session_id: sessionId, total_score: score, games_played: 1 });
          }
        }
      }

      // Requeue finished players / promote waitlisted players atomically.
      // (The RPC marks previous playing entries as done, inserts waiting entries,
      // and either occupies the court with next waiting players or marks it available).
      await requeueAfterMatch(
        sessionId,
        gameMode,
        court,
        [...team1, ...team2],
        team1.map((p) => p.id),
        team2.map((p) => p.id)
      );

      toast.success(`Score saved — ${s1}–${s2}`);
      setTimeout(() => router.push(`/session/${sessionId}`), 1500);
    } catch (err: unknown) {
      toast.error(
        (err instanceof Error ? err.message : "Failed to save score") +
          " — tap Save Score again to retry."
      );
    } finally { setSaving(false); }
  };

  const s1num = parseInt(team1Score) || 0;
  const s2num = parseInt(team2Score) || 0;

  // ── No court param — shouldn't happen normally ──
  if (!preselectedCourtId) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--bg-page)" }}>
        <div className="text-center">
          <p className="text-lg font-bold mb-2" style={{ color: "var(--text-heading)" }}>No court selected</p>
          <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
            Tap an occupied court on the dashboard to enter a score.
          </p>
          <BackButton fallback={`/session/${sessionId}`} />        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen max-w-3xl mx-auto" style={{ background: "var(--bg-page)" }}>
      <header
        className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 sm:px-6 py-3"
        style={{background: "var(--bg-page)",
          borderBottom: "1px solid var(--border-subtle)",
          backdropFilter: "blur(12px)",}}
      >
        <div className="flex items-center gap-2 min-w-0">
          <BackButton fallback={`/session/${sessionId}`} />
          <div className="w-px h-4 flex-shrink-0" style={{background: "var(--border)"}} />
          <div>
            <h1 className="text-sm font-black tracking-tight" style={{color: "var(--text-heading)"}}>
              {court?.name ?? "Score Entry"}
            </h1>
            <p className="text-xs capitalize" style={{color: "var(--text-muted)"}}>
              {gameMode} · {court?.assigned_skill_level.replace(/_/g, " ") ?? ""}
            </p>
          </div>
        </div>
        <ThemeToggle />
      </header>

      <div className="px-4 sm:px-6 pt-5 pb-6">
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={28} className="animate-spin" style={{ color: "var(--text-faint)" }} />
        </div>
      ) : (
        <>

          {/* Score inputs & Match layout */}
          <div
            className="rounded-3xl p-6 mb-6 relative overflow-hidden"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.06)",
            }}
          >
            {/* Header / Match format info */}
            <div className="flex items-center justify-between mb-6 pb-4" style={{ borderBottom: "1px solid var(--separator)" }}>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: SKILL_COLORS[court?.assigned_skill_level ?? ""] || "#8b5cf6" }} />
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-heading)" }}>
                  {court?.name} · {gameMode === "doubles" ? "Doubles Match" : "Singles Match"}
                </span>
              </div>
              <span
                className="text-[10px] font-bold px-2.5 py-0.5 rounded-full capitalize"
                style={{
                  background: (SKILL_COLORS[court?.assigned_skill_level ?? ""] || "#8b5cf6") + "20",
                  color: SKILL_COLORS[court?.assigned_skill_level ?? ""] || "#8b5cf6",
                }}
              >
                {court?.assigned_skill_level.replace(/_/g, " ")}
              </span>
            </div>

            {/* Score Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
              {/* Team 1 Score Card */}
              <div
                className="p-5 rounded-3xl transition-all duration-300 relative overflow-hidden"
                style={{
                  background: s1num > s2num && s1num > 0
                    ? "linear-gradient(145deg, var(--bg-card-alt) 0%, rgba(34,197,94,0.12) 100%)"
                    : "var(--bg-card-alt)",
                  border: `1.5px solid ${s1num > s2num && s1num > 0 ? "rgba(34,197,94,0.4)" : "var(--border)"}`,
                  boxShadow: s1num > s2num && s1num > 0 ? "0 8px 28px rgba(34,197,94,0.15)" : "none",
                }}
              >
                {s1num > s2num && s1num > 0 && (
                  <div
                    className="absolute -top-8 -right-8 w-24 h-24 rounded-full pointer-events-none"
                    style={{ background: "radial-gradient(circle, rgba(34,197,94,0.25) 0%, transparent 70%)" }}
                  />
                )}
                <div className="flex items-center justify-between mb-4">
                  <span
                    className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full"
                    style={{
                      background: s1num > s2num && s1num > 0 ? "rgba(34,197,94,0.2)" : "var(--bg-subtle)",
                      color: s1num > s2num && s1num > 0 ? "var(--success-text)" : "var(--text-muted)",
                      border: `1px solid ${s1num > s2num && s1num > 0 ? "rgba(34,197,94,0.3)" : "transparent"}`,
                    }}
                  >
                    {s1num > s2num && s1num > 0 && <Trophy size={12} className="text-amber-400" />}
                    {gameMode === "singles" ? "Player 1" : "Team 1"}
                  </span>
                  {s1num > s2num && s1num > 0 && (
                    <span className="text-[10px] font-black tracking-widest text-emerald-400 uppercase">WINNING</span>
                  )}
                </div>

                {/* Score Stepper */}
                <div className="flex items-center justify-center gap-3 mb-4">
                  <button
                    type="button"
                    onClick={() => setTeam1Score(String(Math.max(0, s1num - 1)))}
                    disabled={s1num <= 0}
                    className="w-11 h-11 rounded-2xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:pointer-events-none cursor-pointer shadow-sm"
                    style={{ background: "var(--bg-card)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
                  >
                    <Minus size={16} strokeWidth={2.5} />
                  </button>

                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={2}
                    value={team1Score}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, "");
                      if (!val) { setTeam1Score(""); return; }
                      const num = parseInt(val, 10);
                      setTeam1Score(String(Math.min(11, num)));
                    }}
                    placeholder="0"
                    className="w-24 text-center text-5xl font-black bg-transparent outline-none"
                    style={{ color: s1num > s2num && s1num > 0 ? "var(--success-text)" : "var(--text-heading)" }}
                  />

                  <button
                    type="button"
                    onClick={() => setTeam1Score(String(Math.min(11, s1num + 1)))}
                    disabled={s1num >= 11}
                    className="w-11 h-11 rounded-2xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:pointer-events-none cursor-pointer shadow-sm"
                    style={{ background: "rgba(124,58,237,0.15)", color: "#a78bfa", border: "1px solid rgba(124,58,237,0.3)" }}
                  >
                    <Plus size={16} strokeWidth={2.5} />
                  </button>
                </div>

                <div className="flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => setTeam1Score("11")}
                    className="px-4 py-1.5 rounded-xl text-xs font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer"
                    style={{
                      background: s1num === 11 ? "var(--gradient-green)" : "var(--bg-card)",
                      color: s1num === 11 ? "#fff" : "var(--text-muted)",
                      border: `1px solid ${s1num === 11 ? "rgba(34,197,94,0.4)" : "var(--border)"}`,
                      boxShadow: s1num === 11 ? "0 4px 12px rgba(34,197,94,0.3)" : "none",
                    }}
                  >
                    Set to 11 pts
                  </button>
                </div>
              </div>

              {/* Team 2 Score Card */}
              <div
                className="p-5 rounded-3xl transition-all duration-300 relative overflow-hidden"
                style={{
                  background: s2num > s1num && s2num > 0
                    ? "linear-gradient(145deg, var(--bg-card-alt) 0%, rgba(34,197,94,0.12) 100%)"
                    : "var(--bg-card-alt)",
                  border: `1.5px solid ${s2num > s1num && s2num > 0 ? "rgba(34,197,94,0.4)" : "var(--border)"}`,
                  boxShadow: s2num > s1num && s2num > 0 ? "0 8px 28px rgba(34,197,94,0.15)" : "none",
                }}
              >
                {s2num > s1num && s2num > 0 && (
                  <div
                    className="absolute -top-8 -right-8 w-24 h-24 rounded-full pointer-events-none"
                    style={{ background: "radial-gradient(circle, rgba(34,197,94,0.25) 0%, transparent 70%)" }}
                  />
                )}
                <div className="flex items-center justify-between mb-4">
                  <span
                    className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full"
                    style={{
                      background: s2num > s1num && s2num > 0 ? "rgba(34,197,94,0.2)" : "var(--bg-subtle)",
                      color: s2num > s1num && s2num > 0 ? "var(--success-text)" : "var(--text-muted)",
                      border: `1px solid ${s2num > s1num && s2num > 0 ? "rgba(34,197,94,0.3)" : "transparent"}`,
                    }}
                  >
                    {s2num > s1num && s2num > 0 && <Trophy size={12} className="text-amber-400" />}
                    {gameMode === "singles" ? "Player 2" : "Team 2"}
                  </span>
                  {s2num > s1num && s2num > 0 && (
                    <span className="text-[10px] font-black tracking-widest text-emerald-400 uppercase">WINNING</span>
                  )}
                </div>

                {/* Score Stepper */}
                <div className="flex items-center justify-center gap-3 mb-4">
                  <button
                    type="button"
                    onClick={() => setTeam2Score(String(Math.max(0, s2num - 1)))}
                    disabled={s2num <= 0}
                    className="w-11 h-11 rounded-2xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:pointer-events-none cursor-pointer shadow-sm"
                    style={{ background: "var(--bg-card)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
                  >
                    <Minus size={16} strokeWidth={2.5} />
                  </button>

                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={2}
                    value={team2Score}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, "");
                      if (!val) { setTeam2Score(""); return; }
                      const num = parseInt(val, 10);
                      setTeam2Score(String(Math.min(11, num)));
                    }}
                    placeholder="0"
                    className="w-24 text-center text-5xl font-black bg-transparent outline-none"
                    style={{ color: s2num > s1num && s2num > 0 ? "var(--success-text)" : "var(--text-heading)" }}
                  />

                  <button
                    type="button"
                    onClick={() => setTeam2Score(String(Math.min(11, s2num + 1)))}
                    disabled={s2num >= 11}
                    className="w-11 h-11 rounded-2xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:pointer-events-none cursor-pointer shadow-sm"
                    style={{ background: "rgba(124,58,237,0.15)", color: "#a78bfa", border: "1px solid rgba(124,58,237,0.3)" }}
                  >
                    <Plus size={16} strokeWidth={2.5} />
                  </button>
                </div>

                <div className="flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => setTeam2Score("11")}
                    className="px-4 py-1.5 rounded-xl text-xs font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer"
                    style={{
                      background: s2num === 11 ? "var(--gradient-green)" : "var(--bg-card)",
                      color: s2num === 11 ? "#fff" : "var(--text-muted)",
                      border: `1px solid ${s2num === 11 ? "rgba(34,197,94,0.4)" : "var(--border)"}`,
                      boxShadow: s2num === 11 ? "0 4px 12px rgba(34,197,94,0.3)" : "none",
                    }}
                  >
                    Set to 11 pts
                  </button>
                </div>
              </div>
            </div>

            {/* Players roster layout */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t" style={{ borderColor: "var(--separator)" }}>
              {/* Side 1 Players */}
              <div>
                <p className="text-xs font-bold mb-2.5 uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
                  {gameMode === "singles" ? "Player 1" : "Team 1 Roster"}
                </p>
                <div className="space-y-2">
                  {team1.map((p) => {
                    const color = SKILL_COLORS[p.skill_level ?? ""] || "#8b5cf6";
                    return (
                      <div
                        key={p.id}
                        className="px-3.5 py-2.5 rounded-2xl text-sm font-semibold flex items-center justify-between gap-2.5"
                        style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0"
                            style={{ background: color + "25", color }}
                          >
                            {p.name.slice(0, 1).toUpperCase()}
                          </div>
                          <span className="truncate" style={{ color: "var(--text-heading)" }}>{p.name}</span>
                        </div>
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize flex-shrink-0"
                          style={{ background: color + "20", color }}
                        >
                          {(p.skill_level ?? "").replace(/_/g, " ")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Side 2 Players */}
              <div>
                <p className="text-xs font-bold mb-2.5 uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
                  {gameMode === "singles" ? "Player 2" : "Team 2 Roster"}
                </p>
                <div className="space-y-2">
                  {team2.map((p) => {
                    const color = SKILL_COLORS[p.skill_level ?? ""] || "#8b5cf6";
                    return (
                      <div
                        key={p.id}
                        className="px-3.5 py-2.5 rounded-2xl text-sm font-semibold flex items-center justify-between gap-2.5"
                        style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0"
                            style={{ background: color + "25", color }}
                          >
                            {p.name.slice(0, 1).toUpperCase()}
                          </div>
                          <span className="truncate" style={{ color: "var(--text-heading)" }}>{p.name}</span>
                        </div>
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize flex-shrink-0"
                          style={{ background: color + "20", color }}
                        >
                          {(p.skill_level ?? "").replace(/_/g, " ")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Action button */}
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="btn-primary w-full py-4 text-base font-bold flex items-center justify-center gap-2 cursor-pointer transition-all duration-300 shadow-xl hover:scale-[1.01] active:scale-[0.99]"
            style={{
              background: "var(--gradient-green)",
              boxShadow: "0 8px 30px rgba(34,197,94,0.35)",
            }}
          >
            {saving ? (
              <><Loader2 size={18} className="animate-spin" /> Recording score &amp; updating queue...</>
            ) : (
              <><Check size={18} strokeWidth={2.5} /> Save Final Score</>
            )}
          </button>
        </>
      )}
      </div>
    </main>
  );
}
