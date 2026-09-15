-- supabase/migrations/20260822013136_dcp_attempts_and_choice_grading.sql
--
-- **관측이 0행인 진짜 이유를 고친다 — 그리고 선택지 9종을 학습자가 풀 수 있게 만든다.**
--
-- ── ① 채점은 지금까지 단 한 번도 성공한 적이 없다 ────────────────────
-- `grade_dcp_item` 은 `csat_item_attempts.question_id` 에 `csat_dcp_items.id` 를 넣는다.
-- 그런데 그 컬럼의 FK 는 **`quiz_questions`** 를 가리킨다. 그래서 모든 INSERT 가
-- 23503(foreign key violation)으로 죽는다. 실측(2026-08-22, 롤백 프로브):
--
--   insert or update on table "csat_item_attempts" violates foreign key constraint
--   "csat_item_attempts_question_id_fkey"
--   DETAIL: Key (question_id)=(5d268e14-…) is not present in table "quiz_questions".
--
-- 그 예외는 `gradeDcpItem` 에서 `{correct:false}` 로 바뀐다. 즉 **학습자가 정답을 맞혀도
-- 화면은 "아쉬워요" 를 띄웠고, 기록은 한 줄도 안 남았다.** 오답보다 나쁘다 —
-- 틀렸다고 가르쳤다.
--
-- ⚠️ 이 결함은 `20260812113000_restore_csat_item_attempts` 가 **원본 DDL 을 그대로**
--   복원하면서 FK 까지 되살려 생겼다. 그때 검증은 `derive_learner_stage` 와
--   `prescribe_today` 만 확인했다 — **채점을 한 번도 돌려 보지 않았다.** 42P01 을 고치고
--   23503 을 남긴 셈이다. 그래서 이번에는 회귀가 "attempt 가 실제로 한 줄 생기는지" 를 센다.
--
-- 고치는 방법: `question_id` 를 재활용하지 않고 **문항 종류마다 제 컬럼**을 준다.
-- 두 세계(퀴즈 문항 / DCP 문항)가 한 컬럼을 나눠 쓰면 FK 를 어느 쪽에도 걸 수 없다.
-- `ON DELETE SET NULL` 인 이유는 `refresh-dcp-items` 가 문항을 재생성하면 id 가 바뀌기
-- 때문이다 — 그때 **관측을 지우면 안 된다**(`derive_learner_stage` 가 정답률로 계단을 낸다).
-- 링크만 끊고 행은 남긴다. `question_id` 와 같은 시맨틱이다.
--
-- ── ② 선택지 9종을 채점한다 ─────────────────────────────────────────
-- 지금 `grade_dcp_item` 은 order/insert 외에는 `Unknown type` 예외를 던진다.
-- 수능 대표 9종(요지·주제·제목·빈칸·목적·주장·함축·요약·일치)은 DB 실측상 모양이 같다:
--   payload `{passage, choices[5], stem_ko, …}` · answer_key `{answer: 1..5, rationale_ko}`
-- 그래서 분기 하나가 아홉을 다 덮는다.
--
-- ── ③ 교재 연습이 그 9종을 내보낸다 ─────────────────────────────────
-- `textbook_practice_items` 의 허용 목록을 넓힌다. **정답은 그대로 안 나간다** —
-- 이 함수는 `answer_key` 열을 아예 select 하지 않고, 9종 payload 에는 정답 키가 없다
-- (payload 키 실측: passage · choices · stem_ko · underline · summary_sentence · choice_language).
--
-- 같은 실행에서 학습자가 **이미 푼 문항은 빼고** 준다. 안 그러면 두 번째 방문에 같은 8문항이
-- 다시 나와 관측이 늘지 않는다.
--
-- 되돌리기: ① 은 컬럼 DROP, ②③ 은 이전 정의로 CREATE OR REPLACE. 데이터 손실 없음
-- (`csat_item_attempts` 는 적용 시점 0행).

-- ────────────────────────────────────────────────────────────────────
-- ① 관측이 DCP 문항을 가리킬 수 있게 한다
-- ────────────────────────────────────────────────────────────────────
ALTER TABLE public.csat_item_attempts
  ADD COLUMN IF NOT EXISTS dcp_item_id uuid REFERENCES public.csat_dcp_items(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.csat_item_attempts.dcp_item_id IS
  'DCP 문항(csat_dcp_items) 참조. question_id 는 quiz_questions 전용 — 두 세계가 한 컬럼을 나눠 쓰면 FK 를 못 건다.';

CREATE INDEX IF NOT EXISTS idx_cia_dcp_item ON public.csat_item_attempts (dcp_item_id);

-- ────────────────────────────────────────────────────────────────────
-- ② 채점 — 올바른 컬럼에 기록 + 선택지 9종 분기
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
                             'purpose','implication','content_match','claim']) THEN
    -- 제출값을 먼저 검증한다. 캐스트가 먼저 터지면 학습자에게는 원인 없는 오류로 보인다.
    IF (p_answer->>'choice') !~ '^[1-5]$' THEN RAISE EXCEPTION 'Bad choice'; END IF;
    v_choice := (p_answer->>'choice')::int;
    v_correct := v_choice = (it.answer_key->>'answer')::int;
  ELSE RAISE EXCEPTION 'Unknown type'; END IF;

  -- ⚠️ question_id 가 아니라 dcp_item_id 다. 위 ① 참조 — 반대로 넣으면 FK 위반으로 전부 죽는다.
  INSERT INTO csat_item_attempts (user_id, dcp_item_id, text_id, is_correct, item_role)
  VALUES (v_uid, p_item_id, it.ref_id, v_correct, 'practice')
  RETURNING id INTO v_attempt_id;

  RETURN jsonb_build_object('correct', v_correct, 'attempt_id', v_attempt_id,
    'answer_key', CASE WHEN v_correct THEN NULL ELSE it.answer_key END);
END $function$;

-- ────────────────────────────────────────────────────────────────────
-- ③ 교재 연습 — 선택지 9종까지 + 이미 푼 문항 제외
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
                   'purpose','implication','content_match','claim')
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
