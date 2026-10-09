"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Court, Player, QueueEntry, GameMode, SkillLevel, SKILL_LEVELS } from "@/lib/types";
import { requeueAfterMatch, tryFillCourts } from "@/lib/queue-helpers";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Trophy, Users, User, Check, Loader2, Copy, CheckCheck, Plus, Minus, X, Activity, ClipboardList, UserCheck, Swords, Radio, QrCode, ExternalLink } from "lucide-react";
import { BackButton } from "@/components/BackButton";
import { useToast } from "@/lib/toast";
import { useScrollPosition } from "@/hooks/useScroll";
import { Skeleton, SkeletonCourt } from "@/components/Skeleton";

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
  const params       = useParams();
  const router       = useRouter();
  const searchParams = useSearchParams();
  const sessionId    = params.id as string;

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
  const [showQr, setShowQr]           = useState(false);
  const [qrCopied, setQrCopied]       = useState(false);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [showAddCourt, setShowAddCourt] = useState(false);
  const [newCourtName, setNewCourtName] = useState("");
  const [newCourtSkill, setNewCourtSkill] = useState<SkillLevel>("beginner");
  const [addingCourt, setAddingCourt]   = useState(false);
  const toast = useToast();
  const scrollY = useScrollPosition();

  const checkinUrl = typeof window !== "undefined"
    ? `${window.location.origin}/session/${sessionId}/checkin`
    : "";

  // Show a personalised welcome toast when a player arrives from check-in
  useEffect(() => {
    const joinedName = searchParams.get("joined");
    if (joinedName) {
      toast.success(`🏓 Welcome, ${joinedName}! You're in the queue.`);
      // Clean the query param from the URL without re-navigating
      router.replace(`/session/${sessionId}`, { scroll: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const vibrate = (pattern: number[]) => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  };

  const fetchData = useCallback(async () => {
    const supabase = createClient();
    const [{ data: sd }, { data: cd }, { data: qd }] = await Promise.all([
      supabase.from("sessions").select("game_mode, organizer_token").eq("id", sessionId).single(),
      supabase.from("courts").select("*").eq("session_id", sessionId).order("name"),
      supabase.from("queue_entries")
        .select("*, player:players(*)")
        .eq("session_id", sessionId)
        .in("status", ["playing", "waiting"])
        .order("joined_at"),
    ]);

    const mode = (sd?.game_mode ?? "doubles") as GameMode;
    setGameMode(mode);

    // Verify organizer ownership via token stored in localStorage at session creation
    const localToken = typeof window !== "undefined"
      ? localStorage.getItem(`qp-organizer-${sessionId}`)
      : null;
    setIsOrganizer(!!localToken && localToken === sd?.organizer_token);

    const allQueue = (qd ?? []) as QueueEntry[];
    const needed = mode === "singles" ? 2 : 4;

    const courtsWithPlayers: CourtWithPlayers[] = ((cd ?? []) as Court[]).map((court) => {
      const playingEntries = allQueue.filter(
        (q) => q.status === "playing" && q.skill_level === court.assigned_skill_level
      );
      // Deduplicate by player_id to protect against any duplicate records
      const seenPlaying = new Set<string>();
      const uniquePlaying: QueueEntry[] = [];
      for (const entry of playingEntries) {
        if (entry.player && !seenPlaying.has(entry.player_id)) {
          seenPlaying.add(entry.player_id);
          uniquePlaying.push(entry);
        }
      }
      const playingPlayers = uniquePlaying
        .slice(0, needed)
        .map((q) => ({ ...(q.player as Player), queueEntryId: q.id }));
      return { ...court, playingPlayers };
    });

    // Deduplicate waitlist by player_id
    const seenWaitlist = new Set<string>();
    const uniqueWaitlist: QueueEntry[] = [];
    for (const q of allQueue.filter((e) => e.status === "waiting")) {
      if (q.player && !seenWaitlist.has(q.player_id)) {
        seenWaitlist.add(q.player_id);
        uniqueWaitlist.push(q);
      }
    }

    setCourts(courtsWithPlayers);
    setWaitlist(uniqueWaitlist);
    setLoading(false);

    // Heal any courts that should be occupied but aren't (e.g. after a page reload).
    tryFillCourts(sessionId, mode).catch(() => {});
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
    vibrate([30]);
    setWaitlist((prev) => prev.filter((w) => w.id !== queueEntryId));
    const supabase = createClient();
    // Update status to 'done' so fetchData (which queries 'playing' or 'waiting') won't reload it even if DELETE fails RLS
    await supabase.from("queue_entries").update({ status: "done" }).eq("id", queueEntryId);
    await supabase.from("queue_entries").delete().eq("id", queueEntryId);
  };

  const openScoreModal = (court: CourtWithPlayers) => {
    if (court.status !== "occupied") return;
    vibrate([20]);
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
    if (s1 > 11 || s2 > 11) { toast.error("Max score in pickleball is 11 points"); return; }
    vibrate([30, 50, 30]);
    setSaving(true);

    const { court, team1, team2 } = scoreModal;
    const allPlayers = [...team1, ...team2];

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
        await supabase.from("matches").insert({
          session_id: sessionId,
          court_id: court.id,
          game_mode: gameMode,
          team1_player_ids: team1.map((p) => p.id),
          team2_player_ids: team2.map((p) => p.id),
          team1_score: s1,
          team2_score: s2,
        });
      }

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

      // Requeue finished players / promote waitlisted players atomically.
      // (The RPC marks previous playing entries as done, inserts waiting entries,
      // and either occupies the court with next waiting players or marks it available).
      await requeueAfterMatch(
        sessionId,
        gameMode,
        court,
        allPlayers,
        team1.map((p) => p.id),
        team2.map((p) => p.id)
      );

      closeModal();
      fetchData();
    } catch (err: unknown) {
      toast.error(
        (err instanceof Error ? err.message : "Failed to save") +
          " — tap Save again to retry."
      );
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

  const openAddCourtModal = () => {
    setNewCourtName(`Court ${courts.length + 1}`);
    setNewCourtSkill("beginner");
    setShowAddCourt(true);
  };

  const handleAddCourt = async () => {
    if (!newCourtName.trim()) {
      toast.error("Please enter a court name");
      return;
    }
    setAddingCourt(true);
    try {
      const supabase = createClient();
      const { error: ce } = await supabase
        .from("courts")
        .insert({
          session_id: sessionId,
          name: newCourtName.trim(),
          assigned_skill_level: newCourtSkill,
          status: "available",
        });
      if (ce) throw ce;

      toast.success(`${newCourtName.trim()} added!`);
      setShowAddCourt(false);

      // Attempt to immediately auto-fill court if waiting players match
      await tryFillCourts(sessionId, gameMode);
      await fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to add court");
    } finally {
      setAddingCourt(false);
    }
  };

  const handleDeleteCourt = async (courtId: string, courtName: string) => {
    if (!isOrganizer) return;
    const court = courts.find((c) => c.id === courtId);
    if (court && court.status === "occupied") {
      toast.error("Cannot remove a court while a match is in progress");
      return;
    }
    if (!confirm(`Are you sure you want to remove ${courtName}?`)) return;
    try {
      const supabase = createClient();
      const { error } = await supabase.from("courts").delete().eq("id", courtId);
      if (error) throw error;
      toast.success(`${courtName} removed`);
      await fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to remove court");
    }
  };

  const s1num = parseInt(team1Score) || 0;
  const s2num = parseInt(team2Score) || 0;

  if (loading) return (
    <main className="min-h-screen max-w-5xl mx-auto px-4 sm:px-6 pt-5" style={{ background: "var(--bg-page)" }}>
      <div className="flex items-center gap-3 mb-6">
        <Skeleton className="w-8 h-8 rounded-full" />
        <Skeleton className="w-32 h-6" />
      </div>
      <div className="grid grid-cols-3 gap-3 mb-5">
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
      </div>
      <div className="flex flex-col lg:flex-row gap-5">
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SkeletonCourt />
          <SkeletonCourt />
          <SkeletonCourt />
          <SkeletonCourt />
        </div>
      </div>
    </main>
  );

  return (
    <main className="min-h-screen max-w-5xl mx-auto" style={{ background: "var(--bg-page)" }}>

      {/* ── Sticky top nav bar ── */}
      <header
        className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 sm:px-6 py-3 transition-all duration-300"
        style={{
          background: scrollY > 10 ? "var(--bg-page)" : "transparent",
          borderBottom: scrollY > 10 ? "1px solid var(--border-subtle)" : "1px solid transparent",
          backdropFilter: scrollY > 10 ? "blur(12px)" : "none",
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
            onClick={() => setShowQr(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold transition-all hover:opacity-90 hover:scale-105 active:scale-95 cursor-pointer"
            style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border)", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
            title="Show check-in QR code"
          >
            <QrCode size={13} />
            <span className="hidden sm:inline">QR Code</span>
          </button>
          <button
            onClick={() => router.push(`/session/${sessionId}/leaderboard`)}
            className="hidden lg:flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold transition-all hover:opacity-90 hover:scale-105 active:scale-95 cursor-pointer"
            style={{ background: "linear-gradient(135deg, #7c3aed, #9333ea)", color: "#ffffff", boxShadow: "0 4px 14px rgba(124,58,237,0.35)" }}
          >
            <Trophy size={13} className="text-amber-300" />
            <span>Leaderboard</span>
          </button>
          <ThemeToggle />
        </div>
      </header>

      {/* ── Page content ── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-5">

        {/* ── View-only notice for non-organizers ── */}
        {!loading && !isOrganizer && (
          <div
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl mb-4 text-xs font-semibold"
            style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", color: "#f59e0b" }}
          >
            <span className="text-base">👁️</span>
            <span>You are viewing this session as a <strong>player</strong>. Only the organizer can manage the queue, enter scores, or end the session.</span>
          </div>
        )}

        {/* ── Stats strip ── */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {/* Courts in Play */}
          <div
            className="rounded-2xl p-4 flex flex-col gap-1 relative overflow-hidden"
            style={{ background: "var(--error-bg)", border: "1px solid rgba(239,68,68,0.2)", boxShadow: "0 4px 20px rgba(239,68,68,0.08)" }}
          >
            <div className="absolute -top-3 -right-3 w-16 h-16 rounded-full opacity-20" style={{ background: "radial-gradient(circle, #ef4444, transparent)" }} />
            <div className="flex items-center justify-between mb-1">
              <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: "rgba(239,68,68,0.15)" }}>
                <Radio size={13} style={{ color: "var(--error-text)" }} />
              </div>
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--error-text)" }} />
            </div>
            <p className="text-2xl font-black leading-none" style={{ color: "var(--error-text)" }}>
              {courts.filter((c) => c.status === "occupied").length}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-70" style={{ color: "var(--error-text)" }}>In Play</p>
          </div>

          {/* Courts Available */}
          <div
            className="rounded-2xl p-4 flex flex-col gap-1 relative overflow-hidden"
            style={{ background: "var(--success-bg)", border: "1px solid rgba(34,197,94,0.2)", boxShadow: "0 4px 20px rgba(34,197,94,0.08)" }}
          >
            <div className="absolute -top-3 -right-3 w-16 h-16 rounded-full opacity-20" style={{ background: "radial-gradient(circle, #22c55e, transparent)" }} />
            <div className="flex items-center justify-between mb-1">
              <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: "rgba(34,197,94,0.15)" }}>
                <Check size={13} style={{ color: "var(--success-text)" }} />
              </div>
            </div>
            <p className="text-2xl font-black leading-none" style={{ color: "var(--success-text)" }}>
              {courts.filter((c) => c.status === "available").length}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-70" style={{ color: "var(--success-text)" }}>Available</p>
          </div>

          {/* Waiting */}
          <div
            className="rounded-2xl p-4 flex flex-col gap-1 relative overflow-hidden"
            style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", boxShadow: "0 4px 20px rgba(245,158,11,0.06)" }}
          >
            <div className="absolute -top-3 -right-3 w-16 h-16 rounded-full opacity-20" style={{ background: "radial-gradient(circle, #f59e0b, transparent)" }} />
            <div className="flex items-center justify-between mb-1">
              <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: "rgba(245,158,11,0.15)" }}>
                <Users size={13} style={{ color: "#f59e0b" }} />
              </div>
              {waitlist.length > 0 && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(245,158,11,0.2)", color: "#f59e0b" }}>LIVE</span>
              )}
            </div>
            <p className="text-2xl font-black leading-none" style={{ color: "#f59e0b" }}>{waitlist.length}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-70" style={{ color: "#f59e0b" }}>Waiting</p>
          </div>
        </div>

        {/* Main layout: Courts + Waitlist — stacked on mobile, side-by-side on lg+ */}
        <div className="flex flex-col lg:flex-row gap-5">

          {/* Courts */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>Courts</h2>
              <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "var(--bg-card)", color: "var(--text-faint)", border: "1px solid var(--border)" }}>{courts.length} total</span>
              {isOrganizer && (
                <button
                  type="button"
                  onClick={openAddCourtModal}
                  className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-sm ml-1"
                  style={{ background: "var(--gradient-cta)", color: "#fff", boxShadow: "0 2px 10px rgba(124,58,237,0.3)" }}
                  title="Add a new court to this session"
                >
                  <Plus size={13} strokeWidth={2.5} />
                  <span>Add Court</span>
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {courts.map((court) => {
                const color      = SKILL_COLORS[court.assigned_skill_level] || "#6b7280";
                const isOccupied = court.status === "occupied";
                const waitingCount = waitlist.filter((w) => w.skill_level === court.assigned_skill_level).length;

                return (
                  <div
                    key={court.id}
                    onClick={() => isOrganizer && openScoreModal(court)}
                    className="rounded-3xl p-5 relative overflow-hidden transition-all duration-300 group"
                    style={{
                      background: isOccupied
                        ? `linear-gradient(145deg, var(--bg-card) 0%, ${color}08 100%)`
                        : "var(--bg-card)",
                      border: `1px solid ${isOccupied ? color + "50" : "var(--border)"}`,
                      cursor: isOccupied && isOrganizer ? "pointer" : "default",
                      boxShadow: isOccupied ? `0 8px 32px ${color}20, 0 0 0 1px ${color}15` : "0 2px 8px rgba(0,0,0,0.04)",
                    }}
                  >
                    {/* Decorative glow blob for occupied courts */}
                    {isOccupied && (
                      <div
                        className="absolute -top-8 -right-8 w-28 h-28 rounded-full pointer-events-none"
                        style={{ background: `radial-gradient(circle, ${color}25 0%, transparent 70%)` }}
                      />
                    )}

                    {/* Top row: name + status badge */}
                    <div className="flex items-center justify-between mb-3 relative z-10">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs flex-shrink-0"
                          style={{ background: color + "20", color }}>
                          {court.name.replace(/[^0-9]/g, "") || court.name.slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-sm leading-tight" style={{ color: "var(--text-primary)" }}>{court.name}</p>
                          <span className="text-[10px] font-semibold capitalize" style={{ color }}>
                            {court.assigned_skill_level.replace(/_/g, " ")}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full font-bold flex-shrink-0"
                          style={{
                            background: isOccupied ? color + "18" : "var(--court-available-bg)",
                            color:      isOccupied ? color       : "var(--court-available-text)",
                            border: `1px solid ${isOccupied ? color + "40" : "transparent"}`,
                          }}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isOccupied ? "animate-pulse" : ""}`}
                            style={{ background: isOccupied ? color : "var(--court-available-text)" }}
                          />
                          {isOccupied ? "In Play" : "Available"}
                        </span>
                        {isOrganizer && !isOccupied && courts.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCourt(court.id, court.name);
                            }}
                            title={`Remove ${court.name}`}
                            className="w-6 h-6 rounded-full flex items-center justify-center text-[var(--text-faint)] hover:text-red-500 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Players currently playing */}
                    {isOccupied && court.playingPlayers.length > 0 && (
                      <div className="relative z-10">
                        {gameMode === "doubles" ? (
                          /* Doubles: Team 1 vs Team 2 with VS divider */
                          <div className="flex items-center gap-2 mb-3">
                            {/* Team 1 */}
                            <div className="flex-1 min-w-0">
                              <p className="text-[9px] font-black uppercase tracking-widest mb-1.5" style={{ color: color + "99" }}>Team 1</p>
                              <div className="flex flex-col gap-1">
                                {court.playingPlayers.slice(0, 2).map((p) => (
                                  <div key={p.id} className="flex items-center gap-1.5">
                                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black flex-shrink-0"
                                      style={{ background: color + "25", color }}>
                                      {p.name.slice(0, 1).toUpperCase()}
                                    </div>
                                    <span className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>{p.name}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            {/* VS chip */}
                            <div className="flex-shrink-0 flex flex-col items-center gap-1">
                              <div className="w-px h-5 rounded-full" style={{ background: color + "30" }} />
                              <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full" style={{ background: color + "15", color }}>
                                VS
                              </span>
                              <div className="w-px h-5 rounded-full" style={{ background: color + "30" }} />
                            </div>
                            {/* Team 2 */}
                            <div className="flex-1 min-w-0 text-right">
                              <p className="text-[9px] font-black uppercase tracking-widest mb-1.5" style={{ color: color + "99" }}>Team 2</p>
                              <div className="flex flex-col gap-1 items-end">
                                {court.playingPlayers.slice(2, 4).map((p) => (
                                  <div key={p.id} className="flex items-center gap-1.5">
                                    <span className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>{p.name}</span>
                                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black flex-shrink-0"
                                      style={{ background: color + "25", color }}>
                                      {p.name.slice(0, 1).toUpperCase()}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* Singles: Player vs Player */
                          <div className="flex items-center gap-2 mb-3">
                            <div className="flex-1 flex items-center gap-1.5 min-w-0">
                              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0"
                                style={{ background: color + "25", color }}>
                                {court.playingPlayers[0]?.name.slice(0, 1).toUpperCase()}
                              </div>
                              <span className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                                {court.playingPlayers[0]?.name}
                              </span>
                            </div>
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full flex-shrink-0"
                              style={{ background: color + "15", color }}>VS</span>
                            <div className="flex-1 flex items-center gap-1.5 min-w-0 justify-end">
                              <span className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                                {court.playingPlayers[1]?.name}
                              </span>
                              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0"
                                style={{ background: color + "25", color }}>
                                {court.playingPlayers[1]?.name.slice(0, 1).toUpperCase()}
                              </div>
                            </div>
                          </div>
                        )}
                        {/* Tap hint */}
                        <div
                          className="flex items-center justify-center gap-1.5 py-2 rounded-2xl text-xs font-bold opacity-0 group-hover:opacity-100 transition-all duration-200"
                          style={{ background: color + "12", color }}
                        >
                          <Trophy size={11} /> Tap to record score
                        </div>
                      </div>
                    )}

                    {/* Available state */}
                    {!isOccupied && (
                      <div className="relative z-10 flex flex-col items-center justify-center py-4 gap-3">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "var(--bg-subtle)" }}>
                          <Swords size={20} style={{ color: "var(--text-faint)" }} />
                        </div>
                        {waitingCount > 0 ? (
                          <div className="text-center">
                            <p className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>
                              {waitingCount} player{waitingCount !== 1 ? "s" : ""} waiting
                            </p>
                            <p className="text-[10px] mt-0.5" style={{ color: "var(--text-faint)" }}>
                              Needs {gameMode === "doubles" ? 4 : 2} to fill
                            </p>
                          </div>
                        ) : (
                          <p className="text-xs font-medium" style={{ color: "var(--text-faint)" }}>Court ready</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Waitlist sidebar */}
          <div className="w-full lg:w-80 lg:flex-shrink-0 lg:sticky lg:top-20 self-start">
            {/* Sidebar header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>Queue</h2>
                {waitlist.length > 0 && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full" style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}>
                    {waitlist.length} waiting
                  </span>
                )}
              </div>
              <div className="flex-1 mx-3 h-px" style={{ background: "var(--border)" }} />
              <UserCheck size={13} style={{ color: "var(--text-faint)" }} />
            </div>

            {waitlist.length === 0 ? (
              <div
                className="rounded-3xl p-8 flex flex-col items-center text-center gap-3 transition-all"
                style={{ background: "var(--bg-card)", border: "1px dashed var(--border-hover)" }}
              >
                <div className="relative w-16 h-16 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ background: "var(--success-text)" }} />
                  <div className="relative z-10 w-12 h-12 rounded-2xl flex items-center justify-center transform rotate-12 shadow-sm" style={{ background: "var(--bg-subtle)" }}>
                    <ClipboardList size={24} style={{ color: "var(--text-faint)" }} />
                  </div>
                  <div className="absolute -bottom-1 -right-1 z-20 w-6 h-6 rounded-full flex items-center justify-center shadow-md border-2" style={{ background: "var(--bg-card)", borderColor: "var(--bg-card)" }}>
                    <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ background: "var(--success-bg)", color: "var(--success-text)" }}>
                      <Check size={10} strokeWidth={3} />
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-bold mb-1" style={{ color: "var(--text-primary)" }}>All caught up!</p>
                  <p className="text-xs leading-relaxed max-w-[200px]" style={{ color: "var(--text-faint)" }}>
                    Nobody is waiting right now.
                  </p>
                </div>
              </div>
            ) : (
              <div
                className="rounded-3xl overflow-hidden flex flex-col shadow-sm"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
              >
                {/* Queue header row */}
                <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "var(--separator)", background: "var(--bg-subtle)" }}>
                  <div className="flex items-center gap-2">
                    <Activity size={12} style={{ color: "#f59e0b" }} />
                    <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-primary)" }}>
                      Waiting to play
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "var(--bg-card)", color: "var(--text-muted)", border: "1px solid var(--border)" }}>
                    {waitlist.length} in line
                  </span>
                </div>

                {/* Contained scrollable player list */}
                <div className="max-h-[380px] sm:max-h-[440px] overflow-y-auto overscroll-contain divide-y divide-[var(--separator)]">
                  {waitlist.map((entry, idx) => {
                    const color = SKILL_COLORS[entry.skill_level] || "#6b7280";
                    const initials = (entry.player?.name ?? "?").slice(0, 2).toUpperCase();
                    const isNextUp = idx < (gameMode === "doubles" ? 4 : 2);

                    return (
                      <div
                        key={entry.id}
                        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--bg-card-hover)] min-w-0 group"
                        style={{
                          background: isNextUp ? `${color}05` : undefined,
                        }}
                      >
                        {/* Avatar with queue number */}
                        <div className="relative flex-shrink-0">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-black shadow-sm"
                            style={{ background: color + "20", color }}>
                            {initials}
                          </div>
                          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black"
                            style={{ background: "var(--bg-page)", color: "var(--text-faint)", border: "1px solid var(--border)" }}>
                            {idx + 1}
                          </div>
                        </div>

                        {/* Player info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-bold truncate leading-tight" style={{ color: "var(--text-primary)" }}>
                              {entry.player?.name}
                            </p>
                            {isNextUp && (
                              <span className="text-[9px] font-black px-1.5 py-0.2 rounded-full uppercase flex-shrink-0"
                                style={{ background: "rgba(34,197,94,0.15)", color: "#4ade80" }}>
                                Next
                              </span>
                            )}
                          </div>
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold capitalize mt-0.5" style={{ color }}>
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
                            {entry.skill_level.replace(/_/g, " ")}
                          </span>
                        </div>

                        {isOrganizer && (
                        <button
                          type="button"
                          onClick={() => removeFromWaitlist(entry.id)}
                          title={`Remove ${entry.player?.name ?? "player"} from queue`}
                          className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 transition-all opacity-0 group-hover:opacity-100 hover:scale-110 cursor-pointer"
                          style={{ background: "var(--error-bg)", color: "var(--error-text)", border: "1px solid var(--error-border)" }}
                        >
                          <X size={12} />
                        </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Check-in shortcut — organizer only */}
            {isOrganizer && (
            <button
              onClick={() => router.push(`/session/${sessionId}/checkin`)}
              className="w-full mt-3 py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all hover:opacity-80 hover:scale-[1.01]"
              style={{ background: "rgba(22,163,74,0.10)", color: "#4ade80", border: "1px solid rgba(22,163,74,0.25)" }}
            >
              + Check in player
            </button>
            )}

            {/* End Session button — organizer only */}
            {isOrganizer && (
            <button
              onClick={() => setEndConfirm(true)}
              className="w-full mt-2 py-2.5 rounded-2xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all hover:opacity-90"
              style={{ background: "var(--error-bg)", color: "var(--error-text)", border: "1px solid var(--error-border)" }}
            >
              End Session
            </button>
            )}
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
                    disabled={s1num <= 0}
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:pointer-events-none cursor-pointer flex-shrink-0"
                    style={{ background: "rgba(124,58,237,0.12)", color: "#a78bfa", border: "1px solid rgba(124,58,237,0.25)" }}
                  >
                    <Minus size={14} />
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
                    className="w-12 sm:w-14 text-center text-3xl sm:text-4xl font-black bg-transparent outline-none min-w-0"
                    style={{ color: s1num > s2num && s1num > 0 ? "var(--success-text)" : "var(--text-primary)" }}
                    placeholder="0"
                  />

                  <button
                    type="button"
                    onClick={() => setTeam1Score(String(Math.min(11, s1num + 1)))}
                    disabled={s1num >= 11}
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:pointer-events-none cursor-pointer flex-shrink-0"
                    style={{ background: "rgba(124,58,237,0.12)", color: "#a78bfa", border: "1px solid rgba(124,58,237,0.25)" }}
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
                    disabled={s2num <= 0}
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:pointer-events-none cursor-pointer flex-shrink-0"
                    style={{ background: "rgba(124,58,237,0.12)", color: "#a78bfa", border: "1px solid rgba(124,58,237,0.25)" }}
                  >
                    <Minus size={14} />
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
                    className="w-12 sm:w-14 text-center text-3xl sm:text-4xl font-black bg-transparent outline-none min-w-0"
                    style={{ color: s2num > s1num && s2num > 0 ? "var(--success-text)" : "var(--text-primary)" }}
                    placeholder="0"
                  />

                  <button
                    type="button"
                    onClick={() => setTeam2Score(String(Math.min(11, s2num + 1)))}
                    disabled={s2num >= 11}
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:pointer-events-none cursor-pointer flex-shrink-0"
                    style={{ background: "rgba(124,58,237,0.12)", color: "#a78bfa", border: "1px solid rgba(124,58,237,0.25)" }}
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

      {/* ── QR Code Modal ── */}
      {showQr && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}
          onClick={() => setShowQr(false)}
        >
          <div
            className="relative w-full max-w-sm rounded-3xl p-6 flex flex-col gap-5"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "0 24px 64px rgba(0,0,0,0.3)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setShowQr(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center transition-all hover:opacity-80 cursor-pointer"
              style={{ background: "var(--bg-subtle)", color: "var(--text-muted)" }}
            >
              <X size={15} />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 pr-8">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: "linear-gradient(135deg, #7c3aed22, #9333ea22)", border: "1px solid rgba(124,58,237,0.3)" }}>
                <QrCode size={20} style={{ color: "#a78bfa" }} />
              </div>
              <div>
                <p className="font-black text-base leading-tight" style={{ color: "var(--text-heading)" }}>
                  Player Check-In QR
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--text-faint)" }}>
                  Scan to join this session directly
                </p>
              </div>
            </div>

            {/* QR Code image */}
            <div className="flex flex-col items-center gap-3">
              <div
                className="rounded-2xl p-4 flex items-center justify-center"
                style={{ background: "#ffffff", border: "1px solid var(--border)" }}
              >
                {checkinUrl ? (
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=0&data=${encodeURIComponent(checkinUrl)}`}
                    alt="Check-in QR code"
                    width={200}
                    height={200}
                    className="rounded-lg"
                  />
                ) : (
                  <div className="w-[200px] h-[200px] flex items-center justify-center" style={{ color: "var(--text-faint)" }}>
                    <Loader2 size={28} className="animate-spin" />
                  </div>
                )}
              </div>
              <p className="text-[10px] font-semibold text-center" style={{ color: "var(--text-faint)" }}>
                Point any phone camera at this code
              </p>
            </div>

            {/* Check-in URL pill */}
            <div
              className="flex items-center gap-2 rounded-xl px-3 py-2"
              style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}
            >
              <span className="text-[11px] font-mono truncate flex-1" style={{ color: "var(--text-muted)" }}>
                {checkinUrl}
              </span>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(checkinUrl).then(() => {
                    setQrCopied(true);
                    setTimeout(() => setQrCopied(false), 2000);
                  });
                }}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-xs font-bold transition-all hover:opacity-90 active:scale-95 cursor-pointer"
                style={{
                  background: qrCopied ? "var(--success-bg)" : "var(--bg-subtle)",
                  color: qrCopied ? "var(--success-text)" : "var(--text-primary)",
                  border: `1px solid ${qrCopied ? "rgba(34,197,94,0.3)" : "var(--border)"}`,
                }}
              >
                {qrCopied ? <><CheckCheck size={13} /> Copied!</> : <><Copy size={13} /> Copy Link</>}
              </button>
              <a
                href={checkinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-xs font-bold transition-all hover:opacity-90 active:scale-95 cursor-pointer"
                style={{ background: "linear-gradient(135deg, #7c3aed, #9333ea)", color: "#fff", boxShadow: "0 4px 14px rgba(124,58,237,0.3)" }}
              >
                <ExternalLink size={13} /> Open Link
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Court Modal ── */}
      {showAddCourt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
          style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}
          onClick={() => !addingCourt && setShowAddCourt(false)}
        >
          <div
            className="relative w-full max-w-sm rounded-3xl p-6 flex flex-col gap-5 animate-scale-in"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "0 24px 64px rgba(0,0,0,0.3)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setShowAddCourt(false)}
              disabled={addingCourt}
              className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center transition-all hover:opacity-80 cursor-pointer disabled:opacity-40"
              style={{ background: "var(--bg-subtle)", color: "var(--text-muted)" }}
            >
              <X size={15} />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 pr-8">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: "linear-gradient(135deg, #7c3aed22, #9333ea22)", border: "1px solid rgba(124,58,237,0.3)" }}
              >
                <Plus size={20} style={{ color: "#a78bfa" }} />
              </div>
              <div>
                <p className="font-black text-base leading-tight" style={{ color: "var(--text-heading)" }}>
                  Add Court
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--text-faint)" }}>
                  Add a new court to this session
                </p>
              </div>
            </div>

            {/* Court Name Input */}
            <div>
              <label className="block text-[10px] font-bold mb-1.5 tracking-widest uppercase" style={{ color: "var(--text-faint)" }}>
                Court Name
              </label>
              <input
                type="text"
                value={newCourtName}
                onChange={(e) => setNewCourtName(e.target.value)}
                placeholder="e.g. Court 2"
                className="w-full px-3.5 py-2.5 rounded-2xl text-sm font-bold outline-none transition-all"
                style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                autoFocus
              />
            </div>

            {/* Skill Level Selection */}
            <div>
              <label className="block text-[10px] font-bold mb-1.5 tracking-widest uppercase" style={{ color: "var(--text-faint)" }}>
                Assigned Skill Level
              </label>
              <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto">
                {SKILL_LEVELS.map((s) => {
                  const color = SKILL_COLORS[s.value] || "#6b7280";
                  const isSelected = newCourtSkill === s.value;
                  return (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setNewCourtSkill(s.value)}
                      className="flex items-center justify-between px-3 py-2 rounded-xl text-left text-xs font-bold transition-all cursor-pointer"
                      style={{
                        background: isSelected ? `${color}18` : "var(--bg-subtle)",
                        border: `1.5px solid ${isSelected ? color : "var(--border)"}`,
                        color: isSelected ? color : "var(--text-primary)",
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                        <span>{s.label}</span>
                      </div>
                      {isSelected && <Check size={14} style={{ color }} strokeWidth={3} />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAddCourt(false)}
                disabled={addingCourt}
                className="flex-1 py-2.5 rounded-2xl text-xs font-semibold hover:opacity-80 transition-all cursor-pointer"
                style={{ background: "var(--bg-subtle)", color: "var(--text-muted)" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddCourt}
                disabled={addingCourt || !newCourtName.trim()}
                className="flex-1 py-2.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer shadow-md"
                style={{
                  background: "linear-gradient(135deg, #7c3aed, #9333ea)",
                  color: "#fff",
                  boxShadow: "0 4px 14px rgba(124,58,237,0.35)",
                }}
              >
                {addingCourt ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Adding...
                  </>
                ) : (
                  <>
                    <Plus size={14} /> Add Court
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
