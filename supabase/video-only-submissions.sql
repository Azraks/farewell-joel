-- Apply in Supabase SQL Editor before deploying the updated tribute-api and frontend.
-- Keeps all existing records; an empty message requires photos, a video path or a video link.
begin;
-- Fail rather than waiting indefinitely behind active traffic.
set local lock_timeout = '5s';
set local statement_timeout = '30s';
alter table public.tributes drop constraint if exists tributes_message_check;
alter table public.tributes add constraint tributes_message_check
  check (char_length(message) <= 1500);
alter table public.tributes drop constraint if exists tributes_content_check;
alter table public.tributes add constraint tributes_content_check check (
  char_length(btrim(message)) > 0 or cardinality(photo_paths) > 0 or
  nullif(btrim(video_path), '') is not null or
  nullif(btrim(video_link), '') is not null
);
commit;
