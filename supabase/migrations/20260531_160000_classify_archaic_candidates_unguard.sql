-- 20260531_160000_classify_archaic_candidates_unguard.sql
-- classify_archaic_candidates() 의 admin 가드 제거 — ingest 파이프라인(service_role)이
-- 형제 함수 collect_archaic_candidates() 와 동일하게 호출할 수 있도록 정합.
--
-- 배경: 20260531_140000 에서 추가한 is_admin_or_curator() 가드가 service_role 워커의
-- 호출을 막아(auth.uid() NULL → false → Forbidden) ingest 末 자동 분류 wiring 이 불가했다.
-- collect_archaic_candidates() 는 가드 없이 SECURITY DEFINER 로 동작하므로 이에 맞춘다.
--
-- 함수는 pending 행의 classification 만 결정론적으로 재분류(UPDATE)하고 카운트만 반환한다.
-- 가드 제거 후에는 SECURITY DEFINER(postgres 실행, RLS 우회)가 유일한 권한 경계가 되므로,
-- EXECUTE 를 service_role(ingest/cron) 로만 한정한다 — anon/authenticated 의 전역 재분류
-- 트리거를 차단. admin UI 가 트리거해야 하면 service_role 서버 액션 또는 별도 admin-guard
-- 래퍼로 노출할 것.
--
-- 결정론적·멱등. INSERT 없음. 연쇄 트리거 없음(archaic_candidates 트리거 부재 확인).

BEGIN;

CREATE OR REPLACE FUNCTION classify_archaic_candidates()
RETURNS TABLE(
  marked_processed INT,
  marked_addable INT,
  remaining_pending INT
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

-- 권한 경계: 가드 제거에 따라 anon/authenticated 의 EXECUTE 를 명시 회수, service_role 만 허용.
REVOKE ALL ON FUNCTION classify_archaic_candidates() FROM PUBLIC;
REVOKE ALL ON FUNCTION classify_archaic_candidates() FROM anon;
REVOKE ALL ON FUNCTION classify_archaic_candidates() FROM authenticated;
GRANT EXECUTE ON FUNCTION classify_archaic_candidates() TO service_role;

COMMIT;
