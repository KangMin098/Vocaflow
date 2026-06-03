-- 20260528_130000_find_unbound_book_lemmas.sql
-- 큐레이션 — 책 lemma 중 사전 바인딩 실패 사유 진단 RPC.
--
-- library_book_vocabularies.lemma 가 shared_dictionary 와 매칭 안 되거나,
-- 매칭은 되지만 추출 필터를 못 통과한 lemma를 사유별로 반환.
--
-- 사유:
--   not_in_dictionary  shared_dictionary 에 word/inflections 매칭 0
--   no_v_level         dict row 있으나 v_level IS NULL
--   not_classified     v_level 있으나 classified_by IS NULL (자동 분류 미완료)
--   no_meaning         meaning_ko 비어있음
--   ok                 모든 필터 통과 (참고용 — 보통 호출 안 함)
--
-- read-only — UPDATE/INSERT 없음.

BEGIN;

CREATE OR REPLACE FUNCTION find_unbound_book_lemmas(
  p_book_id UUID,
  p_limit INT DEFAULT 500
)
RETURNS TABLE(
  lemma TEXT,
  reason TEXT,
  dict_v_level SMALLINT,
  dict_meaning_ko TEXT,
  dict_classified_by TEXT,
  book_occurrences INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin_or_curator() THEN
    RAISE EXCEPTION 'Forbidden: admin or curator only';
  END IF;

  RETURN QUERY
  WITH book_lemmas AS (
    SELECT COALESCE(lbv.lemma, lbv.word) AS w,
           BOOL_OR(lbv.lemma IS NULL) AS no_lemma,
           SUM(COALESCE(lbv.frequency_in_book, 1))::int AS occ
    FROM library_book_vocabularies lbv
    WHERE lbv.library_book_id = p_book_id
      AND COALESCE(lbv.lemma, lbv.word) IS NOT NULL
    GROUP BY COALESCE(lbv.lemma, lbv.word)
  ),
  joined AS (
    SELECT bl.w, bl.no_lemma, bl.occ,
           d.v_level, d.meaning_ko, d.classified_by
    FROM book_lemmas bl
    LEFT JOIN shared_dictionary d ON d.word = bl.w
  ),
  classified AS (
    SELECT j.w AS lemma,
           j.occ AS occ,
           j.v_level AS v_level,
           j.meaning_ko AS meaning_ko,
           j.classified_by AS classified_by,
           CASE
             WHEN j.no_lemma
                  THEN 'no_lemma_mapping'
             WHEN j.v_level IS NULL AND j.meaning_ko IS NULL AND j.classified_by IS NULL
                  THEN 'not_in_dictionary'
             WHEN j.v_level IS NULL
                  THEN 'no_v_level'
             WHEN j.classified_by IS NULL
                  THEN 'not_classified'
             WHEN j.meaning_ko IS NULL OR LENGTH(j.meaning_ko) = 0
                  THEN 'no_meaning'
             ELSE 'ok'
           END AS reason
    FROM joined j
  )
  SELECT c.lemma,
         c.reason,
         c.v_level::smallint,
         c.meaning_ko,
         c.classified_by,
         c.occ
  FROM classified c
  WHERE c.reason <> 'ok'
  ORDER BY c.occ DESC, c.lemma
  LIMIT GREATEST(1, LEAST(p_limit, 5000));
END $$;

REVOKE ALL ON FUNCTION find_unbound_book_lemmas(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION find_unbound_book_lemmas(UUID, INT) TO authenticated;

COMMIT;
