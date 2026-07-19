-- supabase/migrations/20260719120000_lookup_coverage_fallback.sql
-- lookup_word_meaning: shared_dictionary 5단계 실패 시 coverage_lexicon 폴백 추가.
-- 반환에 gloss_en 컬럼 추가(미번역 롱테일 영어 폴백). 체인: core→coverage(ko)→gloss_en→미상.
DROP FUNCTION IF EXISTS public.lookup_word_meaning(text);

CREATE FUNCTION public.lookup_word_meaning(p_surface text)
 RETURNS TABLE(found boolean, surface text, resolved_word text, meaning_ko text, pos text,
   cefr_level text, v_level smallint, example_en text, match_via text, word_register text, gloss_en text)
 LANGUAGE plpgsql STABLE SET search_path TO 'public'
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

  -- 5. derivation (투명 파생 접미사 벗기기 → base 존재 시)
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

  -- 6. (신규) coverage_lexicon 한국어 — 비학습 롱테일 독해 폴백 (직접 + 굴절 base)
  RETURN QUERY
    SELECT true, p_surface, c.word, c.meaning_ko, c.pos, NULL::text, NULL::smallint,
      NULL::text, 'coverage'::text, NULL::text, c.gloss_en
    FROM coverage_lexicon c
    WHERE c.word = ANY (ARRAY[s] || en_inflection_bases(s))
      AND c.meaning_ko IS NOT NULL AND length(c.meaning_ko) > 0
    ORDER BY (c.word = s) DESC, c.frequency_rank NULLS LAST
    LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  -- 7. (신규) coverage_lexicon 영어 gloss — 미번역 롱테일(한국어 없으면 영어라도). skip 잡음 제외.
  RETURN QUERY
    SELECT true, p_surface, c.word, NULL::text, c.pos, NULL::text, NULL::smallint,
      NULL::text, 'coverage_en'::text, NULL::text, c.gloss_en
    FROM coverage_lexicon c
    WHERE c.word = ANY (ARRAY[s] || en_inflection_bases(s))
      AND c.source <> 'skip' AND c.gloss_en IS NOT NULL AND length(c.gloss_en) > 0
    ORDER BY (c.word = s) DESC, c.frequency_rank NULLS LAST
    LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  RETURN QUERY SELECT false, p_surface, NULL::text, NULL::text, NULL::text, NULL::text,
    NULL::smallint, NULL::text, 'not_found'::text, NULL::text, NULL::text;
END $function$;
