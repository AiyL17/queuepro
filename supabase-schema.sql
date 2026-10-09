-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── Migration: run these if upgrading an existing database ──────────
-- alter table sessions add column if not exists game_mode text not null default 'doubles' check (game_mode in ('singles','doubles'));
-- alter table matches  add column if not exists game_mode text not null default 'doubles' check (game_mode in ('singles','doubles'));
-- ─────────────────────────────────────────────────────────────────────

-- Sessions table
create table sessions (
  id uuid primary key default uuid_generate_v4(),
  mode text not null check (mode in ('guest', 'hosted')),
  game_mode text not null default 'doubles' check (game_mode in ('singles', 'doubles')),
  creator_account_id uuid references auth.users(id) on delete set null,
  start_time timestamptz not null default now(),
  end_time timestamptz,
  status text not null default 'active' check (status in ('active', 'ended'))
);

-- Courts table
create table courts (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references sessions(id) on delete cascade,
  name text not null,
  assigned_skill_level text not null check (assigned_skill_level in ('beginner','advanced_beginner','novice','intermediate','advanced')),
  status text not null default 'available' check (status in ('available', 'occupied'))
);

-- Players table
create table players (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references sessions(id) on delete cascade,
  name text not null,
  skill_level text not null check (skill_level in ('beginner','advanced_beginner','novice','intermediate','advanced')),
  account_id uuid references auth.users(id) on delete set null,
  is_guest boolean not null default true
);

-- Queue entries table
create table queue_entries (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references sessions(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  skill_level text not null check (skill_level in ('beginner','advanced_beginner','novice','intermediate','advanced')),
  joined_at timestamptz not null default now(),
  status text not null default 'waiting' check (status in ('waiting', 'playing', 'done'))
);

-- Matches table
create table matches (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid not null references sessions(id) on delete cascade,
  court_id uuid not null references courts(id) on delete cascade,
  game_mode text not null default 'doubles' check (game_mode in ('singles', 'doubles')),
  team1_player_ids uuid[] not null,
  team2_player_ids uuid[] not null,
  team1_score integer not null default 0,
  team2_score integer not null default 0,
  played_at timestamptz not null default now()
);

-- Player session scores table
create table player_session_scores (
  player_id uuid not null references players(id) on delete cascade,
  session_id uuid not null references sessions(id) on delete cascade,
  total_score integer not null default 0,
  games_played integer not null default 0,
  primary key (player_id, session_id)
);

-- Pair scores table
create table pair_scores (
  player1_id uuid not null references players(id) on delete cascade,
  player2_id uuid not null references players(id) on delete cascade,
  session_id uuid not null references sessions(id) on delete cascade,
  total_score integer not null default 0,
  games_played integer not null default 0,
  primary key (player1_id, player2_id, session_id)
);

-- Enable Row Level Security
alter table sessions enable row level security;
alter table courts enable row level security;
alter table players enable row level security;
alter table queue_entries enable row level security;
alter table matches enable row level security;
alter table player_session_scores enable row level security;
alter table pair_scores enable row level security;

-- Public read access for all tables
create policy "Public read sessions" on sessions for select using (true);
create policy "Public read courts" on courts for select using (true);
create policy "Public read players" on players for select using (true);
create policy "Public read queue" on queue_entries for select using (true);
create policy "Public read matches" on matches for select using (true);
create policy "Public read scores" on player_session_scores for select using (true);
create policy "Public read pairs" on pair_scores for select using (true);

-- Public write for guest sessions (anyone can insert/update)
create policy "Public insert sessions" on sessions for insert with check (true);
create policy "Public insert courts" on courts for insert with check (true);
create policy "Public insert players" on players for insert with check (true);
create policy "Public insert queue" on queue_entries for insert with check (true);
create policy "Public insert matches" on matches for insert with check (true);
create policy "Public insert scores" on player_session_scores for insert with check (true);
create policy "Public insert pairs" on pair_scores for insert with check (true);
create policy "Public update sessions" on sessions for update using (true);
create policy "Public update courts" on courts for update using (true);
create policy "Public update queue" on queue_entries for update using (true);
create policy "Public update scores" on player_session_scores for update using (true);
create policy "Public update pairs" on pair_scores for update using (true);

-- Enable Realtime for live updates
alter publication supabase_realtime add table sessions;
alter publication supabase_realtime add table courts;
alter publication supabase_realtime add table queue_entries;
alter publication supabase_realtime add table player_session_scores;
alter publication supabase_realtime add table pair_scores;

-- ─────────────────────────────────────────────────────────────────────
-- RPC: requeue_after_match
-- Atomically re-inserts finished players into the waitlist and 
-- promotes the next N players if enough are waiting.
-- ─────────────────────────────────────────────────────────────────────
create or replace function requeue_after_match(
  p_session_id uuid,
  p_court_id uuid,
  p_skill_level text,
  p_needed integer,
  p_requeued_ids uuid[],
  p_requeue_base_ms bigint
) returns void as $$
declare
  v_player_id uuid;
  v_idx integer := 0;
  v_waitlist uuid[];
begin
  -- 1. Re-insert players as waiting, de-duping if they are already waiting
  foreach v_player_id in array p_requeued_ids
  loop
    if not exists (
      select 1 from queue_entries 
      where session_id = p_session_id 
        and player_id = v_player_id 
        and status = 'waiting'
    ) then
      insert into queue_entries (session_id, player_id, skill_level, status, joined_at)
      values (
        p_session_id, 
        v_player_id, 
        p_skill_level, 
        'waiting', 
        to_timestamp((p_requeue_base_ms + v_idx) / 1000.0)
      );
    end if;
    v_idx := v_idx + 1;
  end loop;

  -- 2. Fetch the top N waiting players
  select array_agg(id) into v_waitlist
  from (
    select id
    from queue_entries
    where session_id = p_session_id
      and status = 'waiting'
      and skill_level = p_skill_level
    order by joined_at asc
    limit p_needed
  ) as t;

  -- 3. If we have enough players, promote them
  if array_length(v_waitlist, 1) = p_needed then
    update queue_entries
    set status = 'playing'
    where id = any(v_waitlist);

    update courts
    set status = 'occupied'
    where id = p_court_id;
  else
    update courts
    set status = 'available'
    where id = p_court_id;
  end if;
end;
$$ language plpgsql;
