-- scripts/db/r0-article-practice/submit.proposal.sql — **제안(미적용)**. apply.proposal.sql(조회 getter) 뒤에 적용.
-- R0 같은 기사 안내 연습 제출 wrapper — 조회와 채점 사이의 판본 변경을 막는다(같은 트랜잭션).
--
-- 순서: 로그인·계정 → 선택 1~5 → 문항·기사·본인 글 행을 FOR SHARE 로 잠금(UPDATE 와 충돌 — FOR KEY SHARE 는 payload
--       UPDATE 를 막지 못하므로 쓰지 않는다) → 본인 글이 이 기사 마커이고 현재 본문과 같은지 → 그 문항이 지금
--       answer-free getter(article_practice_items)의 후보인지(검수 결속·권리·발행·채점 가능) → 기존 grade_dcp_item 위임.
-- 거부는 grade 호출·attempt INSERT 전에 예외로 끝난다. 성공은 기존 grade 의 결과(correct·attempt_id·answer_key 규칙) 그대로.
-- 재시도는 기존 공개 practice 의 append 의미(호출마다 시도 1행) — exactly-once·독립 평가를 보장하지 않는다.
-- 새 테이블·시도 엔진·토큰 없음.
BEGIN;
CREATE OR REPLACE FUNCTION public.submit_article_practice(
  p_article_id uuid,
  p_text_id uuid,
  p_item_id uuid,
  p_choice int
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_status text;
  v_text_body text;
  v_article_body text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT up.status INTO v_status FROM public.user_profiles up WHERE up.user_id = v_uid;
  IF v_status IN ('suspended', 'deleted') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF p_article_id IS NULL OR p_text_id IS NULL OR p_item_id IS NULL THEN RAISE EXCEPTION 'Bad request'; END IF;
  IF p_choice IS NULL OR p_choice < 1 OR p_choice > 5 THEN RAISE EXCEPTION 'Bad choice'; END IF;

  -- 잠금: 이 트랜잭션이 끝날 때까지 문항·기사·본인 글 행의 UPDATE 를 막는다
  PERFORM 1 FROM public.csat_dcp_items d WHERE d.id = p_item_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item not available'; END IF;
  SELECT a.content INTO v_article_body FROM public.library_articles a WHERE a.id = p_article_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Article not available'; END IF;
  PERFORM 1 FROM public.texts t
   WHERE t.id = p_text_id AND t.user_id = v_uid AND t.source_url = 'article:' || p_article_id::text
   FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Text not available'; END IF;

  -- 본인 글이 현재 기사 판본과 같은가(본문은 기존 본문 계약 get_chapter_content — 소유 확인 포함)
  v_text_body := public.get_chapter_content(p_text_id);
  IF v_text_body IS NULL OR v_article_body IS NULL
     OR encode(sha256(convert_to(v_text_body, 'UTF8')), 'hex') <> encode(sha256(convert_to(v_article_body, 'UTF8')), 'hex') THEN
    RAISE EXCEPTION 'Stale copy';
  END IF;

  -- 지금 그 기사의 검수 후보인가(getter 와 같은 조건 · 잠금 뒤라 채점까지 바뀌지 않는다)
  IF NOT EXISTS (SELECT 1 FROM public.article_practice_items(p_article_id) g WHERE g.id = p_item_id) THEN
    RAISE EXCEPTION 'Item not available';
  END IF;

  RETURN public.grade_dcp_item(p_item_id, jsonb_build_object('choice', p_choice::text));
END;
$$;
REVOKE ALL ON FUNCTION public.submit_article_practice(uuid, uuid, uuid, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_article_practice(uuid, uuid, uuid, int) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_article_practice(uuid, uuid, uuid, int) TO authenticated;
COMMIT;
