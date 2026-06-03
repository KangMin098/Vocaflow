-- 20260531_180000_find_unbound_morphology_columns.sql
-- 큐레이션 진단 보강 2 — find_unbound_book_lemmas 에 형태론/사전DB 점검 컬럼 3개 추가.
--
--   inflection_base : en_inflection_bases(lemma) 로 나온 굴절 base 중 사전에 실재하는 표제어
--                     (meta 완전성 무관). 미바인딩 row 에서 non-null 이면 "굴절형인데 base 가
--                     사전엔 있으나 미완성(dict V/뜻 비어있음)" 을 뜻함 — dict_v_level/meaning 칼럼과 함께 점검.
--   deriv_base      : en_derivational_bases(lemma) 로 나온 파생 base 중 완전한 표제어
--                     (v_level + classified_by + meaning_ko). "파생형, base=X" → seed 후보 판단.
--   archaic_class   : archaic_candidates.classification (classify 파이프라인 위치 —
--                     processed/addable_modern/person_noise/geo_noise/spelling_variant/pending).
--
-- 기존 cluster_base(freq_external_a 클러스터) · variant_hit(US/UK 철자) 와 함께 미바인딩어의
-- 사전 연결 경로를 전부 노출. reason 분류 로직은 불변(순수 진단 컬럼 추가).
-- read-only. 반환 컬럼 추가라 DROP 후 재생성.

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
  joined AS (
    SELECT bl.w, bl.occ,
           d.v_level, d.meaning_ko, d.classified_by,
           (SELECT sv.word FROM shared_dictionary sv
              WHERE sv.spelling_variants @> ARRAY[bl.w]
                AND sv.v_level IS NOT NULL AND sv.classified_by IS NOT NULL
                AND sv.meaning_ko IS NOT NULL LIMIT 1) AS sv_hit,
           (SELECT id.word FROM unnest(en_inflection_bases(bl.w)) AS cand(c)
              JOIN shared_dictionary id ON id.word = cand.c
              WHERE id.v_level IS NOT NULL AND id.classified_by IS NOT NULL
                AND id.meaning_ko IS NOT NULL LIMIT 1) AS infl_hit,
           (ad.word IS NOT NULL) AS in_archaic,
           (nb.form IS NOT NULL) AS in_blacklist,
           ac.classification AS ac_class,
           (SELECT c.word FROM shared_dictionary c
              WHERE c.inflections @? format('$.forms[*].form ? (@ == "%s")', bl.w)::jsonpath
                AND c.v_level IS NOT NULL AND c.classified_by IS NOT NULL
                AND c.meaning_ko IS NOT NULL
              ORDER BY c.frequency_rank NULLS LAST
              LIMIT 1) AS cl_base,
           -- ★ 굴절 base (loose — 사전 실재 여부만, meta 완전성 무관)
           (SELECT id2.word FROM unnest(en_inflection_bases(bl.w)) AS cand2(c)
              JOIN shared_dictionary id2 ON id2.word = cand2.c
              ORDER BY (id2.v_level IS NOT NULL AND id2.meaning_ko IS NOT NULL
                        AND id2.classified_by IS NOT NULL) DESC, id2.word
              LIMIT 1) AS infl_base,
           -- ★ 파생 base (완전한 표제어)
           (SELECT sd.word FROM unnest(en_derivational_bases(bl.w)) AS cand3(c)
              JOIN shared_dictionary sd ON sd.word = cand3.c
              WHERE sd.v_level IS NOT NULL AND sd.classified_by IS NOT NULL
                AND sd.meaning_ko IS NOT NULL AND LENGTH(sd.meaning_ko) > 0
              LIMIT 1) AS deriv_base
    FROM book_lemmas bl
    LEFT JOIN shared_dictionary d ON d.word = bl.w
    LEFT JOIN archaic_dictionary ad ON ad.word = bl.w
    LEFT JOIN archaic_candidates ac ON ac.word = bl.w
    LEFT JOIN noise_blacklist nb ON nb.form = bl.w
  ),
  classified AS (
    SELECT j.w AS lemma, j.occ, j.v_level, j.meaning_ko, j.classified_by,
      NULL::text AS v_hit, j.cl_base, j.infl_base, j.deriv_base, j.ac_class,
      CASE
        WHEN j.sv_hit IS NOT NULL THEN 'ok'
        WHEN j.infl_hit IS NOT NULL THEN 'ok'
        WHEN j.in_blacklist THEN 'noise'
        WHEN j.in_archaic THEN 'ok'
        WHEN j.v_level IS NOT NULL AND j.classified_by IS NULL THEN 'not_classified'
        WHEN j.v_level IS NULL AND (j.meaning_ko IS NOT NULL OR j.classified_by IS NOT NULL) THEN 'no_v_level'
        WHEN j.v_level IS NOT NULL AND (j.meaning_ko IS NULL OR LENGTH(j.meaning_ko)=0) THEN 'no_meaning'
        WHEN j.v_level IS NOT NULL THEN 'ok'
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
