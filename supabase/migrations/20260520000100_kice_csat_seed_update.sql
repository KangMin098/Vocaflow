-- =====================================================================
-- KICE 13y sprint #15 — frequency_data_sources.kice_csat citation 갱신
--
-- v2.1 schema seed 의 citation 은 'KICE 수능 영어영역 전체 기출 (1994~)' 였음.
-- 본 sprint 적재 범위에 맞춰 2014-2026 (13개년) 으로 갱신.
-- url 은 suneung.re.kr 로 갱신 (kice.re.kr 의 수능 전용 서브도메인).
-- =====================================================================

BEGIN;

UPDATE frequency_data_sources
SET
  citation = '한국교육과정평가원 대학수학능력시험 영어 영역 2014~2026 (13개년)',
  url      = 'https://www.suneung.re.kr/'
WHERE source_key = 'kice_csat';

-- 검증
DO $$
DECLARE v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM frequency_data_sources
  WHERE source_key = 'kice_csat'
    AND citation LIKE '%2014~2026%';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'kice_csat citation update 실패: count=%', v_count;
  END IF;
END $$;

COMMIT;
