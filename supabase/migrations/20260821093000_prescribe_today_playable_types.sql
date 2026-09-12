-- supabase/migrations/20260821093000_prescribe_today_playable_types.sql
--
-- **처방이 화면이 못 그리는 문항을 주지 않게 한다.**
--
-- ── 무슨 일이 있었나 ─────────────────────────────────────────────────
-- `20260821090000` 이 `csat_dcp_items.type` 에 `irrelevant`·`word_order` 를 허용했고,
-- 그날 1,087행이 들어갔다. 그런데 `prescribe_today` 는 **유형을 가리지 않고** 5문항을 뽑고,
-- 학습자 화면(`DcpPlayer`)과 채점 RPC(`grade_dcp_item`)는 `order`·`insert` 만 안다.
--
--   · 클라이언트 매퍼(`parseItem`)가 모르는 유형을 `null` 로 버린다 → 5문항이 3문항으로 줄어든다
--   · 다섯 개가 모두 새 유형이면 블록이 통째로 "오늘 준비된 구문 연습이 없어요" 로 뜬다
--   · 만에 하나 화면까지 갔다면 `grade_dcp_item` 이 `Unknown type` 으로 예외를 던진다
--
-- 실측(적재 직후): 처방이 보는 발행 카탈로그 안에서
--   word_order 630 · irrelevant 31 · insert 516 · order 379  → **661/1,556 = 42.5%** 가 재생 불가
--
-- ── 고치는 방식 ──────────────────────────────────────────────────────
-- **저장은 그대로 두고 처방에서만 거른다.** 새 유형은 교재(인쇄물)를 위해 만든 것이라
-- 지우면 안 되고, 학습 화면이 그것을 그리게 되는 것은 별개의 작업이다. 그때 이 목록에
-- 유형을 더하면 된다 — 목록이 한 곳에 있으니 빠뜨릴 수 없다.
--
-- 나머지 본문은 `20260821 이전 정의와 동일`하다. 바뀐 줄은 `i.type IN (...)` 한 줄이다.

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
    SELECT jsonb_agg(p) INTO v_practice FROM (
      SELECT i.id, i.type, i.paragraph_idx, i.payload FROM csat_dcp_items i
      JOIN csat_stage_catalog c ON c.id=i.ref_id AND c.kind=i.kind
      WHERE substring(c.stage_band FROM 2)::int <= LEAST(v_num, 4)
        -- 화면과 채점이 아는 유형만. 새 유형을 그리게 되면 여기에 더한다.
        AND i.type IN ('order', 'insert')
      ORDER BY md5(i.id::text || current_date::text) LIMIT 5) p;
  END IF;
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
