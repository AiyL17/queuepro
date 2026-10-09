# Queue rotation fix: atomic requeue via Postgres RPC

Players finishing a match were permanently stuck in `done` status instead of returning to the waitlist. This change rewrites the post-match flow: finished players are now re-inserted as `waiting` by a Postgres RPC (`requeue_after_match`) that runs as a single transaction, then promotes the first N waiters to the freed court. The score page gains an idempotency guard so a retry after a partial failure doesn't double-record the match. The client-side `requeueAfterMatch` function is significantly slimmed down — the multi-step read-then-write promotion logic is removed and replaced by a single `supabase.rpc()` call.

**Watch for:** (confirmed) The `v_to_requeue` array in the RPC preserves the order of `p_requeued_ids` only if Postgres' `unnest` returns rows in array order — which is guaranteed by the SQL standard for `unnest`, but the insertion loop iterates `v_to_requeue` which was populated by `array_agg` without an explicit `ORDER BY`. This means the rotation order computed on the client may not be faithfully reproduced at the back of the queue. (confirmed) The idempotency guard in `handleSubmit` checks for an existing match record and skips the `INSERT`, but still runs the `requeueAfterMatch` RPC call — if the match was already recorded and the players already re-queued, a second call will hit the de-dup guard inside the RPC. This is safe but the score-update loops for `player_session_scores` and `pair_scores` will double-count stats on a retry, because they are outside the idempotency guard.

**Verdict**: NEEDS_CHANGES

---

## High-level view

The core behavioural fix is solid: finished players are now unconditionally re-inserted as `waiting` entries, and the entire requeue + promote sequence is wrapped in a Postgres transaction via RPC. This eliminates the original bug (players stuck in `done`) and closes the double-promotion race condition that was present in the previous multi-step client approach.

The recovery pass for stuck-done players still runs client-side before the RPC, correctly scoped to `court.assigned_skill_level`. This handles partial failures from earlier runs and is a reasonable design for a scenario the RPC itself can't observe.

The doubles pairing rotation is computed client-side and passed as an ordered array to the RPC. The RPC is supposed to insert these in the given order so the score page can reconstruct teams by position (`slice(0,2)` / `slice(2,4)`). There is a gap: `array_agg` in the RPC's `v_to_requeue` construction does not have an `ORDER BY`, so the ordering of `p_requeued_ids` is not guaranteed to be preserved in `v_to_requeue`. Whether this manifests depends on Postgres version and planner, making it fragile.

The match idempotency guard in `handleSubmit` wraps only the `INSERT` into `matches`. The score-accumulation writes (`player_session_scores`, `pair_scores`) are unconditional, so a retry will inflate totals. This is a pre-existing structural issue now made more reachable because the idempotency guard actively invites retries.

The `security definer` attribute on the RPC means it executes with the privileges of the function owner (typically the superuser role in Supabase), bypassing RLS on every table it touches. Given the schema's wide-open RLS policies this has no immediate blast radius, but it's worth tracking if RLS policies are ever tightened.

---

<details>
<summary>Issues (3)</summary>

1. **Rotation order not guaranteed in RPC** — `array_agg` building `v_to_requeue` from `unnest(p_requeued_ids)` has no `ORDER BY`, so Postgres is free to return rows in any order. The rotation pairing computed client-side may be scrambled. Fix: replace `array_agg(pid)` with `array_agg(pid ORDER BY array_position(p_requeued_ids, pid))` (requires Postgres 9.4+, available on Supabase).

2. **Score stats double-counted on retry** — the `player_session_scores` and `pair_scores` upsert loops run unconditionally; the `alreadyRecorded` guard only skips the `matches` insert. A retry after a partial failure will add scores a second time. Fix: wrap the score loops inside the same `if (!alreadyRecorded)` block, or use an idempotent upsert that stores the match ID as a key.

3. **`security definer` RPC bypasses RLS** — the function runs with owner-level privileges and can read/write every row in `queue_entries`, `courts`. This is currently benign given open policies, but it's a latent privilege escalation surface. Worth a conscious decision: either document it, or re-evaluate if RLS is tightened later. Not blocking for the current security posture, but should be tracked.

</details>

---

<details>
<summary>Details</summary>

### Rotation order gap in the RPC's `v_to_requeue` construction

The client computes `rotatedPlayerIds` — the chosen pairing for the next match — and passes it as `p_requeued_ids`. The RPC's goal is to insert these in that exact order so `joined_at` timestamps make the first two entries become Team 1 and the second two become Team 2 when the score page later slices by position.

The gap is in how `v_to_requeue` is built:

```sql
select array_agg(pid)
into   v_to_requeue
from   unnest(p_requeued_ids) as pid
where  v_existing_waiting is null
   or  pid <> all(v_existing_waiting);
```

`unnest` does preserve array order in practice for sequential scans in Postgres, but `array_agg` without `ORDER BY` is formally unordered. If any player already has a waiting entry (de-dup guard fires for a subset), the surviving IDs are aggregated without ordering, destroying the rotation. The insertion `foreach` loop then iterates `v_to_requeue` in whatever order Postgres chose.

The fix is one clause:
```sql
select array_agg(pid ORDER BY array_position(p_requeued_ids, pid))
```

When *none* of the players have a pre-existing waiting entry (the normal, non-retry path), the bug is harmless because all four IDs survive the filter and `unnest` order is incidentally preserved. The rotation scramble only manifests on a retry where the de-dup guard is exercised — which is the precise scenario the recovery path exists to handle.

### Score inflation on retry

`handleSubmit` checks `alreadyRecorded` before inserting the `matches` row, but the score-accumulation that follows is unconditional:

```typescript
for (const { id: player_id, score } of [...]) {
  // always runs, even on retry
  await supabase.from("player_session_scores").update({ total_score: ex.total_score + score, ... })
}
```

The existing comment in the code correctly describes that a retry is the expected recovery path when `requeueAfterMatch` throws after the match was recorded. That path now reliably re-hits the score loops. A match that records `11–8` and then fails during `requeueAfterMatch` will, on retry, add another `11` and `8` to both players' totals. The safest fix is to move the score loops inside the `if (!alreadyRecorded)` block; if score tracking ever needs to be decoupled from match recording, storing and checking a match ID in `player_session_scores` is the right key.

### RPC `security definer` posture

`requeue_after_match` is declared `security definer`, meaning it executes with the function owner's grants rather than the caller's. In Supabase's default setup the owner is the `postgres` role, which bypasses RLS entirely. The current RLS policies are all `using (true)` (public read/write), so there is no privilege gap today. The concern is forward-looking: if access to `queue_entries` or `courts` is ever locked down, this function will still run with elevated privileges without any code change, making it a silent policy bypass. A note in the SQL file is the minimum; switching to `security invoker` is the stronger fix if RLS ever gets meaningful policies.

</details>

---

<details>
<summary>File map</summary>

- `src/lib/queue-helpers.ts` — replaced multi-step client-side requeue+promote logic with a single `supabase.rpc("requeue_after_match", …)` call; removed `shuffle()`; recovery pass for stuck-done players retained and scoped to `court.assigned_skill_level`.
- `src/app/session/[id]/score/page.tsx` — added idempotency guard before `matches` insert; added skill-level scope to playing-entries query in `fetchData`.
- `supabase-rpc-requeue.sql` — new file; defines `requeue_after_match` Postgres function that atomically re-inserts waiters, fetches the live waitlist, and promotes to the freed court.

Full diff: `git diff HEAD~1`

</details>
