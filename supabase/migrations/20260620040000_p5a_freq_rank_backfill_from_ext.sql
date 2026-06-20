-- 20260620040000_p5a_freq_rank_backfill_from_ext.sql
-- ═══════════════════════════════════════════════════════════
-- P5a — V6~V11 frequency_rank 백필 (D2 해결)
--
-- 변경: V6~V11 학습밴드에서 frequency_rank IS NULL 이면서
--       lemma_band 가 있는 단어 16,492건의 frequency_rank 를
--       lemma_band → 정수 변환으로 백필.
--
-- 백필 식 (deterministic · vendor-neutral):
--   lemma_band 'XXk' → XX * 1000 + 500 (밴드 중간점)
--   예: '13k' → 13500 · '4k' → 4500 · '1k' → 1500
--
-- 효과 (실측 2026-06-20):
--   V6~V11 frequency_rank 충전: 22.7% → 64.1% (+41.4pp · D2 60% 통과)
--   V6~V8 CSAT 핵심:           40.0% → 56.6% (+16.6pp)
--   25 distinct band (1500~25500)
--
-- 멱등: WHERE frequency_rank IS NULL 절로 자연 보장.
-- 롤백: shared_dictionary_p5a_backup_20260620 (PK=word) 기반 역 UPDATE.
--   UPDATE shared_dictionary sd
--   SET frequency_rank = NULL,
--       frequency_sources = frequency_sources - 'p5a_backfill'
--   FROM shared_dictionary_p5a_backup_20260620 b
--   WHERE sd.word = b.word;
--   DROP TABLE shared_dictionary_p5a_backup_20260620;
-- ═══════════════════════════════════════════════════════════

-- 1) 백업 테이블 (PK=word + 변경 전 NULL 보존 — 롤백용)
CREATE TABLE IF NOT EXISTS shared_dictionary_p5a_backup_20260620 AS
SELECT word, frequency_rank
FROM shared_dictionary
WHERE v_level BETWEEN 6 AND 11
  AND frequency_rank IS NULL
  AND lemma_band IS NOT NULL;

-- 2) 백필 UPDATE (deterministic · 멱등 보장)
UPDATE shared_dictionary
SET frequency_rank =
      (regexp_match(lemma_band, '(\d+)'))[1]::int * 1000 + 500,
    frequency_sources = jsonb_set(
      COALESCE(frequency_sources, '{}'::jsonb),
      '{p5a_backfill}',
      to_jsonb('2026-06-20T00:00:00Z'::text)
    )
WHERE v_level BETWEEN 6 AND 11
  AND frequency_rank IS NULL
  AND lemma_band IS NOT NULL;
