-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: requeue_after_match
--
-- Atomically handles all post-match queue rotation for one court:
--   1. Re-inserts finished players as "waiting" at the back of the queue
--      (skipping any who already have a waiting entry — idempotent retry guard).
--   2. Re-fetches the full live waitlist for the court's skill level.
--   3. If enough waiting players exist (>= needed), promotes the first N to
--      "playing" and marks the court "occupied".
--   4. Otherwise leaves the court "available".
--
-- Running inside a single transaction ensures concurrent court finishes cannot
-- double-promote the same players.
--
-- Parameters:
--   p_session_id        uuid      – the active session
--   p_court_id          uuid      – the court that just became free
--   p_skill_level       text      – court's assigned_skill_level
--   p_needed            int       – 2 for singles, 4 for doubles
--   p_requeued_ids      uuid[]    – finished player IDs in insertion order
--                                   (doubles: already rotation-ordered by caller)
--   p_requeue_base_ms   bigint    – epoch-ms for first requeued entry's joined_at;
--                                   each subsequent entry gets +1ms offset
--
-- Returns: void (raises on error)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function requeue_after_match(
  p_session_id      uuid,
  p_court_id        uuid,
  p_skill_level     text,
  p_needed          int,
  p_requeued_ids    uuid[],
  p_requeue_base_ms bigint
)
returns void
language plpgsql
security definer
as $$
declare
  v_existing_waiting  uuid[];
  v_to_requeue        uuid[];
  v_pid               uuid;
  v_idx               int;
  v_waitlist          uuid[];
  v_to_promote        uuid[];
  v_waitlist_count    int;
begin
  -- ── Step B: re-insert finished players as "waiting" ────────────────────
  -- Find which of the finished players already have a waiting entry
  -- at this skill level (de-dup guard for idempotent retry).
  select array_agg(player_id)
  into   v_existing_waiting
  from   queue_entries
  where  session_id  = p_session_id
    and  status      = 'waiting'
    and  skill_level = p_skill_level
    and  player_id   = any(p_requeued_ids);

  -- Build the list that still needs inserting
  select array_agg(pid)
  into   v_to_requeue
  from   unnest(p_requeued_ids) as pid
  where  v_existing_waiting is null
     or  pid <> all(v_existing_waiting);

  -- Insert with per-index 1ms offset to preserve rotation order
  if v_to_requeue is not null and array_length(v_to_requeue, 1) > 0 then
    v_idx := 0;
    foreach v_pid in array v_to_requeue loop
      insert into queue_entries (session_id, player_id, skill_level, status, joined_at)
      values (
        p_session_id,
        v_pid,
        p_skill_level,
        'waiting',
        to_timestamp((p_requeue_base_ms + v_idx)::double precision / 1000.0)
      );
      v_idx := v_idx + 1;
    end loop;
  end if;

  -- ── Step C: fetch full live waitlist for this skill level ───────────────
  select array_agg(id order by joined_at asc)
  into   v_waitlist
  from   queue_entries
  where  session_id  = p_session_id
    and  status      = 'waiting'
    and  skill_level = p_skill_level;

  v_waitlist_count := coalesce(array_length(v_waitlist, 1), 0);

  -- ── Step D: promote if enough players are waiting ──────────────────────
  if v_waitlist_count >= p_needed then
    -- Slice the first p_needed entries (already ordered by joined_at from Step C)
    v_to_promote := v_waitlist[1:p_needed];

    -- Promote queue entries first
    update queue_entries
    set    status = 'playing'
    where  id = any(v_to_promote)
      and  session_id = p_session_id;

    -- Then mark the court occupied
    update courts
    set    status = 'occupied'
    where  id = p_court_id;
  end if;

  -- If not enough players, court remains "available" — no-op here.
end;
$$;

-- Grant execute to the anon role (used by Supabase JS client with anon key)
grant execute on function requeue_after_match(uuid, uuid, text, int, uuid[], bigint) to anon;
grant execute on function requeue_after_match(uuid, uuid, text, int, uuid[], bigint) to authenticated;
