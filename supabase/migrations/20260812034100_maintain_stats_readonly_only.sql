-- 20260812034100_maintain_stats_readonly_only.sql
-- maintain_reference_stats 범위 축소 — 내가 만든 부하를 제거한다.
--
-- 실측: pg_stat_statements 에서 이 함수가 2회 호출에 2,608초(평균 21.7분)로
--   전체 부하의 13.3%. 배치 러너가 매 배치 끝마다 호출하므로 그때마다 20분씩
--   디스크를 태운다. 감사(N×M 정규식)에 이은 두 번째 자책골이다.
--
-- 원인은 화이트리스트를 너무 넓게 잡은 것:
--   autoanalyze 가 영원히 안 도는 건 갱신이 없는 읽기 전용 사전뿐이다.
--   library_book_vocabularies(964MB)·shared_words·content_chunks 는 적재/갱신이
--   잦아 autoanalyze 가 정상 작동한다(last_autoanalyze 기록 확인). 그것들까지
--   statement_timeout=0 으로 매번 전수 ANALYZE 할 이유가 없었다.
--
-- 수정 두 가지:
--   ① 대상을 읽기 전용 사전 7종으로 좁힌다 (갱신 테이블은 autoanalyze 에 맡긴다)
--   ② 이미 분석된 테이블은 건너뛴다 — 통계가 없거나 마지막 분석 후 10% 이상
--      변경된 것만 실제로 ANALYZE 한다.
--   반복 호출이 사실상 무료가 되어, 배치가 끝날 때마다 불러도 안전해진다.
--
-- 적용 후 실측: 전 테이블 'skipped (fresh)' → 21.7분이 즉시 완료로.
--
-- DROP 선행: 반환 컬럼에 action 을 추가해 OUT 파라미터 구성이 바뀌었다
--   (42P13 cannot change return type of existing function).

DROP FUNCTION IF EXISTS public.maintain_reference_stats();

CREATE FUNCTION public.maintain_reference_stats()
RETURNS TABLE(table_name text, action text, live_tuples bigint, analyzed_at timestamptz)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '0'
SET lock_timeout TO '5s'
AS $function$
DECLARE
  -- 읽기 전용이라 autoanalyze 임계값에 도달하지 못하는 사전 계열만.
  -- (갱신이 잦은 lbv·shared_words·content_chunks 는 의도적으로 제외 — 위 주석)
  v_tables text[] := ARRAY[
    'shared_dictionary', 'lexicon_clean', 'spelling_norm', 'dialect_map',
    'archaic_dictionary', 'coverage_lexicon', 'english_irregular_forms'
  ];
  v_t     text;
  v_stale boolean;
BEGIN
  FOREACH v_t IN ARRAY v_tables LOOP
    CONTINUE WHEN to_regclass('public.' || quote_ident(v_t)) IS NULL;

    -- 분석 이력이 없거나, 마지막 분석 이후 10% 넘게 바뀐 경우만
    SELECT COALESCE(s.last_analyze, s.last_autoanalyze) IS NULL
           OR s.n_mod_since_analyze > GREATEST(s.n_live_tup / 10, 1000)
      INTO v_stale
    FROM pg_stat_user_tables s WHERE s.relname = v_t;

    IF COALESCE(v_stale, true) THEN
      EXECUTE format('ANALYZE public.%I', v_t);
      RETURN QUERY SELECT v_t, 'analyzed'::text, s.n_live_tup,
                          COALESCE(s.last_analyze, s.last_autoanalyze)
                   FROM pg_stat_user_tables s WHERE s.relname = v_t;
    ELSE
      RETURN QUERY SELECT v_t, 'skipped (fresh)'::text, s.n_live_tup,
                          COALESCE(s.last_analyze, s.last_autoanalyze)
                   FROM pg_stat_user_tables s WHERE s.relname = v_t;
    END IF;
  END LOOP;
END;
$function$;

COMMENT ON FUNCTION public.maintain_reference_stats() IS
  '읽기 전용 사전 계열 통계 갱신 — autoanalyze 가 도달하지 못하는 테이블만, 낡은 것만. 갱신 잦은 대형 테이블(lbv 등)은 autoanalyze 에 맡긴다.';

REVOKE ALL ON FUNCTION public.maintain_reference_stats() FROM public;
GRANT EXECUTE ON FUNCTION public.maintain_reference_stats() TO service_role;
