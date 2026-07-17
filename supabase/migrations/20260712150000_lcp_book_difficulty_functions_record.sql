-- LCP 도서 난이도 함수 기록 (스키마 드리프트 복구 · 2026-07-12).
--
-- 발견: compute_book_vrl / compute_book_cefrj / compute_book_coverage 함수 본체가
--   committed 마이그레이션에 부재(out-of-band execute_sql 적용)로 재현·감사·롤백 불가였음.
--   본 파일은 현 DB 정의를 pg_get_functiondef 로 덤프해 마이그레이션 이력에 기록(동작 변경 0 — CREATE OR REPLACE 동일본).
--   (compute_book_difficulty v2.4 는 20260712140000 에 이미 존재, trg_publish_book_word_sets 재부착은 20260606123000.)

-- ① compute_book_vrl — book_v_level = distinct-lemma v_level PERCENTILE_DISC(0.75), V11(archaic) 제외.
CREATE OR REPLACE FUNCTION public.compute_book_vrl(p_book_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_p50              INT;
  v_p75              INT;
  v_p90              INT;
  v_weighted_avg     NUMERIC;
  v_matched_lemmas   INT;
  v_total_lbv        INT;
  v_v_level_div      INT;
  v_coverage_pct     NUMERIC;
BEGIN
  IF p_book_id IS NULL THEN RETURN; END IF;

  SELECT COUNT(*) INTO v_total_lbv
  FROM library_book_vocabularies
  WHERE library_book_id = p_book_id;

  IF v_total_lbv = 0 THEN
    RAISE NOTICE 'Book % has no vocabularies; skipping VRL.', p_book_id;
    RETURN;
  END IF;

  -- ★ type-based: distinct lemma 만 percentile 계산 (frequency expansion 제거)
  --   V11 (archaic) 제외 유지 — method tag 'p75_type_v11_excluded'
  WITH joined AS (
    SELECT DISTINCT lbv.lemma, sd.v_level
    FROM library_book_vocabularies lbv
    JOIN shared_dictionary sd ON sd.word = lbv.lemma
    WHERE lbv.library_book_id = p_book_id
      AND sd.v_level IS NOT NULL
      AND sd.v_level <> 11
  )
  SELECT
    PERCENTILE_DISC(0.50) WITHIN GROUP (ORDER BY v_level)::int,
    PERCENTILE_DISC(0.75) WITHIN GROUP (ORDER BY v_level)::int,
    PERCENTILE_DISC(0.90) WITHIN GROUP (ORDER BY v_level)::int,
    ROUND(AVG(v_level)::numeric, 2)
  INTO v_p50, v_p75, v_p90, v_weighted_avg
  FROM joined;

  IF v_p75 IS NULL THEN
    RAISE NOTICE 'Book % vrl join produced no rows; skipping.', p_book_id;
    RETURN;
  END IF;

  -- matched lemmas (v_level 존재 + 매칭) + diversity (V11 포함 카운트)
  SELECT COUNT(DISTINCT lbv.lemma), COUNT(DISTINCT sd.v_level)
    INTO v_matched_lemmas, v_v_level_div
  FROM library_book_vocabularies lbv
  JOIN shared_dictionary sd ON sd.word = lbv.lemma
  WHERE lbv.library_book_id = p_book_id
    AND sd.v_level IS NOT NULL
    AND sd.v_level <> 11;

  v_coverage_pct := ROUND(100.0 * v_matched_lemmas / NULLIF(v_total_lbv, 0), 2);

  UPDATE library_books
  SET
    book_v_level             = v_p75::smallint,
    v_level_centroid_precise = v_weighted_avg,
    vrl_components = jsonb_build_object(
      'p50', v_p50,
      'p75', v_p75,
      'p90', v_p90,
      'weighted_avg', v_weighted_avg,
      'matched_lemmas', v_matched_lemmas,
      'lemma_coverage_pct', v_coverage_pct,
      'v_level_diversity', v_v_level_div,
      'method', 'p75_type_v11_excluded_l1_l2_inflections',
      'computed_at', now()
    ),
    vrl_calculated_at = now()
  WHERE id = p_book_id;
END;
$function$;

-- ② compute_book_cefrj — p75 → CEFR-J 12-band + 소스 신뢰도 기반 confidence.
CREATE OR REPLACE FUNCTION public.compute_book_cefrj(p_book_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_source           TEXT;
  v_components       JSONB;
  v_p75              INT;
  v_weighted_avg     NUMERIC;
  v_coverage_pct     NUMERIC;
  v_cefrj            TEXT;
  v_base_confidence  NUMERIC;
  v_final_confidence NUMERIC;
  v_tier             TEXT;
BEGIN
  SELECT lb.source, lb.vrl_components, sc.cefrj_auto_assign_tier
    INTO v_source, v_components, v_tier
  FROM library_books lb
  LEFT JOIN library_source_catalogs sc ON sc.source = lb.source
  WHERE lb.id = p_book_id;

  IF v_components IS NULL
     OR NOT (v_components ? 'p75')
     OR NOT (v_components ? 'weighted_avg') THEN
    RAISE NOTICE 'Book % has no VRL computed; skipping CEFR-J.', p_book_id;
    RETURN;
  END IF;

  v_p75          := (v_components->>'p75')::INT;
  v_weighted_avg := (v_components->>'weighted_avg')::NUMERIC;
  v_coverage_pct := COALESCE((v_components->>'lemma_coverage_pct')::NUMERIC, 0);

  v_cefrj := CASE v_p75
    WHEN 1  THEN 'PreA1'
    WHEN 2  THEN 'A1.2'
    WHEN 3  THEN 'A1.3'
    WHEN 4  THEN 'A2.1'
    WHEN 5  THEN 'A2.2'
    WHEN 6  THEN 'B1.1'
    WHEN 7  THEN 'B1.2'
    WHEN 8  THEN 'B2.1'
    WHEN 9  THEN 'B2.2'
    WHEN 10 THEN 'C1'
    WHEN 11 THEN 'C2'
    ELSE 'B1.1'
  END;

  v_base_confidence := CASE v_source
    WHEN 'standard_ebooks' THEN 0.95
    WHEN 'openstax'        THEN 0.90
    WHEN 'voa_learning'    THEN 0.95
    WHEN 'wikibooks'       THEN 0.85
    WHEN 'wikisource'      THEN 0.80
    WHEN 'gutenberg'       THEN 0.70
    WHEN 'librivox'        THEN 0.65
    WHEN 'open_library'    THEN 0.50
    WHEN 'hathitrust'      THEN 0.60
    WHEN 'manual'          THEN 1.00
    ELSE 0.70
  END;

  v_final_confidence := v_base_confidence + CASE
    WHEN v_coverage_pct >= 90 THEN  0.00
    WHEN v_coverage_pct >= 80 THEN -0.05
    WHEN v_coverage_pct >= 70 THEN -0.10
    ELSE                            -0.20
  END;
  v_final_confidence := LEAST(1.00, GREATEST(0.30, v_final_confidence));

  UPDATE library_books SET
    cefrj_level              = v_cefrj,
    cefrj_confidence         = v_final_confidence,
    v_level_centroid_precise = v_weighted_avg,
    status_message = COALESCE(status_message, CASE v_tier
      WHEN 'S' THEN 'auto-assigned · spot-check needed (10%)'
      WHEN 'A' THEN 'auto-assigned · sample review needed (30%)'
      WHEN 'B' THEN 'auto-assigned · full review needed'
      WHEN 'C' THEN 'auto-assigned · OCR cleanup + full review needed'
      WHEN 'M' THEN 'auto-assigned · admin self-verify'
      ELSE          'auto-assigned · review needed'
    END)
  WHERE id = p_book_id;
END;
$function$;

-- ③ compute_book_coverage — 레벨별 기지어 커버리지(i+1) lexical_coverage jsonb.
CREATE OR REPLACE FUNCTION public.compute_book_coverage(p_book_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_cov jsonb;
BEGIN
  WITH toks AS (
    SELECT v.frequency_in_book::numeric AS f, sd.v_level AS vl
    FROM library_book_vocabularies v
    JOIN shared_dictionary sd ON sd.word = v.lemma
    WHERE v.library_book_id = p_book_id
      AND v.lemma IS NOT NULL AND sd.v_level IS NOT NULL
  )
  SELECT jsonb_object_agg(g::text, pct) INTO v_cov FROM (
    SELECT g,
      round(100.0 * coalesce(sum(f) FILTER (WHERE vl <= g), 0) / nullif(sum(f), 0), 1) AS pct
    FROM toks CROSS JOIN generate_series(1, 10) AS g
    GROUP BY g
  ) x;
  UPDATE library_books SET lexical_coverage = v_cov WHERE id = p_book_id;
END $function$;
