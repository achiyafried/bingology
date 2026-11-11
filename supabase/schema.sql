-- Bingology personal area: tables, triggers, RLS, RPCs. Source of truth for the database.
-- Idempotent: safe to re-run (`npm run schema:test` applies it to the TEST project).
-- Future column changes must use `alter table … add column if not exists` so re-running this file stays safe.
--
-- Privilege model: Supabase grants everything on new public tables/functions to anon and authenticated by
-- default, so every table and function below revokes first and grants back only what is needed.
-- anon (signed-out visitors) gets nothing except shared_profile().

-- ───────────────────────────── tables ─────────────────────────────

create table if not exists public.circles (
  id          uuid primary key default gen_random_uuid(),
  invite_code text not null unique,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text not null,
  circle_id  uuid references public.circles (id) on delete set null,
  share_slug text unique check (share_slug ~ '^[A-Za-z0-9_-]{8,64}$'),  -- null = share link off
  created_at timestamptz not null default now()
);
create index if not exists profiles_circle_id on public.profiles (circle_id);

create table if not exists public.entries (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tmdb_id     int  not null,
  status      text not null check (status in ('want', 'watching', 'seen', 'dropped')),
  season      int,
  episode     int,
  rating      int  check (rating between 1 and 10),
  note        text check (char_length(note) <= 140),
  finished_on date,
  title       text,
  poster      text,
  updated_at  timestamptz not null default now(),
  primary key (user_id, tmdb_id)
);

create table if not exists public.events (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  circle_id  uuid not null references public.circles (id) on delete cascade,
  tmdb_id    int  not null,
  kind       text not null check (kind in ('started', 'finished', 'rated', 'wanted', 'dropped')),
  rating     int,
  season     int,
  created_at timestamptz not null default now()
);
create index if not exists events_circle_created on public.events (circle_id, created_at desc);

create table if not exists public.pick_votes (
  circle_id  uuid not null references public.circles (id) on delete cascade,
  tmdb_id    int  not null,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  vote       text not null check (vote in ('yes', 'skip')),
  created_at timestamptz not null default now(),
  primary key (circle_id, tmdb_id, user_id)
);

-- Extra checks, added separately so re-running upgrades a table created by an earlier version of this file.
alter table public.profiles drop constraint if exists profiles_name_len;
alter table public.profiles add constraint profiles_name_len check (char_length(name) between 1 and 40);
alter table public.entries drop constraint if exists entries_title_len;
alter table public.entries add constraint entries_title_len check (char_length(title) <= 200);
alter table public.entries drop constraint if exists entries_poster_url;
alter table public.entries add constraint entries_poster_url
  check (poster is null or poster ~ '^https://image\.tmdb\.org/t/p/[a-z0-9]+/[A-Za-z0-9_.-]+$');

-- ───────────────────────────── helpers ─────────────────────────────
-- security definer so policies can look up the caller's circle without recursing into profiles' own RLS.

create or replace function public.my_circle() returns uuid
language sql stable security definer set search_path = '' as $$
  select circle_id from public.profiles where id = auth.uid()
$$;

-- true when `uid` is the caller or shares the caller's (non-null) circle right now
create or replace function public.in_my_circle(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select uid = auth.uid() or exists (
    select 1 from public.profiles me join public.profiles them on them.circle_id = me.circle_id
    where me.id = auth.uid() and them.id = uid and me.circle_id is not null)
$$;

-- ───────────────────────────── triggers ─────────────────────────────

-- set_finished_on: an existing row becoming 'seen' with no date ⇒ today. Later edits of the date are kept.
-- INSERTs keep what the client sends: migrated "seen" marks were finished on an unknown date (null).
create or replace function public.set_finished_on() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.status = 'seen' and new.finished_on is null
     and old.status is distinct from 'seen' then
    new.finished_on := current_date;
  end if;
  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  return new;
end $$;

create or replace trigger set_finished_on
  before insert or update on public.entries
  for each row execute function public.set_finished_on();

-- entries_to_events: the only writer of events. Status change and rating change create events;
-- episode/season/note/title changes do not. Nothing is written while the user has no circle.
-- An INSERT as 'seen' with no finished_on means "watched, date unknown" (e.g. device migration): no event.
create or replace function public.entries_to_events() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  c uuid;
begin
  select circle_id into c from public.profiles where id = new.user_id;
  if c is null then
    return null;
  end if;
  if (tg_op = 'INSERT' and not (new.status = 'seen' and new.finished_on is null))
     or (tg_op = 'UPDATE' and new.status is distinct from old.status) then
    insert into public.events (user_id, circle_id, tmdb_id, kind, rating, season)
    values (new.user_id, c, new.tmdb_id,
            case new.status when 'want' then 'wanted' when 'watching' then 'started'
                            when 'seen' then 'finished' else 'dropped' end,
            new.rating, new.season);
  end if;
  if new.rating is not null and (tg_op = 'INSERT' or new.rating is distinct from old.rating) then
    insert into public.events (user_id, circle_id, tmdb_id, kind, rating, season)
    values (new.user_id, c, new.tmdb_id, 'rated', new.rating, new.season);
  end if;
  return null;
end $$;

create or replace trigger entries_to_events
  after insert or update on public.entries
  for each row execute function public.entries_to_events();

-- drop_empty_circle: when the last member leaves (or is deleted), the circle goes too.
create or replace function public.drop_empty_circle() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.circle_id is not null
     and (tg_op = 'DELETE' or new.circle_id is distinct from old.circle_id)
     and not exists (select 1 from public.profiles where circle_id = old.circle_id) then
    delete from public.circles where id = old.circle_id;
  end if;
  return null;
end $$;

create or replace trigger drop_empty_circle
  after update of circle_id or delete on public.profiles
  for each row execute function public.drop_empty_circle();

-- ───────────────────────────── RPCs ─────────────────────────────

create or replace function public.create_circle() returns public.circles
language plpgsql security definer set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';  -- 56 chars, no look-alikes
  code text;
  b bytea;
  row public.circles;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'no profile' using errcode = 'P0002';
  end if;
  loop
    b := extensions.gen_random_bytes(10);
    code := '';
    for i in 0..9 loop
      code := code || substr(alphabet, (get_byte(b, i) % length(alphabet)) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.circles where invite_code = code);
  end loop;
  insert into public.circles (invite_code, created_by) values (code, auth.uid()) returning * into row;
  update public.profiles set circle_id = row.id where id = auth.uid();
  return row;
end $$;

create or replace function public.join_circle(code text, force boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  target uuid;
  mine uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  select id into target from public.circles where invite_code = code;
  if target is null then
    return jsonb_build_object('error', 'bad_code');
  end if;
  select circle_id into mine from public.profiles where id = auth.uid();
  if not found then
    raise exception 'no profile' using errcode = 'P0002';
  end if;
  if mine = target then
    return jsonb_build_object('ok', true, 'noop', true);
  end if;
  if mine is not null and not coalesce(force, false) then
    return jsonb_build_object('error', 'in_other_circle', 'circle_names',
      coalesce((select jsonb_agg(name order by name) from public.profiles
                where circle_id = mine and id <> auth.uid()), '[]'::jsonb));
  end if;
  update public.profiles set circle_id = target where id = auth.uid();
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.leave_circle() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  update public.profiles set circle_id = null where id = auth.uid();
end $$;

-- Read-only share link: only the name and the entries (with note). No circle, no events, no ids.
create or replace function public.shared_profile(slug text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('name', p.name, 'entries', coalesce((
    select jsonb_agg(jsonb_build_object(
             'tmdb_id', e.tmdb_id, 'status', e.status, 'season', e.season, 'episode', e.episode,
             'rating', e.rating, 'note', e.note, 'finished_on', e.finished_on,
             'title', e.title, 'poster', e.poster, 'updated_at', e.updated_at)
           order by e.updated_at desc)
    from public.entries e where e.user_id = p.id), '[]'::jsonb))
  from public.profiles p
  where slug is not null and p.share_slug = slug
$$;

-- ───────────────────────────── privileges ─────────────────────────────

revoke all on public.profiles, public.circles, public.entries, public.events, public.pick_votes from anon, authenticated;

grant select on public.profiles to authenticated;
grant insert (id, name, share_slug), update (id, name, share_slug) on public.profiles to authenticated;  -- never circle_id
grant select on public.circles to authenticated;                                                       -- written only by RPCs
grant select, insert, update, delete on public.entries to authenticated;
grant select on public.events to authenticated;                                                        -- written only by the trigger
grant select, insert, update, delete on public.pick_votes to authenticated;

revoke all on function public.my_circle(), public.in_my_circle(uuid), public.set_finished_on(),
  public.entries_to_events(), public.drop_empty_circle(), public.create_circle(),
  public.join_circle(text, boolean), public.leave_circle(), public.shared_profile(text)
  from public, anon, authenticated;
grant execute on function public.my_circle(), public.in_my_circle(uuid) to authenticated;              -- used by policies
grant execute on function public.create_circle(), public.join_circle(text, boolean), public.leave_circle() to authenticated;
grant execute on function public.shared_profile(text) to anon, authenticated;

-- ───────────────────────────── RLS ─────────────────────────────

alter table public.profiles   enable row level security;
alter table public.circles    enable row level security;
alter table public.entries    enable row level security;
alter table public.events     enable row level security;
alter table public.pick_votes enable row level security;

-- profiles: read self + same circle; write self only
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (public.in_my_circle(id));
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated
  with check (id = auth.uid());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- circles: members read; no direct writes (create_circle / join_circle only)
drop policy if exists circles_select on public.circles;
create policy circles_select on public.circles for select to authenticated
  using (id = public.my_circle());

-- entries: read self + same circle; write self only
drop policy if exists entries_select on public.entries;
create policy entries_select on public.entries for select to authenticated
  using (public.in_my_circle(user_id));
drop policy if exists entries_insert on public.entries;
create policy entries_insert on public.entries for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists entries_update on public.entries;
create policy entries_update on public.entries for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists entries_delete on public.entries;
create policy entries_delete on public.entries for delete to authenticated
  using (user_id = auth.uid());

-- events: read only events of my current circle by people still in it; nobody writes (trigger only)
drop policy if exists events_select on public.events;
create policy events_select on public.events for select to authenticated
  using (circle_id = public.my_circle() and public.in_my_circle(user_id));

-- pick_votes: circle reads votes of current members; own votes in my own circle only
drop policy if exists pick_votes_select on public.pick_votes;
create policy pick_votes_select on public.pick_votes for select to authenticated
  using (circle_id = public.my_circle() and public.in_my_circle(user_id));
drop policy if exists pick_votes_insert on public.pick_votes;
create policy pick_votes_insert on public.pick_votes for insert to authenticated
  with check (user_id = auth.uid() and circle_id = public.my_circle());
drop policy if exists pick_votes_update on public.pick_votes;
create policy pick_votes_update on public.pick_votes for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and circle_id = public.my_circle());
drop policy if exists pick_votes_delete on public.pick_votes;
create policy pick_votes_delete on public.pick_votes for delete to authenticated
  using (user_id = auth.uid());

notify pgrst, 'reload schema';
