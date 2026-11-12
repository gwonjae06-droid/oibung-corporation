alter table public.oc_games
  add column intro_tone text not null default 'gallery'
  constraint oc_games_intro_tone_check check (intro_tone in ('gallery', 'burgundy', 'navy', 'forest', 'plum', 'umber', 'slate'));
