-- supabase/migrations/20260613160000_resolve_via_inflected_forms.sql
-- 굴절형 Phase D — surface↔lemma 정방향 해소를 inflected_forms 로 통일.
--
-- 기존: lookup_word_meaning cluster tier 와 extract_vocabulary_for_user_v2 L2 가
--   noisy `inflections` jsonb 를 `@? jsonpath(사용자 입력 interpolation)` 로 조회 →
--   (1) doer→do 같은 파생 오매칭 (2) jsonpath 문자열에 surface 직접 삽입(주입 위험) (3) 느림.
-- 변경: 정제 `inflected_forms text[]` + GIN 으로 `@> ARRAY[surface]` (정확·파라미터화·빠름).
--   `inflections` jsonb 는 freq/provenance 로 보존하되 해소 경로에선 더 이상 조회 안 함.
--   ※ 규칙 역방향(en_inflection_bases + english_irregular_forms) tier 는 그대로 — 정방향만 통일.

-- 1) reader 클릭 사전 lookup — cluster tier 를 inflected_forms 로
CREATE OR REPLACE FUNCTION public.lookup_word_meaning(p_surface text)
 RETURNS TABLE(found boolean, surface text, resolved_word text, meaning_ko text, pos text, cefr_level text, v_level smallint, example_en text, match_via text, word_register text)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE s text := lower(trim(coalesce(p_surface,'')));
BEGIN
  IF s = '' OR s !~ '[a-z]' THEN
    RETURN QUERY SELECT false, p_surface, NULL::text, NULL::text, NULL::text, NULL::text, NULL::smallint, NULL::text, 'invalid'::text, NULL::text;
    RETURN;
  END IF;

  RETURN QUERY
    SELECT true, p_surface, d.word, d.meaning_ko, d.pos, d.cefr_level, d.v_level::smallint, d.example_en, 'direct'::text, d.word_register
    FROM shared_dictionary d
    WHERE d.word = s AND d.v_level IS NOT NULL AND d.classified_by IS NOT NULL
      AND d.meaning_ko IS NOT NULL AND length(d.meaning_ko) > 0
    LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  RETURN QUERY
    SELECT true, p_surface, d.word, d.meaning_ko, d.pos, d.cefr_level, d.v_level::smallint, d.example_en, 'inflection'::text, d.word_register
    FROM unnest(en_inflection_bases(s)) AS cand(c)
    JOIN shared_dictionary d ON d.word = cand.c
    WHERE d.v_level IS NOT NULL AND d.classified_by IS NOT NULL
      AND d.meaning_ko IS NOT NULL AND length(d.meaning_ko) > 0
    ORDER BY d.frequency_rank NULLS LAST
    LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  RETURN QUERY
    SELECT true, p_surface, d.word, d.meaning_ko, d.pos, d.cefr_level, d.v_level::smallint, d.example_en, 'variant'::text, d.word_register
    FROM shared_dictionary d
    WHERE d.spelling_variants @> ARRAY[s]
      AND d.v_level IS NOT NULL AND d.classified_by IS NOT NULL
      AND d.meaning_ko IS NOT NULL AND length(d.meaning_ko) > 0
    LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  -- (v06.41 Phase D) 정제 inflected_forms 정방향 — 이전 noisy inflections jsonbpath 대체
  RETURN QUERY
    SELECT true, p_surface, d.word, d.meaning_ko, d.pos, d.cefr_level, d.v_level::smallint, d.example_en, 'cluster'::text, d.word_register
    FROM shared_dictionary d
    WHERE d.inflected_forms @> ARRAY[s]
      AND d.v_level IS NOT NULL AND d.classified_by IS NOT NULL
      AND d.meaning_ko IS NOT NULL AND length(d.meaning_ko) > 0
    ORDER BY d.frequency_rank NULLS LAST
    LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  RETURN QUERY SELECT false, p_surface, NULL::text, NULL::text, NULL::text, NULL::text, NULL::smallint, NULL::text, 'not_found'::text, NULL::text;
END $function$;

-- 2) /text 추출 L2 굴절 회수 — inflected_forms 로 (주입 제거 + 정확 + GIN 가속)
CREATE OR REPLACE FUNCTION public.extract_vocabulary_for_user_v2(p_user_id uuid, p_words text[], p_level_strategy text DEFAULT 'auto'::text, p_limit integer DEFAULT NULL::integer)
 RETURNS TABLE(text_v_level smallint, user_v_level smallint, effective_user_v smallint, level_source text, gap integer, auto_n integer, v_threshold smallint, total_candidates integer, word text, meaning_ko text, v_level smallint, cefr_level text, pos text, example_en text, frequency_rank integer, skill_level smallint, track_levels jsonb, composite_score numeric, score_breakdown jsonb, rank integer, match_layer smallint, matched_via_surface text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_v INT; v_text_v INT; v_eff_v INT;
  v_gap INT; v_auto_n INT;
  v_csat INT; v_biz INT; v_acad INT;
  v_level_source TEXT;
  v_thresh INT;
  v_effective_limit INT;
BEGIN
  IF p_level_strategy NOT IN ('user', 'text', 'auto') THEN
    RAISE EXCEPTION 'invalid p_level_strategy: %, expected user|text|auto', p_level_strategy;
  END IF;

  SELECT current_v_level,
    COALESCE((current_track_levels->>'csat_korean')::int, 0),
    COALESCE((current_track_levels->>'business_english')::int, 0),
    COALESCE((current_track_levels->>'academic_english')::int, 0)
  INTO v_user_v, v_csat, v_biz, v_acad
  FROM public.user_profiles WHERE user_id = p_user_id;

  WITH input_words AS (
    SELECT DISTINCT LOWER(TRIM(w)) AS w FROM unnest(p_words) AS w WHERE LENGTH(TRIM(w)) >= 2
  ),
  word_levels AS (
    SELECT d.v_level::int AS vl
    FROM input_words iw
    JOIN public.shared_dictionary d ON d.word = iw.w
    WHERE d.v_level IS NOT NULL AND d.classified_by IS NOT NULL
  )
  SELECT COALESCE(
    (SELECT percentile_disc(0.75) WITHIN GROUP (ORDER BY vl) FROM word_levels), 5
  ) INTO v_text_v;

  IF p_level_strategy = 'user' THEN
    IF v_user_v IS NULL OR v_user_v = 0 THEN
      RAISE EXCEPTION '본인 레벨 기준 선택했으나 진단 미완료 — /diagnostic 진단 후 시도 또는 text 모드 사용';
    END IF;
    v_eff_v := v_user_v;
    v_thresh := v_user_v + 1;
    v_level_source := 'user_diagnostic';
  ELSIF p_level_strategy = 'text' THEN
    v_eff_v := GREATEST(v_text_v - 1, 1);
    v_thresh := v_text_v;
    v_level_source := 'text_p75';
  ELSE
    IF v_user_v IS NOT NULL AND v_user_v > 0 THEN
      v_eff_v := v_user_v;
      v_thresh := v_user_v + 1;
      v_level_source := 'auto_user_diagnostic';
    ELSE
      v_eff_v := GREATEST(v_text_v - 1, 1);
      v_thresh := v_text_v;
      v_level_source := 'auto_text_p75_fallback';
    END IF;
  END IF;

  v_thresh := GREATEST(1, LEAST(v_thresh, 11));
  v_gap := GREATEST(v_text_v - v_eff_v, 0);
  v_auto_n := 30;

  v_effective_limit := CASE
    WHEN p_limit IS NULL THEN 30
    WHEN p_limit = 0 THEN 9999
    ELSE GREATEST(1, LEAST(p_limit, 9999))
  END;

  RETURN QUERY
  WITH input_words AS (
    SELECT DISTINCT LOWER(TRIM(w)) AS w FROM unnest(p_words) AS w WHERE LENGTH(TRIM(w)) >= 2
  ),
  l1_candidates AS (
    SELECT
      d.word AS c_word, d.meaning_ko AS c_meaning, d.v_level AS c_vl,
      d.cefr_level AS c_cefr, d.pos AS c_pos, d.example_en AS c_ex,
      d.frequency_rank AS c_freq, d.skill_level AS c_skill, d.track_levels AS c_tracks,
      1::smallint AS c_layer, NULL::text AS c_via
    FROM input_words iw
    JOIN public.shared_dictionary d ON d.word = iw.w
    WHERE d.v_level IS NOT NULL
      AND d.meaning_ko IS NOT NULL AND LENGTH(d.meaning_ko) > 0
      AND d.classified_by IS NOT NULL
      AND d.v_level >= v_thresh
  ),
  l1_lemmas AS (SELECT c_word AS w FROM l1_candidates),
  l2_inputs AS (
    SELECT iw.w FROM input_words iw
    WHERE NOT EXISTS (SELECT 1 FROM l1_lemmas h WHERE h.w = iw.w)
  ),
  l2_candidates AS (
    SELECT DISTINCT ON (d.word)
      d.word AS c_word, d.meaning_ko AS c_meaning, d.v_level AS c_vl,
      d.cefr_level AS c_cefr, d.pos AS c_pos, d.example_en AS c_ex,
      d.frequency_rank AS c_freq, d.skill_level AS c_skill, d.track_levels AS c_tracks,
      2::smallint AS c_layer, li.w AS c_via
    FROM l2_inputs li
    JOIN public.shared_dictionary d
      ON d.inflected_forms @> ARRAY[li.w]
    WHERE d.v_level IS NOT NULL
      AND d.meaning_ko IS NOT NULL AND LENGTH(d.meaning_ko) > 0
      AND d.classified_by IS NOT NULL
      AND d.v_level >= v_thresh
      AND NOT EXISTS (SELECT 1 FROM l1_lemmas h WHERE h.w = d.word)
  ),
  candidates AS (
    SELECT * FROM l1_candidates UNION ALL SELECT * FROM l2_candidates
  ),
  filtered AS (
    SELECT c.* FROM candidates c
    LEFT JOIN public.vocabularies v
      ON v.user_id = p_user_id AND LOWER(v.word) = c.c_word
    WHERE v.id IS NULL
  ),
  scored AS (
    SELECT f.*,
      GREATEST(
        CASE WHEN v_csat >= 4 AND (f.c_tracks->>'csat_korean')::int >= 4
             THEN 1.0 - ABS((f.c_tracks->>'csat_korean')::int - v_csat)::numeric / 10.0 ELSE 0 END,
        CASE WHEN v_biz >= 4 AND (f.c_tracks->>'business_english')::int >= 4
             THEN 1.0 - ABS((f.c_tracks->>'business_english')::int - v_biz)::numeric / 10.0 ELSE 0 END,
        CASE WHEN v_acad >= 4 AND (f.c_tracks->>'academic_english')::int >= 4
             THEN 1.0 - ABS((f.c_tracks->>'academic_english')::int - v_acad)::numeric / 10.0 ELSE 0 END,
        0.0
      ) AS c_track,
      1.0 / LOG(10, COALESCE(f.c_freq, 50000)::numeric + 10) AS c_freqb,
      CASE WHEN f.c_skill = 4 AND v_eff_v < 6 THEN -0.10 ELSE 0 END AS c_skillp
    FROM filtered f
  ),
  composite AS (
    SELECT s.*,
      ROUND(0.70*s.c_freqb + 0.30*s.c_track + s.c_skillp, 4) AS c_score,
      ROW_NUMBER() OVER (
        ORDER BY (0.70*s.c_freqb + 0.30*s.c_track + s.c_skillp) DESC,
                 s.c_vl ASC,
                 s.c_freq ASC NULLS LAST
      ) AS c_rn,
      COUNT(*) OVER () AS c_total
    FROM scored s
  )
  SELECT
    v_text_v::smallint, v_user_v::smallint, v_eff_v::smallint, v_level_source,
    v_gap, v_auto_n, v_thresh::smallint, c.c_total::int,
    c.c_word, c.c_meaning, c.c_vl::smallint, c.c_cefr, c.c_pos, c.c_ex,
    c.c_freq, c.c_skill::smallint, c.c_tracks,
    c.c_score,
    jsonb_build_object(
      'user_v_level', v_eff_v, 'v_threshold', v_thresh,
      'track_boost', ROUND(c.c_track, 4),
      'frequency_boost', ROUND(c.c_freqb, 4),
      'skill_penalty', c.c_skillp,
      'weights', jsonb_build_object('frequency_boost', 0.70, 'track_boost', 0.30),
      'match_layer', c.c_layer,
      'matched_via_surface', c.c_via,
      'method', 'pure_threshold_filter_user_limit',
      'reasoning',
        'V' || c.c_vl || ' ≥ threshold V' || v_thresh
        || CASE WHEN c.c_vl = v_thresh THEN ' (정확히 threshold)' ELSE '' END
    ),
    c.c_rn::int,
    c.c_layer,
    c.c_via
  FROM composite c
  WHERE c.c_rn <= v_effective_limit
  ORDER BY c.c_rn;
END;
$function$;