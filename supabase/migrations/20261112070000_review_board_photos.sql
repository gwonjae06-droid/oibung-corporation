begin;
alter table public.oc_reviews
  add column image_paths text[] not null default '{}'::text[];
alter table public.oc_reviews
  add constraint oc_reviews_images_count_check check (cardinality(image_paths) <= 3);
alter table public.oc_reviews
  drop constraint if exists oc_reviews_body_check;
alter table public.oc_reviews
  add constraint oc_reviews_body_check check (char_length(body) <= 2000);
commit;
