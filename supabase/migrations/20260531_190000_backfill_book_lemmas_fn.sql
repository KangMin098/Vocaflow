-- 20260531_190000_backfill_book_lemmas_fn.sql
-- LCP 재발 방지 — 도서 lemma backfill 을 함수화해 ingest 파이프라인이 권당 자동 호출.
--
-- 배경: analyzeBook 이 library_book_vocabularies 에 word 만 채우고 lemma 를 안 채움.
-- lemma NULL 이면 extract_book_vocabulary_admin 의 direct(d.word=lemma)·book_levels 가
-- 무력화 → percentile 무효 + seed 미반영 ("Twenty years after" 사례). Phase 3B 일괄
-- backfill 이후 추가된 도서가 누락되는 구조적 결함.
--
-- 규칙(다른 6권 역추적 = Sherlock 기준, 채워진 lemma 100% 완전 표제어):
--   1순위 word 자체가 완전 표제어(v_level+classified_by+meaning_ko) → lemma = word
--   2순위 en_inflection_bases(word) 의 완전 표제어 base → lemma = base
--   3순위 둘 다 실패 → NULL 유지 (추출기 inflection_recovery 가 word 로 처리, 무회귀)
--
-- 멱등(lemma IS NULL 만). SECURITY DEFINER, service_role(ingest)·postgres(cron) 호출.

BEGIN;

CREATE OR REPLACE FUNCTION backfill_book_lemmas(p_book_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_filled INT;
BEGIN
  UPDATE library_book_vocabularies lbv
  SET lemma = COALESCE(
    (SELECT d.word FROM shared_dictionary d
       WHERE d.word = lower(trim(lbv.word))
         AND d.v_level IS NOT NULL AND d.classified_by IS NOT NULL
         AND d.meaning_ko IS NOT NULL AND LENGTH(d.meaning_ko) > 0
       LIMIT 1),
    (SELECT id.word FROM unnest(en_inflection_bases(lower(trim(lbv.word)))) AS cand(c)
       JOIN shared_dictionary id ON id.word = cand.c
       WHERE id.v_level IS NOT NULL AND id.classified_by IS NOT NULL
         AND id.meaning_ko IS NOT NULL AND LENGTH(id.meaning_ko) > 0
       ORDER BY id.word LIMIT 1)
  )
  WHERE lbv.library_book_id = p_book_id AND lbv.lemma IS NULL;
  GET DIAGNOSTICS v_filled = ROW_COUNT;
  RETURN v_filled;
END $$;

REVOKE ALL ON FUNCTION backfill_book_lemmas(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION backfill_book_lemmas(UUID) FROM anon;
REVOKE ALL ON FUNCTION backfill_book_lemmas(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION backfill_book_lemmas(UUID) TO service_role;

COMMIT;
