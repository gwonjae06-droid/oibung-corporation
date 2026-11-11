begin;
create schema if not exists oibung_private;
create table oibung_private.guest_usage (
  day date not null,
  scope text not null,
  action text not null,
  used integer not null,
  primary key (day, scope, action)
);

create function public.oc_guest_quota(address_hash text, operation text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  today date := (now() at time zone 'UTC')::date;
  allowance integer;
  total integer;
begin
  allowance := case operation when 'game' then 8 when 'review' then 30 when 'image' then 18 end;
  if allowance is null or address_hash !~ '^[a-f0-9]{64}$' then return false; end if;
  delete from oibung_private.guest_usage where day < today - 1;
  insert into oibung_private.guest_usage as u values (today, address_hash, operation, 1)
    on conflict (day, scope, action) do update set used = u.used + 1 where u.used < allowance
    returning used into total;
  if total is null then return false; end if;
  insert into oibung_private.guest_usage as u values (today, 'global', operation, 1)
    on conflict (day, scope, action) do update set used = u.used + 1
    where u.used < case when operation = 'image' then 120 else 300 end
    returning used into total;
  return total is not null;
end;
$$;
revoke all on function public.oc_guest_quota(text,text) from public, anon, authenticated;
grant execute on function public.oc_guest_quota(text,text) to service_role;
grant select, insert on public.oc_games, public.oc_images to service_role;
grant select, insert, update on public.oc_reviews to service_role;
commit;
