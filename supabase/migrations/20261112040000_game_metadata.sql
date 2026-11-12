begin;
alter table public.oc_games
  add column developer text check (developer is null or char_length(btrim(developer)) between 1 and 80),
  add column development_status text not null default 'unknown'
    check (development_status in ('unknown', 'in_development', 'released')),
  add column thumbnail_path text
    check (thumbnail_path is null or thumbnail_path ~ '^thumbnails/[a-z0-9-]{1,64}/[0-9a-f-]{36}[.](jpg|png|webp)$');
grant insert (developer, development_status, thumbnail_path),
      update (developer, development_status, thumbnail_path)
  on public.oc_games to service_role;

create table oibung_private.owner_claim (
  digest bytea primary key,
  game_ids text[] not null
);
revoke all on oibung_private.owner_claim from public, anon, authenticated, service_role;
create function public.oc_claim_games(claim_digest text, guest_author uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  claimed_ids text[];
  affected integer;
begin
  if claim_digest !~ '^[a-f0-9]{64}$' or guest_author is null then return 0; end if;
  delete from oibung_private.owner_claim where digest = decode(claim_digest, 'hex')
    returning game_ids into claimed_ids;
  if claimed_ids is null then return 0; end if;
  update public.oc_games set author_id = guest_author
    where id = any(claimed_ids) and author_id is null;
  get diagnostics affected = row_count;
  return affected;
end;
$$;
revoke all on function public.oc_claim_games(text,uuid) from public, anon, authenticated;
grant execute on function public.oc_claim_games(text,uuid) to service_role;
commit;
