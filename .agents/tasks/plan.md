# Implementation Plan — Queue Rotation Bug Fix

## Background

Two bugs identified from reading the source:

1. **Primary (queue-helpers.ts):** `requeueAfterMatch` has two branches. Branch 1 (enough waitlisted players exist) promotes waitlisted players to the freed court and returns early — leaving finished players as `status='done'` forever. Branch 2 (not enough waitlisted players) correctly re-inserts finished players as `waiting`. The fix unifies these: always re-insert finished players as `waiting` first, then promote from the full waitlist (which now includes the just-finished players).

2. **Secondary (score/page.tsx):** The `queueData` fetch queries all `playing` entries for the session without filtering by skill level. In a multi-court session this picks up players from other courts. The session dashboard (`page.tsx`) correctly filters by `court.assigned_skill_level`; the score page must do the same.

**Schema note:** `queue_entries` has no `court_id` column. Playing players are associated with a court via `skill_level = court.assigned_skill_level`. That is the correct scope key to use.

---

## Implementation Plan

- [ ] 1. Fix `requeueAfterMatch` in `src/lib/queue-helpers.ts` — always re-insert finished players as waiting.

      **What to do:**
      
      Restructure the two-branch logic into a single unified flow:
      
      a. Re-insert ALL finished players as `waiting` unconditionally (the rotation / pairing logic for doubles already exists in Branch 2 — move it before the waitlist check).
      
      b. After re-inserting, re-fetch the live waitlist (which now includes the just-finished players) and check if there are enough players (`>= needed`) to promote. If yes, promote the first `needed` entries and mark the court `occupied`. If not, leave the court `available`.
      
      c. Remove the early `return` in the old Branch 1 that prevented re-insertion.
      
      **Concrete shape of the new function body:**
      
      ```
      // Step A: compute rotated player order (doubles rotation logic, same as current Branch 2)
      let rotatedPlayerIds: string[]
      if (gameMode === "doubles" && finishedPlayers.length === 4) { ... }
      else { rotatedPlayerIds = finishedPlayers.map(p => p.id) }
      
      // Step B: re-insert finished players as "waiting"
      const now = new Date().toISOString()
      await supabase.from("queue_entries").insert(
        rotatedPlayerIds.map(pid => ({
          session_id: sessionId,
          player_id: pid,
          skill_level: court.assigned_skill_level as SkillLevel,
          status: "waiting",
          joined_at: now,
        }))
      )
      
      // Step C: fetch the FULL live waitlist (now includes re-queued players)
      const { data: freshWaitlistData } = await supabase
        .from("queue_entries")
        .select("id, player_id, skill_level")
        .eq("session_id", sessionId)
        .eq("status", "waiting")
        .eq("skill_level", court.assigned_skill_level)
        .order("joined_at", { ascending: true })
      
      const freshWaitlist = freshWaitlistData ?? []
      
      // Step D: promote to court if enough players are waiting
      if (freshWaitlist.length >= needed) {
        const toPromote = freshWaitlist.slice(0, needed)
        await supabase.from("courts").update({ status: "occupied" }).eq("id", court.id)
        await supabase.from("queue_entries")
          .update({ status: "playing" })
          .in("id", toPromote.map(w => w.id))
          .eq("session_id", sessionId)
      }
      // else: court stays "available" — operator or next score submit handles it
      ```
      
      **Key difference from current code:** The old Branch 1 `liveWaitlist` deliberately excluded finished players (`!finishedIds.includes(w.player_id)`) because finished players were supposed to sit out. Now that we always re-insert them, the exclusion filter on the initial fetch is no longer needed — the fresh fetch in Step C naturally sees the newly inserted entries.
      
      Also delete the now-unused `liveWaitlist` / `finishedIds` variables and the old Branch 1/2 separation.
      
      **Files:** `src/lib/queue-helpers.ts`
      
      **Verify:** `npm run build` in `c:\xampp\htdocs\queuepro\app` — TypeScript must compile with no errors.

- [ ] 2. Fix the score page's playing-entries query to scope by court skill level.

      **What to do:**
      
      In `src/app/session/[id]/score/page.tsx`, inside `fetchData`, the third parallel query currently reads:
      ```ts
      supabase
        .from("queue_entries")
        .select("*, player:players(*)")
        .eq("session_id", sessionId)
        .eq("status", "playing")
      ```
      
      Add `.eq("skill_level", courtData.assigned_skill_level)` to scope it to the court being scored. `courtData` is fetched in the same `Promise.all`, so it is available immediately after destructuring. However, since `Promise.all` runs them concurrently, `courtData` isn't available *before* the queue query is constructed. The fix: move the queue fetch into a second step, after the court and session fetches complete:
      
      ```ts
      const [{ data: courtData }, { data: sessionData }] = await Promise.all([
        supabase.from("courts").select("*").eq("id", preselectedCourtId).single(),
        supabase.from("sessions").select("game_mode").eq("id", sessionId).single(),
      ])
      
      const { data: queueData } = await supabase
        .from("queue_entries")
        .select("*, player:players(*)")
        .eq("session_id", sessionId)
        .eq("status", "playing")
        .eq("skill_level", (courtData as Court).assigned_skill_level)
      ```
      
      This is a two-round-trip approach but is the clean solution given that `courtData` is needed for the filter. Alternatively, if the `preselectedCourtId` is always present before `fetchData` runs (which it is — it's a URL param), the court fetch can be kept in the `Promise.all` and the queue fetch executed in a follow-up `await` after the destructuring. Either approach is acceptable; choose the two-step approach for clarity.
      
      **Files:** `src/app/session/[id]/score/page.tsx`
      
      **Verify:** `npm run build` in `c:\xampp\htdocs\queuepro\app` — no TypeScript errors.

- [ ] 3. Audit `src/app/session/[id]/page.tsx` — confirm court-scoping is correct or fix it.

      **What to do:**
      
      The session dashboard already does this in `fetchData`:
      ```ts
      const playingEntries = allQueue.filter(
        (q) => q.status === "playing" && q.skill_level === court.assigned_skill_level
      )
      ```
      This is correct — it scopes by skill level, same approach we're applying to the score page. **No change needed** to this file for the court-scoping fix.
      
      However, verify one other concern: when `handleSaveScore` calls `requeueAfterMatch`, the `court` argument is `scoreModal.court` (a `CourtWithPlayers`). The `CourtWithPlayers` type extends `Court` with an extra `playingPlayers` field but otherwise has the same shape. Since `requeueAfterMatch` only reads `court.id`, `court.assigned_skill_level`, and `court.status` (all present on `Court`), this is fine with no change required.
      
      **Files:** `src/app/session/[id]/page.tsx` — read-only confirmation, no edits.
      
      **Verify:** `npm run build` — covered by the build step in item 5.

- [ ] 4. Guard against duplicate `waiting` entries for the same player.

      **What to do:**
      
      Edge case: if somehow a player already has a `status='waiting'` entry in the queue (e.g. from a previous partial failure), `requeueAfterMatch` would insert a second `waiting` entry. This would cause the player to appear twice in the waitlist and potentially be promoted twice.
      
      The mitigation — add a de-duplication check before the insert in Step B of item 1:
      
      ```ts
      // Check for any existing 'waiting' entries for these players in this session
      const { data: existingWaiting } = await supabase
        .from("queue_entries")
        .select("player_id")
        .eq("session_id", sessionId)
        .eq("status", "waiting")
        .in("player_id", rotatedPlayerIds)
      
      const alreadyWaiting = new Set((existingWaiting ?? []).map(e => e.player_id))
      const toRequeue = rotatedPlayerIds.filter(pid => !alreadyWaiting.has(pid))
      
      if (toRequeue.length > 0) {
        await supabase.from("queue_entries").insert(
          toRequeue.map(pid => ({
            session_id: sessionId,
            player_id: pid,
            skill_level: court.assigned_skill_level as SkillLevel,
            status: "waiting",
            joined_at: now,
          }))
        )
      }
      ```
      
      This replaces the unconditional insert from item 1's Step B. The `rotatedPlayerIds` array preserves the doubles rotation order; filtering it keeps the relative order intact.
      
      **Note on `playing` entries:** The caller marks players `done` via `.update({ status: 'done' })` before calling `requeueAfterMatch`, so by the time this function runs, no finished player should have `status='playing'` anymore. The duplicate check only needs to guard against `waiting` duplicates.
      
      **Files:** `src/lib/queue-helpers.ts` (part of the same edit as item 1 — do both in one pass)
      
      **Verify:** `npm run build` — covered by item 5.

- [ ] 5. Run the build to confirm no TypeScript or compilation errors.

      **What to do:**
      
      From `c:\xampp\htdocs\queuepro\app`, run:
      ```
      npm run build
      ```
      
      Expected: build completes successfully with no TypeScript type errors. Warnings about `no-unused-vars` (if the old `liveWaitlist`/`finishedIds` variables are cleaned up, there should be none) are acceptable only if they were pre-existing. Any new errors must be fixed before the plan is considered complete.
      
      **Files:** none (verification only)
      
      **Verify:** Exit code 0 from `npm run build`.

---

## Summary of Changes

| File | Change |
|---|---|
| `src/lib/queue-helpers.ts` | Restructure: always re-insert finished players as `waiting` (with de-dup guard), then auto-promote from the fresh full waitlist. Remove the Branch 1 early return. |
| `src/app/session/[id]/score/page.tsx` | Split `fetchData`'s `Promise.all` into two steps so the queue fetch can filter by `court.assigned_skill_level`. |
| `src/app/session/[id]/page.tsx` | No changes — court-scoping already correct. |

## Edge Cases Covered

- **Player sitting out forever:** Fixed — finished players are always re-inserted as `waiting`.
- **Auto-fill still works:** After re-insertion, the fresh waitlist query picks up the re-queued players, so if there are now enough, the court auto-fills immediately.
- **Doubles pairing rotation:** Preserved — the existing rotation logic (3 unique pairings) still runs before the re-insert.
- **Duplicate waiting entries:** Guarded — a pre-insert check skips any player who already has a `waiting` entry.
- **Multi-court skill level scoping:** Score page now filters by `court.assigned_skill_level`, matching how the session dashboard already works.
- **Schema:** No DB migrations required — `queue_entries` columns (`session_id`, `player_id`, `skill_level`, `status`, `joined_at`) are sufficient for all changes.
