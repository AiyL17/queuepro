-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: requeue_after_match
--
-- Atomically handles all post-match queue rotation for one court:
--   1. Marks finished players' previous active entries as "done".
--   2. Re-inserts finished players as "waiting" at the back of the queue
--      (skipping any who are already marked waiting — idempotent guard).
--   3. Re-fetches the live waitlist for the court's skill level.
--   4. If enough waiting players exist (>= needed):
--        - Promotes the first N to "playing"
--        - Marks the court "occupied".
--      Otherwise:
--        - Marks the court "available".
--
-- Running inside a single Postgres transaction eliminates race conditions
-- and prevents double-promotion or duplicate entries.
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
  v_pid               uuid;
  v_idx               int := 0;
  v_waitlist          uuid[];
  v_to_promote        uuid[];
  v_waitlist_count    int;
begin
  -- 1. Mark previous active entries for these finished players as 'done'
  update queue_entries
  set    status = 'done'
  where  session_id = p_session_id
    and  player_id = any(p_requeued_ids)
    and  status = 'playing';

  -- 2. Re-insert finished players as 'waiting' (only if not already waiting)
  if p_requeued_ids is not null and array_length(p_requeued_ids, 1) > 0 then
    foreach v_pid in array p_requeued_ids loop
      if not exists (
        select 1 from queue_entries
        where session_id = p_session_id
          and player_id = v_pid
          and status = 'waiting'
      ) then
        insert into queue_entries (session_id, player_id, skill_level, status, joined_at)
        values (
          p_session_id,
          v_pid,
          p_skill_level,
          'waiting',
          to_timestamp((p_requeue_base_ms + v_idx)::double precision / 1000.0)
        );
        v_idx := v_idx + 1;
      end if;
    end loop;
  end if;

  -- 3. Fetch full live waitlist for this skill level ordered by joined_at asc
  select array_agg(id order by joined_at asc)
  into   v_waitlist
  from   queue_entries
  where  session_id  = p_session_id
    and  status      = 'waiting'
    and  skill_level = p_skill_level;

  v_waitlist_count := coalesce(array_length(v_waitlist, 1), 0);

  -- 4. If enough players are waiting, promote them and set court occupied;
  --    otherwise mark court available.
  if v_waitlist_count >= p_needed then
    v_to_promote := v_waitlist[1:p_needed];

    update queue_entries
    set    status = 'playing'
    where  id = any(v_to_promote)
      and  session_id = p_session_id;

    update courts
    set    status = 'occupied'
    where  id = p_court_id;
  else
    update courts
    set    status = 'available'
    where  id = p_court_id;
  end if;
end;
$$;

-- Grant execute to anon and authenticated roles
grant execute on function requeue_after_match(uuid, uuid, text, int, uuid[], bigint) to anon;
grant execute on function requeue_after_match(uuid, uuid, text, int, uuid[], bigint) to authenticated;
