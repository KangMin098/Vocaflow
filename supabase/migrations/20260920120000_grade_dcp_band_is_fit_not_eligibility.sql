-- supabase/migrations/20260920120000_grade_dcp_band_is_fit_not_eligibility.sql
--
-- **밴드는 적합이지 적격이 아니다** — 채점이 `cefr_above_band` 로 거부되지 않게 한다.
-- 사용자 결정 2026-09-20(이슈 #104 · design/DECISIONS DD-57 초안에서 이 한 조각만 먼저 떼어 냈다).
--
-- ── 무엇이 문제였나 (실측 2026-09-20) ─────────────────────────────────
-- `20260918140100_csat_source_eligibility_consumers` 가 채점 앞에 적격 게이트를 세웠다:
--     IF it.kind = 'article' AND NOT public.csat_source_is_eligible(it.ref_id) THEN
--       RAISE EXCEPTION 'Source is unavailable for practice';
-- 그 게이트는 **차단 사유가 하나라도 있으면** 거짓이고, 거기에 `cefr_above_band` 가 섞여 있다.
-- 그런데 밴드는 「이 학습자에게 맞는 난이도인가」(적합)이고 「이 원문을 학습에 쓸 수 있는가」(적격)가
-- 아니다. 둘이 한 칸에 있으니 **이미 받은 문항의 채점이 거부**됐다 — 학습자가 답을 냈는데 결과를
-- 못 보는 상태이고, `dcp-grade-records.integration` 4건이 그것을 잡고 있었다.
--
-- 규모(DB 실측): 차단 사유가 `["cefr_above_band"]` **하나뿐**인 원문 **11,276편**이고 등급은
-- `blocked` 로 잡힌다 — 즉 **등급만 보면 못 가른다.** 사유 배열로 갈라야 한다.
--
-- ── 이 마이그레이션이 하는 일 ─────────────────────────────────────────
-- ① `csat_source_is_gradeable(uuid)` 신설 — 적격과 같은 조건이지만 **밴드 사유만 무시**한다
--    (policy_version 3 · revision 일치 · status ready|published · **밴드 외 차단 사유 0**).
-- ② `grade_dcp_item` 이 그 함수를 본다. **본문은 적용된 정의를 그대로 옮기고 그 한 줄만 바꿨다**
--    (`pg_get_functiondef` 로 받아 대조 — `order`·`mood`·`long_*` 유형과 attempts 컬럼을 잃지 않게).
-- ③ 서빙 함수(`prescribe_today` · `textbook_practice_items`)는 **그대로 `csat_source_is_eligible`** —
--    밴드는 거기서 「적합 필터」로 계속 작동한다.
--
-- ⚠️ 적격 게이트 자체는 건드리지 않는다. `cefr_above_band` 를 blocker → warning 으로 옮기는 개정은
--    캐시 전량 재적재가 따라오므로 DD-57 에서 따로 결정한다.
--
-- 되돌리기: `grade_dcp_item` 의 그 한 줄을 `csat_source_is_eligible` 로 되돌리고
--    `csat_source_is_gradeable` 를 DROP 한다. 데이터 변경은 없다.

CREATE OR REPLACE FUNCTION public.csat_source_is_gradeable(p_article_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.csat_source_eligibility e
    JOIN public.library_articles a ON a.id = e.article_id
    WHERE e.article_id = p_article_id
      AND e.policy_version = 3
      AND e.source_updated_at = a.updated_at
      AND a.status IN ('ready', 'published')
      -- 밴드(cefr_above_band)만 무시한다. 법적·안전·내용 반려·형식 사유가 하나라도 있으면 거짓.
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(e.result->'blockers') AS b(code)
        WHERE b.code <> 'cefr_above_band'
      )
  );
$$;

COMMENT ON FUNCTION public.csat_source_is_gradeable(uuid) IS
  '채점 허용 판정 — 적격과 같되 cefr_above_band(밴드 적합)만 무시한다. 서빙은 csat_source_is_eligible 을 쓴다. 2026-09-20 #104.';

REVOKE ALL ON FUNCTION public.csat_source_is_gradeable(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.csat_source_is_gradeable(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.grade_dcp_item(p_item_id uuid, p_answer jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE it record; v_correct boolean; v_uid uuid := auth.uid(); v_attempt_id uuid; v_choice int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT type, answer_key, ref_id, kind INTO it FROM csat_dcp_items WHERE id=p_item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item not found'; END IF;
  -- 2026-09-20: 적격(csat_source_is_eligible) → 채점 허용(csat_source_is_gradeable).
  -- 밴드는 적합이라 채점을 막지 않는다 — 막으면 답을 낸 학습자가 결과를 못 본다(#104).
  IF it.kind = 'article' AND NOT public.csat_source_is_gradeable(it.ref_id) THEN
    RAISE EXCEPTION 'Source is unavailable for practice';
  END IF;

  IF it.type='insert' THEN
    v_correct := (p_answer->>'position')::int = (it.answer_key->>'position')::int;
  ELSIF it.type='order' THEN
    WITH la AS (SELECT (value)::int AS pidx, (ordinality-1) AS pos FROM jsonb_array_elements_text(p_answer->'order') WITH ORDINALITY),
         so AS (SELECT (value)::int AS orig, (ordinality-1) AS j    FROM jsonb_array_elements_text(it.answer_key->'source_order') WITH ORDINALITY)
    SELECT bool_and(so.orig = la.pos) INTO v_correct FROM la JOIN so ON so.j = la.pidx;
    v_correct := coalesce(v_correct, false);
  ELSIF it.type = ANY (ARRAY['topic','blank','main_point','title','summary',
                             'purpose','implication','content_match','claim','mood',
                             'long_order','long_reference','long_match',
                             'long_title','long_vocab']) THEN
    IF (p_answer->>'choice') !~ '^[1-5]$' THEN RAISE EXCEPTION 'Bad choice'; END IF;
    v_choice := (p_answer->>'choice')::int;
    v_correct := v_choice = (it.answer_key->>'answer')::int;
  ELSE RAISE EXCEPTION 'Unknown type'; END IF;

  INSERT INTO csat_item_attempts (user_id, dcp_item_id, text_id, is_correct, item_role)
  VALUES (v_uid, p_item_id, it.ref_id, v_correct, 'practice')
  RETURNING id INTO v_attempt_id;

  RETURN jsonb_build_object('correct', v_correct, 'attempt_id', v_attempt_id,
    'answer_key', CASE WHEN v_correct
      THEN jsonb_strip_nulls(jsonb_build_object(
             'explanation_ko',     it.answer_key->>'explanation_ko',
             'explanation_writer', it.answer_key->>'explanation_writer',
             'rationale_ko',       it.answer_key->>'rationale_ko'))
      ELSE it.answer_key END);
END $function$;
