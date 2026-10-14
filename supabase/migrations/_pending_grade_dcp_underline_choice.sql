-- supabase/migrations/_pending_grade_dcp_underline_choice.sql
-- ⚠️ 보류(적용 안 함) — v6.2 P-F8d 승인안 A3. 어휘 교재 연습의 첫 유형 `vocab_choice` 를 DB 가 채점하게 한다.
--
-- 왜: 어휘 · 구문 12권 연습이 비는 이유는 재고가 아니라 **실행 경로**다 — vocab_choice 49,353문항(V2~V7)이 있지만
--     grade_dcp_item 이 'Unknown type' 을 던져 화면에 낼 수 없었다. 화면 계약 · 플레이어는 준비됐다(`dcp-underline.ts`).
-- 무엇: 개발 DB 의 현재 정의(2026-10-15 실측)에 **분기 하나만** 더한다 — vocab_choice: 고른 번호 = answer_key.position.
--       나머지 분기 · 권한 · 기록(csat_item_attempts) · 정답 공개 규칙은 그대로.
-- 순서: ① 이 파일 ② 승인안 A(연습 RPC 2판) 재생성 시 PLAYABLE 에 vocab_choice 추가 ③ 앱 parseItem 이 vocab_choice 를 받게(같은 PR)
--       ①이 먼저여야 한다 — 채점 못 하는 문항이 화면에 나가면 학습자가 맞혀도 「채점하지 못했어요」가 된다.
-- 되돌리기: 이 분기를 뺀 이전 정의로 create or replace(아래 원문에서 ELSIF vocab_choice 블록 삭제).
-- 검증: 격리 Postgres 시험 `grade-underline.pglite.test.ts`(SQL 채점 = 앱 gradeUnderlineChoice) · 적용 뒤 검증 계정으로 정답 · 오답 1건씩(attempt 정리).
-- 함께 고침: 기존 선택지 분기의 `(p_answer->>'choice') !~ …` 는 choice 가 없으면 NULL 이라 검사를 통과해 is_correct=NULL 을 기록했다 → coalesce.
-- 기준: 적용 직전 md5(pg_get_functiondef(grade_dcp_item)) = ad87205aad5fbd59b1a4d12ba85b339f(2026-10-15) 일 때만 — 다르면 다른 세션이 바꾼 것이니 다시 만든다.
-- 공급 자격과 무관: 채점이 된다고 독립 확인 · 전이 평가가 되지 않는다(지도 연습 후보).

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
    IF coalesce(p_answer->>'choice', '') !~ '^[1-5]$' THEN RAISE EXCEPTION 'Bad choice'; END IF;
    v_choice := (p_answer->>'choice')::int;
    v_correct := v_choice = (it.answer_key->>'answer')::int;
  -- v6.2 P-F8d — 밑줄 다섯 중 하나(어휘). 정답 번호는 answer_key.position(1부터)
  ELSIF it.type = 'vocab_choice' THEN
    IF coalesce(p_answer->>'choice', '') !~ '^[1-5]$' THEN RAISE EXCEPTION 'Bad choice'; END IF;
    IF coalesce(it.answer_key->>'position', '') !~ '^[1-5]$' THEN RAISE EXCEPTION 'Item has no answer position'; END IF;
    v_choice := (p_answer->>'choice')::int;
    v_correct := v_choice = (it.answer_key->>'position')::int;
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
