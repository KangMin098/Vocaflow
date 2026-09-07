-- supabase/migrations/20260822110000_prescribe_today_textbook_steer.sql
--
-- **담은 교재가 오늘의 학습을 조준한다** — 다만 굶기지는 않는다.
--
-- ── 왜 (실측 2026-08-22) ────────────────────────────────────────────
-- 권 상세가 "이 권의 문항은 오늘의 학습에 섞여 나옵니다" 라고 적고 있었는데 거짓이었다.
-- `prescribe_today` 는 담은 교재를 **보지 않았다**(v06.354 에서 문구를 사실로 되돌렸다).
-- 이 마이그레이션이 그 문장을 **참으로 만든다.**
--
-- ── 설계에서 가장 중요한 한 가지 ────────────────────────────────────
-- **사다리(step → V-Level)를 SQL 에 다시 적지 않는다.**
-- 그 정본은 `SERIES_SPINE`(packages/library-pipeline)이고, DB 에 복사하면 눈금이 둘이 되어
-- 반드시 갈린다 — `user_textbook_selections` 가 step 번호만 저장한 이유와 같다.
-- 그래서 **호출부(TS)가 step 을 V-Level 로 풀어서 넘긴다.** SQL 은 레벨만 안다.
--
-- ── 담기는 조준할 뿐, 굶기지 않는다 ─────────────────────────────────
-- 담은 교재 레벨로 5문항을 못 채우면 **기존 방식으로 채운다.**
-- 교재를 담았다는 이유로 오늘 할 것이 줄어들면, 담기는 벌이 된다.
--
-- ⚠️ 기존 1인자 함수를 DROP 하고 2인자로 만든다. 기본값이 있어 `prescribe_today(uuid)`
--    호출은 그대로 동작한다. 둘을 함께 두면 "function is not unique" 로 호출이 깨진다.
--
-- 되돌리기: 이 파일의 DROP/CREATE 를 뒤집어 1인자 판을 다시 만들면 된다
--           (본문은 아래 ② 분기만 남기면 이전과 같다).

DROP FUNCTION IF EXISTS public.prescribe_today(uuid);

CREATE OR REPLACE FUNCTION public.prescribe_today(
  p_user_id  uuid,
  -- 담은 교재가 덮는 V-Level 목록. 호출부가 SERIES_SPINE 으로 풀어서 넘긴다.
  -- NULL/빈 배열이면 예전과 똑같이 동작한다.
  p_v_levels int[] DEFAULT NULL
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_stage text; v_num int; v_band text; v_due int;
  v_input jsonb; v_practice jsonb; v_active boolean;
  v_steered boolean := false;
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
    -- ① 담은 교재의 레벨을 먼저 본다.
    IF p_v_levels IS NOT NULL AND array_length(p_v_levels, 1) > 0 THEN
      SELECT jsonb_agg(p) INTO v_practice FROM (
        SELECT i.id, i.type, i.paragraph_idx, i.payload FROM csat_dcp_items i
        JOIN csat_stage_catalog c ON c.id=i.ref_id AND c.kind=i.kind
        WHERE substring(c.stage_band FROM 2)::int <= LEAST(v_num, 4)
          -- 화면과 채점이 아는 유형만. 새 유형을 그리게 되면 여기에 더한다.
          AND i.type IN ('order', 'insert')
          AND i.v_level = ANY(p_v_levels)
        ORDER BY md5(i.id::text || current_date::text) LIMIT 5) p;
      v_steered := v_practice IS NOT NULL AND jsonb_array_length(v_practice) > 0;
    END IF;

    -- ② 담은 교재로 못 채우면 예전 방식으로 채운다 — 담기가 오늘 할 것을 **줄이면 안 된다.**
    IF NOT v_steered THEN
      SELECT jsonb_agg(p) INTO v_practice FROM (
        SELECT i.id, i.type, i.paragraph_idx, i.payload FROM csat_dcp_items i
        JOIN csat_stage_catalog c ON c.id=i.ref_id AND c.kind=i.kind
        WHERE substring(c.stage_band FROM 2)::int <= LEAST(v_num, 4)
          AND i.type IN ('order', 'insert')
        ORDER BY md5(i.id::text || current_date::text) LIMIT 5) p;
    END IF;
  END IF;
  v_active := v_active AND v_practice IS NOT NULL AND jsonb_array_length(v_practice) > 0;

  RETURN jsonb_build_object(
    'stage', v_stage,
    'blocks', jsonb_build_array(
      jsonb_build_object('kind','fsrs_due','minutes',10,'due_count',v_due),
      jsonb_build_object('kind','listening','minutes',10,'module','echomatch'),
      jsonb_build_object('kind','input','minutes',30,'stage_band',v_band,'candidates',coalesce(v_input,'[]'::jsonb)),
      -- `steered` = 이 블록이 **담은 교재에서** 나왔는가. 화면이 그 사실을 말할 수 있어야
      -- "담기가 무엇을 바꿨는지" 를 학습자가 안다(안 그러면 또 보이지 않는 약속이 된다).
      jsonb_build_object('kind','practice','minutes',CASE WHEN v_active THEN 15 ELSE 0 END,
                         'active',v_active,'steered',v_steered,'items',coalesce(v_practice,'[]'::jsonb)),
      jsonb_build_object('kind','verify','minutes',10,'module','scriptquiz')),
    'total_minutes', CASE WHEN v_active THEN 75 ELSE 60 END);
END $function$;

COMMENT ON FUNCTION public.prescribe_today(uuid, int[]) IS
  '오늘의 학습 처방. p_v_levels 는 담은 교재가 덮는 레벨 — 사다리는 SERIES_SPINE 이 소유하므로 호출부가 풀어서 넘긴다(20260822110000).';
