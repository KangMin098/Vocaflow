-- 20261006090000 되돌리기 — 이전 live 정의(2026-10-06 추출)와 이전 ACL({=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres})
begin;
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

  -- V11 도달 시 더 상향 X
  IF v_current_level >= 11 THEN
    RETURN QUERY SELECT false, v_current_level, v_current_level, 0, v_threshold,
      'V-Level 최고점 도달 (V11) — 추가 상향 없음'::TEXT;
    RETURN;
  END IF;

  v_next_level := v_current_level + 1;

  -- i+1 zone 단어 mastered count
  -- mastered 조건: ≥3 successful reviews AND last review correct (최근 30일)
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

  -- 상향 조건 충족 — confidence = mastered/threshold ratio (0.85~1.0)
  v_confidence := LEAST(v_mastered::NUMERIC / v_threshold, 1.0);

  PERFORM public.update_user_v_level(
    p_user_id,
    v_next_level,
    'learning_data',
    v_confidence,
    'auto_promotion',
    NULL, -- diagnostic_id 없음
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
revoke execute on function public.auto_promote_v_level_for_user(uuid) from public, anon, authenticated, service_role;
grant execute on function public.auto_promote_v_level_for_user(uuid) to public, anon, authenticated, service_role;
commit;
