-- supabase/migrations/20260906103500_textbook_volume_renders_series.sql
--
-- **조판 기록에 시리즈 칸을 준다.**
--
-- ⚠️ 왜 (실측 2026-09-06):
--   `textbook_volume_renders` 가 `band` 하나로 키를 잡고 있었다(`onConflict: 'band'`).
--   시리즈가 하나(Vocaflow Reading)뿐일 때는 맞는 키였다. 어휘·구문 시리즈를 세우고
--   어휘 V5 를 시험 조판했더니 band 5 행의 제목이 이렇게 바뀌었다:
--
--       "Vocaflow Reading 4"  →  "Vocaflow Vocab Advanced"
--
--   **발행 중인 시리즈의 조판 기록이 시험 조판 한 번에 지워졌다.** (독해 V5 재조판으로 복구.)
--
-- 기존 행은 전부 독해다 — 그때는 시리즈가 하나뿐이었으므로 `default 'reading'` 이 사실이다.
--
-- 되돌리기: `series` 열을 지우면 원래대로다. 다만 그 사이에 독해가 아닌 행이 쌓였다면
-- band 가 겹쳐 충돌하므로 **먼저 그 행들을 지워야** 한다.

alter table public.textbook_volume_renders
  add column if not exists series text not null default 'reading';

comment on column public.textbook_volume_renders.series is
  '어느 시리즈의 권인가 (series-catalog.ts 의 SeriesId). 2026-09-06 이전 행은 전부 reading — 그때는 시리즈가 하나뿐이었다.';

alter table public.textbook_volume_renders
  drop constraint if exists textbook_volume_renders_pkey;

alter table public.textbook_volume_renders
  add constraint textbook_volume_renders_pkey primary key (series, band);
