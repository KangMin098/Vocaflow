-- supabase/migrations/20260822120000_csat_dcp_items_long_types.sql
--
-- **장문 ② 서사문(수능 43~45번) 세 유형을 연다.**
--
-- ── 왜 세 유형인가 ───────────────────────────────────────────────────
-- 수능 장문은 묶음이 둘이고 지문이 서로 다르다: 41~42 는 설명문 한 편(제목·어휘),
-- 43~45 는 서사문 한 편(순서·지칭·일치). 이번에 여는 것은 뒤쪽뿐이다 —
-- 앞쪽은 긴 설명문 집필 갈래가 아직 없다(`csat-types.ts` 의 `long_expository` 참조).
--
-- ── 왜 기존 선택지 유형에 얹을 수 있나 ───────────────────────────────
-- 셋 다 **지문 하나 + 선택지 다섯**이고 정답 키가 `{answer: 1..5, rationale_ko}` 다.
-- 즉 2026-08-22 에 만든 선택지 갈래와 payload 모양이 같다. 그래서 화면(`DcpChoiceItem`)과
-- 채점 분기를 새로 만들지 않고 **유형 이름만 목록에 더한다.**
--
-- 다른 것은 **지문 길이**뿐이다(300어 안팎 · 문단 4개). 그건 DB 가 아니라 조합기의 문제라
-- `compose-unit.CSAT_LONG_ITEM_WORDS`(260~400어)로 창을 갈랐다 —
-- 짧은 지문의 창(90~200어)을 그대로 대면 장문이 **전량 "너무 길다" 로 걸린다.**
--
-- ⚠️ 44번(지칭)의 선택지는 **지문에서 그대로 따온 구절**이다. 화면이 지문 안에 ①~⑤ 를
--    찍지 않으므로 학습자가 눈으로 찾아야 한다(시험지보다 어렵다). 적재기가 "지문에
--    그대로 없는 구절" 을 반려하므로 찾을 수 있다는 것만은 보장된다.
--
-- 되돌리기: CHECK 를 이전 목록으로 되돌리고 두 함수를 이전 정의로 CREATE OR REPLACE.
-- 순수 추가라 기존 행에 영향 없음(적용 시점 이 세 유형의 행은 0건).

-- ────────────────────────────────────────────────────────────────────
-- ① type CHECK 확장
-- ────────────────────────────────────────────────────────────────────
ALTER TABLE public.csat_dcp_items DROP CONSTRAINT IF EXISTS csat_dcp_items_type_check;
ALTER TABLE public.csat_dcp_items ADD CONSTRAINT csat_dcp_items_type_check CHECK (
  type IN (
    -- 코어 2 + 교재 결정론 4
    'order','insert','irrelevant','word_order','vocab_choice','grammar_choice',
    -- 학교 시험 축 4
    'blank_word','grammar_fix','unit_vocab','unit_grammar',
    -- 수능 생성형 10
    'purpose','mood','claim','implication','main_point','topic','title','blank','summary','content_match',
    -- 장문 ② 서사문 3 (43~45) ← 이번에 더한 것
    'long_order','long_reference','long_match'
  )
);

-- ────────────────────────────────────────────────────────────────────
-- ② 채점 — 선택지 분기에 장문 3종을 더한다
-- ────────────────────────────────────────────────────────────────────
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
                             'purpose','implication','content_match','claim',
                             'long_order','long_reference','long_match']) THEN
    -- 제출값을 먼저 검증한다. 캐스트가 먼저 터지면 학습자에게는 원인 없는 오류로 보인다.
    IF (p_answer->>'choice') !~ '^[1-5]$' THEN RAISE EXCEPTION 'Bad choice'; END IF;
    v_choice := (p_answer->>'choice')::int;
    v_correct := v_choice = (it.answer_key->>'answer')::int;
  ELSE RAISE EXCEPTION 'Unknown type'; END IF;

  -- ⚠️ question_id 가 아니라 dcp_item_id 다(20260822013136). 반대로 넣으면 FK 위반으로 전부 죽는다.
  INSERT INTO csat_item_attempts (user_id, dcp_item_id, text_id, is_correct, item_role)
  VALUES (v_uid, p_item_id, it.ref_id, v_correct, 'practice')
  RETURNING id INTO v_attempt_id;

  RETURN jsonb_build_object('correct', v_correct, 'attempt_id', v_attempt_id,
    'answer_key', CASE WHEN v_correct THEN NULL ELSE it.answer_key END);
END $function$;

-- ────────────────────────────────────────────────────────────────────
-- ③ 교재 연습 — 허용 목록에 장문 3종을 더한다
-- ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.textbook_practice_items(p_v_level smallint, p_limit int DEFAULT 10)
RETURNS TABLE (id uuid, type text, paragraph_idx int, payload jsonb, ref_title text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT i.id, i.type, i.paragraph_idx, i.payload, a.title
  FROM csat_dcp_items i
  JOIN library_articles a ON a.id = i.ref_id
  WHERE i.kind = 'article'
    -- 허용 목록이다 — 새 유형은 기본이 제외. 화면이 못 그리는 유형이 새면 빈 화면이 된다.
    AND i.type IN ('order','insert',
                   'topic','blank','main_point','title','summary',
                   'purpose','implication','content_match','claim',
                   'long_order','long_reference','long_match')
    AND i.v_level = p_v_level
    AND a.status IN ('ready','published')
    AND a.display_only = false
    -- 이미 푼 문항은 빼고 준다. 안 그러면 두 번째 방문에 같은 문항이 다시 나온다.
    AND NOT EXISTS (
      SELECT 1 FROM csat_item_attempts t
      WHERE t.dcp_item_id = i.id AND t.user_id = auth.uid()
    )
  ORDER BY i.id
  LIMIT greatest(1, least(p_limit, 50));
$function$;

REVOKE ALL ON FUNCTION public.textbook_practice_items(smallint, int) FROM public;
GRANT EXECUTE ON FUNCTION public.textbook_practice_items(smallint, int) TO authenticated;
