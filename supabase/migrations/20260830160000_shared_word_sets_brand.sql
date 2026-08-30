-- supabase/migrations/20260830160000_shared_word_sets_brand.sql
--
-- 단어장에 **출판 정보**를 붙인다 — 교재의 `textbook_volume_renders` 와 같은 자리.
--
-- ── 왜 두 칸인가 ───────────────────────────────────────────────────
--
-- ① `brand_fingerprint` — 발행 당시 브랜드 규격의 지문(FNV-1a 8자리).
--    `packages/library-pipeline/src/vocab/brand.ts` 의 `vocabBrandFingerprint()` 값이다.
--    **색을 여기 복사하지 않는다** — 복사하면 정본이 둘이 되고 토큰이 바뀌어도 안 따라온다.
--    지문만 남기면 나중에 토큰이 바뀌었을 때 현재 지문과 달라지므로,
--    화면이 "이 권은 옛 규격으로 만들어졌다" 를 말할 수 있다. 유도 불가능한 값이라 저장한다.
--
-- ② `ladder_step` — 사다리에서 이 권의 자리(1~7).
--    ⚠️ **파생값을 저장하는 것이 아니다.** 지금 화면은 `category`·`cefr_level` 로 계단을
--    *추정*하는데(`lib/library/vocab/rung.ts`), 그건 신호가 없어 어쩔 수 없이 하는 추정이다.
--    이 칸은 **컴포저가 정한 값**을 담는다 — `curation_query.blueprint` 이 그러하듯 저작물이다.
--    NULL 이면 "아직 안 정했다" 는 뜻이고, 그때만 화면이 추정으로 내려간다.
--    (그래서 `memory_state` 처럼 계산 결과를 굳히는 안티패턴에 해당하지 않는다.)
--
-- 되돌리기: 두 컬럼 모두 NULL 허용 · 기본값 없음이라 DROP COLUMN 으로 원상복구된다.
--           기존 행은 건드리지 않는다(UPDATE 없음).

BEGIN;

ALTER TABLE public.shared_word_sets
  ADD COLUMN IF NOT EXISTS brand_fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS ladder_step SMALLINT;

-- 사다리는 일곱 단이다(`VOCAB_SPINE`). 여덟 번째가 들어오면 화면이 조용히 그 권을 잃는다 —
-- 어느 계단에도 안 걸리기 때문이다. 그래서 DB 에서 막는다.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shared_word_sets_ladder_step_range'
  ) THEN
    ALTER TABLE public.shared_word_sets
      ADD CONSTRAINT shared_word_sets_ladder_step_range
      CHECK (ladder_step IS NULL OR ladder_step BETWEEN 1 AND 7);
  END IF;
END $$;

COMMENT ON COLUMN public.shared_word_sets.brand_fingerprint IS
  'Brand spec fingerprint at publish time (FNV-1a, 8 hex) from vocabBrandFingerprint().
   Colors are NOT copied here — the design tokens remain the single source of truth.
   A mismatch against the current fingerprint means this volume was made to an older spec.';

COMMENT ON COLUMN public.shared_word_sets.ladder_step IS
  'Authored rung on the 7-step vocabulary ladder (VOCAB_SPINE). NOT a cached derivation:
   the composer sets it. NULL means unassigned, and only then does the UI fall back to
   inferring a step from category/cefr_level (lib/library/vocab/rung.ts).';

-- 계단으로 서가를 훑는 질의가 잦아진다(계단별 재고·계단 필터). 부분 인덱스로 충분하다 —
-- 아직 대부분이 NULL 이라 전체 인덱스는 자리만 차지한다.
CREATE INDEX IF NOT EXISTS idx_sws_ladder_step
  ON public.shared_word_sets(ladder_step) WHERE ladder_step IS NOT NULL;

COMMIT;
