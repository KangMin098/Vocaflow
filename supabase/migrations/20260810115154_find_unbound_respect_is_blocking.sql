-- 20260810115154_find_unbound_respect_is_blocking.sql
-- ADR 0004 D3 (후속) — 진단 함수가 해제된 오등록을 "노이즈"로 표시하지 않도록.
--   블랙리스트 조인에 is_blocking 조건 추가. 반환 타입 동일 → CREATE OR REPLACE.
--   나머지 로직은 20260809155433 과 같다.

-- (반환 타입 동일 → CREATE OR REPLACE. 나머지 로직은 20260809155433 과 같다.)
CREATE OR REPLACE FUNCTION public.find_unbound_book_lemmas(
  p_book_id uuid,
  p_limit   integer DEFAULT 500
)
RETURNS TABLE(
  lemma text, reason text, dict_v_level smallint, dict_meaning_ko text,
  dict_classified_by text, book_occurrences integer, variant_hit text,
  cluster_base text, inflection_base text, deriv_base text, archaic_class text,
  resolved_via text, resolved_lang text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT is_admin_or_curator() THEN
    RAISE EXCEPTION 'Forbidden: admin or curator only';
  END IF;

  RETURN QUERY
  WITH book_lemmas AS (
    SELECT COALESCE(lbv.lemma, lbv.word) AS w,
           SUM(COALESCE(lbv.frequency_in_book, 1))::int AS occ,
           MAX(lbv.resolved_via)  AS rvia,
           MAX(lbv.resolved_lang) AS rlang,
           MAX(lbv.noise_kind)    AS nkind
    FROM library_book_vocabularies lbv
    WHERE lbv.library_book_id = p_book_id
      AND COALESCE(lbv.lemma, lbv.word) IS NOT NULL
    GROUP BY COALESCE(lbv.lemma, lbv.word)
  ),
  unbound AS (
    SELECT bl.* FROM book_lemmas bl
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
    SELECT u.w, u.occ, u.rvia, u.rlang, u.nkind,
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
    -- ADR 0004 D3 — 해제된 오등록은 노이즈로 보지 않는다.
    LEFT JOIN noise_blacklist nb ON nb.form = u.w AND nb.is_blocking
  ),
  classified AS (
    SELECT j.w AS lemma, j.occ, j.v_level, j.meaning_ko, j.classified_by,
      NULL::text AS v_hit, j.cl_base, j.infl_base, j.deriv_base, j.ac_class,
      j.rvia, j.rlang,
      CASE
        WHEN j.in_blacklist THEN 'noise'
        WHEN j.nkind IS NOT NULL THEN 'noise'
        WHEN j.v_level IS NOT NULL AND j.classified_by IS NULL THEN 'not_classified'
        WHEN j.v_level IS NULL AND (j.meaning_ko IS NOT NULL OR j.classified_by IS NOT NULL) THEN 'no_v_level'
        WHEN j.v_level IS NOT NULL AND (j.meaning_ko IS NULL OR LENGTH(j.meaning_ko) = 0) THEN 'no_meaning'
        WHEN j.ac_class = 'processed' THEN 'ok'
        WHEN j.ac_class IN ('geo_noise', 'person_noise') THEN 'noise'
        WHEN COALESCE(j.rlang, 'en') <> 'en' THEN 'foreign'
        WHEN j.rvia IN ('dialect', 'spelling', 'variant') OR j.ac_class = 'spelling_variant'
          THEN 'spelling_variant'
        WHEN j.rvia IN ('derivation', 'normalized', 'normalized-coverage', 'cluster', 'inflection')
          THEN 'morphology'
        WHEN j.rvia IN ('coverage-clean', 'suggestion', 'direct') THEN 'lexicon_only'
        WHEN j.ac_class IN ('addable_modern', 'archaic') THEN 'genuine_miss'
        WHEN j.w ~ '^[ivxlcdm]+$' OR LENGTH(j.w) < 3 OR j.w LIKE '%''%' THEN 'noise'
        ELSE 'genuine_miss'
      END AS reason
    FROM joined j
  )
  SELECT c.lemma, c.reason, c.v_level::smallint, c.meaning_ko, c.classified_by,
         c.occ, c.v_hit, c.cl_base, c.infl_base, c.deriv_base, c.ac_class,
         c.rvia, c.rlang
  FROM classified c
  WHERE c.reason <> 'ok'
  ORDER BY
    CASE c.reason
      WHEN 'genuine_miss'     THEN 1
      WHEN 'no_meaning'       THEN 2
      WHEN 'no_v_level'       THEN 3
      WHEN 'not_classified'   THEN 4
      WHEN 'spelling_variant' THEN 5
      WHEN 'lexicon_only'     THEN 6
      WHEN 'morphology'       THEN 7
      WHEN 'foreign'          THEN 8
      ELSE 9
    END,
    c.occ DESC, c.lemma
  LIMIT GREATEST(1, LEAST(p_limit, 5000));
END $function$;
