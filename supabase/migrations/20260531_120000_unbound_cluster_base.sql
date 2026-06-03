-- 20260531_120000_unbound_cluster_base.sql
-- 큐레이션 진단 보강 — find_unbound_book_lemmas 에 cluster_base 컬럼 추가.
--
-- 동기: 진단 함수는 규칙 기반 en_inflection_bases()/en_derivational_bases() 로 매핑을
-- 확인하지만, 실제 추출기(extract_vocabulary_for_user_v2 / extract_book_vocabulary_admin)는
-- shared_dictionary.inflections 의 freq_external_a 클러스터('$.forms[*].form')로 매핑한다.
-- 두 메커니즘이 달라, 클러스터로는 base 에 회수되는 파생/굴절형이 진단에서는 genuine_miss
-- 로 과대 보고된다 (Dumas "Twenty years after" 실측: genuine_miss 376 중 257 이 클러스터
-- 회수 가능, noise 80 중 12).
--
-- 본 마이그레이션은 reason 분류를 바꾸지 않는다 (ADR 0001 D1 — 파생형은 독립 row seed
-- 후보로 유지). 대신 추출기와 동일한 클러스터 조회 결과를 cluster_base 컬럼으로 노출해,
-- 큐레이터가 "이 lemma 는 base <X> 의 굴절 클러스터로 이미 추출됨 → seed 우선순위 낮음"
-- 을 즉시 판단하게 한다. 순수 additive — 기존 호출부는 새 컬럼만 무시하면 호환.
--
-- read-only — UPDATE/INSERT 없음.

BEGIN;

-- 반환 타입 변경(컬럼 추가)이라 CREATE OR REPLACE 불가 — DROP 후 재생성.
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
  cluster_base TEXT          -- ★ 신규: freq_external_a inflections 클러스터로 회수되는 base 표제어
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
           EXISTS (
             SELECT 1 FROM unnest(en_derivational_bases(bl.w)) AS cand(c)
             JOIN shared_dictionary sd ON sd.word = cand.c
             WHERE sd.v_level IS NOT NULL AND sd.classified_by IS NOT NULL
               AND sd.meaning_ko IS NOT NULL
           ) AS deriv_likely,
           -- ★ 추출기와 동일한 클러스터 조회 (full meta). reason 에는 영향 없음.
           (SELECT c.word FROM shared_dictionary c
              WHERE c.inflections @? format('$.forms[*].form ? (@ == "%s")', bl.w)::jsonpath
                AND c.v_level IS NOT NULL AND c.classified_by IS NOT NULL
                AND c.meaning_ko IS NOT NULL
              ORDER BY c.frequency_rank NULLS LAST
              LIMIT 1) AS cl_base
    FROM book_lemmas bl
    LEFT JOIN shared_dictionary d ON d.word = bl.w
    LEFT JOIN archaic_dictionary ad ON ad.word = bl.w
    LEFT JOIN archaic_candidates ac ON ac.word = bl.w
    LEFT JOIN noise_blacklist nb ON nb.form = bl.w
  ),
  classified AS (
    SELECT j.w AS lemma, j.occ, j.v_level, j.meaning_ko, j.classified_by,
      NULL::text AS v_hit, j.cl_base,
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
        -- 구조적 노이즈: 로마숫자/너무 짧음/아포스트로피
        WHEN j.w ~ '^[ivxlcdm]+$' OR length(j.w) < 3 OR j.w LIKE '%''%' THEN 'noise'
        -- 정책 반전(ADR 0002): 미스 기본 = genuine_miss (학습 자산 보존)
        ELSE 'genuine_miss'
      END AS reason
    FROM joined j
  )
  SELECT c.lemma, c.reason, c.v_level::smallint, c.meaning_ko, c.classified_by,
         c.occ, c.v_hit, c.cl_base
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
