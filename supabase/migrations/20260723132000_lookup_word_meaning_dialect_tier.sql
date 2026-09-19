-- lookup_word_meaning 에 dialect tier 추가 — dialect_map(방언/고어→표준) 해소.
-- 순서: coverage(6-7) → dialect(신규) → normalized(8-9). 방언변이는 비단어라 앞 tier와 충돌 없음.
create or replace function public.lookup_word_meaning(p_surface text)
 returns table(found boolean, surface text, resolved_word text, meaning_ko text, pos text, cefr_level text, v_level smallint, example_en text, match_via text, word_register text, gloss_en text, lang text)
 language plpgsql stable set search_path to 'public'
as $function$
DECLARE s text := lower(trim(coalesce(p_surface,''))); dh text;
BEGIN
  IF s = '' OR s !~ '[a-z]' THEN
    RETURN QUERY SELECT false, p_surface, NULL::text, NULL::text, NULL::text, NULL::text, NULL::smallint, NULL::text, 'invalid'::text, NULL::text, NULL::text, NULL::text;
    RETURN;
  END IF;
  dh := replace(s,'-','');

  RETURN QUERY SELECT true, p_surface, d.word, d.meaning_ko, d.pos, d.cefr_level, d.v_level::smallint, d.example_en, 'direct'::text, d.word_register, NULL::text, 'en'::text
    FROM shared_dictionary d WHERE d.word = s AND d.v_level IS NOT NULL AND d.classified_by IS NOT NULL AND d.meaning_ko IS NOT NULL AND length(d.meaning_ko) > 0 LIMIT 1;
  IF FOUND THEN RETURN; END IF;
  RETURN QUERY SELECT true, p_surface, d.word, d.meaning_ko, d.pos, d.cefr_level, d.v_level::smallint, d.example_en, 'inflection'::text, d.word_register, NULL::text, 'en'::text
    FROM unnest(en_inflection_bases(s)) AS cand(c) JOIN shared_dictionary d ON d.word = cand.c
    WHERE d.v_level IS NOT NULL AND d.classified_by IS NOT NULL AND d.meaning_ko IS NOT NULL AND length(d.meaning_ko) > 0 ORDER BY d.frequency_rank NULLS LAST LIMIT 1;
  IF FOUND THEN RETURN; END IF;
  RETURN QUERY SELECT true, p_surface, d.word, d.meaning_ko, d.pos, d.cefr_level, d.v_level::smallint, d.example_en, 'variant'::text, d.word_register, NULL::text, 'en'::text
    FROM shared_dictionary d WHERE d.spelling_variants @> ARRAY[s] AND d.v_level IS NOT NULL AND d.classified_by IS NOT NULL AND d.meaning_ko IS NOT NULL AND length(d.meaning_ko) > 0 LIMIT 1;
  IF FOUND THEN RETURN; END IF;
  RETURN QUERY SELECT true, p_surface, d.word, d.meaning_ko, d.pos, d.cefr_level, d.v_level::smallint, d.example_en, 'cluster'::text, d.word_register, NULL::text, 'en'::text
    FROM shared_dictionary d WHERE d.inflected_forms @> ARRAY[s] AND d.v_level IS NOT NULL AND d.classified_by IS NOT NULL AND d.meaning_ko IS NOT NULL AND length(d.meaning_ko) > 0 ORDER BY d.frequency_rank NULLS LAST LIMIT 1;
  IF FOUND THEN RETURN; END IF;
  RETURN QUERY SELECT true, p_surface, d.word, d.meaning_ko, d.pos, d.cefr_level, d.v_level::smallint, d.example_en, 'derivation'::text, d.word_register, NULL::text, 'en'::text
    FROM (SELECT unnest(array_remove(ARRAY[
        CASE WHEN s ~ 'ically$' THEN regexp_replace(s,'ically$','ic') END, CASE WHEN s ~ 'ily$' THEN regexp_replace(s,'ily$','y') END,
        CASE WHEN s ~ 'ly$' THEN regexp_replace(s,'ly$','') END, CASE WHEN s ~ 'iness$' THEN regexp_replace(s,'iness$','y') END,
        CASE WHEN s ~ 'ness$' THEN regexp_replace(s,'ness$','') END, CASE WHEN s ~ 'iless$' THEN regexp_replace(s,'iless$','y') END,
        CASE WHEN s ~ 'less$' THEN regexp_replace(s,'less$','') END, CASE WHEN s ~ 'fully$' THEN regexp_replace(s,'fully$','') END,
        CASE WHEN s ~ 'ful$' THEN regexp_replace(s,'ful$','') END, CASE WHEN s ~ 'ish$' THEN regexp_replace(s,'ish$','') END,
        CASE WHEN s ~ 'like$' THEN regexp_replace(s,'like$','') END, CASE WHEN s ~ 'wise$' THEN regexp_replace(s,'wise$','') END
      ], NULL)) AS cand) c JOIN shared_dictionary d ON d.word = c.cand
    WHERE length(c.cand) >= 3 AND d.v_level IS NOT NULL AND d.classified_by IS NOT NULL AND d.meaning_ko IS NOT NULL AND length(d.meaning_ko) > 0 ORDER BY d.frequency_rank NULLS LAST LIMIT 1;
  IF FOUND THEN RETURN; END IF;
  RETURN QUERY SELECT true, p_surface, lc.word, lc.meaning_ko, lc.pos, NULL::text, NULL::smallint, NULL::text, 'coverage-clean'::text, NULL::text, lc.gloss_en, lc.lang
    FROM lexicon_clean lc WHERE lc.word = ANY (ARRAY[s] || en_inflection_bases(s)) AND lc.meaning_ko IS NOT NULL AND length(lc.meaning_ko) > 0 ORDER BY (lc.word = s) DESC LIMIT 1;
  IF FOUND THEN RETURN; END IF;
  RETURN QUERY SELECT true, p_surface, lc.word, NULL::text, lc.pos, NULL::text, NULL::smallint, NULL::text, 'coverage-clean_en'::text, NULL::text, lc.gloss_en, lc.lang
    FROM lexicon_clean lc WHERE lc.word = ANY (ARRAY[s] || en_inflection_bases(s)) AND lc.gloss_en IS NOT NULL AND length(lc.gloss_en) > 0 ORDER BY (lc.word = s) DESC LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  -- 7.5 방언·고어 정규화 맵 (dialect_map → 표준 표제어)
  RETURN QUERY SELECT true, p_surface, d.word, d.meaning_ko, d.pos, d.cefr_level, d.v_level::smallint, d.example_en, 'dialect'::text, d.word_register, NULL::text, 'en'::text
    FROM dialect_map dm
    JOIN shared_dictionary d ON d.word = ANY(ARRAY[dm.standard] || en_inflection_bases(dm.standard))
    WHERE dm.variant = s AND d.classified_by IS NOT NULL AND d.meaning_ko IS NOT NULL AND length(d.meaning_ko) > 0
    ORDER BY (d.word = dm.standard) DESC, d.frequency_rank NULLS LAST LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  -- 8. 정규화 → shared_dictionary (de-하이픈 전체형 우선)
  RETURN QUERY SELECT true, p_surface, d.word, d.meaning_ko, d.pos, d.cefr_level, d.v_level::smallint, d.example_en, 'normalized'::text, d.word_register, NULL::text, 'en'::text
    FROM shared_dictionary d
    WHERE d.word IN (SELECT unnest(array[sv] || en_inflection_bases(sv)) FROM unnest(surface_variants(s)) sv)
      AND d.classified_by IS NOT NULL AND d.meaning_ko IS NOT NULL AND length(d.meaning_ko) > 0
    ORDER BY (d.word = dh) DESC, d.frequency_rank NULLS LAST LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  -- 9. 정규화 → lexicon_clean
  RETURN QUERY SELECT true, p_surface, lc.word, lc.meaning_ko, lc.pos, NULL::text, NULL::smallint, NULL::text, 'normalized-coverage'::text, NULL::text, lc.gloss_en, lc.lang
    FROM lexicon_clean lc
    WHERE lc.word IN (SELECT unnest(array[sv] || en_inflection_bases(sv)) FROM unnest(surface_variants(s)) sv)
      AND lc.meaning_ko IS NOT NULL ORDER BY (lc.word = dh) DESC LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  RETURN QUERY SELECT false, p_surface, NULL::text, NULL::text, NULL::text, NULL::text, NULL::smallint, NULL::text, 'not_found'::text, NULL::text, NULL::text, NULL::text;
END $function$;
