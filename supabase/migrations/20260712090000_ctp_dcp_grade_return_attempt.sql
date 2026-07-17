-- CTP DCP Phase 2 — grade_dcp_item 이 attempt_id·question_id 반환 (오답 error_cause 부착용).
-- 적용 완료(2026-07-12). error_cause CHECK(5원인 vocab/parsing/structure/inference/timing)는 기존 존재(CTP 런타임 테이블).
-- 안전성: 소비자 0(신규 /practice/dcp UI 뿐) · csat_item_attempts 0행 · question_id FK 없음.
-- 로컬 기록 파일(원격 apply_migration 서버 타임스탬프와 별개 · USGS/NOAA 동일 관행).

CREATE OR REPLACE FUNCTION public.grade_dcp_item(p_item_id uuid, p_answer jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE it record; v_correct boolean; v_uid uuid := auth.uid(); v_attempt_id uuid;
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
  ELSE RAISE EXCEPTION 'Unknown type'; END IF;

  INSERT INTO csat_item_attempts (user_id, question_id, text_id, is_correct, item_role)
  VALUES (v_uid, p_item_id, it.ref_id, v_correct, 'practice')
  RETURNING id INTO v_attempt_id;

  RETURN jsonb_build_object('correct', v_correct, 'attempt_id', v_attempt_id,
    'answer_key', CASE WHEN v_correct THEN NULL ELSE it.answer_key END);
END $function$;
