-- VCB §19 — shared_dictionary 확장 (P1 of dict-opt sprint)
-- 의존: shared_dictionary 기본 컬럼 존재 (word, pos, cefr_level, meaning_ko, ...)
-- 패턴: ALTER ADD IF NOT EXISTS + DO $$ guard (idempotent)
--
-- 신규 컬럼 4종 (shared_words 확장과 type 정합):
--   ipa                  TEXT         발음 기호
--   collocations         TEXT[]       연어
--   register             TEXT CHECK   격식도 (formal/neutral/informal)
--   korean_learner_note  TEXT         한국 학습자 맥락 노트
--
-- frequency_band 은 추가하지 않음 — frequency_rank 가 이미 더 정밀.
-- 'slang' 은 register CHECK 에서 제외 — VCB enrichment 룰 (formal/neutral/informal) 과 정합.

-- ─── 1. 컬럼 추가 ───
ALTER TABLE public.shared_dictionary
  ADD COLUMN IF NOT EXISTS ipa TEXT,
  ADD COLUMN IF NOT EXISTS collocations TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS register TEXT,
  ADD COLUMN IF NOT EXISTS korean_learner_note TEXT;

-- ─── 2. register CHECK 제약 ───
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.shared_dictionary'::regclass
      AND conname = 'shared_dictionary_register_check'
  ) THEN
    ALTER TABLE public.shared_dictionary
      ADD CONSTRAINT shared_dictionary_register_check
      CHECK (register IS NULL OR register IN ('formal', 'neutral', 'informal'));
  END IF;
END $$;

-- ─── 3. 인덱스 ───
CREATE INDEX IF NOT EXISTS idx_shared_dictionary_register
  ON public.shared_dictionary(register);
CREATE INDEX IF NOT EXISTS idx_shared_dictionary_collocations_gin
  ON public.shared_dictionary USING GIN(collocations);
