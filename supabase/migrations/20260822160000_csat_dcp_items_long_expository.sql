-- supabase/migrations/20260822160000_csat_dcp_items_long_expository.sql
--
-- **장문 ① 설명문(수능 41~42번) 두 유형을 연다.** 남은 유형 중 우리가 쓸 수 있는 마지막 것이다.
--
-- ── 남은 셋 중 왜 이것만인가 ─────────────────────────────────────────
-- 도표(25)·안내문(27,28)은 **지문 밖 재료**가 있어야 한다 — 우리가 글을 쓴다고 생기지 않는다.
-- 41~42 는 긴 설명문 한 편이면 되고, 그 집필 갈래를 이번에 열었다
-- (`write-drain-export --mode long-expository`, 문단 4 × 6문장 · 300~340어).
--
-- ── 두 유형의 모양 ───────────────────────────────────────────────────
--   `long_title`  41 제목 — 지문 + 영어 제목 5개. 정답은 글 전체를 관통하는 논지.
--   `long_vocab`  42 어휘 — 지문에서 낱말 다섯을 밑줄, 그중 하나가 문맥과 어긋난다.
--
-- ⚠️ **`long_vocab` 은 지문을 고쳐서 저장한다.** 학습자가 보는 판은 낱말 하나를 어긋나게
--   바꿔 놓은 지문이고, 선택지는 그 지문에서 그대로 따온 구절이다(적재기가 포함 여부를 검사).
--   원본을 저장하면 바꾼 낱말이 지문에 없어 학습자가 찾을 것이 없다.
--
-- 둘 다 payload·answer_key 모양은 기존 선택지 갈래와 같아 화면·채점을 새로 만들지 않는다.
--
-- ── 이번에는 세 곳을 한 번에 넣는다 ──────────────────────────────────
-- 유형을 만들고 `grade_dcp_item` 배열에 더하는 것을 **세 번 빠뜨렸다**(그때마다 "정답을
-- 맞혀도 오답" 이 됐다). 그래서 CHECK·채점·RPC 를 한 마이그레이션에 묶는다.
-- 회귀(`dcp-grade-records.integration`)가 재생용 유형을 전부 실제로 채점해 보므로,
-- 여기서 빠뜨리면 테스트가 먼저 빨개진다.
--
-- 되돌리기: CHECK 를 이전 목록으로, 두 함수를 이전 정의로 CREATE OR REPLACE.
-- 순수 추가라 기존 행에 영향 없음(적용 시점 두 유형의 행은 0건).

ALTER TABLE public.csat_dcp_items DROP CONSTRAINT IF EXISTS csat_dcp_items_type_check;
ALTER TABLE public.csat_dcp_items ADD CONSTRAINT csat_dcp_items_type_check CHECK (
  type IN (
    'order','insert','irrelevant','word_order','vocab_choice','grammar_choice',
    'blank_word','grammar_fix','unit_vocab','unit_grammar',
    'purpose','mood','claim','implication','main_point','topic','title','blank','summary','content_match',
    'long_order','long_reference','long_match',
    -- 장문 ① 설명문 2 (41~42) ← 이번에 더한 것
    'long_title','long_vocab'
  )
);

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
                   'purpose','implication','content_match','claim','mood',
                   'long_order','long_reference','long_match',
                   'long_title','long_vocab')
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
