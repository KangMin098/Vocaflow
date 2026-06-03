-- 20260603_130000_find_unbound_perf_prefilter.sql
-- 큐레이션 단어 추출 BookExtractionPanel 의 findUnboundBookLemmas timeout 해소.
--
-- 문제: 기존 find_unbound_book_lemmas 는 책의 전체 lemma (1,838~5,760개) 에 대해
--   6개 expensive subquery (spelling_variants GIN · inflections jsonpath @? ·
--   en_inflection_bases × 2 · en_derivational_bases · archaic_candidates)
--   를 실행 후 WHERE reason <> 'ok' 사후 필터링 → statement_timeout(2분) 초과.
--
-- Fix: book_lemmas → unbound CTE pre-filter (NOT EXISTS 4-way):
--   완전 매핑 lemma — (1) dict 정상 등재 / (2) spelling_variants hit /
--                    (3) inflection base hit / (4) archaic 등재 — 미리 제외.
--   expensive subquery 는 진짜 unbound (수십~수백 개) 만 처리. 예상 비용 ~100× 축소.
--
-- 반환 컬럼·인터페이스 불변 — UI 코드 영향 0. read-only.

BEGIN;

DROP FUNCTION IF EXISTS find_unbound_book_lemmas(UUID, INT);

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
  book_occurrences INT,
  variant_hit TEXT,
  cluster_base TEXT,
  inflection_base TEXT,
  deriv_base TEXT,
  archaic_class TEXT
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
           SUM(COALESCE(lbv.frequency_in_book, 1))::int AS occ
    FROM library_book_vocabularies lbv
    WHERE lbv.library_book_id = p_book_id
      AND COALESCE(lbv.lemma, lbv.word) IS NOT NULL
    GROUP BY COALESCE(lbv.lemma, lbv.word)
  ),
  -- ★ pre-filter: 완전 매핑 lemma 미리 제외 (joined CTE 의 expensive subquery 대상 ~100x 축소).
  --   완전 매핑 = (1) dict 정상 등재 / (2) spelling_variants hit / (3) inflection base hit / (4) archaic 등재
  unbound AS (
    SELECT bl.w, bl.occ FROM book_lemmas bl
    WHERE NOT (
      EXISTS (SELECT 1 FROM shared_dictionary d
              WHERE d.word = bl.w
                AND d.v_level IS NOT NULL AND d.classified_by IS NOT NULL
                AND d.meaning_ko IS NOT NULL AND LENGTH(d.meaning_ko) > 0)
      OR EXISTS (SELECT 1 FROM shared_dictionary sv
                 WHERE sv.spelling_variants @> ARRAY[bl.w]
                   AND sv.v_level IS NOT NULL AND sv.classified_by IS NOT NULL
                   AND sv.meaning_ko IS NOT NULL)
      OR EXISTS (SELECT 1 FROM unnest(en_inflection_bases(bl.w)) AS cand(c)
                 JOIN shared_dictionary id ON id.word = cand.c
                 WHERE id.v_level IS NOT NULL AND id.classified_by IS NOT NULL
                   AND id.meaning_ko IS NOT NULL)
      OR EXISTS (SELECT 1 FROM archaic_dictionary ad WHERE ad.word = bl.w)
    )
  ),
  joined AS (
    SELECT u.w, u.occ,
           d.v_level, d.meaning_ko, d.classified_by,
           (nb.form IS NOT NULL) AS in_blacklist,
           ac.classification AS ac_class,
           (SELECT c.word FROM shared_dictionary c
              WHERE c.inflections @? format('$.forms[*].form ? (@ == "%s")', u.w)::jsonpath
                AND c.v_level IS NOT NULL AND c.classified_by IS NOT NULL
                AND c.meaning_ko IS NOT NULL
              ORDER BY c.frequency_rank NULLS LAST
              LIMIT 1) AS cl_base,
           (SELECT id2.word FROM unnest(en_inflection_bases(u.w)) AS cand2(c)
              JOIN shared_dictionary id2 ON id2.word = cand2.c
              ORDER BY (id2.v_level IS NOT NULL AND id2.meaning_ko IS NOT NULL
                        AND id2.classified_by IS NOT NULL) DESC, id2.word
              LIMIT 1) AS infl_base,
           (SELECT sd.word FROM unnest(en_derivational_bases(u.w)) AS cand3(c)
              JOIN shared_dictionary sd ON sd.word = cand3.c
              WHERE sd.v_level IS NOT NULL AND sd.classified_by IS NOT NULL
                AND sd.meaning_ko IS NOT NULL AND LENGTH(sd.meaning_ko) > 0
              LIMIT 1) AS deriv_base
    FROM unbound u
    LEFT JOIN shared_dictionary d ON d.word = u.w
    LEFT JOIN archaic_candidates ac ON ac.word = u.w
    LEFT JOIN noise_blacklist nb ON nb.form = u.w
  ),
  classified AS (
    SELECT j.w AS lemma, j.occ, j.v_level, j.meaning_ko, j.classified_by,
      NULL::text AS v_hit, j.cl_base, j.infl_base, j.deriv_base, j.ac_class,
      CASE
        WHEN j.in_blacklist THEN 'noise'
        WHEN j.v_level IS NOT NULL AND j.classified_by IS NULL THEN 'not_classified'
        WHEN j.v_level IS NULL AND (j.meaning_ko IS NOT NULL OR j.classified_by IS NOT NULL) THEN 'no_v_level'
        WHEN j.v_level IS NOT NULL AND (j.meaning_ko IS NULL OR LENGTH(j.meaning_ko)=0) THEN 'no_meaning'
        WHEN j.ac_class = 'processed' THEN 'ok'
        WHEN j.ac_class IN ('geo_noise','person_noise') THEN 'noise'
        WHEN j.ac_class = 'spelling_variant' THEN 'spelling_variant'
        WHEN j.ac_class IN ('addable_modern','archaic') THEN 'genuine_miss'
        WHEN j.w ~ '^[ivxlcdm]+$' OR length(j.w) < 3 OR j.w LIKE '%''%' THEN 'noise'
        ELSE 'genuine_miss'
      END AS reason
    FROM joined j
  )
  SELECT c.lemma, c.reason, c.v_level::smallint, c.meaning_ko, c.classified_by,
         c.occ, c.v_hit, c.cl_base, c.infl_base, c.deriv_base, c.ac_class
  FROM classified c
  WHERE c.reason <> 'ok'
  ORDER BY
    CASE c.reason
      WHEN 'spelling_variant' THEN 1
      WHEN 'genuine_miss' THEN 2
      WHEN 'no_meaning' THEN 3
      WHEN 'no_v_level' THEN 4
      WHEN 'not_classified' THEN 5
      ELSE 6
    END,
    c.occ DESC, c.lemma
  LIMIT GREATEST(1, LEAST(p_limit, 5000));
END $$;

REVOKE ALL ON FUNCTION find_unbound_book_lemmas(UUID, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION find_unbound_book_lemmas(UUID, INT) TO authenticated;

COMMIT;
