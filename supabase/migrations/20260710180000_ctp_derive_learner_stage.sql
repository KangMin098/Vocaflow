-- CTP P3 — derive_learner_stage(uuid): 학습자 stage 실시간 파생 (컬럼 저장 금지 · §9 R(t) 동형)
-- csat_stage_gates 전 지표(coverage·wpm·item_accuracy·listening) 통과 최대 단계.
-- 지표: wpm=reading_fluency_log(유효 세션) · item_accuracy=csat_item_attempts ·
--   listening=echo_match_attempts.overall_score/100 · coverage=v1 current_v_level 대리(실 per-content=v2).
-- SECURITY INVOKER — RLS 로 본인 데이터만.
-- ⚠ 적용 이력: apply_migration 이 함수 본문 $$ 경계에서 오분할 → execute_sql 로 적용됨(내용 동일).
CREATE OR REPLACE FUNCTION public.derive_learner_stage(p_user_id uuid) RETURNS text LANGUAGE plpgsql STABLE AS $fn$
DECLARE
  v_wpm numeric; v_acc numeric; v_vlevel int; v_listen numeric;
  v_stage text := 'S1';
  r record; g record; ok boolean; m text; th numeric; reqv int;
BEGIN
  SELECT CASE WHEN sum(extract(epoch FROM (ended_at-started_at))/60.0)>0 THEN sum(word_count)/sum(extract(epoch FROM (ended_at-started_at))/60.0) END
    INTO v_wpm FROM public.reading_fluency_log
    WHERE user_id=p_user_id AND comprehension_ok IS TRUE AND ended_at IS NOT NULL AND is_rereading IS FALSE;
  SELECT avg(is_correct::int) INTO v_acc FROM public.csat_item_attempts WHERE user_id=p_user_id;
  SELECT current_v_level INTO v_vlevel FROM public.user_profiles WHERE user_id=p_user_id;
  SELECT avg(overall_score)/100.0 INTO v_listen FROM public.echo_match_attempts WHERE user_id=p_user_id;
  FOR r IN SELECT stage, jsonb_agg(jsonb_build_object('metric',metric,'threshold',threshold)) AS gates FROM public.csat_stage_gates GROUP BY stage ORDER BY stage LOOP
    ok := true;
    reqv := LEAST(substring(r.stage FROM 2)::int * 2, 9);
    FOR g IN SELECT value AS gate FROM jsonb_array_elements(r.gates) LOOP
      m := g.gate->>'metric';
      th := (g.gate->>'threshold')::numeric;
      IF    m='wpm'           AND (v_wpm    IS NULL OR v_wpm    < th) THEN ok:=false;
      ELSIF m='item_accuracy' AND (v_acc    IS NULL OR v_acc    < th) THEN ok:=false;
      ELSIF m='listening'     AND (v_listen IS NULL OR v_listen < th) THEN ok:=false;
      ELSIF m='coverage'      AND coalesce(v_vlevel,1) < reqv          THEN ok:=false;
      END IF;
    END LOOP;
    IF ok THEN v_stage := 'S' || LEAST(substring(r.stage FROM 2)::int + 1, 5); ELSE EXIT; END IF;
  END LOOP;
  RETURN v_stage;
END $fn$;
COMMENT ON FUNCTION public.derive_learner_stage(uuid) IS 'CTP 학습자 stage 실시간 파생(csat_stage_gates 통과 최대 단계). 컬럼 저장 금지. coverage=v1 current_v_level 대리.';
