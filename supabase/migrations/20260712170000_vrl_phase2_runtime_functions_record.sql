-- VRL Phase 2 런타임 함수 기록 (스키마 드리프트 복구 · 2026-07-12).
--
-- 발견: 진단·프로필·자동상향 런타임 함수 12종이 committed 마이그레이션에 부재(out-of-band 적용) →
--   마이그만으로 DB 재구축 시 DiagnosticClient/VLevelPromotionCheck/pg_cron 이 호출하는 RPC 전부 부재.
--   본 파일은 현 DB 정의를 pg_get_functiondef 로 덤프해 의존 순서로 기록(동작 변경 0 · CREATE OR REPLACE 동일본).
--
-- ⚠️ 잔여 드리프트(본 파일 범위 밖, 후속 기록 필요): 이 함수들이 참조하는
--   테이블 user_level_snapshots·vrl_data_integrity_concerns 의 CREATE TABLE,
--   user_profiles 의 <axis>_meta / target_v_level_meta / segment 등 컬럼 ALTER,
--   진단 문항 시드(vrl_diagnostic_tests/questions) — DB엔 존재하나 마이그 이력엔 부재.
--   (함수는 CREATE OR REPLACE 라 참조 해소가 호출 시점이므로 본 기록만으로도 적용 자체는 성공.)

-- ═══ leaf 유틸 ═══

-- effective_confidence — meta.confidence 를 estimated_at 기준 반감(180일) 감쇠.
CREATE OR REPLACE FUNCTION public.effective_confidence(p_meta jsonb)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  v_base NUMERIC; v_at TIMESTAMPTZ; v_days NUMERIC; v_decay NUMERIC;
BEGIN
  IF p_meta IS NULL THEN RETURN NULL; END IF;
  v_base := (p_meta->>'confidence')::numeric;
  v_at   := (p_meta->>'estimated_at')::timestamptz;
  IF v_base IS NULL OR v_at IS NULL THEN RETURN v_base; END IF;
  v_days  := GREATEST(EXTRACT(EPOCH FROM (now() - v_at)) / 86400.0, 0);
  v_decay := POWER(0.5, v_days / 180.0);
  RETURN ROUND(LEAST(GREATEST(v_base * v_decay, 0), 1)::numeric, 3);
END $function$;

-- calculate_next_review_due — 활동/신뢰도로 다음 레벨 재검토 due 계산(1~90일).
CREATE OR REPLACE FUNCTION public.calculate_next_review_due(p_user_id uuid)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
  v_activity NUMERIC; v_conf NUMERIC; v_days NUMERIC;
BEGIN
  SELECT learning_activity_score,
         public.effective_confidence(current_v_level_meta)
    INTO v_activity, v_conf
  FROM public.user_profiles WHERE user_id = p_user_id;
  IF NOT FOUND THEN RETURN now() + INTERVAL '14 days'; END IF;
  v_days := 14.0 * (1.0 - 0.5 * COALESCE(v_activity, 0)) * (0.5 + COALESCE(v_conf, 0.5));
  v_days := GREATEST(LEAST(v_days, 90), 1);
  RETURN now() + (v_days || ' days')::interval;
END $function$;

-- ═══ V-Level 갱신 코어 ═══

-- update_user_v_level — 프로필 v_level 갱신 + snapshot audit INSERT(advisory lock · source/reason 검증).
CREATE OR REPLACE FUNCTION public.update_user_v_level(p_user_id uuid, p_new_level smallint, p_source text, p_confidence numeric, p_reason text, p_diagnostic_id uuid DEFAULT NULL::uuid, p_triggered_by text DEFAULT 'api'::text, p_trigger_details jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_lock_key BIGINT;
  v_old_level SMALLINT;
  v_new_meta JSONB;
  v_snapshot_id UUID;
  v_prev_snap_id UUID;
  v_profile_segment TEXT;
  v_profile_goal TEXT;
  v_profile_cefr TEXT;
  v_target_lvl SMALLINT;
  v_target_meta JSONB;
BEGIN
  v_lock_key := hashtextextended('user_v_level_' || p_user_id::text, 0);
  PERFORM pg_advisory_xact_lock(v_lock_key);

  IF p_source NOT IN ('system_default','self_declared','diagnostic','learning_data','manual_override') THEN
    RAISE EXCEPTION 'Invalid source: %', p_source;
  END IF;
  IF p_confidence IS NOT NULL AND (p_confidence < 0 OR p_confidence > 1) THEN
    RAISE EXCEPTION 'confidence out of range: %', p_confidence;
  END IF;
  IF p_new_level < 0 OR p_new_level > 11 THEN
    RAISE EXCEPTION 'level out of range: %', p_new_level;
  END IF;
  IF p_reason NOT IN ('initial','diagnostic','self_declared','mastery_calc','scheduled','manual_override') THEN
    RAISE EXCEPTION 'Invalid reason: %', p_reason;
  END IF;
  IF p_triggered_by NOT IN ('api','cron','admin','system','internal') THEN
    RAISE EXCEPTION 'Invalid triggered_by: %', p_triggered_by;
  END IF;

  SELECT current_v_level, segment, learning_goal, cefr_level,
         target_v_level, target_v_level_meta
    INTO v_old_level, v_profile_segment, v_profile_goal, v_profile_cefr,
         v_target_lvl, v_target_meta
  FROM public.user_profiles WHERE user_id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'User % not found', p_user_id; END IF;

  SELECT id INTO v_prev_snap_id
  FROM public.user_level_snapshots
  WHERE user_id = p_user_id
  ORDER BY taken_at DESC LIMIT 1;

  v_new_meta := jsonb_build_object(
    'level',        p_new_level,
    'source',       p_source,
    'confidence',   p_confidence,
    'estimated_at', now()::text,
    'status',       'active'
  ) || CASE WHEN p_diagnostic_id IS NOT NULL
       THEN jsonb_build_object('diagnostic_result_id', p_diagnostic_id::text)
       ELSE '{}'::jsonb END;

  UPDATE public.user_profiles
  SET current_v_level = p_new_level,
      current_v_level_meta = v_new_meta,
      next_level_review_due_at = public.calculate_next_review_due(p_user_id),
      updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO public.user_level_snapshots (
    user_id, v_level, v_level_meta, previous_v_level,
    track_levels, domain_levels, skill_levels,
    learning_activity_score, total_words_seen, total_words_mastered,
    taken_reason, diagnostic_result_id, taken_at,
    snapshot_type, triggered_by, trigger_details,
    previous_snapshot_id,
    target_v_level, target_v_level_meta,
    segment, learning_goal, cefr_level
  )
  SELECT user_id, current_v_level, current_v_level_meta, v_old_level,
         current_track_levels, current_domain_levels, current_skill_levels,
         learning_activity_score, total_words_seen, total_words_mastered,
         p_reason, p_diagnostic_id, now(),
         'level_change', p_triggered_by, p_trigger_details,
         v_prev_snap_id,
         v_target_lvl, v_target_meta,
         v_profile_segment, v_profile_goal, v_profile_cefr
  FROM public.user_profiles WHERE user_id = p_user_id
  RETURNING id INTO v_snapshot_id;

  RETURN v_snapshot_id;
END $function$;

-- ═══ 진단 분석 ═══

-- analyze_diagnostic_result — base V-Level 진단 응답 → estimated_v_level(정확도≥0.70 최고 밴드) + 신뢰도.
CREATE OR REPLACE FUNCTION public.analyze_diagnostic_result(p_result_id uuid)
 RETURNS TABLE(estimated_v_level smallint, confidence numeric, per_level jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_responses JSONB;
  v_per_level JSONB;
  v_est_level SMALLINT;
  v_conf NUMERIC;
BEGIN
  SELECT responses INTO v_responses
  FROM public.user_diagnostic_results WHERE id = p_result_id;

  IF v_responses IS NULL THEN
    RAISE EXCEPTION 'user_diagnostic_results % not found', p_result_id;
  END IF;

  WITH resp AS (
    SELECT (r->>'question_id')::uuid AS qid, (r->>'knew')::bool AS knew
    FROM jsonb_array_elements(v_responses) r
  ),
  joined AS (
    SELECT q.target_v_level AS vl, r.knew
    FROM resp r JOIN public.vrl_diagnostic_questions q ON q.id = r.qid
    WHERE q.target_v_level IS NOT NULL
  ),
  per_level_calc AS (
    SELECT vl,
      COUNT(*) FILTER (WHERE knew) AS correct,
      COUNT(*) AS total,
      ROUND(COUNT(*) FILTER (WHERE knew)::numeric / NULLIF(COUNT(*), 0), 3) AS acc
    FROM joined GROUP BY vl
  )
  SELECT jsonb_object_agg(
    vl::text,
    jsonb_build_object('correct', correct, 'total', total, 'accuracy', acc)
  ) INTO v_per_level FROM per_level_calc;

  IF v_per_level IS NULL THEN v_per_level := '{}'::jsonb; END IF;

  WITH per_level_arr AS (
    SELECT (key::int) AS vl, (value->>'accuracy')::numeric AS acc
    FROM jsonb_each(v_per_level)
  )
  SELECT COALESCE(MAX(vl), 1)::smallint INTO v_est_level
  FROM per_level_arr WHERE acc >= 0.70;

  WITH conf_calc AS (
    SELECT
      COALESCE(SUM((value->>'correct')::numeric), 0) AS total_correct,
      COALESCE(SUM((value->>'total')::numeric), 0) AS total_qty
    FROM jsonb_each(v_per_level)
  )
  SELECT ROUND(CASE WHEN total_qty > 0 THEN total_correct / total_qty ELSE 0 END, 3)
  INTO v_conf FROM conf_calc;

  RETURN QUERY SELECT v_est_level, v_conf, v_per_level;
END;
$function$;

-- analyze_track_diagnostic_result — track 진단 응답 → estimated_track_level(target_track_level 기반).
CREATE OR REPLACE FUNCTION public.analyze_track_diagnostic_result(p_result_id uuid)
 RETURNS TABLE(estimated_track_level smallint, track_id text, confidence numeric, per_level jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_responses JSONB;
  v_test_id UUID;
  v_track_id TEXT;
  v_per_level JSONB;
  v_est_level SMALLINT;
  v_conf NUMERIC;
BEGIN
  SELECT r.responses, r.test_id INTO v_responses, v_test_id
  FROM public.user_diagnostic_results r WHERE r.id = p_result_id;

  IF v_responses IS NULL THEN
    RAISE EXCEPTION 'user_diagnostic_results % not found', p_result_id;
  END IF;

  SELECT target_track_id INTO v_track_id
  FROM public.vrl_diagnostic_tests WHERE id = v_test_id;

  IF v_track_id IS NULL THEN
    RAISE EXCEPTION 'test % is not a track diagnostic (target_track_id is NULL)', v_test_id;
  END IF;

  WITH resp AS (
    SELECT (r->>'question_id')::uuid AS qid, (r->>'knew')::bool AS knew
    FROM jsonb_array_elements(v_responses) r
  ),
  joined AS (
    SELECT q.target_track_level AS tl, r.knew
    FROM resp r JOIN public.vrl_diagnostic_questions q ON q.id = r.qid
    WHERE q.target_track_level IS NOT NULL
  ),
  per_level_calc AS (
    SELECT tl,
      COUNT(*) FILTER (WHERE knew) AS correct,
      COUNT(*) AS total,
      ROUND(COUNT(*) FILTER (WHERE knew)::numeric / NULLIF(COUNT(*), 0), 3) AS acc
    FROM joined GROUP BY tl
  )
  SELECT jsonb_object_agg(
    tl::text,
    jsonb_build_object('correct', correct, 'total', total, 'accuracy', acc)
  ) INTO v_per_level FROM per_level_calc;

  IF v_per_level IS NULL THEN v_per_level := '{}'::jsonb; END IF;

  WITH per_level_arr AS (
    SELECT (key::int) AS tl, (value->>'accuracy')::numeric AS acc
    FROM jsonb_each(v_per_level)
  )
  SELECT COALESCE(MAX(tl), 1)::smallint INTO v_est_level
  FROM per_level_arr WHERE acc >= 0.70;

  WITH conf_calc AS (
    SELECT
      COALESCE(SUM((value->>'correct')::numeric), 0) AS total_correct,
      COALESCE(SUM((value->>'total')::numeric), 0) AS total_qty
    FROM jsonb_each(v_per_level)
  )
  SELECT ROUND(CASE WHEN total_qty > 0 THEN total_correct / total_qty ELSE 0 END, 3)
  INTO v_conf FROM conf_calc;

  RETURN QUERY SELECT v_est_level, v_track_id, v_conf, v_per_level;
END;
$function$;

-- ═══ 진단 적용 (analyze + user_profiles/snapshot) ═══

-- apply_diagnostic_result — estimated_v_level 을 update_user_v_level 로 반영.
CREATE OR REPLACE FUNCTION public.apply_diagnostic_result(p_diagnostic_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID; v_est_level SMALLINT; v_conf NUMERIC; v_snap_id UUID;
BEGIN
  SELECT user_id, estimated_v_level, confidence
    INTO v_user_id, v_est_level, v_conf
  FROM public.user_diagnostic_results WHERE id = p_diagnostic_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Diagnostic % not found', p_diagnostic_id; END IF;
  IF v_est_level IS NULL THEN RAISE EXCEPTION 'Diagnostic % has no estimated_v_level', p_diagnostic_id; END IF;

  v_snap_id := public.update_user_v_level(
    v_user_id, v_est_level, 'diagnostic',
    COALESCE(v_conf, 0.70), 'diagnostic', p_diagnostic_id,
    'internal',
    jsonb_build_object('caller', 'apply_diagnostic_result', 'diagnostic_id', p_diagnostic_id::text)
  );

  UPDATE public.user_profiles
  SET diagnostic_completed_at = now()
  WHERE user_id = v_user_id;

  RETURN v_snap_id;
END $function$;

-- analyze_and_apply_diagnostic_result — DiagnosticClient base 경로: analyze → set → apply.
CREATE OR REPLACE FUNCTION public.analyze_and_apply_diagnostic_result(p_result_id uuid)
 RETURNS TABLE(snapshot_id uuid, estimated_v_level smallint, confidence numeric, per_level jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_est_level SMALLINT;
  v_conf NUMERIC;
  v_per_level JSONB;
  v_snap_id UUID;
BEGIN
  SELECT a.estimated_v_level, a.confidence, a.per_level
  INTO v_est_level, v_conf, v_per_level
  FROM public.analyze_diagnostic_result(p_result_id) a;

  UPDATE public.user_diagnostic_results
  SET estimated_v_level = v_est_level,
      confidence = v_conf
  WHERE id = p_result_id;

  SELECT public.apply_diagnostic_result(p_result_id) INTO v_snap_id;

  RETURN QUERY SELECT v_snap_id, v_est_level, v_conf, v_per_level;
END;
$function$;

-- analyze_and_apply_track_diagnostic_result — DiagnosticClient track 경로: track_levels merge + snapshot(scope='track').
CREATE OR REPLACE FUNCTION public.analyze_and_apply_track_diagnostic_result(p_result_id uuid)
 RETURNS TABLE(user_id uuid, track_id text, estimated_track_level smallint, confidence numeric, per_level jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID; v_track_id TEXT; v_test_id UUID;
  v_est_level SMALLINT; v_conf NUMERIC; v_per_level JSONB;
  v_current_v SMALLINT; v_merged_tracks JSONB;
  v_previous_track_level INT; v_track_delta INT; v_prev_snapshot_id UUID;
BEGIN
  SELECT a.estimated_track_level, a.track_id, a.confidence, a.per_level
  INTO v_est_level, v_track_id, v_conf, v_per_level
  FROM public.analyze_track_diagnostic_result(p_result_id) a;

  SELECT r.user_id, r.test_id INTO v_user_id, v_test_id
  FROM public.user_diagnostic_results r WHERE r.id = p_result_id;

  SELECT current_v_level, COALESCE((current_track_levels->>v_track_id)::int, 0)
  INTO v_current_v, v_previous_track_level
  FROM public.user_profiles WHERE user_profiles.user_id = v_user_id;

  v_track_delta := v_est_level - v_previous_track_level;

  UPDATE public.user_diagnostic_results
  SET estimated_track_levels = jsonb_build_object(v_track_id, v_est_level), confidence = v_conf
  WHERE id = p_result_id;

  UPDATE public.user_profiles
  SET current_track_levels = COALESCE(current_track_levels, '{}'::jsonb)
                             || jsonb_build_object(v_track_id, v_est_level),
      updated_at = now()
  WHERE user_profiles.user_id = v_user_id
  RETURNING current_track_levels INTO v_merged_tracks;

  SELECT s.id INTO v_prev_snapshot_id
  FROM public.user_level_snapshots s
  WHERE s.user_id = v_user_id ORDER BY s.taken_at DESC LIMIT 1;

  INSERT INTO public.user_level_snapshots (
    user_id, v_level, v_level_meta, previous_v_level, track_levels,
    taken_reason, taken_at, diagnostic_result_id,
    snapshot_meta, snapshot_type, triggered_by, trigger_details, previous_snapshot_id
  ) VALUES (
    v_user_id, COALESCE(v_current_v, 0),
    jsonb_build_object(
      'level', COALESCE(v_current_v, 0),
      'source', 'track_diagnostic_unchanged',
      'confidence', v_conf,
      'estimated_at', now(),
      'status', 'active',
      'track_id', v_track_id
    ),
    v_current_v, v_merged_tracks,
    'diagnostic', now(), p_result_id,
    jsonb_build_object(
      'test_id', v_test_id, 'track_id', v_track_id,
      'estimated_track_level', v_est_level,
      'previous_track_level', v_previous_track_level,
      'track_delta', v_track_delta,
      'confidence', v_conf, 'per_level', v_per_level,
      'scope', 'track'
    ),
    'level_change', 'internal',
    jsonb_build_object('caller', 'analyze_and_apply_track_diagnostic_result', 'result_id', p_result_id, 'track_id', v_track_id),
    v_prev_snapshot_id
  );

  RETURN QUERY SELECT v_user_id, v_track_id, v_est_level, v_conf, v_per_level;
END;
$function$;

-- analyze_and_apply_comprehensive_diagnostic_result — 종합 진단: base V + 3 track(csat/business/academic) 동시 산정·반영.
CREATE OR REPLACE FUNCTION public.analyze_and_apply_comprehensive_diagnostic_result(p_result_id uuid)
 RETURNS TABLE(user_id uuid, estimated_v_level smallint, estimated_track_levels jsonb, confidence numeric, per_level jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_responses JSONB;
  v_test_id UUID;
  v_per_level JSONB;
  v_v_est SMALLINT;
  v_conf NUMERIC;
  v_track_csat INT;
  v_track_biz INT;
  v_track_acad INT;
  v_tracks JSONB;
  v_prev_v SMALLINT;
  v_prev_snapshot_id UUID;
BEGIN
  SELECT r.user_id, r.responses, r.test_id INTO v_user_id, v_responses, v_test_id
  FROM public.user_diagnostic_results r WHERE r.id = p_result_id;

  WITH resp AS (
    SELECT (r->>'question_id')::uuid AS qid, (r->>'knew')::bool AS knew
    FROM jsonb_array_elements(v_responses) r
  ),
  joined AS (
    SELECT q.target_v_level AS vl, r.knew, q.word
    FROM resp r JOIN public.vrl_diagnostic_questions q ON q.id = r.qid
    WHERE q.target_v_level IS NOT NULL
  ),
  per_level_calc AS (
    SELECT vl,
      COUNT(*) FILTER (WHERE knew) AS correct, COUNT(*) AS total,
      ROUND(COUNT(*) FILTER (WHERE knew)::numeric / NULLIF(COUNT(*),0), 3) AS acc
    FROM joined GROUP BY vl
  )
  SELECT jsonb_object_agg(vl::text, jsonb_build_object('correct', correct, 'total', total, 'accuracy', acc))
  INTO v_per_level FROM per_level_calc;

  IF v_per_level IS NULL THEN v_per_level := '{}'::jsonb; END IF;

  WITH arr AS (SELECT (key::int) AS vl, (value->>'accuracy')::numeric AS acc FROM jsonb_each(v_per_level))
  SELECT COALESCE(MAX(vl), 1)::smallint INTO v_v_est FROM arr WHERE acc >= 0.70;

  WITH c AS (SELECT SUM((value->>'correct')::numeric) AS tc, SUM((value->>'total')::numeric) AS tt FROM jsonb_each(v_per_level))
  SELECT ROUND(CASE WHEN tt > 0 THEN tc/tt ELSE 0 END, 3) INTO v_conf FROM c;

  WITH resp AS (
    SELECT (r->>'question_id')::uuid AS qid, (r->>'knew')::bool AS knew
    FROM jsonb_array_elements(v_responses) r
  ),
  joined AS (
    SELECT q.target_v_level AS vl, r.knew, sd.list_tags
    FROM resp r
    JOIN public.vrl_diagnostic_questions q ON q.id = r.qid
    JOIN public.shared_dictionary sd ON sd.word = q.word
    WHERE q.target_v_level IS NOT NULL
  ),
  csat_level AS (
    SELECT MAX(vl) AS lvl FROM (
      SELECT vl, COUNT(*) FILTER (WHERE knew)::numeric / NULLIF(COUNT(*),0) AS acc
      FROM joined
      WHERE list_tags @> ARRAY['csat-prep-core-2k'] OR list_tags @> ARRAY['csat-prep-ext-1.8k']
      GROUP BY vl
    ) sub WHERE acc >= 0.70
  ),
  biz_level AS (
    SELECT MAX(vl) AS lvl FROM (
      SELECT vl, COUNT(*) FILTER (WHERE knew)::numeric / NULLIF(COUNT(*),0) AS acc
      FROM joined WHERE list_tags @> ARRAY['bsl_1.20']
      GROUP BY vl
    ) sub WHERE acc >= 0.70
  ),
  acad_level AS (
    SELECT MAX(vl) AS lvl FROM (
      SELECT vl, COUNT(*) FILTER (WHERE knew)::numeric / NULLIF(COUNT(*),0) AS acc
      FROM joined WHERE list_tags @> ARRAY['nawl_1.2']
      GROUP BY vl
    ) sub WHERE acc >= 0.70
  )
  SELECT COALESCE((SELECT lvl FROM csat_level), 0),
         COALESCE((SELECT lvl FROM biz_level), 0),
         COALESCE((SELECT lvl FROM acad_level), 0)
  INTO v_track_csat, v_track_biz, v_track_acad;

  v_tracks := jsonb_build_object(
    'csat_korean', v_track_csat,
    'business_english', v_track_biz,
    'academic_english', v_track_acad
  );

  SELECT current_v_level INTO v_prev_v FROM public.user_profiles WHERE user_profiles.user_id = v_user_id;

  UPDATE public.user_diagnostic_results
  SET estimated_v_level = v_v_est,
      estimated_track_levels = v_tracks,
      confidence = v_conf
  WHERE id = p_result_id;

  UPDATE public.user_profiles
  SET current_v_level = v_v_est,
      current_track_levels = COALESCE(current_track_levels, '{}'::jsonb) || v_tracks,
      current_v_level_meta = jsonb_build_object(
        'source', 'comprehensive_diagnostic',
        'diagnostic_result_id', p_result_id,
        'confidence', v_conf,
        'per_level', v_per_level,
        'set_at', now()
      ),
      diagnostic_completed_at = now(),
      updated_at = now()
  WHERE user_profiles.user_id = v_user_id;

  SELECT s.id INTO v_prev_snapshot_id
  FROM public.user_level_snapshots s
  WHERE s.user_id = v_user_id ORDER BY s.taken_at DESC LIMIT 1;

  INSERT INTO public.user_level_snapshots (
    user_id, v_level, v_level_meta, previous_v_level, track_levels,
    taken_reason, taken_at, diagnostic_result_id,
    snapshot_meta, snapshot_type, triggered_by, trigger_details, previous_snapshot_id
  ) VALUES (
    v_user_id, v_v_est,
    jsonb_build_object(
      'level', v_v_est, 'source', 'comprehensive_diagnostic',
      'confidence', v_conf, 'estimated_at', now(),
      'status', 'active'
    ),
    v_prev_v, v_tracks,
    'diagnostic', now(), p_result_id,
    jsonb_build_object(
      'test_id', v_test_id, 'scope', 'comprehensive',
      'v_level', v_v_est, 'track_levels', v_tracks,
      'confidence', v_conf, 'per_level', v_per_level
    ),
    'level_change', 'internal',
    jsonb_build_object('caller', 'analyze_and_apply_comprehensive_diagnostic_result', 'result_id', p_result_id),
    v_prev_snapshot_id
  );

  RETURN QUERY SELECT v_user_id, v_v_est, v_tracks, v_conf, v_per_level;
END;
$function$;

-- ═══ 자동 상향 + cron ═══

-- auto_promote_v_level_for_user — i+1 zone ≥20 mastered(최근30일·≥3정답·마지막정답) → V+1.
CREATE OR REPLACE FUNCTION public.auto_promote_v_level_for_user(p_user_id uuid)
 RETURNS TABLE(promoted boolean, old_level smallint, new_level smallint, mastered_count integer, threshold integer, reason text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current_level SMALLINT;
  v_next_level SMALLINT;
  v_mastered INT;
  v_threshold CONSTANT INT := 20;
  v_window_days CONSTANT INT := 30;
  v_confidence NUMERIC;
BEGIN
  SELECT current_v_level INTO v_current_level
  FROM public.user_profiles WHERE user_id = p_user_id;

  IF v_current_level IS NULL OR v_current_level = 0 THEN
    RETURN QUERY SELECT false, v_current_level, v_current_level, 0, v_threshold,
      '진단 미완료 — 자동 상향 불가 (먼저 /diagnostic 진단 완료 필요)'::TEXT;
    RETURN;
  END IF;

  IF v_current_level >= 11 THEN
    RETURN QUERY SELECT false, v_current_level, v_current_level, 0, v_threshold,
      'V-Level 최고점 도달 (V11) — 추가 상향 없음'::TEXT;
    RETURN;
  END IF;

  v_next_level := v_current_level + 1;

  WITH word_reviews AS (
    SELECT
      v.id AS vocab_id,
      v.word,
      COUNT(*) FILTER (WHERE lr.is_correct) AS correct_count,
      COUNT(*) AS total_count,
      MAX(lr.attempted_at) AS last_attempt,
      (
        SELECT lr2.is_correct FROM public.learning_records lr2
        WHERE lr2.vocabulary_id = v.id
          AND lr2.attempted_at > NOW() - (v_window_days || ' days')::INTERVAL
        ORDER BY lr2.attempted_at DESC LIMIT 1
      ) AS last_correct
    FROM public.vocabularies v
    JOIN public.shared_dictionary sd ON sd.word = v.word
    LEFT JOIN public.learning_records lr ON lr.vocabulary_id = v.id
      AND lr.attempted_at > NOW() - (v_window_days || ' days')::INTERVAL
    WHERE v.user_id = p_user_id
      AND sd.v_level = v_next_level
    GROUP BY v.id, v.word
  )
  SELECT COUNT(*) INTO v_mastered
  FROM word_reviews
  WHERE correct_count >= 3 AND last_correct = true;

  IF v_mastered < v_threshold THEN
    RETURN QUERY SELECT false, v_current_level, v_current_level, v_mastered, v_threshold,
      ('i+1 zone (V' || v_next_level || ') mastered ' || v_mastered ||
       '개 / threshold ' || v_threshold || '개 — 자동 상향 조건 미충족')::TEXT;
    RETURN;
  END IF;

  v_confidence := LEAST(v_mastered::NUMERIC / v_threshold, 1.0);

  PERFORM public.update_user_v_level(
    p_user_id,
    v_next_level,
    'learning_data',
    v_confidence,
    'auto_promotion',
    NULL,
    'internal',
    jsonb_build_object(
      'caller', 'auto_promote_v_level_for_user',
      'mastered_count', v_mastered,
      'threshold', v_threshold,
      'window_days', v_window_days,
      'next_level', v_next_level
    )
  );

  RETURN QUERY SELECT true, v_current_level, v_next_level, v_mastered, v_threshold,
    ('V' || v_current_level || ' → V' || v_next_level || ' 자동 상향 (mastered ' ||
     v_mastered || '개 ≥ threshold ' || v_threshold || ', 최근 ' ||
     v_window_days || '일)')::TEXT;
END;
$function$;

-- auto_promote_track_level_for_user — track i+1 ≥15 mastered → track+1 (threshold 15).
CREATE OR REPLACE FUNCTION public.auto_promote_track_level_for_user(p_user_id uuid, p_track_id text)
 RETURNS TABLE(promoted boolean, track_id text, old_level integer, new_level integer, mastered_count integer, threshold integer, reason text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current_level INT; v_next_level INT; v_mastered INT;
  v_threshold CONSTANT INT := 15;
  v_window_days CONSTANT INT := 30;
  v_track_tag TEXT; v_current_v_level SMALLINT;
  v_merged_tracks JSONB; v_prev_snapshot_id UUID;
BEGIN
  v_track_tag := CASE p_track_id
    WHEN 'csat_korean' THEN 'csat-prep-core-2k'
    WHEN 'business_english' THEN 'bsl_1.20'
    WHEN 'academic_english' THEN 'nawl_1.2'
    ELSE NULL
  END;

  IF v_track_tag IS NULL THEN
    RETURN QUERY SELECT false, p_track_id, 0, 0, 0, v_threshold,
      ('지원하지 않는 track_id: ' || p_track_id)::TEXT;
    RETURN;
  END IF;

  SELECT current_v_level, COALESCE((current_track_levels->>p_track_id)::int, 0)
  INTO v_current_v_level, v_current_level
  FROM public.user_profiles WHERE user_id = p_user_id;

  IF v_current_level = 0 THEN
    RETURN QUERY SELECT false, p_track_id, 0, 0, 0, v_threshold,
      ('track 진단 미완료 — ' || p_track_id)::TEXT;
    RETURN;
  END IF;

  IF v_current_level >= 10 THEN
    RETURN QUERY SELECT false, p_track_id, v_current_level, v_current_level, 0, v_threshold,
      ('track 최고점 L10 도달')::TEXT;
    RETURN;
  END IF;

  v_next_level := v_current_level + 1;

  WITH word_reviews AS (
    SELECT v.id AS vocab_id,
      COUNT(*) FILTER (WHERE lr.is_correct) AS correct_count,
      (SELECT lr2.is_correct FROM public.learning_records lr2
       WHERE lr2.vocabulary_id = v.id
         AND lr2.attempted_at > NOW() - (v_window_days || ' days')::INTERVAL
       ORDER BY lr2.attempted_at DESC LIMIT 1) AS last_correct
    FROM public.vocabularies v
    JOIN public.shared_dictionary sd ON sd.word = v.word
    LEFT JOIN public.learning_records lr ON lr.vocabulary_id = v.id
      AND lr.attempted_at > NOW() - (v_window_days || ' days')::INTERVAL
    WHERE v.user_id = p_user_id
      AND sd.v_level = v_next_level
      AND (
        sd.list_tags @> ARRAY[v_track_tag]
        OR (p_track_id = 'csat_korean' AND sd.list_tags @> ARRAY['csat-prep-ext-1.8k'])
      )
    GROUP BY v.id
  )
  SELECT COUNT(*) INTO v_mastered FROM word_reviews
  WHERE correct_count >= 3 AND last_correct = true;

  IF v_mastered < v_threshold THEN
    RETURN QUERY SELECT false, p_track_id, v_current_level, v_current_level, v_mastered, v_threshold,
      ('track ' || p_track_id || ' i+1 (L' || v_next_level || ') mastered ' ||
       v_mastered || ' / ' || v_threshold || ' 미충족')::TEXT;
    RETURN;
  END IF;

  UPDATE public.user_profiles
  SET current_track_levels = COALESCE(current_track_levels, '{}'::jsonb)
                             || jsonb_build_object(p_track_id, v_next_level),
      updated_at = now()
  WHERE user_id = p_user_id
  RETURNING current_track_levels INTO v_merged_tracks;

  SELECT s.id INTO v_prev_snapshot_id
  FROM public.user_level_snapshots s
  WHERE s.user_id = p_user_id ORDER BY s.taken_at DESC LIMIT 1;

  INSERT INTO public.user_level_snapshots (
    user_id, v_level, v_level_meta, previous_v_level, track_levels,
    taken_reason, taken_at, snapshot_meta, snapshot_type, triggered_by,
    trigger_details, previous_snapshot_id
  ) VALUES (
    p_user_id, COALESCE(v_current_v_level, 0),
    jsonb_build_object(
      'level', COALESCE(v_current_v_level, 0),
      'source', 'track_auto_promotion',
      'confidence', LEAST(v_mastered::numeric / v_threshold, 1.0),
      'estimated_at', now(), 'status', 'active',
      'track_id', p_track_id
    ),
    v_current_v_level, v_merged_tracks,
    'mastery_calc', now(),
    jsonb_build_object(
      'track_id', p_track_id, 'estimated_track_level', v_next_level,
      'previous_track_level', v_current_level, 'track_delta', 1,
      'mastered_count', v_mastered, 'threshold', v_threshold,
      'window_days', v_window_days, 'scope', 'track'
    ),
    'level_change', 'internal',
    jsonb_build_object('caller', 'auto_promote_track_level_for_user', 'track_id', p_track_id),
    v_prev_snapshot_id
  );

  RETURN QUERY SELECT true, p_track_id, v_current_level, v_next_level, v_mastered, v_threshold,
    ('track ' || p_track_id || ' L' || v_current_level || ' → L' || v_next_level || ' 자동 상향')::TEXT;
END;
$function$;

-- cron_auto_promote_all_users — pg_cron(jobid=8, KST 03:00): 전 사용자 base+track 자동상향 배치 + 실패 pg_notify.
CREATE OR REPLACE FUNCTION public.cron_auto_promote_all_users()
 RETURNS TABLE(total_users integer, base_promoted integer, track_promoted integer, failed integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total INT := 0; v_base INT := 0; v_track INT := 0; v_failed INT := 0;
  v_user RECORD; v_track_id TEXT; v_result RECORD;
BEGIN
  FOR v_user IN
    SELECT user_id, current_v_level, current_track_levels FROM public.user_profiles
    WHERE current_v_level IS NOT NULL AND current_v_level > 0
  LOOP
    v_total := v_total + 1;
    IF v_user.current_v_level < 11 THEN
      BEGIN
        SELECT * INTO v_result FROM public.auto_promote_v_level_for_user(v_user.user_id);
        IF v_result.promoted THEN v_base := v_base + 1; END IF;
      EXCEPTION WHEN OTHERS THEN v_failed := v_failed + 1;
      END;
    END IF;
    FOREACH v_track_id IN ARRAY ARRAY['csat_korean','business_english','academic_english'] LOOP
      IF (v_user.current_track_levels ? v_track_id)
         AND (v_user.current_track_levels->>v_track_id)::int < 10 THEN
        BEGIN
          SELECT * INTO v_result FROM public.auto_promote_track_level_for_user(v_user.user_id, v_track_id);
          IF v_result.promoted THEN v_track := v_track + 1; END IF;
        EXCEPTION WHEN OTHERS THEN v_failed := v_failed + 1;
        END;
      END IF;
    END LOOP;
  END LOOP;

  IF v_failed > 0 THEN
    PERFORM pg_notify('vrl_cron_alert',
      jsonb_build_object(
        'event', 'cron_promotion_failures',
        'failed', v_failed,
        'total_users', v_total,
        'timestamp', now()
      )::text
    );
  END IF;

  RETURN QUERY SELECT v_total, v_base, v_track, v_failed;
END;
$function$;
