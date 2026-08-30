-- supabase/migrations/20260830230000_tvr_article_inventory.sql
--
-- 조판 기록에 **원글 재고 두 수**를 더한다 — 문항이 붙은 것과 안 붙은 것.
--
-- ── 왜 (2026-08-30 실측) ─────────────────────────────────────────────
-- 조판이 재고로 세는 것은 **문항이 붙은 원글**이지 원글 전체가 아니다. 그 둘이
-- 크게 벌어져 있었다 — V6 은 원글 9,992편 중 8,235편(82%)에 문항이 없다.
-- 글은 이미 다 쓰여 있고 `store-new-types.mjs` 를 안 돌렸을 뿐이다.
--
-- 그런데 `/admin/textbook` 에는 이 격차가 안 보였다. 그래서 화면은 "겹치지 않는 책
-- 264권" 이라고 말하고 조판기는 같은 순간에 "28권" 을 찍고 있었다 —
-- `distinct_volumes` 를 기록할 때만 전체 원글로 나눴기 때문이다(출력은 문항 있는
-- 원글로 나눈다). **거짓말하는 화면은 없는 화면보다 나쁘다.**
-- 조판기 쪽 계산을 출력과 같게 맞추고, 격차를 화면이 볼 수 있도록 여기 남긴다.

BEGIN;

ALTER TABLE public.textbook_volume_renders
  ADD COLUMN IF NOT EXISTS articles_with_items smallint CHECK (articles_with_items >= 0),
  ADD COLUMN IF NOT EXISTS articles_idle       smallint CHECK (articles_idle >= 0);

COMMENT ON COLUMN public.textbook_volume_renders.articles_with_items IS
  '문항이 붙은 원글 수 — 조판이 실제로 쓸 수 있는 재고. distinct_volumes 의 분자다.';
COMMENT ON COLUMN public.textbook_volume_renders.articles_idle IS
  '쓰여 있는데 문항이 안 붙은 원글 수. 0 이 아니면 store-new-types.mjs --band N 을 돌릴 몫이 남아 있다.';

COMMIT;
