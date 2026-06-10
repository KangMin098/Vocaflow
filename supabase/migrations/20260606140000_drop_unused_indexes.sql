-- supabase/migrations/20260606140000_drop_unused_indexes.sql
-- ═══════════════════════════════════════════════════════════
-- DB 최적화 — 사용 0회 인덱스 + 정확한 중복 인덱스 DROP
--
-- 진단 (pg_stat_user_indexes):
--   idx_shared_words_set            (1976 kB, scan=0) - idx_shared_words_set_v2 와 정확히 동일 def
--   idx_shared_words_cefr           ( 896 kB, scan=0)
--   idx_source_tags_metadata_gin    (3144 kB, scan=0)
--   idx_lexicon_lemma_trgm          (1392 kB, scan=0) - word_lexicon Phase E DROP 예정과 연관
--
-- 총 ~7.4 MB heap+idx 회수. 모든 인덱스 idx_scan=0 (한 번도 사용 안 됨) 또는 정확히 중복.
-- ═══════════════════════════════════════════════════════════

BEGIN;

DROP INDEX IF EXISTS public.idx_shared_words_set;
DROP INDEX IF EXISTS public.idx_shared_words_cefr;
DROP INDEX IF EXISTS public.idx_source_tags_metadata_gin;
DROP INDEX IF EXISTS public.idx_lexicon_lemma_trgm;

COMMIT;
