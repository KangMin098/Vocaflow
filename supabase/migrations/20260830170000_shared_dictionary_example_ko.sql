-- supabase/migrations/20260830170000_shared_dictionary_example_ko.sql
--
-- 대표 예문의 **한국어 번역** 자리.
--
-- ── 왜 필요한가 (실측 2026-08-30) ───────────────────────────────────
-- 시중 단어장 대비 우위지수에서 V2(예문 한국어역)만 지고 있다 — 우리 2.3% / 시장 92.1%.
-- 그런데 그 축은 지금 구조상 **24.1% 가 천장**이다:
--
--   발행 카탈로그 표제어 11,183
--     ├ 뜻마다 붙은 예문을 가진 것   2,696  → senses[].examples_ko 로 채울 수 있다(마이그레이션 불필요)
--     └ `example_en` 컬럼에만 있는 것 8,487  → **짝이 되는 칸이 없다**
--
-- 그 8,487 의 번역을 `senses[0].examples_ko` 에 밀어 넣을 수도 있었지만 그러지 않았다 —
-- 대표 예문이 정말 0번 뜻의 예문이라는 보장이 없어서 **짝이 어긋난 번역**이 되기 때문이다.
-- 학습자가 다른 뜻의 문장에 붙은 번역을 읽게 되는 것은 번역이 없는 것보다 나쁘다.
--
-- `example_en` 이 컬럼으로 있으니 그 짝도 컬럼으로 있는 것이 맞다. 그래서 한 칸을 연다.
--
-- 되돌리기: NULL 허용 · 기본값 없음 · 기존 행 미수정이라 DROP COLUMN 으로 원상복구된다.

BEGIN;

ALTER TABLE public.shared_dictionary
  ADD COLUMN IF NOT EXISTS example_ko TEXT;

COMMENT ON COLUMN public.shared_dictionary.example_ko IS
  'Korean translation of example_en (the headword''s representative example).
   Per-sense example translations live in senses[].examples_ko instead — do not mix the two:
   this column pairs ONLY with example_en.';

COMMIT;
