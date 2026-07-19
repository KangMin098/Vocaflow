-- supabase/migrations/20260719140000_coverage_for_words.sql
-- 사용자 입력 스크립트 등 임의 토큰 배열의 비학습 롱테일 참고 목록.
-- 굴절 surface도 en_inflection_bases로 coverage lemma 해소(footrests→footrest).
-- 고유명사 필터는 클라이언트(원문 대소문자 소문자 출현)에서 — 여기선 순수 매칭만.
CREATE OR REPLACE FUNCTION public.select_coverage_for_words(p_words text[])
 RETURNS TABLE(word text, matched_surface text, meaning_ko text, gloss_en text, pos text, frequency_rank integer)
 LANGUAGE sql STABLE SET search_path TO 'public' SET statement_timeout TO '15000'
AS $function$
  WITH c AS (
    SELECT DISTINCT ON (cov.word)
      cov.word AS word, t.w AS matched_surface, cov.meaning_ko, cov.gloss_en, cov.pos, cov.frequency_rank
    FROM unnest(p_words) AS t(w)
    JOIN coverage_lexicon cov ON cov.word = ANY (ARRAY[lower(t.w)] || en_inflection_bases(lower(t.w)))
    WHERE cov.source <> 'skip'
      AND (cov.meaning_ko IS NOT NULL OR cov.gloss_en IS NOT NULL)
    ORDER BY cov.word, cov.frequency_rank NULLS LAST
  )
  SELECT word, matched_surface, meaning_ko, gloss_en, pos, frequency_rank
  FROM c ORDER BY frequency_rank NULLS LAST, word
$function$;
