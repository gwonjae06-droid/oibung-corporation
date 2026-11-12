begin;
alter table public.oc_games
  add column platform text not null default 'unknown'
    check (platform in ('unknown','web','pc','android','mod','other')),
  add column play_mode text not null default 'unknown'
    check (play_mode in ('unknown','single','multi','both'));
grant insert (platform,play_mode), update (platform,play_mode) on public.oc_games to service_role;
create or replace function public.oc_record_game_revision()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if row(old.title,old.description,old.genre,old.developer,old.development_status,old.play_url,old.intro_tone,old.platform,old.play_mode)
     is distinct from row(new.title,new.description,new.genre,new.developer,new.development_status,new.play_url,new.intro_tone,new.platform,new.play_mode) then
    insert into public.oc_game_revisions(game_id,snapshot)
    values (old.id, jsonb_build_object(
      'title',old.title,'description',old.description,'genre',old.genre,
      'developer',old.developer,'developmentStatus',old.development_status,
      'playUrl',old.play_url,'introTone',old.intro_tone,
      'platform',old.platform,'playMode',old.play_mode));
    delete from public.oc_game_revisions where id in (
      select id from public.oc_game_revisions where game_id=old.id
      order by changed_at desc,id desc offset 20
    );
  end if;
  return new;
end;
$$;
commit;
