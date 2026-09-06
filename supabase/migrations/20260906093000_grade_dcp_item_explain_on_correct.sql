-- supabase/migrations/20260906093000_grade_dcp_item_explain_on_correct.sql
--
-- grade_dcp_item: **맞혀도 해설은 준다.**
--
-- ── 왜 (실측 2026-09-06 · 학습자 표면 감사 S6) ──────────────────────────
-- 이 함수는 정답일 때 `answer_key` 를 통째로 NULL 로 내렸다. 정답 위치·순서를 감추려는
-- 의도는 옳지만, 그 안에는 **해설**도 같이 들어 있다. 그래서 맞힌 학습자는 "왜 맞았는지"
-- 를 볼 수 없었다 — 인출(Active Recall) 직후의 확인이 통째로 빠진 것이다.
-- `csat_dcp_items` 에는 학습자용 RLS 정책이 없어(관리자 정책 하나뿐) 앱 계층에서
-- 우회할 수도 없었다. 화면(`components/practice/DcpPlayer.tsx`)의 `!correct` 게이트는
-- 이미 풀어 뒀으므로 여기만 고치면 그날로 보인다.
--
-- 무엇을 주고 무엇을 계속 감추나 (키 분포는 표본 300행 실측):
--   준다   — explanation_ko(277) · explanation_writer(277) · rationale_ko(1)
--   감춘다 — answer · position · source_order · text · original · sentence · rule
--            (정답 자체이거나 정답을 역산할 수 있는 값)
--   틀렸을 때는 종전대로 `answer_key` 전체를 준다(이미 정답을 보여 주는 자리다).
--
--   `jsonb_strip_nulls` 로 없는 키는 아예 넣지 않는다 — `{"explanation_ko": null}` 은
--   "해설이 없다" 와 "키가 없다" 를 구별하지 못하게 만들고 화면이 빈 칸을 그리게 된다.
--
-- 되돌리기: 아래 CASE 의 THEN 가지를 `NULL` 로 되돌리면 된다. 나머지 본문은 그대로다.

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
