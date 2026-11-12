begin;
create table if not exists public.oc_game_revisions (
  id bigint generated always as identity primary key,
  game_id text not null references public.oc_games(id) on delete cascade,
  snapshot jsonb not null,
  changed_at timestamptz not null default now()
);
create index if not exists oc_game_revisions_recent on public.oc_game_revisions (game_id, changed_at desc, id desc);
alter table public.oc_game_revisions enable row level security;
revoke all on public.oc_game_revisions from anon, authenticated;
grant select on public.oc_game_revisions to anon, authenticated;
grant select, insert, delete on public.oc_game_revisions to service_role;
grant usage, select on sequence public.oc_game_revisions_id_seq to service_role;
create policy oc_game_revisions_public_read on public.oc_game_revisions
  for select to anon, authenticated using (true);

create or replace function public.oc_record_game_revision()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if row(old.title,old.description,old.genre,old.developer,old.development_status,old.play_url,old.intro_tone)
     is distinct from row(new.title,new.description,new.genre,new.developer,new.development_status,new.play_url,new.intro_tone) then
    insert into public.oc_game_revisions(game_id,snapshot)
    values (old.id, jsonb_build_object(
      'title',old.title,'description',old.description,'genre',old.genre,
      'developer',old.developer,'developmentStatus',old.development_status,
      'playUrl',old.play_url,'introTone',old.intro_tone));
    delete from public.oc_game_revisions where id in (
      select id from public.oc_game_revisions where game_id=old.id
      order by changed_at desc,id desc offset 20
    );
  end if;
  return new;
end;
$$;
revoke execute on function public.oc_record_game_revision() from public, anon, authenticated;
create trigger oc_game_revision_audit
after update on public.oc_games for each row execute function public.oc_record_game_revision();

create table if not exists public.oc_game_updates (
  id uuid primary key default gen_random_uuid(),
  game_id text not null references public.oc_games(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 60),
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists oc_game_updates_recent on public.oc_game_updates (game_id, created_at desc);
alter table public.oc_game_updates enable row level security;
revoke all on public.oc_game_updates from anon, authenticated;
grant select on public.oc_game_updates to anon, authenticated;
grant select,insert on public.oc_game_updates to service_role;
create policy oc_game_updates_public_read on public.oc_game_updates
  for select to anon, authenticated using (true);

create table if not exists public.oc_content_reports (
  id bigint generated always as identity primary key,
  game_id text not null references public.oc_games(id) on delete cascade,
  reason text not null check (reason in ('incorrect','inappropriate','spam','other')),
  reporter_hash text not null check (reporter_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  unique (game_id, reporter_hash)
);
alter table public.oc_content_reports enable row level security;
revoke all on public.oc_content_reports from anon, authenticated;
grant select,insert on public.oc_content_reports to service_role;
grant usage,select on sequence public.oc_content_reports_id_seq to service_role;
commit;
