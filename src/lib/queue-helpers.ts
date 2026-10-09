/**
 * queue-helpers.ts
 *
 * Shared post-match logic:
 *  1. Recovery pass: any finished player still stuck in "done" status (e.g. from
 *     a previous partial failure) is restored to "waiting" so they re-enter the
 *     queue. Scoped to the court's skill_level to avoid cross-court contamination.
 *  2. Calls the Postgres RPC `requeue_after_match` which atomically:
 *       a. Re-inserts finished players as "waiting" at the back of the queue
 *          (with a de-dup guard so retries are safe).
 *       b. Re-fetches the full live waitlist (now including the re-queued players).
 *       c. If enough waiting players exist → promotes the first N to "playing"
 *          and marks the court "occupied".
 *       d. Otherwise → leaves the court "available".
 *
 * Running Steps 2a–2d inside a single Postgres transaction (via RPC) prevents
 * the race condition where two operators submit scores simultaneously and both
 * read the waitlist before either writes, causing double-promotion.
 *
 * For doubles (4 players), pairing rotation (Step A below) is computed client-side
 * and passed to the RPC as the ordered `p_requeued_ids` array. The RPC inserts
 * them in that order so the score page's slice(0,2)/slice(2,4) reconstitutes
 * the correct teams. No shuffle is applied — Step A's rotation is the sole
 * source of truth for team composition.
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

  const finishedIds = finishedPlayers.map((p) => p.id);

  // ── Recovery pass ─────────────────────────────────────────────────────────
  //
  // Detect any finished player still stuck in "done" status from a previous
  // partial run (e.g. requeueAfterMatch threw after the done-write but before
  // the RPC inserted a waiting entry). Re-insert them as "waiting" now so the
  // RPC's de-dup guard sees them as already handled.
  //
  // Scoped to court.assigned_skill_level (Finding 2) so a player who finished
  // on a different court at a different skill level is not accidentally
  // re-inserted into the wrong queue.

  const { data: stuckDone, error: stuckErr } = await supabase
    .from("queue_entries")
    .select("id, player_id")
    .eq("session_id", sessionId)
    .eq("status", "done")
    .eq("skill_level", court.assigned_skill_level)
    .in("player_id", finishedIds);

  if (stuckErr) {
    throw new Error(`requeueAfterMatch: failed to check for stuck-done players — ${stuckErr.message}`);
  }

  const stuckIds = (stuckDone ?? []).map((e: { id: string; player_id: string }) => e.player_id);

  if (stuckIds.length > 0) {
    // Only re-insert players who don't already have a waiting entry.
    const { data: alreadyWaitingForRecovery } = await supabase
      .from("queue_entries")
      .select("player_id")
      .eq("session_id", sessionId)
      .eq("status", "waiting")
      .eq("skill_level", court.assigned_skill_level)
      .in("player_id", stuckIds);

    const alreadyWaitingPlayerIds = new Set(
      (alreadyWaitingForRecovery ?? []).map((e: { player_id: string }) => e.player_id)
    );

    const trulyStuck = stuckIds.filter((pid: string) => !alreadyWaitingPlayerIds.has(pid));

    if (trulyStuck.length > 0) {
      const recoveryBase = Date.now() - 1000; // Place before the new re-inserts
      const { error: recoveryErr } = await supabase.from("queue_entries").insert(
        trulyStuck.map((pid: string, idx: number) => ({
          session_id: sessionId,
          player_id: pid,
          skill_level: court.assigned_skill_level as SkillLevel,
          status: "waiting",
          joined_at: new Date(recoveryBase + idx).toISOString(),
        }))
      );

      if (recoveryErr) {
        throw new Error(`requeueAfterMatch: failed to recover stuck-done players — ${recoveryErr.message}`);
      }
    }
  }

  // ── Step A: Compute rotated player order ──────────────────────────────────
  //
  // For doubles (4 players), rotate the pairing so the same two people aren't
  // always on the same team back-to-back.
  //
  // The 3 unique pairings for P0..P3 (sorted by id):
  //   [P0,P1] vs [P2,P3]
  //   [P0,P2] vs [P1,P3]
  //   [P0,P3] vs [P1,P2]
  //
  // We pick randomly from the 2 pairings that weren't just played.
  // The chosen order ([newTeam1..., newTeam2...]) is passed to the RPC as
  // p_requeued_ids. The RPC inserts entries in this order (with 1ms offsets),
  // so when the score page later slices by position it reconstitutes the teams.
  //
  // NO shuffle is applied here or in the RPC (Finding 4 — the rotation in
  // Step A is the sole source of truth for team composition).

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
    // Singles or 3-player edge case — re-insert as-is.
    rotatedPlayerIds = finishedPlayers.map((p) => p.id);
  }

  // ── Steps B–D: atomic rotation via Postgres RPC ───────────────────────────
  //
  // The RPC runs inside a single transaction, preventing the race condition
  // where two concurrent score submissions both read the waitlist before either
  // writes promotions (Finding 1).
  //
  // p_requeue_base_ms is the current epoch-ms. The RPC adds a per-index 1ms
  // offset so re-inserted entries sort after any existing waiters and have a
  // stable relative order within the batch.

  const { error: rpcErr } = await supabase.rpc("requeue_after_match", {
    p_session_id:      sessionId,
    p_court_id:        court.id,
    p_skill_level:     court.assigned_skill_level,
    p_needed:          needed,
    p_requeued_ids:    rotatedPlayerIds,
    p_requeue_base_ms: Date.now(),
  });

  if (rpcErr) {
    throw new Error(`requeueAfterMatch: RPC failed — ${rpcErr.message}`);
  }
}
