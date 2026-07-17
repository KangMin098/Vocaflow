-- 20260713150000_lookup_derivation_tier.sql
-- lookup_word_meaning 에 파생 해소 tier 추가 — 학습자가 파생형을 따로 안 찾아도 뜻이 나오도록.
--   기존 tier: direct → en_inflection_bases(굴절 규칙) → spelling_variants → inflected_forms(cluster).
--   추가 tier: 위 전부 실패 시, 투명 파생 접미사(-ly/-ness/-less/-ful/-ish/-like/-wise)를 벗겨
--     base 표제어가 있으면 그 뜻으로 폴백(match_via='derivation'). base 존재 시에만 해소 → 쓰레기 없음.
--   ※ 흔한 파생형(bravely·kindliness…)은 이미 표제어(direct)라 그대로. 이 tier는 rare 미등록 롱테일만 커버.
--   ※ 명사화(-tion/-ment…)는 base 뜻이 POS-불일치라 폴백 안 함(대부분 이미 표제어). 투명 파생만.

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

  -- 1) 직접 매칭
  RETURN QUERY
    SELECT true, p_surface, d.word, d.meaning_ko, d.pos, d.cefr_level, d.v_level::smallint, d.example_en, 'direct'::text, d.word_register
    FROM shared_dictionary d
    WHERE d.word = s AND d.v_level IS NOT NULL AND d.classified_by IS NOT NULL
      AND d.meaning_ko IS NOT NULL AND length(d.meaning_ko) > 0
    LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  -- 2) 규칙 역굴절
  RETURN QUERY
    SELECT true, p_surface, d.word, d.meaning_ko, d.pos, d.cefr_level, d.v_level::smallint, d.example_en, 'inflection'::text, d.word_register
    FROM unnest(en_inflection_bases(s)) AS cand(c)
    JOIN shared_dictionary d ON d.word = cand.c
    WHERE d.v_level IS NOT NULL AND d.classified_by IS NOT NULL
      AND d.meaning_ko IS NOT NULL AND length(d.meaning_ko) > 0
    ORDER BY d.frequency_rank NULLS LAST
    LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  -- 3) 철자 변형
  RETURN QUERY
    SELECT true, p_surface, d.word, d.meaning_ko, d.pos, d.cefr_level, d.v_level::smallint, d.example_en, 'variant'::text, d.word_register
    FROM shared_dictionary d
    WHERE d.spelling_variants @> ARRAY[s]
      AND d.v_level IS NOT NULL AND d.classified_by IS NOT NULL
      AND d.meaning_ko IS NOT NULL AND length(d.meaning_ko) > 0
    LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  -- 4) inflected_forms 클러스터(불규칙)
  RETURN QUERY
    SELECT true, p_surface, d.word, d.meaning_ko, d.pos, d.cefr_level, d.v_level::smallint, d.example_en, 'cluster'::text, d.word_register
    FROM shared_dictionary d
    WHERE d.inflected_forms @> ARRAY[s]
      AND d.v_level IS NOT NULL AND d.classified_by IS NOT NULL
      AND d.meaning_ko IS NOT NULL AND length(d.meaning_ko) > 0
    ORDER BY d.frequency_rank NULLS LAST
    LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  -- 5) (신규) 투명 파생 접미사 벗기기 → base 뜻 폴백 (base 존재 시에만 = 쓰레기 없음)
  RETURN QUERY
    SELECT true, p_surface, d.word, d.meaning_ko, d.pos, d.cefr_level, d.v_level::smallint, d.example_en, 'derivation'::text, d.word_register
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

  RETURN QUERY SELECT false, p_surface, NULL::text, NULL::text, NULL::text, NULL::text, NULL::smallint, NULL::text, 'not_found'::text, NULL::text;
END $function$;
