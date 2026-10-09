"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SKILL_LEVELS, SkillLevel, GameMode } from "@/lib/types";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  ArrowLeft, ArrowRight, Plus, X, Rocket, Loader2,
  UserPlus, User, Users, Check,
} from "lucide-react";
import { useToast } from "@/lib/toast";

interface CourtSetup  { name: string; skillLevel: SkillLevel; }
interface PlayerSetup { name: string; skillLevel: SkillLevel; }

const SKILL_COLORS: Record<SkillLevel, string> = {
  beginner:          "#3b82f6",
  advanced_beginner: "#8b5cf6",
  novice:            "#f59e0b",
  intermediate:      "#f97316",
  advanced:          "#ef4444",
};

export default function NewSessionPage() {
  const router = useRouter();
  const toast  = useToast();
  const [gameMode, setGameMode]           = useState<GameMode>("doubles");
  const [courts, setCourts]               = useState<CourtSetup[]>([{ name: "Court 1", skillLevel: "beginner" }]);
  const [players, setPlayers]             = useState<PlayerSetup[]>([]);
  const [playerName, setPlayerName]       = useState("");
  const [playerSkill, setPlayerSkill]     = useState<SkillLevel>("beginner");
  const [loading, setLoading]             = useState(false);
  const [step, setStep]                   = useState<1 | 2>(1);

  const addCourt    = () => setCourts([...courts, { name: `Court ${courts.length + 1}`, skillLevel: "beginner" }]);
  const removeCourt = (i: number) => { if (courts.length > 1) setCourts(courts.filter((_, idx) => idx !== i)); };
  const updateCourt = (i: number, field: keyof CourtSetup, value: string) => {
    const u = [...courts]; u[i] = { ...u[i], [field]: value }; setCourts(u);
  };

  const addPlayer = () => {
    if (!playerName.trim()) return;
    setPlayers([...players, { name: playerName.trim(), skillLevel: playerSkill }]);
    setPlayerName("");
  };
  const removePlayer = (i: number) => setPlayers(players.filter((_, idx) => idx !== i));

  const handleStart = async () => {
    if (players.length === 0) { toast.error("Add at least one player before starting."); return; }
    setLoading(true);
    try {
      const supabase = createClient();
      const playersPerCourt = gameMode === "singles" ? 2 : 4;

      // 1. Create session with a random organizer token for ownership verification
      const organizerToken = crypto.randomUUID();
      const { data: session, error: se } = await supabase
        .from("sessions")
        .insert({ mode: "guest", game_mode: gameMode, status: "active", organizer_token: organizerToken })
        .select().single();
      if (se) throw se;

      // 2. Create courts
      const { data: createdCourts, error: ce } = await supabase
        .from("courts")
        .insert(courts.map((c) => ({
          session_id: session.id,
          name: c.name,
          assigned_skill_level: c.skillLevel,
          status: "available",
        })))
        .select();
      if (ce) throw ce;

      // 3. Create players
      const createdPlayers: { id: string; skillLevel: SkillLevel }[] = [];
      for (const p of players) {
        const { data: player, error: pe } = await supabase
          .from("players")
          .insert({ session_id: session.id, name: p.name, skill_level: p.skillLevel, is_guest: true })
          .select().single();
        if (pe) throw pe;
        createdPlayers.push({ id: player.id, skillLevel: p.skillLevel });
      }

      // 4. Auto-assign players to courts by skill level
      //    Group players by skill level, group courts by skill level,
      //    fill courts first (status → occupied), remainder go to waiting queue.
      const courtsBySkill: Record<string, typeof createdCourts[0][]> = {};
      for (const c of createdCourts ?? []) {
        const sk = c.assigned_skill_level;
        if (!courtsBySkill[sk]) courtsBySkill[sk] = [];
        courtsBySkill[sk].push(c);
      }

      const playersBySkill: Record<string, string[]> = {};
      for (const p of createdPlayers) {
        if (!playersBySkill[p.skillLevel]) playersBySkill[p.skillLevel] = [];
        playersBySkill[p.skillLevel].push(p.id);
      }

      for (const skill of Object.keys(playersBySkill)) {
        const skillPlayers  = playersBySkill[skill];
        const skillCourts   = courtsBySkill[skill] ?? [];
        let playerIdx       = 0;

        // Fill each court with `playersPerCourt` players → mark them "playing"
        for (const court of skillCourts) {
          const batch = skillPlayers.slice(playerIdx, playerIdx + playersPerCourt);
          if (batch.length === playersPerCourt) {
            // Mark court occupied
            await supabase.from("courts").update({ status: "occupied" }).eq("id", court.id);
            // Insert queue entries as "playing"
            await supabase.from("queue_entries").insert(
              batch.map((pid) => ({
                session_id: session.id,
                player_id: pid,
                skill_level: skill,
                status: "playing",
              }))
            );
            playerIdx += playersPerCourt;
          }
        }

        // Remaining players → "waiting"
        const waiting = skillPlayers.slice(playerIdx);
        if (waiting.length > 0) {
          await supabase.from("queue_entries").insert(
            waiting.map((pid) => ({
              session_id: session.id,
              player_id: pid,
              skill_level: skill,
              status: "waiting",
            }))
          );
        }
      }

      localStorage.setItem("qp-last-session", session.id);
      localStorage.setItem(`qp-organizer-${session.id}`, organizerToken);
      router.push(`/session/${session.id}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create session");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen max-w-4xl mx-auto" style={{ background: "var(--bg-page)" }}>
      <header
        className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 sm:px-6 py-3 mb-0"
        style={{background: "var(--bg-page)",
          borderBottom: "1px solid var(--border-subtle)",
          backdropFilter: "blur(12px)",}}
      >
        {/* Left cluster */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => step === 2 ? setStep(1) : router.push("/")}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium transition-all hover:opacity-80 flex-shrink-0"
            style={{background: "var(--bg-card)", color: "var(--text-muted)", border: "1px solid var(--border)"}}
          >
            <ArrowLeft size={15} /> {step === 2 ? "Courts" : "Home"}
          </button>
          <div className="w-px h-4 flex-shrink-0 hidden sm:block" style={{background: "var(--border)"}} />
          <div className="hidden sm:block">
            <h1 className="text-sm font-black tracking-tight" style={{color: "var(--text-heading)"}}>New Session</h1>
            <p className="text-xs" style={{color: "var(--text-muted)"}}>
              Step {step} of 2 — {step === 1 ? "Game mode & courts" : "Add players"}
            </p>
          </div>
        </div>
        {/* Right cluster */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="flex gap-1.5">
            {[1, 2].map((s) => (
              <div
                key={s}
                className="h-1.5 rounded-full transition-all duration-300"
                style={{width: step >= s ? "28px" : "12px",
                  background: step >= s ? "var(--gradient-cta)" : "var(--step-inactive)",}}
              />
            ))}
          </div>
          <ThemeToggle />
        </div>
      </header>
      <div className="px-4 sm:px-6 pt-5 pb-6">
      {/* ── STEP 1 ── */}
      {step === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-slide-up">
          {/* Left col: Game Mode */}
          <div>
            <div className="mb-7">
              <div className="flex items-center gap-2 mb-1.5">
                <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>Game Mode</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "var(--bg-subtle)", color: "var(--text-muted)" }}>Format</span>
              </div>
              <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>How will matches be structured?</p>
              <div className="grid grid-cols-2 gap-4">
                {([
                  { value: "doubles" as GameMode, icon: <Users size={24} strokeWidth={2} />, label: "Doubles", sub: "2 vs 2 players", color: "#8b5cf6", bg: "rgba(139,92,246,0.12)" },
                  { value: "singles" as GameMode, icon: <User  size={24} strokeWidth={2} />, label: "Singles", sub: "1 vs 1 match", color: "#06b6d4", bg: "rgba(6,182,212,0.12)"   },
                ]).map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setGameMode(m.value)}
                    className="p-5 text-left rounded-3xl relative overflow-hidden transition-all duration-300 cursor-pointer group"
                    style={{
                      background: gameMode === m.value
                        ? `linear-gradient(145deg, var(--bg-card) 0%, ${m.color}10 100%)`
                        : "var(--bg-card)",
                      border: `1.5px solid ${gameMode === m.value ? m.color + "70" : "var(--border)"}`,
                      boxShadow: gameMode === m.value ? `0 8px 30px ${m.color}22, 0 0 0 1px ${m.color}30` : "0 2px 10px rgba(0,0,0,0.04)",
                      transform: gameMode === m.value ? "scale(1.02)" : "scale(1)",
                    }}
                  >
                    {gameMode === m.value && (
                      <div
                        className="absolute -top-10 -right-10 w-24 h-24 rounded-full pointer-events-none"
                        style={{ background: `radial-gradient(circle, ${m.color}25 0%, transparent 70%)` }}
                      />
                    )}
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110 shadow-sm"
                      style={{ background: m.bg, color: m.color }}
                    >
                      {m.icon}
                    </div>
                    <p className="text-base font-bold mb-1" style={{ color: gameMode === m.value ? m.color : "var(--text-heading)" }}>
                      {m.label}
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>{m.sub}</p>
                    {gameMode === m.value && (
                      <div
                        className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full"
                        style={{ background: m.color + "20", color: m.color, border: `1px solid ${m.color}40` }}
                      >
                        <Check size={11} strokeWidth={2.5} /> Active Mode
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right col: Courts */}
          <div className="flex flex-col min-w-0">
            <div className="mb-4 flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1.5">
                <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>
                  Courts Setup
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(124,58,237,0.15)", color: "#a78bfa" }}>
                  {courts.length} court{courts.length !== 1 ? "s" : ""}
                </span>
              </div>
              <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
                Name courts and assign target skill levels for each.
              </p>
              <div className="space-y-3.5 max-h-[380px] sm:max-h-[440px] overflow-y-auto pr-1">
                {courts.map((court, i) => {
                  const activeColor = SKILL_COLORS[court.skillLevel] || "#6b7280";
                  return (
                    <div
                      key={i}
                      className="p-4 rounded-3xl min-w-0 relative overflow-hidden transition-all duration-200"
                      style={{
                        background: "var(--bg-card)",
                        border: `1px solid var(--border)`,
                        boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
                      }}
                    >
                      <div className="flex gap-3 items-center mb-3 min-w-0">
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black flex-shrink-0"
                          style={{ background: activeColor + "20", color: activeColor }}
                        >
                          {i + 1}
                        </div>
                        <input
                          type="text"
                          value={court.name}
                          onChange={(e) => updateCourt(i, "name", e.target.value)}
                          className="flex-1 min-w-0 text-sm font-bold bg-transparent border-0 outline-none truncate"
                          style={{ color: "var(--text-primary)" }}
                          placeholder="Court name"
                        />
                        <button
                          onClick={() => removeCourt(i)}
                          disabled={courts.length === 1}
                          title="Remove court"
                          className="w-7 h-7 rounded-xl flex items-center justify-center disabled:opacity-20 flex-shrink-0 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                          style={{ background: "var(--error-bg)", color: "var(--error-text)", border: "1px solid var(--error-border)" }}
                        >
                          <X size={13} />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {SKILL_LEVELS.map((s) => (
                          <button
                            key={s.value}
                            onClick={() => updateCourt(i, "skillLevel", s.value)}
                            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all duration-200 flex-shrink-0 hover:scale-105 active:scale-95 cursor-pointer"
                            style={{
                              background: court.skillLevel === s.value ? SKILL_COLORS[s.value] + "22" : "var(--bg-subtle)",
                              color:      court.skillLevel === s.value ? SKILL_COLORS[s.value] : "var(--text-muted)",
                              border: `1px solid ${court.skillLevel === s.value ? SKILL_COLORS[s.value] + "55" : "transparent"}`,
                            }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: SKILL_COLORS[s.value] }} />
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              onClick={addCourt}
              className="w-full py-3.5 rounded-2xl text-xs font-bold hover:opacity-80 transition-all active:scale-[0.99] mb-8 flex items-center justify-center gap-2 cursor-pointer"
              style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1.5px dashed var(--border-hover)" }}
            >
              <Plus size={15} /> Add Another Court
            </button>
          </div>

          {/* Full-width CTA */}
          <div className="lg:col-span-2">
            <button
              onClick={() => setStep(2)}
              className="btn-primary w-full py-4 text-base font-bold flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:scale-[1.01] transition-all"
              style={{ background: "var(--gradient-cta)", boxShadow: "0 8px 30px rgba(124,58,237,0.3)" }}
            >
              Next: Add Players <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2 ── */}
      {step === 2 && (
        <div className="animate-slide-up">
          {/* Mode reminder */}
          <div
            className="flex items-center gap-3 px-5 py-3 rounded-2xl mb-6 text-sm"
            style={{
              background: gameMode === "doubles" ? "rgba(139,92,246,0.08)" : "rgba(6,182,212,0.08)",
              border: `1px solid ${gameMode === "doubles" ? "rgba(139,92,246,0.25)" : "rgba(6,182,212,0.25)"}`,
              color: gameMode === "doubles" ? "#a78bfa" : "#06b6d4",
            }}
          >
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: gameMode === "doubles" ? "rgba(139,92,246,0.15)" : "rgba(6,182,212,0.15)" }}>
              {gameMode === "doubles" ? <Users size={16} /> : <User size={16} />}
            </div>
            <div>
              <span className="font-bold capitalize">{gameMode} Mode</span>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                Each match will seat {gameMode === "doubles" ? "4" : "2"} players per court according to skill level.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left col: Add form */}
            <div>
              <div className="mb-4">
                <h2 className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "var(--text-faint)" }}>Add Players</h2>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  Enter player names and select their current skill level.
                </p>
              </div>

              <div
                className="p-5 rounded-3xl mb-4"
                style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "0 4px 20px rgba(0,0,0,0.04)" }}
              >
                <div
                  className="flex items-center gap-2.5 px-3.5 py-3 rounded-2xl mb-3.5"
                  style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}
                >
                  <User size={16} style={{ color: "var(--text-faint)", flexShrink: 0 }} />
                  <input
                    type="text"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addPlayer()}
                    placeholder="Enter player name..."
                    className="w-full text-sm font-semibold bg-transparent border-0 outline-none min-w-0"
                    style={{ color: "var(--text-primary)" }}
                  />
                </div>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {SKILL_LEVELS.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => setPlayerSkill(s.value)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200 flex-shrink-0 hover:scale-105 active:scale-95 cursor-pointer"
                      style={{
                        background: playerSkill === s.value ? SKILL_COLORS[s.value] + "22" : "var(--bg-subtle)",
                        color:      playerSkill === s.value ? SKILL_COLORS[s.value] : "var(--text-muted)",
                        border: `1px solid ${playerSkill === s.value ? SKILL_COLORS[s.value] + "55" : "transparent"}`,
                      }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: SKILL_COLORS[s.value] }} />
                      {s.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={addPlayer}
                  disabled={!playerName.trim()}
                  className="w-full py-3 rounded-2xl text-xs font-bold disabled:opacity-30 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                  style={{ background: "rgba(22,163,74,0.12)", color: "#4ade80", border: "1px solid rgba(22,163,74,0.25)" }}
                >
                  <UserPlus size={15} /> Add to Roster
                </button>
              </div>
            </div>

            {/* Right col: Player list */}
            <div className="min-w-0">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>
                  Registered Roster
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(34,197,94,0.15)", color: "#4ade80" }}>
                  {players.length} players
                </span>
              </div>

              {players.length === 0 ? (
                <div
                  className="rounded-3xl p-10 flex flex-col items-center text-center gap-3"
                  style={{ background: "var(--bg-card)", border: "1.5px dashed var(--border)" }}
                >
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "var(--bg-subtle)" }}>
                    <User size={24} style={{ color: "var(--text-faint)" }} />
                  </div>
                  <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>No players registered yet</p>
                  <p className="text-xs max-w-xs" style={{ color: "var(--text-muted)" }}>
                    Add players using the form on the left. They will be auto-assigned to courts based on skill level.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[380px] sm:max-h-[440px] overflow-y-auto pr-1">
                  {players.map((p, i) => {
                    const color = SKILL_COLORS[p.skillLevel];
                    const initials = p.name.slice(0, 2).toUpperCase();
                    return (
                      <div
                        key={i}
                        className="flex items-center gap-3 px-4 py-3 rounded-2xl min-w-0 group transition-all hover:scale-[1.01]"
                        style={{ background: "var(--bg-card)", border: "1px solid var(--border)", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}
                      >
                        {/* Avatar */}
                        <div className="relative flex-shrink-0">
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-black"
                            style={{ background: color + "20", color }}
                          >
                            {initials}
                          </div>
                          <div
                            className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold"
                            style={{ background: "var(--bg-page)", color: "var(--text-faint)", border: "1px solid var(--border)" }}
                          >
                            {i + 1}
                          </div>
                        </div>

                        {/* Name + Skill */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate leading-tight" style={{ color: "var(--text-primary)" }}>
                            {p.name}
                          </p>
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold capitalize mt-0.5" style={{ color }}>
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
                            {p.skillLevel.replace(/_/g, " ")}
                          </span>
                        </div>

                        <button
                          onClick={() => removePlayer(i)}
                          title="Remove player"
                          className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 transition-all opacity-70 group-hover:opacity-100 hover:scale-110 cursor-pointer"
                          style={{ background: "var(--error-bg)", color: "var(--error-text)", border: "1px solid var(--error-border)" }}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Full-width CTA */}
            <div className="lg:col-span-2">
              <button
                onClick={handleStart}
                disabled={loading || players.length === 0}
                className="btn-primary w-full py-4 text-base font-bold flex items-center justify-center gap-2 cursor-pointer transition-all duration-300"
                style={{
                  background: "var(--gradient-green)",
                  boxShadow: players.length > 0 ? "0 8px 30px rgba(34,197,94,0.35)" : "none",
                  opacity: players.length === 0 ? 0.4 : 1,
                }}
              >
                {loading ? (
                  <><Loader2 size={18} className="animate-spin" /> Preparing courts...</>
                ) : (
                  <><Rocket size={18} /> Launch Session · {players.length} player{players.length !== 1 ? "s" : ""}</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </main>
  );
}
