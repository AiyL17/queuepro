/**
 * queue-helpers.ts
 *
 * Shared post-match logic:
 *  1. Fetch a LIVE waitlist from the DB (avoids stale React-state reads).
 *  2. If enough waitlisted players exist → promote them to the freed court.
 *  3. Otherwise → re-insert the just-finished players as "waiting" at the
 *     back of the queue with a rotated doubles pairing. The court stays
 *     "available"; the operator (or a future auto-promote pass) decides when
 *     to start the next match.
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
 * @param sessionId   – the active session UUID
 * @param gameMode    – "singles" | "doubles"
 * @param court       – the court that just became available
 * @param finishedPlayers – ALL players from the finished match (team1 ++ team2)
 * @param team1Ids    – player IDs that formed team 1 (for pairing-rotation)
 * @param team2Ids    – player IDs that formed team 2 (for pairing-rotation)
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

  // ── 1. Fetch LIVE waitlist from the database ──────────────────────────────
  // We explicitly exclude the players who just finished — they were marked
  // "done" before this function runs, so they should not appear, but the
  // extra filter makes intent crystal-clear.
  const finishedIds = finishedPlayers.map((p) => p.id);

  const { data: liveWaitlistData } = await supabase
    .from("queue_entries")
    .select("id, player_id, skill_level")
    .eq("session_id", sessionId)
    .eq("status", "waiting")
    .eq("skill_level", court.assigned_skill_level)
    .order("joined_at", { ascending: true });

  const liveWaitlist = (liveWaitlistData ?? []).filter(
    (w) => !finishedIds.includes(w.player_id)
  );

  // ── 2. Promote waitlisted players if there are enough ────────────────────
  if (liveWaitlist.length >= needed) {
    const toPromote = liveWaitlist.slice(0, needed);

    await supabase
      .from("courts")
      .update({ status: "occupied" })
      .eq("id", court.id);

    await supabase
      .from("queue_entries")
      .update({ status: "playing" })
      .in(
        "id",
        toPromote.map((w) => w.id)
      )
      .eq("session_id", sessionId);

    // Finished players stay "done" — they're NOT re-queued here.
    return;
  }

  // ── 3. No (or not enough) waitlisted players — re-queue finished players ─
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
    // Singles — only one possible match-up
    rotatedPlayerIds = finishedPlayers.map((p) => p.id);
  }

  // Insert them as "waiting" with an explicit joined_at so they land AFTER
  // any players who were already in the waitlist before this insert.
  const now = new Date().toISOString();
  await supabase.from("queue_entries").insert(
    rotatedPlayerIds.map((pid) => ({
      session_id: sessionId,
      player_id: pid,
      skill_level: court.assigned_skill_level as SkillLevel,
      status: "waiting",
      joined_at: now,
    }))
  );

  // The court stays "available". The operator uses the Queue page or the
  // next score submission to kick off the following match.
}
