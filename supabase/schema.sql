-- GOATVersus database schema.
-- Run this once in the Supabase dashboard: SQL Editor > New query > paste > Run.

-- One row per weekly category.
create table if not exists weeks (
  id          serial primary key,
  category    text not null,
  description text,
  roster      text not null,          -- file name in /data without ".json", e.g. 'xmen'
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  check (ends_at > starts_at)
);

-- Exactly 10 distinct picks, ordered best first (index 1 = rank 1).
create or replace function picks_valid(p text[]) returns boolean
language sql immutable as $$
  select array_length(p, 1) = 10
     and (select count(distinct x) from unnest(p) x) = 10
$$;

create table if not exists ballots (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  week_id    int  not null references weeks (id) on delete cascade,
  picks      text[] not null check (picks_valid(picks)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_id)
);

alter table weeks   enable row level security;
alter table ballots enable row level security;

-- Anyone can read the list of weeks.
create policy "weeks are public" on weeks for select using (true);

-- People can only ever read their own ballot. Nobody can read anyone else's,
-- and there is no policy that lets the browser read totals.
create policy "read own ballot" on ballots for select
  using (auth.uid() = user_id);

-- People can submit and edit their own ballot only while the week is open.
create policy "insert own ballot while open" on ballots for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from weeks w
                where w.id = week_id and now() >= w.starts_at and now() < w.ends_at)
  );

create policy "update own ballot while open" on ballots for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from weeks w
                where w.id = week_id and now() >= w.starts_at and now() < w.ends_at)
  );

-- No delete policy: ballots can't be removed from the browser.

create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger ballots_touch before update on ballots
  for each row execute function touch_updated_at();

-- The ONLY way to see totals: refuses to answer until the week has ended.
create or replace function get_results(p_week int)
returns table (character_id text, points bigint, voters bigint)
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from weeks w where w.id = p_week and w.ends_at <= now()) then
    raise exception 'Results are locked until the week ends';
  end if;

  return query
    select t.pick                        as character_id,
           sum(11 - t.pos)::bigint       as points,    -- rank 1 = 10 pts ... rank 10 = 1 pt
           count(*)::bigint              as voters
    from ballots b
    cross join lateral unnest(b.picks) with ordinality as t(pick, pos)
    where b.week_id = p_week
    group by t.pick
    order by 2 desc, 3 desc, 1
    limit 50;
end $$;

-- Safe to show during the week: just how many ballots exist, not who is winning.
create or replace function ballot_count(p_week int)
returns bigint
language sql security definer set search_path = public as $$
  select count(*) from ballots where week_id = p_week
$$;

revoke all on function get_results(int)  from public;
revoke all on function ballot_count(int) from public;
grant execute on function get_results(int)  to anon, authenticated;
grant execute on function ballot_count(int) to anon, authenticated;

-- First week. Starts Monday 00:00 UTC, ends the following Monday.
insert into weeks (category, description, roster, starts_at, ends_at)
values ('Best X-Men',
        'Rank your ten greatest X-Men from the comics.',
        'xmen',
        date_trunc('week', now()),
        date_trunc('week', now()) + interval '7 days');
