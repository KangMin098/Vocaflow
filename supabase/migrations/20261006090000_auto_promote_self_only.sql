-- supabase/migrations/20261006090000_auto_promote_self_only.sql
--
-- G1 · P0 핫픽스 — auto_promote_v_level_for_user 를 본인 전용(AUTH_SELF_RPC)으로.
-- 근거: docs/reports/function-execute-decisions-2026-10-06.md · 감사 docs/reports/function-execute-audit-2026-10-05.md
--
-- 문제(2026-10-06 실측): SECURITY DEFINER · 본문에 auth.uid() 검사 없음 · anon 직접 GRANT(2026-09-06 이전 기본 ACL 잔재).
--   비로그인 누구나 아무 user_id 로 불러 그 사용자의 현재 레벨 · i+1 숙달 수를 읽고, 조건을 채운 사용자면 승급을 일으킨다
--   (승급 자체는 실제 숙달 기준을 통과해야 일어난다 — 임의 레벨 지정은 아니다).
-- 호출자: 앱 VLevelPromotionCheck.tsx(브라우저 · 자기 user.id) · cron_auto_promote_all_users(cron · 소유자 권한).
-- 변경: ① 본문 맨 앞 본인 검사(나머지 본문은 live 정의 그대로) ② PUBLIC · anon EXECUTE 회수, authenticated · service_role 명시.
-- 되돌리기: scripts/db/rollback-20261006090000.sql (이전 정의 + 이전 ACL {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres})

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
  -- 본인만 · 2026-10-06 P0. 로그인/비로그인 요청(JWT role = anon · authenticated)은 자기 user_id 로만 부른다.
  -- JWT 가 없는 호출(cron_auto_promote_all_users — 소유자 권한)과 service_role 은 그대로 통과한다.
  IF coalesce(auth.role(), '') IN ('anon', 'authenticated') AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'auto_promote_v_level_for_user: 본인 user_id 로만 호출할 수 있다' USING ERRCODE = '42501';
  END IF;
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

revoke execute on function public.auto_promote_v_level_for_user(uuid) from public, anon;
grant execute on function public.auto_promote_v_level_for_user(uuid) to authenticated, service_role;
