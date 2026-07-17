-- CTP DCP 채점 — grade_dcp_item(item_id, answer): order/insert 답변 검증 + 기록
-- answer_key 는 서버에만(오답 시에만 반환). csat_item_attempts INSERT(is_correct·item_role=practice).
-- SECURITY DEFINER(csat_dcp_items=admin-only RLS 읽기) + auth.uid() 가드(본인 응답만).
-- 답변: order=`{"order":[presented_idx...]}` · insert=`{"position":int}`.
-- ⚠ apply_migration $$ 오분할 → execute_sql 로 적용됨(내용 동일).
CREATE OR REPLACE FUNCTION public.grade_dcp_item(p_item_id uuid, p_answer jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE it record; v_correct boolean; v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT type, answer_key, ref_id, kind INTO it FROM csat_dcp_items WHERE id=p_item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item not found'; END IF;

  IF it.type='insert' THEN
    v_correct := (p_answer->>'position')::int = (it.answer_key->>'position')::int;
  ELSIF it.type='order' THEN
    -- 학습자 order[k]=presented 인덱스(k번째 배치). 정답 = 그 원본 인덱스(source_order)=k.
    WITH la AS (SELECT (value)::int AS pidx, (ordinality-1) AS pos FROM jsonb_array_elements_text(p_answer->'order') WITH ORDINALITY),
         so AS (SELECT (value)::int AS orig, (ordinality-1) AS j    FROM jsonb_array_elements_text(it.answer_key->'source_order') WITH ORDINALITY)
    SELECT bool_and(so.orig = la.pos) INTO v_correct FROM la JOIN so ON so.j = la.pidx;
    v_correct := coalesce(v_correct, false);
  ELSE RAISE EXCEPTION 'Unknown type'; END IF;

  INSERT INTO csat_item_attempts (user_id, text_id, is_correct, item_role)
  VALUES (v_uid, it.ref_id, v_correct, 'practice');

  RETURN jsonb_build_object('correct', v_correct,
    'answer_key', CASE WHEN v_correct THEN NULL ELSE it.answer_key END);
END $fn$;
COMMENT ON FUNCTION public.grade_dcp_item(uuid, jsonb) IS 'CTP DCP 채점 — order/insert 검증 + csat_item_attempts 기록. answer_key 오답시만 공개. DEFINER+auth.uid.';
