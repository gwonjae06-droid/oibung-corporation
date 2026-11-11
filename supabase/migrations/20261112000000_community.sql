begin;

create table public.oc_members (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.oc_members enable row level security;
revoke all on public.oc_members from anon, authenticated;
grant select on public.oc_members to authenticated;
create policy oc_members_self on public.oc_members for select to authenticated
  using (user_id = (select auth.uid()));

create table public.oc_games (
  id text primary key default gen_random_uuid()::text check (id ~ '^[a-z0-9-]{1,64}$'),
  title text not null check (char_length(btrim(title)) between 1 and 80),
  description text not null check (char_length(btrim(description)) between 1 and 1000),
  category text not null check (category in ('action','strategy','other')),
  genre text not null check (char_length(btrim(genre)) between 1 and 60),
  play_url text not null check (play_url ~ '^https://[^[:space:]]+$' and char_length(play_url) <= 2048),
  author_id uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create table public.oc_images (
  path text primary key,
  game_id text not null references public.oc_games(id),
  author_id uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  check (path ~ ('^' || author_id::text || '/' || game_id || '/[0-9a-f-]{36}\.(jpg|png|webp)$'))
);
create table public.oc_reviews (
  game_id text not null references public.oc_games(id),
  author_id uuid not null default auth.uid(),
  nickname text not null check (char_length(btrim(nickname)) between 1 and 30),
  stars smallint not null check (stars between 1 and 5),
  body text not null check (char_length(body) <= 500),
  created_at timestamptz not null default now(),
  primary key (game_id, author_id)
);
create index oc_images_game_time on public.oc_images (game_id, created_at desc);
create index oc_reviews_game_time on public.oc_reviews (game_id, created_at desc);

alter table public.oc_games enable row level security;
alter table public.oc_images enable row level security;
alter table public.oc_reviews enable row level security;
revoke all on public.oc_games, public.oc_images, public.oc_reviews from anon, authenticated;
grant select on public.oc_games, public.oc_images, public.oc_reviews to anon, authenticated;
grant insert (id, title, description, category, genre, play_url) on public.oc_games to authenticated;
grant insert (path, game_id) on public.oc_images to authenticated;
grant insert (game_id, author_id, nickname, stars, body) on public.oc_reviews to authenticated;
grant update (nickname, stars, body) on public.oc_reviews to authenticated;

create policy oc_games_read on public.oc_games for select to anon, authenticated using (true);
create policy oc_images_read on public.oc_images for select to anon, authenticated using (true);
create policy oc_reviews_read on public.oc_reviews for select to anon, authenticated using (true);
create policy oc_games_add on public.oc_games for insert to authenticated
  with check (author_id = (select auth.uid()) and exists (select 1 from public.oc_members));
create policy oc_images_add on public.oc_images for insert to authenticated
  with check (author_id = (select auth.uid())
    and exists (select 1 from public.oc_members)
    and exists (select 1 from storage.objects
      where bucket_id = 'oc-screenshots' and name = oc_images.path));
create policy oc_reviews_add on public.oc_reviews for insert to authenticated
  with check (author_id = (select auth.uid()) and exists (select 1 from public.oc_members));
create policy oc_reviews_edit on public.oc_reviews for update to authenticated
  using (author_id = (select auth.uid()) and exists (select 1 from public.oc_members))
  with check (author_id = (select auth.uid()) and exists (select 1 from public.oc_members));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('oc-screenshots', 'oc-screenshots', true, 5242880, array['image/jpeg','image/png','image/webp']);

create policy oc_screenshots_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'oc-screenshots'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.oc_members)
    and name ~ '^[0-9a-f-]{36}/[a-z0-9-]{1,64}/[0-9a-f-]{36}[.](jpg|png|webp)$'
    and exists (select 1 from public.oc_games where id = (storage.foldername(name))[2]));
create policy oc_screenshots_cleanup_read on storage.objects for select to authenticated
  using (bucket_id = 'oc-screenshots' and owner_id = (select auth.uid())::text);
create policy oc_screenshots_cleanup on storage.objects for delete to authenticated
  using (bucket_id = 'oc-screenshots' and owner_id = (select auth.uid())::text
    and not exists (select 1 from public.oc_images where path = storage.objects.name));

create function public.oc_review_summary(game text)
returns table (total bigint, average numeric)
language sql stable security invoker set search_path = ''
as $$
  select count(*), round(avg(stars), 1) from public.oc_reviews where game_id = game;
$$;
revoke all on function public.oc_review_summary(text) from public;
grant execute on function public.oc_review_summary(text) to anon, authenticated;

create function public.oc_save_review(game text, display_name text, rating smallint, review_text text)
returns void
language sql security invoker set search_path = ''
as $$
  insert into public.oc_reviews (game_id, nickname, stars, body)
  values (game, display_name, rating, review_text)
  on conflict (game_id, author_id) do update
    set nickname = excluded.nickname, stars = excluded.stars, body = excluded.body;
$$;
revoke all on function public.oc_save_review(text,text,smallint,text) from public;
grant execute on function public.oc_save_review(text,text,smallint,text) to authenticated;

alter publication supabase_realtime add table public.oc_games, public.oc_images, public.oc_reviews;
insert into public.oc_games (id, title, description, category, genre, play_url) values
  ('odenring', '오든링', '개성 강한 보스와 맞서는 3D 소울라이크 보스 러시. 회피하고, 공략하고, 너만의 여정을 완성해 봐.', 'action', '3D 액션 · 보스 러시', 'https://gwonjae06-droid.github.io/oibung-elden-ring/'),
  ('oibung-arena', '오이붕 아레나', '튕기고 부딪히는 핀볼 물리 기반 자동 배틀. 독특한 스킬과 예측 불가능한 충돌이 만들어 내는 한 판!', 'action', '핀볼 · 자동 전투', 'https://gwonjae06-droid.github.io/oibung-ballfight-base/'),
  ('ochams', '오이챔스 3D 배틀', '풀스크린 3D 턴제 대전. 화려한 전투 연출과 캐릭터 애니메이션을 즐기는 배틀 프로토타입.', 'strategy', '3D · 턴제 배틀', 'https://gwonjae06-droid.github.io/ochams-3d-battle/'),
  ('campus-frontier', '대학전선', '대학을 선택하고 부대를 지휘하는 3D 순차 턴 전략게임. 거점을 차지하고, 자원을 모으고, 전장을 지배하라.', 'strategy', '3D · 전략 시뮬레이션', 'https://gwonjae06-droid.github.io/campus-frontier/');

commit;
