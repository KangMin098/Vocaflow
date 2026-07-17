-- CTP ⑥ — prescribe_today(uuid): 결정론 일일 루프 처방 (백엔드 · UI는 META 게이트)
-- derive_learner_stage → stage → 5블록(FSRS due·듣기·input·practice·verify) 조립.
--   input=csat_stage_catalog(stage_band) · practice=csat_dcp_items(S3+, answer_key 제외).
--   시간삭감: practice 는 stage≥S3 에서만(input 보호).
-- SECURITY DEFINER(csat_dcp_items=admin-only RLS 읽기) + auth.uid() 가드(본인/admin).
-- ⚠ apply_migration $$ 오분할 → execute_sql 로 적용됨(내용 동일).
CREATE OR REPLACE FUNCTION public.prescribe_today(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE
  v_stage text; v_num int; v_band text; v_due int;
  v_input jsonb; v_practice jsonb; v_active boolean;
BEGIN
  IF p_user_id <> auth.uid() AND NOT public.is_admin_or_curator() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  v_stage := public.derive_learner_stage(p_user_id);
  v_num := substring(v_stage FROM 2)::int;
  v_band := 'S' || LEAST(v_num, 4);
  v_active := v_num >= 3;

  SELECT count(*) INTO v_due FROM vocabularies WHERE user_id=p_user_id AND next_review_at <= now();

  SELECT jsonb_agg(c) INTO v_input FROM (
    SELECT kind, id, title, v_level, register, cefr_level FROM csat_stage_catalog
    WHERE stage_band = v_band ORDER BY v_level ASC NULLS LAST, title LIMIT 5) c;

  IF v_active THEN
    SELECT jsonb_agg(p) INTO v_practice FROM (
      SELECT i.id, i.type, i.paragraph_idx, i.payload FROM csat_dcp_items i
      JOIN csat_stage_catalog c ON c.id=i.ref_id AND c.kind=i.kind
      WHERE c.stage_band = v_band ORDER BY i.created_at DESC LIMIT 5) p;
  END IF;
  -- practice 실활성 = stage≥S3 AND 실 문항 존재 (S4=도서·DCP 문항 없음 → active-empty 오해 방지, QA v06.195)
  v_active := v_active AND v_practice IS NOT NULL AND jsonb_array_length(v_practice) > 0;

  RETURN jsonb_build_object(
    'stage', v_stage,
    'blocks', jsonb_build_array(
      jsonb_build_object('kind','fsrs_due','minutes',10,'due_count',v_due),
      jsonb_build_object('kind','listening','minutes',10,'module','echomatch'),
      jsonb_build_object('kind','input','minutes',30,'stage_band',v_band,'candidates',coalesce(v_input,'[]'::jsonb)),
      jsonb_build_object('kind','practice','minutes',CASE WHEN v_active THEN 15 ELSE 0 END,'active',v_active,'items',coalesce(v_practice,'[]'::jsonb)),
      jsonb_build_object('kind','verify','minutes',10,'module','scriptquiz')),
    'total_minutes', CASE WHEN v_active THEN 75 ELSE 60 END);
END $fn$;
COMMENT ON FUNCTION public.prescribe_today(uuid) IS 'CTP ⑥ 결정론 일일 처방(5블록). derive_learner_stage 기반. practice=S3+. answer_key 제외. DEFINER+auth.uid 가드.';
