-- 20260809120100_v_book_extraction_stats_v2.sql
-- 추출 지표 재정의 — "사전 결합률" 단일 숫자 → "해석률 + 경로별 분해".
--
-- 왜 바꾸는가 (2026-08-09 실측):
--   lemma_coverage_pct 는 shared_dictionary 결합만 잰다. 그래서
--     · 고어(thee/whilst) — ADR D4 로 shared_dictionary 등재 금지 → 영구 미결합
--     · 외국어 원문 인용(de/la/du — Les Misérables 748회) — 애초에 영어 학습 단어가 아님
--     · 인명/지명(elizabeth 602회) — 학습 대상이 아니어야 정상
--   이 셋이 전부 "추출 실패" 로 표시됐다. 실제로는 Les Misérables 89.5% → 해석률 98.7%.
--   → 기존 컬럼은 하위호환으로 남기고, 판단에 쓸 지표를 뒤에 덧붙인다.
--
-- 새 컬럼 정의:
--   noise_count          인명·지명 (학습 단어 아님 → 분모에서 제외해야 하는 것)
--   resolved_other_count lemma 는 없지만 고어/방언/철자/외국어 사전으로 해석된 것
--   unresolved_count     어떤 자산으로도 해석 안 되는 것 = 진짜 남은 공백
--   resolved_pct         (결합 + 노이즈 + 타사전 해석) / 전체 — "설명된 비율"
--   learnable_coverage_pct  결합 / (전체 - 노이즈) — 학습 대상만 본 결합률

CREATE OR REPLACE VIEW public.v_book_extraction_stats AS
SELECT
  library_book_id AS book_id,
  count(*)::integer AS extracted_count,
  count(*) FILTER (WHERE lemma IS NOT NULL)::integer AS lemma_bound,
  count(*) FILTER (WHERE lemma IS NULL)::integer AS lemma_unbound,
  round(
    100.0 * count(*) FILTER (WHERE lemma IS NOT NULL)::numeric
      / NULLIF(count(*), 0)::numeric, 1
  )::numeric(5,1) AS lemma_coverage_pct,

  -- v06.35 진단 컬럼
  count(*) FILTER (WHERE lemma IS NULL AND noise_kind IS NOT NULL)::integer
    AS noise_count,
  count(*) FILTER (
    WHERE lemma IS NULL AND noise_kind IS NULL
      AND COALESCE(resolved_via, 'not_found') NOT IN ('not_found', 'invalid')
  )::integer AS resolved_other_count,
  count(*) FILTER (
    WHERE lemma IS NULL AND noise_kind IS NULL
      AND COALESCE(resolved_via, 'not_found') IN ('not_found', 'invalid')
  )::integer AS unresolved_count,
  round(
    100.0 * count(*) FILTER (
      WHERE lemma IS NOT NULL
         OR noise_kind IS NOT NULL
         OR COALESCE(resolved_via, 'not_found') NOT IN ('not_found', 'invalid')
    )::numeric / NULLIF(count(*), 0)::numeric, 1
  )::numeric(5,1) AS resolved_pct,
  round(
    100.0 * count(*) FILTER (WHERE lemma IS NOT NULL)::numeric
      / NULLIF(count(*) FILTER (WHERE noise_kind IS NULL), 0)::numeric, 1
  )::numeric(5,1) AS learnable_coverage_pct
FROM library_book_vocabularies
GROUP BY library_book_id;

-- 드릴다운 — 어드민 패널에서 "왜 100% 가 아닌가" 를 한 화면에 설명하기 위한 버킷 집계.
CREATE OR REPLACE VIEW public.v_book_extraction_reasons AS
SELECT
  library_book_id AS book_id,
  CASE
    WHEN lemma IS NOT NULL                                       THEN 'bound'
    WHEN noise_kind = 'person_noise'                             THEN 'noise_person'
    WHEN noise_kind = 'geo_noise'                                THEN 'noise_geo'
    WHEN COALESCE(resolved_lang, 'en') <> 'en'                   THEN 'foreign_' || resolved_lang
    WHEN resolved_via IN ('dialect', 'spelling', 'variant')      THEN 'dialect_spelling'
    WHEN resolved_via IN ('derivation', 'normalized',
                          'normalized-coverage', 'cluster',
                          'inflection')                          THEN 'morphology'
    WHEN resolved_via IN ('coverage-clean', 'suggestion',
                          'direct')                              THEN 'lexicon_only'
    ELSE 'unresolved'
  END AS bucket,
  count(*)::integer AS words,
  COALESCE(sum(frequency_in_book), 0)::bigint AS occurrences
FROM library_book_vocabularies
GROUP BY 1, 2;

COMMENT ON VIEW public.v_book_extraction_reasons IS
  '책별 추출 어휘를 결합/노이즈/외국어/방언·철자/형태론/사전전용/미해결 버킷으로 분해. 어드민 추출 진단 패널용.';
