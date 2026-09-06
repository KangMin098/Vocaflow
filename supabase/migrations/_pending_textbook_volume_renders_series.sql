-- supabase/migrations/_pending_textbook_volume_renders_series.sql
--
-- ⚠️ **아직 적용하지 않았다.** 마이그레이션은 사용자 승인이 필요하다(CLAUDE.md).
--    파일 이름의 `_pending_` 접두사가 그 뜻이다 — Supabase CLI 가 집어가지 않는다.
--
-- ── 왜 필요한가 (실측 2026-09-06) ────────────────────────────────────
-- `textbook_volume_renders` 는 **`band` 하나로 키를 잡는다**(`onConflict: 'band'`).
-- 시리즈가 하나뿐일 때는 맞는 키였다. 어휘·구문 시리즈를 세우고 어휘 V5 를 시험 조판했더니
-- band 5 의 기록이 이렇게 바뀌었다:
--
--     "Vocaflow Reading 4"  →  "Vocaflow Vocab Advanced"
--
-- **발행 중인 시리즈의 조판 기록이 시험 조판 한 번에 지워졌다.** 지금은 조판기가
-- 독해가 아닌 시리즈에서 기록을 아예 안 남기게 막아 두었다(`render-volume.mjs`) —
-- 조판물(HTML)은 정상으로 나오고, 못 남기는 것은 "이 권이 나갔다" 는 사실뿐이다.
--
-- 그 사실을 남기려면 키에 시리즈가 들어가야 한다.
--
-- ── 무엇을 하는가 ────────────────────────────────────────────────────
--   1) `series` 열 추가. 기존 행은 전부 독해다(그때 시리즈가 하나뿐이었다).
--   2) 기본키를 `(series, band)` 복합으로 바꾼다.
--   3) 카탈로그가 시리즈별로 「냈다」를 셀 수 있게 된다 —
--      지금은 `s.id === 'reading'` 으로만 세고 그 한계를 화면 주석이 적고 있다.
--
-- ⚠️ **되돌릴 수 있나**: `series` 열을 지우면 원래대로다. 다만 그 사이에 어휘·구문 기록이
--    쌓였다면 그 행들은 band 가 겹쳐 **되돌릴 때 충돌한다** — 지우기 전에 독해가 아닌 행을
--    먼저 지워야 한다.

begin;

-- 1) 시리즈 열. 기존 행은 전부 독해다 — 그때는 시리즈가 하나뿐이었다.
alter table public.textbook_volume_renders
  add column if not exists series text not null default 'reading';

comment on column public.textbook_volume_renders.series is
  '어느 시리즈의 권인가 (series-catalog.ts 의 SeriesId). 2026-09-06 이전 행은 전부 reading — 그때는 시리즈가 하나뿐이었다.';

-- 2) 키를 (series, band) 로. band 단독 키로는 어휘 V5 가 독해 V5 를 덮는다.
alter table public.textbook_volume_renders
  drop constraint if exists textbook_volume_renders_pkey;

alter table public.textbook_volume_renders
  add constraint textbook_volume_renders_pkey primary key (series, band);

commit;
