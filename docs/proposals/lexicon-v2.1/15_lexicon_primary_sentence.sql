-- =====================================================================
-- 15_lexicon_primary_sentence.sql (DRAFT)
--
-- word_lexicon 에 primary_sentence_id 컬럼 추가.
-- sentences 테이블이 적용된 후에만 실행 가능.
--
-- 적용 순서:
--   14_lexicon_v2_1.sql       (word_lexicon 생성 — primary_sentence_id 부재)
--     ↓
--   (sentences 마이그레이션)  (v2 sentences 1급 엔티티)
--     ↓
--   15_lexicon_primary_sentence.sql (본 파일)
-- =====================================================================

BEGIN;

-- Prereq 체크 + idempotent guard
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sentences') THEN
    RAISE EXCEPTION 'sentences table missing — apply sentences migration first';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'word_lexicon') THEN
    RAISE EXCEPTION 'word_lexicon table missing — apply 14_lexicon_v2_1.sql first';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'word_lexicon' AND column_name = 'primary_sentence_id'
  ) THEN
    RAISE NOTICE 'primary_sentence_id column already exists — skipping';
    RETURN;
  END IF;

  RAISE NOTICE 'Prerequisites OK';
END $$;

ALTER TABLE word_lexicon
  ADD COLUMN IF NOT EXISTS primary_sentence_id UUID
    REFERENCES sentences(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lexicon_primary_sentence
  ON word_lexicon(primary_sentence_id)
  WHERE primary_sentence_id IS NOT NULL;

COMMIT;
