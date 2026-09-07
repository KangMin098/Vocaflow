-- 20260810090000_find_unbound_resolution_aware.sql
-- 큐레이션 추출 패널의 "사전 미바인딩" 과대 보고 수정.
--
-- 실측 (2026-08-10):
--   | 도서 | 패널 표시 | 실제 남은 공백 |
--   | Les Misérables | 1,294 | 153 |
--   | Introduction to Sociology | 1,212 | 79 |
--   | Dialogues | 632 | 26 |
--
-- 원인: find_unbound_book_lemmas 의 "결합됨" 판정이 shared_dictionary 직접 + spelling_variants
--       + en_inflection_bases + archaic_dictionary 4가지뿐이다. lookup_word_meaning 이 쓰는
--       나머지 티어 — lexicon_clean(coverage-clean · 455,037 · en/la/fr/it/de/es) ·
--       spelling_norm(312,642) · dialect_map(147) · derivation · normalized(하이픈/소유격) ·
--       cluster(inflected_forms) — 를 안 본다. v_book_extraction_stats 는 v06.35 에서
--       이미 해석률로 재정의했는데 이 진단 함수만 옛 기준에 남아 있었다.
--
-- 수정: v06.35 에서 추가한 library_book_vocabularies.resolved_via / resolved_lang / noise_kind
--       (트리거 + fill_lbv_resolution 이 유지)를 읽어 reason 을 정확히 붙인다.
--       행을 숨기지 않는다 — 큐레이터가 "왜 사전에 없는데 문제가 아닌지" 를 볼 수 있어야 한다.
--       대신 reason 을 쪼개고 정렬로 **조치 대상을 위로** 올린다.
--
-- 새 reason 3종 (모두 조치 불요):
--   foreign       — 영어가 아님 (Hugo 원문 프랑스어 · Gibbon 라틴어). resolved_lang 에 언어.
--   morphology    — 파생/굴절/복합/정규화로 base 에 도달 (재추출 시 base 로 surface).
--   lexicon_only  — lexicon_clean 에만 있음 (shared_dictionary 등재 대상은 아님).
--
-- 반환 타입이 바뀌므로 CREATE OR REPLACE 불가 → DROP 후 재생성.

DROP FUNCTION IF EXISTS public.find_unbound_book_lemmas(uuid, integer);

CREATE FUNCTION public.find_unbound_book_lemmas(
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
           -- 미결합 행에만 채워지는 진단 컬럼 (v06.35). 같은 단어는 트리거가 동일 값으로 채운다.
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
    LEFT JOIN noise_blacklist nb ON nb.form = u.w
  ),
  classified AS (
    SELECT j.w AS lemma, j.occ, j.v_level, j.meaning_ko, j.classified_by,
      NULL::text AS v_hit, j.cl_base, j.infl_base, j.deriv_base, j.ac_class,
      j.rvia, j.rlang,
      CASE
        WHEN j.in_blacklist THEN 'noise'
        WHEN j.nkind IS NOT NULL THEN 'noise'
        -- 사전 row 는 있으나 메타가 미완성 = 조치 대상 (해석 여부보다 우선)
        WHEN j.v_level IS NOT NULL AND j.classified_by IS NULL THEN 'not_classified'
        WHEN j.v_level IS NULL AND (j.meaning_ko IS NOT NULL OR j.classified_by IS NOT NULL) THEN 'no_v_level'
        WHEN j.v_level IS NOT NULL AND (j.meaning_ko IS NULL OR LENGTH(j.meaning_ko) = 0) THEN 'no_meaning'
        WHEN j.ac_class = 'processed' THEN 'ok'
        WHEN j.ac_class IN ('geo_noise', 'person_noise') THEN 'noise'
        -- v06.35 — lookup_word_meaning 이 이미 해석한 것들
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
    -- 조치 대상(1~5) 을 위로, 설명된 것(6~9) 은 아래로.
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

COMMENT ON FUNCTION public.find_unbound_book_lemmas(uuid, integer) IS
  'v06.35 — 미바인딩 lemma 진단. resolved_via/resolved_lang/noise_kind 를 읽어 foreign/morphology/lexicon_only 를 분리하고 조치 대상을 위로 정렬.';
