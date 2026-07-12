-- CTP: prescribe_today DCP 선정 밴드 완화 — 정확매칭 → 누적(≤) + 일자 로테이션 (v06.229).
--
-- 문제: 기존 practice 블록이 `c.stage_band = v_band`(정확 매칭)로 DCP 를 골라,
--   카탈로그 매핑(v≤4→S1, v5-6→S2, argumentative→S3, v≥7→S4)과 맞물려
--   ① S3 밴드가 argumentative 아티클 7편에 굶주리고(반복), ② CSAT 핵심대 v5-6 콘텐츠와
--   v6 도서 DCP 가 비활성 S2 에 갇혀 학습자 도달 불가(확대 콘텐츠 ~95% 사장)였음.
-- 수정: practice 블록만 `substring(stage_band)::int <= LEAST(v_num,4)`(누적 밴드) +
--   `ORDER BY md5(id||current_date)`(일자-안정 로테이션 — 매일 다른 5문항, 하루 내 고정)로 교체.
--   → S3 학습자가 S1~S3 풀(v5-6 expository·v6 도서 포함)에서 매일 변화. 난이도 정확 캘리브레이션은
--     다소 완화되나 순서/삽입 연습(글 논리 구조 훈련)엔 무해. input(읽기) 블록·밴드 매핑은 불변.
-- 그 외 로직(input/verify/listening/fsrs_due 블록, 활성 게이트, Forbidden 가드)은 전부 동일.

CREATE OR REPLACE FUNCTION public.prescribe_today(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    -- 누적 밴드(≤ 학습자밴드) + 일자 로테이션 — 정확매칭이 S3 를 굶기고 v5-6·v6도서를 사장하던 것 해소.
    SELECT jsonb_agg(p) INTO v_practice FROM (
      SELECT i.id, i.type, i.paragraph_idx, i.payload FROM csat_dcp_items i
      JOIN csat_stage_catalog c ON c.id=i.ref_id AND c.kind=i.kind
      WHERE substring(c.stage_band FROM 2)::int <= LEAST(v_num, 4)
      ORDER BY md5(i.id::text || current_date::text) LIMIT 5) p;
  END IF;
  -- practice 실활성 = stage≥S3 AND 실 문항 존재 (빈 문항이면 비활성 — 오해 방지)
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
END $function$;
