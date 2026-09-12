-- supabase/migrations/20260822140000_grade_dcp_item_mood.sql
--
-- **심경·분위기(19번) 45문항이 채점되지 않는다.** 목록에서 빠진 것뿐이다.
--
-- ── 어떻게 생겼나 ────────────────────────────────────────────────────
-- `20260822013136` 이 선택지 9종의 채점 분기를 만들 때 `mood` 는 **아직 존재하지 않는
-- 유형**이었다(같은 날 몇 시간 뒤에 45문항이 생겼다). 유형을 만들고 나서 그 배열에
-- 더하는 것을 빠뜨렸고, 그래서 지금 상태는 이렇다:
--
--   · payload·answer_key 모양은 다른 선택지 유형과 **완전히 같다**
--   · 화면(`DcpChoiceItem`)은 그릴 수 있다
--   · 그런데 제출하면 `grade_dcp_item` 이 `Unknown type` 을 던진다 (실측 프로브로 확인)
--
-- 그 예외는 `gradeDcpItem` 에서 `{correct:false}` 로 바뀐다 — **정답을 맞혀도 오답으로
-- 보인다.** 이 저장소가 열흘 동안 모든 DCP 문항에서 겪은 바로 그 결함이라, 코드 쪽에서는
-- `mood` 를 교재 전용으로 묶어 화면에 못 나가게 막아 두었다. 이 마이그레이션이 그 자물쇠를 푼다.
--
-- ── 왜 이번엔 회귀가 함께 있나 ───────────────────────────────────────
-- "코드는 풀 수 있다고 하는데 DB 는 채점 못 한다" 는 상태가 두 번째다. 목록이 두 곳에
-- 나뉘어 있는 한 또 갈린다. 그래서 `dcp-grade-records.integration` 에 **재생용 선택지
-- 유형을 전부 실제로 채점해 보는** 단언을 넣었다 — 목록이 어긋나면 테스트가 먼저 빨개진다.
--
-- 되돌리기: 두 배열에서 'mood' 를 빼고 CREATE OR REPLACE. 데이터 변경 없음.

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
                             'mood',                                    -- ← 이번에 더한 것
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
                   'mood',
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
