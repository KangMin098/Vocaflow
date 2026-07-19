-- supabase/migrations/20260720100000_extraction_residual_harvest.sql
-- 추출 누락 실단어 수확 — 도서+기사 토큰 중 core·coverage 어디에도 없고
-- first_sentence에 소문자로 출현(실단어·고유명사 아님)한 것 + 문맥 문장. 재측정에도 재사용.
CREATE OR REPLACE FUNCTION public.select_extraction_residual()
 RETURNS TABLE(word text, context text, freq integer, sources text)
 LANGUAGE sql STABLE SET search_path TO 'public' SET statement_timeout TO '60000'
AS $function$
  WITH tok AS (
    SELECT lower(coalesce(lemma,word)) AS w, first_sentence AS fs, frequency_in_chapter AS freq, 'book' AS src
    FROM library_book_vocabularies WHERE coalesce(lemma,word) ~ '^[a-z]+$'
    UNION ALL
    SELECT lower(coalesce(lemma,word)) AS w, first_sentence, frequency_in_article, 'article'
    FROM library_article_vocabularies WHERE coalesce(lemma,word) ~ '^[a-z]+$'
  ),
  agg AS (
    SELECT w, max(freq) AS freq,
      (array_agg(fs ORDER BY length(fs) DESC) FILTER (WHERE fs ~ ('\m'||w||'\M')))[1] AS ctx,
      string_agg(DISTINCT src, ',') AS sources,
      bool_or(fs IS NOT NULL AND fs ~ ('\m'||w||'\M')) AS appears_lower
    FROM tok WHERE length(w) >= 4
    GROUP BY w
  )
  SELECT a.w, left(a.ctx, 300), a.freq, a.sources
  FROM agg a
  WHERE a.appears_lower
    AND NOT EXISTS (SELECT 1 FROM shared_dictionary d WHERE d.word=a.w AND d.classified_by IS NOT NULL AND d.meaning_ko IS NOT NULL AND length(d.meaning_ko)>0)
    AND NOT EXISTS (SELECT 1 FROM coverage_lexicon c WHERE c.word=a.w AND (c.meaning_ko IS NOT NULL OR c.gloss_en IS NOT NULL) AND c.source<>'skip')
  ORDER BY a.freq DESC NULLS LAST, a.w
$function$;
