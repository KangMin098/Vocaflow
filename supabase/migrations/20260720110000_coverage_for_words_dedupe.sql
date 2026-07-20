-- supabase/migrations/20260720110000_coverage_for_words_dedupe.sql
-- select_coverage_for_words: 입력 토큰당 1행(굴절 확장으로 인한 중복 제거). 정확매칭+한국어 우선.
--   기존엔 DISTINCT ON (cov.word) 라 "flavanols" 하나가 flavanol(영어만)+flavanols(한국어) 두 줄로 나왔음.
CREATE OR REPLACE FUNCTION public.select_coverage_for_words(p_words text[])
 RETURNS TABLE(word text, matched_surface text, meaning_ko text, gloss_en text, pos text, frequency_rank integer)
 LANGUAGE sql STABLE SET search_path TO 'public' SET statement_timeout TO '15000'
AS $function$
  WITH c AS (
    SELECT DISTINCT ON (t.w)
      cov.word AS word, t.w AS matched_surface, cov.meaning_ko, cov.gloss_en, cov.pos, cov.frequency_rank
    FROM unnest(p_words) AS t(w)
    JOIN coverage_lexicon cov ON cov.word = ANY (ARRAY[lower(t.w)] || en_inflection_bases(lower(t.w)))
    WHERE cov.source <> 'skip'
      AND (cov.meaning_ko IS NOT NULL OR cov.gloss_en IS NOT NULL)
    ORDER BY t.w, (cov.word = lower(t.w)) DESC, (cov.meaning_ko IS NOT NULL) DESC, cov.frequency_rank NULLS LAST
  )
  SELECT word, matched_surface, meaning_ko, gloss_en, pos, frequency_rank
  FROM c ORDER BY frequency_rank NULLS LAST, word
$function$;
