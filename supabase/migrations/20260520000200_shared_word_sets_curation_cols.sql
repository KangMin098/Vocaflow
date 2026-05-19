-- =====================================================================
-- KICE 13y sprint #16 — shared_word_sets 자동 큐레이션 지원 컬럼 추가
--
-- 신규 컬럼:
--   - subcategory       TEXT NULL — category 내 세분류 (예: 'frequent_8plus')
--   - auto_curated      BOOLEAN DEFAULT false — 자동 큐레이션 여부
--   - curation_query    JSONB NULL — 재생성 쿼리 (source_key + filters + version)
--   - regenerated_at    TIMESTAMPTZ NULL — 마지막 재생성 시각
-- =====================================================================

BEGIN;

ALTER TABLE shared_word_sets
  ADD COLUMN IF NOT EXISTS subcategory      TEXT NULL,
  ADD COLUMN IF NOT EXISTS auto_curated     BOOLEAN DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS curation_query   JSONB NULL,
  ADD COLUMN IF NOT EXISTS regenerated_at   TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_shared_sets_subcategory
  ON shared_word_sets(category, subcategory)
  WHERE is_published = true;

CREATE INDEX IF NOT EXISTS idx_shared_sets_auto_curated
  ON shared_word_sets(auto_curated, regenerated_at DESC)
  WHERE auto_curated = true;

COMMENT ON COLUMN shared_word_sets.curation_query IS
'자동 큐레이션 재생성 쿼리. {source_key, filters{raw_count_min, frequency_tier_min, question_nos, min_years}, version}';

COMMIT;
