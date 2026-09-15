-- 20260912221500_user_textbook_selections_series.sql
--
-- **담은 책이 시리즈를 구별한다.**
--
-- ── 왜 (실측 2026-09-12) ────────────────────────────────────────────
-- `SERIES_CATALOG` 는 시리즈 3종(독해·어휘·구문)을 정의하고 Admin 카탈로그가 그것을 그리는데,
-- 학습자 쪽은 권의 주소가 `step` 하나였다 — 라우트도 `/library/textbooks/[step]` 이고
-- 이 표의 PK 도 `(user_id, step)` 이다. 그래서 **어휘 5단과 독해 5단이 같은 행**이 된다:
-- 어휘 권을 담으면 독해 권을 담은 것으로 기록되고, 하나를 빼면 둘이 같이 빠진다.
--
-- 어휘·구문은 단이 정의됐고 재고도 찼는데(각 6단) **학습자에게 도달하지 않았다.**
-- 막고 있던 것은 재고가 아니라 이 주소 체계다.
--
-- ── 왜 기본값이 'reading' 인가 ───────────────────────────────────────
-- 이 열이 생기기 전에 담긴 책은 **전부 독해였다** — 다른 시리즈는 학습자 화면에 존재한 적이
-- 없다(매대 함수가 독해 사다리만 읽었다). 적용 시점 실측 **2행 · 사용자 1명**.
-- 그러므로 기본값은 추측이 아니라 **그 2행의 사실**이다.
--
-- 되돌리기:
--   alter table public.user_textbook_selections drop constraint user_textbook_selections_pkey;
--   alter table public.user_textbook_selections drop column series;
--   alter table public.user_textbook_selections add primary key (user_id, step);
-- 데이터 손실 없음 — 지금 행 둘 다 독해다.

alter table public.user_textbook_selections
  add column if not exists series text not null default 'reading';

-- ⚠️ PK 를 바꾼다. `(user_id, step)` 이면 시리즈가 달라도 같은 행이다.
alter table public.user_textbook_selections
  drop constraint user_textbook_selections_pkey;

alter table public.user_textbook_selections
  add primary key (user_id, series, step);

comment on column public.user_textbook_selections.series is
  '시리즈 id (packages/library-pipeline series-catalog.ts). 기본값 reading — 이 열이 생기기 전 담긴 책은 전부 독해였다(실측 2026-09-12: 2행).';
