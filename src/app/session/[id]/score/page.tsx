"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Court, Player, GameMode } from "@/lib/types";
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

    const [{ data: courtData }, { data: sessionData }, { data: queueData }] = await Promise.all([
      supabase.from("courts").select("*").eq("id", preselectedCourtId).single(),
      supabase.from("sessions").select("game_mode").eq("id", sessionId).single(),
      supabase
        .from("queue_entries")
        .select("*, player:players(*)")
        .eq("session_id", sessionId)
        .eq("status", "playing"),
    ]);

    const mode = (sessionData?.game_mode ?? "doubles") as GameMode;
    setGameMode(mode);
    setCourt(courtData as Court);

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

    const allPlayerIds = [...team1, ...team2].map((p) => p.id);
    if (allPlayerIds.length === 0) { toast.error("No players found for this court"); return; }

    setSaving(true);
    try {
      const supabase = createClient();

      // Insert match
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

      // Free court + mark players done
      await supabase.from("courts").update({ status: "available" }).eq("id", court.id);
      await supabase.from("queue_entries")
        .update({ status: "done" })
        .in("player_id", allPlayerIds)
        .eq("session_id", sessionId)
        .eq("status", "playing");

      toast.success(`Score saved — ${s1}–${s2}`);
      setTimeout(() => router.push(`/session/${sessionId}`), 1500);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save score");
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

          {/* Score inputs */}
          <div
            className="rounded-2xl p-5 mb-5"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
          >
            {/* Score Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {/* Team 1 Score Card */}
              <div
                className="p-4 rounded-2xl transition-all duration-200"
                style={{
                  background: s1num > s2num && s1num > 0 ? "rgba(34,197,94,0.08)" : "var(--bg-card-alt)",
                  border: `1px solid ${s1num > s2num && s1num > 0 ? "rgba(34,197,94,0.3)" : "var(--border)"}`,
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full"
                    style={{
                      background: s1num > s2num && s1num > 0 ? "rgba(34,197,94,0.18)" : "var(--bg-subtle)",
                      color: s1num > s2num && s1num > 0 ? "var(--success-text)" : "var(--text-muted)",
                    }}>
                    {s1num > s2num && s1num > 0 && <Trophy size={11} />}
                    {gameMode === "singles" ? "Player 1" : "Team 1"}
                  </span>
                </div>

                <div className="flex items-center justify-center gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setTeam1Score(String(Math.max(0, s1num - 1)))}
                    className="w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer"
                    style={{ background: "rgba(124,58,237,0.12)", color: "#a78bfa", border: "1px solid rgba(124,58,237,0.25)" }}
                  >
                    <Minus size={16} />
                  </button>

                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={team1Score}
                    onChange={(e) => setTeam1Score(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="0"
                    className="w-20 text-center text-5xl font-black bg-transparent outline-none"
                    style={{ color: s1num > s2num && s1num > 0 ? "var(--success-text)" : "var(--text-primary)" }}
                  />

                  <button
                    type="button"
                    onClick={() => setTeam1Score(String(s1num + 1))}
                    className="w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer"
                    style={{ background: "rgba(124,58,237,0.12)", color: "#a78bfa", border: "1px solid rgba(124,58,237,0.25)" }}
                  >
                    <Plus size={16} />
                  </button>
                </div>

                <div className="flex items-center justify-center mt-2">
                  <button
                    type="button"
                    onClick={() => setTeam1Score("11")}
                    className="px-3 py-1 rounded-lg text-xs font-bold transition-all hover:opacity-90 active:scale-95 cursor-pointer"
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

              {/* Team 2 Score Card */}
              <div
                className="p-4 rounded-2xl transition-all duration-200"
                style={{
                  background: s2num > s1num && s2num > 0 ? "rgba(34,197,94,0.08)" : "var(--bg-card-alt)",
                  border: `1px solid ${s2num > s1num && s2num > 0 ? "rgba(34,197,94,0.3)" : "var(--border)"}`,
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full"
                    style={{
                      background: s2num > s1num && s2num > 0 ? "rgba(34,197,94,0.18)" : "var(--bg-subtle)",
                      color: s2num > s1num && s2num > 0 ? "var(--success-text)" : "var(--text-muted)",
                    }}>
                    {s2num > s1num && s2num > 0 && <Trophy size={11} />}
                    {gameMode === "singles" ? "Player 2" : "Team 2"}
                  </span>
                </div>

                <div className="flex items-center justify-center gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setTeam2Score(String(Math.max(0, s2num - 1)))}
                    className="w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer"
                    style={{ background: "rgba(124,58,237,0.12)", color: "#a78bfa", border: "1px solid rgba(124,58,237,0.25)" }}
                  >
                    <Minus size={16} />
                  </button>

                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={team2Score}
                    onChange={(e) => setTeam2Score(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="0"
                    className="w-20 text-center text-5xl font-black bg-transparent outline-none"
                    style={{ color: s2num > s1num && s2num > 0 ? "var(--success-text)" : "var(--text-primary)" }}
                  />

                  <button
                    type="button"
                    onClick={() => setTeam2Score(String(s2num + 1))}
                    className="w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer"
                    style={{ background: "rgba(124,58,237,0.12)", color: "#a78bfa", border: "1px solid rgba(124,58,237,0.25)" }}
                  >
                    <Plus size={16} />
                  </button>
                </div>

                <div className="flex items-center justify-center mt-2">
                  <button
                    type="button"
                    onClick={() => setTeam2Score("11")}
                    className="px-3 py-1 rounded-lg text-xs font-bold transition-all hover:opacity-90 active:scale-95 cursor-pointer"
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

            {/* Player cards — read-only, auto-populated */}
            <div className="grid grid-cols-2 gap-3">
              {/* Side 1 */}
              <div>
                <p
                  className="text-xs font-bold mb-2 flex items-center gap-1"
                  style={{ color: s1num > s2num ? "var(--success-text)" : "var(--text-muted)" }}
                >
                  {gameMode === "singles" ? <User size={11} /> : <Users size={11} />}
                  {gameMode === "singles" ? "Player 1" : "Team 1"}
                  {s1num > s2num && <Trophy size={11} />}
                </p>
                <div className="space-y-1.5">
                  {team1.length > 0 ? team1.map((p) => (
                    <div
                      key={p.id}
                      className="px-3 py-2 rounded-xl text-sm font-medium flex items-center justify-between gap-2"
                      style={{background: "var(--bg-subtle)", color: "var(--text-primary)"}}
                    >
                      <span>{p.name}</span>
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize flex-shrink-0"
                        style={{background: (SKILL_COLORS[p.skill_level] ?? "#6b7280") + "20",
                          color: SKILL_COLORS[p.skill_level] ?? "#6b7280",}}
                      >
                        {(p.skill_level ?? "").replace(/_/g, " ")}
                      </span>
                    </div>
                  )) : (
                    <div
                      className="px-3 py-2 rounded-xl text-sm"
                      style={{ background: "var(--bg-subtle)", color: "var(--text-faint)" }}
                    >
                      No players found
                    </div>
                  )}
                </div>
              </div>

              {/* Side 2 */}
              <div>
                <p
                  className="text-xs font-bold mb-2 flex items-center gap-1"
                  style={{ color: s2num > s1num ? "var(--success-text)" : "var(--text-muted)" }}
                >
                  {gameMode === "singles" ? <User size={11} /> : <Users size={11} />}
                  {gameMode === "singles" ? "Player 2" : "Team 2"}
                  {s2num > s1num && <Trophy size={11} />}
                </p>
                <div className="space-y-1.5">
                  {team2.length > 0 ? team2.map((p) => (
                    <div
                      key={p.id}
                      className="px-3 py-2 rounded-xl text-sm font-medium flex items-center justify-between gap-2"
                      style={{background: "var(--bg-subtle)", color: "var(--text-primary)"}}
                    >
                      <span>{p.name}</span>
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize flex-shrink-0"
                        style={{background: (SKILL_COLORS[p.skill_level] ?? "#6b7280") + "20",
                          color: SKILL_COLORS[p.skill_level] ?? "#6b7280",}}
                      >
                        {(p.skill_level ?? "").replace(/_/g, " ")}
                      </span>
                    </div>
                  )) : (
                    <div
                      className="px-3 py-2 rounded-xl text-sm"
                      style={{ background: "var(--bg-subtle)", color: "var(--text-faint)" }}
                    >
                      No players found
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Error / success */}

          <button
            onClick={handleSubmit}
            disabled={saving}
            className="btn-primary w-full py-4 text-base flex items-center justify-center gap-2"
            style={{
              background: "linear-gradient(135deg, #d97706, #b45309)",
              boxShadow: "0 4px 20px rgba(217,119,6,0.3)",
            }}
          >
            {saving ? (
              <><Loader2 size={18} className="animate-spin" /> Saving...</>
            ) : (
              <><Check size={18} /> Save Score</>
            )}
          </button>
        </>
      )}
      </div>
    </main>
  );
}
