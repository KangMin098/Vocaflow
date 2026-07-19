-- D3: 추출 품질 판정 하네스 (Q3/Q5) — RPC 2종 + extraction_judgments admin RLS.
-- 근거: docs/AI_CONTEXT/diagnostics/ext_quality_p0_20260718.md §5
-- blind 원칙: get_judgment_sample 은 in_cap/sort_order/composite 를 절대 반환하지 않음.
--   save_extraction_judgment 이 저장 시점에 SSoT 를 재조회해 스냅샷을 서버-권위로 기록.

-- ── RLS: admin/curator 전체 접근 (RPC 는 DEFINER 로 우회하나, 대시보드 직접 read 허용) ──
DROP POLICY IF EXISTS ej_admin_all ON public.extraction_judgments;
CREATE POLICY ej_admin_all ON public.extraction_judgments
  FOR ALL TO authenticated
  USING (is_admin_or_curator())
  WITH CHECK (is_admin_or_curator());

-- ── 판정 표본: in-cap 상위 8 + out-of-cap 경계 8(41~48), 셔플·출처 은닉 ──
CREATE OR REPLACE FUNCTION public.get_judgment_sample(
  p_source_kind text,
  p_source_id uuid,
  p_chapter_idx integer DEFAULT NULL
) RETURNS TABLE(word text, lemma text, meaning_ko text, v_level smallint, pos text, first_sentence text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT is_admin_or_curator() THEN
    RAISE EXCEPTION 'Forbidden: admin or curator only';
  END IF;

  IF p_source_kind = 'book' THEN
    IF p_chapter_idx IS NULL THEN RAISE EXCEPTION 'chapter_idx required for book'; END IF;
    RETURN QUERY
      WITH v AS (
        SELECT * FROM select_book_chapter_vocab(p_source_id) s WHERE s.chapter_idx = p_chapter_idx
      )
      SELECT v.word, v.lemma, v.meaning_ko, v.v_level, v.pos, v.first_sentence
      FROM v
      WHERE v.sort_order BETWEEN 1 AND 8 OR v.sort_order BETWEEN 41 AND 48
      ORDER BY random();
  ELSIF p_source_kind = 'article' THEN
    RETURN QUERY
      WITH v AS (SELECT * FROM select_article_vocab(p_source_id) s)
      SELECT v.word, v.lemma, v.meaning_ko, v.v_level, v.pos, v.first_sentence
      FROM v
      WHERE v.sort_order BETWEEN 1 AND 8 OR v.sort_order BETWEEN 41 AND 48
      ORDER BY random();
  ELSE
    RAISE EXCEPTION 'invalid source_kind: % (allowed: book, article)', p_source_kind;
  END IF;
END;
$function$;

-- ── 판정 저장: 저장 시점 SSoT 재조회로 in_cap/sort_order/composite 스냅샷 서버-권위 기록 ──
CREATE OR REPLACE FUNCTION public.save_extraction_judgment(
  p_source_kind text,
  p_source_id uuid,
  p_chapter_idx integer,
  p_word text,
  p_verdict text,
  p_mode text DEFAULT 'absolute',
  p_pair_word text DEFAULT NULL,
  p_pair_wins boolean DEFAULT NULL
) RETURNS TABLE(in_cap boolean, sort_order_at integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sort integer;
  v_comp numeric;
  v_vlevel smallint;
  v_headword text;
BEGIN
  IF NOT is_admin_or_curator() THEN
    RAISE EXCEPTION 'Forbidden: admin or curator only';
  END IF;

  IF p_source_kind = 'book' THEN
    SELECT s.sort_order, s.composite_score, s.v_level, s.lemma
      INTO v_sort, v_comp, v_vlevel, v_headword
    FROM select_book_chapter_vocab(p_source_id) s
    WHERE s.chapter_idx = p_chapter_idx AND s.word = lower(p_word)
    LIMIT 1;
  ELSIF p_source_kind = 'article' THEN
    SELECT s.sort_order, s.composite_score, s.v_level, s.lemma
      INTO v_sort, v_comp, v_vlevel, v_headword
    FROM select_article_vocab(p_source_id) s
    WHERE s.word = lower(p_word)
    LIMIT 1;
  ELSE
    RAISE EXCEPTION 'invalid source_kind: %', p_source_kind;
  END IF;

  IF v_sort IS NULL THEN
    RAISE EXCEPTION 'word % not in current extraction for %/%', p_word, p_source_kind, p_source_id;
  END IF;

  INSERT INTO public.extraction_judgments(
    source_kind, source_id, chapter_idx, word, headword,
    in_cap, sort_order_at, composite_at, v_level_at,
    verdict, judge_kind, mode, pair_word, pair_wins, judged_by
  ) VALUES (
    p_source_kind, p_source_id, p_chapter_idx, lower(p_word), v_headword,
    (v_sort <= 40), v_sort, v_comp, v_vlevel,
    p_verdict, 'human', p_mode, lower(p_pair_word), p_pair_wins, auth.uid()
  );

  in_cap := (v_sort <= 40);
  sort_order_at := v_sort;
  RETURN NEXT;
END;
$function$;

-- anon 잠금 (DEFINER 내부 가드가 이미 차단하나 defense-in-depth) — PUBLIC 회수 후 authenticated grant
REVOKE EXECUTE ON FUNCTION public.get_judgment_sample(text, uuid, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.save_extraction_judgment(text, uuid, integer, text, text, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_judgment_sample(text, uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_extraction_judgment(text, uuid, integer, text, text, text, text, boolean) TO authenticated, service_role;
