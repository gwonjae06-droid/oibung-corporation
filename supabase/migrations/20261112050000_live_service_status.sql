begin;
alter table public.oc_games
  drop constraint if exists oc_games_development_status_check;
alter table public.oc_games
  add constraint oc_games_development_status_check
  check (development_status in ('unknown', 'in_development', 'released', 'live_service'));
commit;
