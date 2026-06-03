-- 20260531_140000_classify_archaic_candidates.sql
-- 큐레이션 스케일링 — archaic_candidates.pending 자동 분류 배치.
--
-- 문제: ingest 마다 collect_archaic_candidates 가 미바인딩어를 pending 으로 적재하지만,
-- 분류가 자동화 안 되어 pending 이 적체된다 (7권에 2,431건). 수백 권 규모면 폭증.
--
-- 해결: 기존 결정론적 레이어를 pending 에 적용해 79% 를 자동 해소.
--   1) 추출기(extract_*)가 freq_external_a inflections 클러스터로 base 에 binding 하는 단어
--      → 'processed' (추출 시 base 로 surface 됨 — 사전 gap 아님. 미바인딩 리포트에서 제거)
--   2) 나머지 중 en_derivational_bases 로 in-dict base 분해되는 단어
--      → 'addable_modern' (파생 row seed 후보 라벨 — 실제 seed 는 재출현 게이트 별도 단계)
--   3) 그 외 (고유명사·외국어·OCR·신규 단형태소) → pending 유지
--      = 재출현(book_count) 게이트로 소수만 사람/seed. 단일 책 hapax 는 무해하게 잔존.
--
-- 결정론적·멱등. pending row 만 변경. INSERT 없음 (seed 는 별도).
-- 스케일: set-based UPDATE — 수만 건도 단일 호출. ingest 末 자동 호출 권장(별도 wire-up).

BEGIN;

CREATE OR REPLACE FUNCTION classify_archaic_candidates()
RETURNS TABLE(
  marked_processed INT,    -- 클러스터 회수 → processed
  marked_addable INT,      -- 파생 base 존재 → addable_modern
  remaining_pending INT    -- 잔존 pending (재출현 게이트 대상)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_proc INT;
  v_add INT;
  v_rem INT;
BEGIN
  IF NOT is_admin_or_curator() THEN
    RAISE EXCEPTION 'Forbidden: admin or curator only';
  END IF;

  -- 1) 클러스터 회수 가능 → processed (추출기와 동일 조건: full meta)
  WITH cand AS (
    SELECT ac.word
    FROM archaic_candidates ac
    WHERE ac.classification = 'pending'
      AND EXISTS (
        SELECT 1 FROM shared_dictionary d
        WHERE d.inflections @? format('$.forms[*].form ? (@ == "%s")', ac.word)::jsonpath
          AND d.v_level IS NOT NULL AND d.classified_by IS NOT NULL
          AND d.meaning_ko IS NOT NULL AND LENGTH(d.meaning_ko) > 0
      )
  )
  UPDATE archaic_candidates a
  SET classification = 'processed', processed_at = now(), updated_at = now()
  FROM cand WHERE a.word = cand.word;
  GET DIAGNOSTICS v_proc = ROW_COUNT;

  -- 2) 잔존 pending 중 파생 base 존재 → addable_modern (seed 후보)
  WITH cand AS (
    SELECT ac.word
    FROM archaic_candidates ac
    WHERE ac.classification = 'pending'
      AND EXISTS (
        SELECT 1 FROM unnest(en_derivational_bases(ac.word)) AS c(x)
        JOIN shared_dictionary sd ON sd.word = c.x
        WHERE sd.v_level IS NOT NULL AND sd.classified_by IS NOT NULL
          AND sd.meaning_ko IS NOT NULL AND LENGTH(sd.meaning_ko) > 0
      )
  )
  UPDATE archaic_candidates a
  SET classification = 'addable_modern', updated_at = now()
  FROM cand WHERE a.word = cand.word;
  GET DIAGNOSTICS v_add = ROW_COUNT;

  SELECT count(*)::int INTO v_rem
  FROM archaic_candidates WHERE classification = 'pending';

  RETURN QUERY SELECT v_proc, v_add, v_rem;
END $$;

REVOKE ALL ON FUNCTION classify_archaic_candidates() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION classify_archaic_candidates() TO authenticated;

COMMIT;
