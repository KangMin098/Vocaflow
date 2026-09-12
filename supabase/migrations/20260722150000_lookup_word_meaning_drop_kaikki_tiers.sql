-- lookup_word_meaning: kaikki(coverage_lexicon) 브리지 tier 제거.
-- lexicon_clean 에 등장 단어 전량 통합(저작권 없는 요소=word+pos+LLM 한국어만) → 브리지 불요.
-- 체인: L1(shared_dictionary 1-5) → lexicon_clean 한국어(6) → lexicon_clean 영어(7) → not_found.
-- 학습자 읽기 경로에서 kaikki 완전 제거. (coverage_lexicon 은 coverage-metric 함수 4종만 참조 — 별도 repoint 후 폐기 예정)
CREATE OR REPLACE FUNCTION public.lookup_word_meaning(p_surface text)
 RETURNS TABLE(found boolean, surface text, resolved_word text, meaning_ko text, pos text, cefr_level text, v_level smallint, example_en text, match_via text, word_register text, gloss_en text)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE s text := lower(trim(coalesce(p_surface,'')));
BEGIN
  IF s = '' OR s !~ '[a-z]' THEN
    RETURN QUERY SELECT false, p_surface, NULL::text, NULL::text, NULL::text, NULL::text,
      NULL::smallint, NULL::text, 'invalid'::text, NULL::text, NULL::text;
    RETURN;
  END IF;

  -- 1. direct
  RETURN QUERY
    SELECT true, p_surface, d.word, d.meaning_ko, d.pos, d.cefr_level, d.v_level::smallint,
      d.example_en, 'direct'::text, d.word_register, NULL::text
    FROM shared_dictionary d
    WHERE d.word = s AND d.v_level IS NOT NULL AND d.classified_by IS NOT NULL
      AND d.meaning_ko IS NOT NULL AND length(d.meaning_ko) > 0
    LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  -- 2. inflection
  RETURN QUERY
    SELECT true, p_surface, d.word, d.meaning_ko, d.pos, d.cefr_level, d.v_level::smallint,
      d.example_en, 'inflection'::text, d.word_register, NULL::text
    FROM unnest(en_inflection_bases(s)) AS cand(c)
    JOIN shared_dictionary d ON d.word = cand.c
    WHERE d.v_level IS NOT NULL AND d.classified_by IS NOT NULL
      AND d.meaning_ko IS NOT NULL AND length(d.meaning_ko) > 0
    ORDER BY d.frequency_rank NULLS LAST
    LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  -- 3. variant
  RETURN QUERY
    SELECT true, p_surface, d.word, d.meaning_ko, d.pos, d.cefr_level, d.v_level::smallint,
      d.example_en, 'variant'::text, d.word_register, NULL::text
    FROM shared_dictionary d
    WHERE d.spelling_variants @> ARRAY[s]
      AND d.v_level IS NOT NULL AND d.classified_by IS NOT NULL
      AND d.meaning_ko IS NOT NULL AND length(d.meaning_ko) > 0
    LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  -- 4. cluster
  RETURN QUERY
    SELECT true, p_surface, d.word, d.meaning_ko, d.pos, d.cefr_level, d.v_level::smallint,
      d.example_en, 'cluster'::text, d.word_register, NULL::text
    FROM shared_dictionary d
    WHERE d.inflected_forms @> ARRAY[s]
      AND d.v_level IS NOT NULL AND d.classified_by IS NOT NULL
      AND d.meaning_ko IS NOT NULL AND length(d.meaning_ko) > 0
    ORDER BY d.frequency_rank NULLS LAST
    LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  -- 5. derivation
  RETURN QUERY
    SELECT true, p_surface, d.word, d.meaning_ko, d.pos, d.cefr_level, d.v_level::smallint,
      d.example_en, 'derivation'::text, d.word_register, NULL::text
    FROM (
      SELECT unnest(array_remove(ARRAY[
        CASE WHEN s ~ 'ically$' THEN regexp_replace(s,'ically$','ic') END,
        CASE WHEN s ~ 'ily$'  THEN regexp_replace(s,'ily$','y') END,
        CASE WHEN s ~ 'ly$'   THEN regexp_replace(s,'ly$','') END,
        CASE WHEN s ~ 'iness$' THEN regexp_replace(s,'iness$','y') END,
        CASE WHEN s ~ 'ness$' THEN regexp_replace(s,'ness$','') END,
        CASE WHEN s ~ 'iless$' THEN regexp_replace(s,'iless$','y') END,
        CASE WHEN s ~ 'less$' THEN regexp_replace(s,'less$','') END,
        CASE WHEN s ~ 'fully$' THEN regexp_replace(s,'fully$','') END,
        CASE WHEN s ~ 'ful$'  THEN regexp_replace(s,'ful$','') END,
        CASE WHEN s ~ 'ish$'  THEN regexp_replace(s,'ish$','') END,
        CASE WHEN s ~ 'like$' THEN regexp_replace(s,'like$','') END,
        CASE WHEN s ~ 'wise$' THEN regexp_replace(s,'wise$','') END
      ], NULL)) AS cand
    ) c
    JOIN shared_dictionary d ON d.word = c.cand
    WHERE length(c.cand) >= 3
      AND d.v_level IS NOT NULL AND d.classified_by IS NOT NULL
      AND d.meaning_ko IS NOT NULL AND length(d.meaning_ko) > 0
    ORDER BY d.frequency_rank NULLS LAST
    LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  -- 6. lexicon_clean 한국어 (청정 독해 폴백). 직접+굴절.
  RETURN QUERY
    SELECT true, p_surface, lc.word, lc.meaning_ko, lc.pos, NULL::text, NULL::smallint,
      NULL::text, 'coverage-clean'::text, NULL::text, lc.gloss_en
    FROM lexicon_clean lc
    WHERE lc.word = ANY (ARRAY[s] || en_inflection_bases(s))
      AND lc.meaning_ko IS NOT NULL AND length(lc.meaning_ko) > 0
    ORDER BY (lc.word = s) DESC
    LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  -- 7. lexicon_clean 영어 gloss (한국어 없으면 영어라도).
  RETURN QUERY
    SELECT true, p_surface, lc.word, NULL::text, lc.pos, NULL::text, NULL::smallint,
      NULL::text, 'coverage-clean_en'::text, NULL::text, lc.gloss_en
    FROM lexicon_clean lc
    WHERE lc.word = ANY (ARRAY[s] || en_inflection_bases(s))
      AND lc.gloss_en IS NOT NULL AND length(lc.gloss_en) > 0
    ORDER BY (lc.word = s) DESC
    LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  RETURN QUERY SELECT false, p_surface, NULL::text, NULL::text, NULL::text, NULL::text,
    NULL::smallint, NULL::text, 'not_found'::text, NULL::text, NULL::text;
END $function$;
