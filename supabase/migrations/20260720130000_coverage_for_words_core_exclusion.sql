-- supabase/migrations/20260720130000_coverage_for_words_core_exclusion.sql
-- select_coverage_for_words(사용자 스크립트)에 core-제외 가드 + 길이≥4 — 도서/기사 함수와 일관.
--   en_inflection_bases 과잉stem(character→charact·father→fathe)이 kaikki obscure 고어와 오매칭하던 것 차단.
--   토큰 bases가 core로 해소되면 학습 소관이므로 coverage 목록에서 배제.
CREATE OR REPLACE FUNCTION public.select_coverage_for_words(p_words text[])
 RETURNS TABLE(word text, matched_surface text, meaning_ko text, gloss_en text, pos text, frequency_rank integer)
 LANGUAGE sql STABLE SET search_path TO 'public' SET statement_timeout TO '15000'
AS $function$
  WITH based AS (
    SELECT t.w AS surface, ARRAY[lower(t.w)] || en_inflection_bases(lower(t.w)) AS bases
    FROM unnest(p_words) AS t(w)
  ),
  elig AS (
    SELECT * FROM based b
    WHERE NOT EXISTS (SELECT 1 FROM shared_dictionary d WHERE d.word = ANY(b.bases)
                        AND d.classified_by IS NOT NULL AND d.meaning_ko IS NOT NULL AND length(d.meaning_ko)>0)
  ),
  c AS (
    SELECT DISTINCT ON (e.surface)
      cov.word AS word, e.surface AS matched_surface, cov.meaning_ko, cov.gloss_en, cov.pos, cov.frequency_rank
    FROM elig e
    JOIN coverage_lexicon cov ON cov.word = ANY (e.bases)
    WHERE cov.source <> 'skip' AND (cov.meaning_ko IS NOT NULL OR cov.gloss_en IS NOT NULL) AND length(cov.word) >= 4
    ORDER BY e.surface, (cov.word = lower(e.surface)) DESC, (cov.meaning_ko IS NOT NULL) DESC, cov.frequency_rank NULLS LAST
  )
  SELECT word, matched_surface, meaning_ko, gloss_en, pos, frequency_rank
  FROM c ORDER BY frequency_rank NULLS LAST, word
$function$;
