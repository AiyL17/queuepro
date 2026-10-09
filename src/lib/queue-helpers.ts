/**
 * queue-helpers.ts
 *
 * Post-match logic & court matchmaking:
 *  1. Calls the atomic Postgres RPC `requeue_after_match` which:
 *       a. Marks previous playing entries for the finished players as "done".
 *       b. Re-inserts finished players as "waiting" with rotation & game-count fairness.
 *       c. Re-fetches the live waitlist.
 *       d. If enough waiting players exist (>= needed), promotes the first N to "playing"
 *          and marks the court "occupied"; otherwise marks it "available".
 *
 * Running this in a single Postgres transaction eliminates race conditions,
 * double-promotion, and duplicate queue entries.
 */

import { createClient } from "@/lib/supabase/client";
import { Court, GameMode } from "@/lib/types";

interface FinishedPlayer {
  id: string;
}

/**
 * Call this immediately after a match score has been recorded.
 *
 * @param sessionId       – the active session UUID
 * @param gameMode        – "singles" | "doubles"
 * @param court           – the court that just completed its match
 * @param finishedPlayers – ALL players from the finished match (team1 ++ team2)
 * @param team1Ids        – player IDs that formed team 1 (for pairing rotation)
 * @param team2Ids        – player IDs that formed team 2 (for pairing rotation)
 */
export async function requeueAfterMatch(
  sessionId: string,
  gameMode: GameMode,
  court: Court,
  finishedPlayers: FinishedPlayer[],
  team1Ids: string[],
  team2Ids: string[]
): Promise<void> {
  const supabase = createClient();
  const needed = gameMode === "singles" ? 2 : 4;
  const finishedIds = finishedPlayers.map((p) => p.id);

  if (finishedIds.length === 0) return;

  // ── Step A: Fetch games played for fair rotation ─────────────────────────
  // In sessions with 5 or 6 players, some players will stay on court while
  // others sit out. Sorting players with fewer games played first ensures
  // everyone gets equal court time and nobody is benched twice in a row.
  const { data: scoreData } = await supabase
    .from("player_session_scores")
    .select("player_id, games_played")
    .eq("session_id", sessionId)
    .in("player_id", finishedIds);

  const gamesMap = new Map<string, number>();
  (scoreData ?? []).forEach((s: { player_id: string; games_played: number }) => {
    gamesMap.set(s.player_id, s.games_played);
  });

  let orderedPlayerIds: string[];

  if (gameMode === "doubles" && finishedPlayers.length === 4) {
    const sorted = [...finishedPlayers].map((p) => p.id).sort();
    const [P0, P1, P2, P3] = sorted;

    const allPairings: [string[], string[]][] = [
      [[P0, P1], [P2, P3]],
      [[P0, P2], [P1, P3]],
      [[P0, P3], [P1, P2]],
    ];

    const lastTeam1 = [...team1Ids].sort().join(",");
    const lastTeam2 = [...team2Ids].sort().join(",");

    const available = allPairings.filter(([t1, t2]) => {
      const t1key = [...t1].sort().join(",");
      const t2key = [...t2].sort().join(",");
      return !(
        (t1key === lastTeam1 && t2key === lastTeam2) ||
        (t1key === lastTeam2 && t2key === lastTeam1)
      );
    });

    const chosen = available.length > 0
      ? available[Math.floor(Math.random() * available.length)]
      : allPairings[0];

    const rotated = [...chosen[0], ...chosen[1]];

    // Check if players have uneven games played (e.g. in 5-player or 6-player sessions)
    const distinctGameCounts = new Set(finishedIds.map((id) => gamesMap.get(id) ?? 0));
    if (distinctGameCounts.size > 1) {
      // Prioritize players who have played fewer games so they get chosen first
      orderedPlayerIds = [...rotated].sort((a, b) => (gamesMap.get(a) ?? 0) - (gamesMap.get(b) ?? 0));
    } else {
      orderedPlayerIds = rotated;
    }
  } else {
    // Singles or uneven counts: sort by games played ASC
    orderedPlayerIds = [...finishedIds].sort((a, b) => (gamesMap.get(a) ?? 0) - (gamesMap.get(b) ?? 0));
  }

  // ── Step B: Atomic requeue & promotion via Postgres RPC ──────────────────
  const { error: rpcErr } = await supabase.rpc("requeue_after_match", {
    p_session_id:      sessionId,
    p_court_id:        court.id,
    p_skill_level:     court.assigned_skill_level,
    p_needed:          needed,
    p_requeued_ids:    orderedPlayerIds,
    p_requeue_base_ms: Date.now(),
  });

  if (rpcErr) {
    throw new Error(`requeueAfterMatch: RPC failed — ${rpcErr.message}`);
  }
}

/**
 * tryFillCourts
 *
 * Scans available courts in the session and, for each one that has
 * enough waiting players of the matching skill level, promotes those players
 * to "playing" and marks the court "occupied".
 */
export async function tryFillCourts(
  sessionId: string,
  gameMode: GameMode
): Promise<void> {
  const supabase = createClient();
  const needed = gameMode === "singles" ? 2 : 4;

  // 1. Get all courts for this session that are currently available
  const { data: courts, error: courtErr } = await supabase
    .from("courts")
    .select("*")
    .eq("session_id", sessionId)
    .eq("status", "available");

  if (courtErr || !courts || courts.length === 0) return;

  // 2. For each available court, check if enough matching players are waiting
  for (const court of courts as Court[]) {
    const { data: waiters, error: waiterErr } = await supabase
      .from("queue_entries")
      .select("id, player_id")
      .eq("session_id", sessionId)
      .eq("skill_level", court.assigned_skill_level)
      .eq("status", "waiting")
      .order("joined_at", { ascending: true })
      .limit(needed);

    if (waiterErr || !waiters || waiters.length < needed) continue;

    // Deduplicate waiters in case of anomalies
    const seen = new Set<string>();
    const uniqueWaiters = waiters.filter((w: { id: string; player_id: string }) => {
      if (seen.has(w.player_id)) return false;
      seen.add(w.player_id);
      return true;
    });

    if (uniqueWaiters.length < needed) continue;

    const ids = uniqueWaiters.slice(0, needed).map((w: { id: string; player_id: string }) => w.id);

    // 3. Promote the first N waiters to "playing"
    const { error: promoteErr } = await supabase
      .from("queue_entries")
      .update({ status: "playing" })
      .in("id", ids);

    if (promoteErr) continue;

    // 4. Mark court occupied
    await supabase
      .from("courts")
      .update({ status: "occupied" })
      .eq("id", court.id);
  }
}
