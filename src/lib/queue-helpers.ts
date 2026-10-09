/**
 * queue-helpers.ts
 *
 * Shared post-match logic:
 *  1. Always re-insert finished players as "waiting" at the back of the queue
 *     (with doubles pairing rotation). They go AFTER any existing waiters.
 *  2. Re-fetch the full live waitlist (which now includes the re-queued players).
 *  3. If enough waiting players exist → promote the first N to the freed court.
 *  4. Otherwise → court stays "available"; the operator or a future submit handles it.
 *
 * This ensures finished players always rotate back into the queue and are never
 * permanently stuck in "done" status.
 */

import { createClient } from "@/lib/supabase/client";
import { Court, GameMode, SkillLevel } from "@/lib/types";

interface FinishedPlayer {
  id: string;
}

/**
 * Call this immediately after a match has been recorded and the court +
 * finished players have been marked done.
 *
 * @param sessionId       – the active session UUID
 * @param gameMode        – "singles" | "doubles"
 * @param court           – the court that just became available
 * @param finishedPlayers – ALL players from the finished match (team1 ++ team2)
 * @param team1Ids        – player IDs that formed team 1 (for pairing-rotation)
 * @param team2Ids        – player IDs that formed team 2 (for pairing-rotation)
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

  // ── Step A: Compute rotated player order ──────────────────────────────────
  //
  // For doubles (4 players) rotate the pairing so the same two people aren't
  // always on the same team back-to-back.
  //
  // The 3 unique pairings for P0..P3 (sorted):
  //   [P0,P1] vs [P2,P3]
  //   [P0,P2] vs [P1,P3]
  //   [P0,P3] vs [P1,P2]
  //
  // We pick randomly from the 2 remaining pairings (excluding the one just played).

  let rotatedPlayerIds: string[];

  if (gameMode === "doubles" && finishedPlayers.length === 4) {
    const sorted = finishedPlayers.map((p) => p.id).sort();
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

    const chosen = available[Math.floor(Math.random() * available.length)];
    rotatedPlayerIds = [...chosen[0], ...chosen[1]];
  } else {
    // Singles (or edge-case 2v1 doubles) — re-insert as-is
    rotatedPlayerIds = finishedPlayers.map((p) => p.id);
  }

  // ── Step B: Re-insert finished players as "waiting" ───────────────────────
  //
  // Always happens — regardless of how many players are waiting. Finished
  // players go to the BACK of the queue. Each entry gets a per-index 1 ms
  // offset so the relative order within this batch is stable even if two
  // courts finish within the same millisecond.
  //
  // De-duplication guard: skip any player who already has a "waiting" entry
  // (protects against partial-failure retries creating double entries).

  const { data: existingWaiting, error: existingErr } = await supabase
    .from("queue_entries")
    .select("player_id")
    .eq("session_id", sessionId)
    .eq("status", "waiting")
    .in("player_id", rotatedPlayerIds);

  if (existingErr) {
    throw new Error(`requeueAfterMatch: failed to check existing waiting entries — ${existingErr.message}`);
  }

  const alreadyWaiting = new Set((existingWaiting ?? []).map((e: { player_id: string }) => e.player_id));
  const toRequeue = rotatedPlayerIds.filter((pid) => !alreadyWaiting.has(pid));

  if (toRequeue.length > 0) {
    const baseTime = Date.now();
    const { error: insertErr } = await supabase.from("queue_entries").insert(
      toRequeue.map((pid, idx) => ({
        session_id: sessionId,
        player_id: pid,
        skill_level: court.assigned_skill_level as SkillLevel,
        status: "waiting",
        // Per-index 1 ms offset ensures stable FIFO ordering within the batch
        // and avoids ties when two courts finish simultaneously.
        joined_at: new Date(baseTime + idx).toISOString(),
      }))
    );

    if (insertErr) {
      throw new Error(`requeueAfterMatch: failed to re-insert finished players as waiting — ${insertErr.message}`);
    }
  }

  // ── Step C: Re-fetch the full live waitlist (includes re-queued players) ──

  const { data: freshWaitlistData, error: waitlistErr } = await supabase
    .from("queue_entries")
    .select("id, player_id, skill_level")
    .eq("session_id", sessionId)
    .eq("status", "waiting")
    .eq("skill_level", court.assigned_skill_level)
    .order("joined_at", { ascending: true });

  if (waitlistErr) {
    throw new Error(`requeueAfterMatch: failed to fetch fresh waitlist — ${waitlistErr.message}`);
  }

  const freshWaitlist = freshWaitlistData ?? [];

  // ── Step D: Promote to court if enough players are now waiting ────────────

  if (freshWaitlist.length >= needed) {
    const toPromote = freshWaitlist.slice(0, needed);

    const { error: courtErr } = await supabase
      .from("courts")
      .update({ status: "occupied" })
      .eq("id", court.id);

    if (courtErr) {
      throw new Error(`requeueAfterMatch: failed to mark court occupied — ${courtErr.message}`);
    }

    const { error: promoteErr } = await supabase
      .from("queue_entries")
      .update({ status: "playing" })
      .in("id", toPromote.map((w) => w.id))
      .eq("session_id", sessionId);

    if (promoteErr) {
      throw new Error(`requeueAfterMatch: failed to promote waiting players to playing — ${promoteErr.message}`);
    }
  }

  // If not enough players yet, court stays "available". The operator uses the
  // Queue page or the next score submission to kick off the following match.
}
