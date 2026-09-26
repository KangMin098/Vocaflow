-- docs/AI_CONTEXT/rollback/drop_dead_dict_mining_rpcs-rollback.sql
--
-- `drop_dead_dict_mining_rpcs` 를 되돌린다 — 삭제 직전(2026-09-24) `pg_get_functiondef` 원문.
-- ACL 은 원래 PUBLIC·anon·authenticated·service_role EXECUTE 였고, CREATE 기본값과 같다.
-- ⚠️ 되살려도 `library_article_vocabularies` 는 이제 발행·가공 글 몫만 있어(12.5만 행)
--    두 함수가 돌려주는 목록은 삭제 전보다 훨씬 짧다.

CREATE OR REPLACE FUNCTION public.select_article_coverage(p_article_id uuid)
 RETURNS TABLE(word text, meaning_ko text, gloss_en text, pos text, frequency_in_article integer, first_sentence text, frequency_rank integer)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
 SET statement_timeout TO '30000'
AS $function$
  WITH filtered AS (
    SELECT lower(av.word) AS surface, av.frequency_in_article AS freq, av.first_sentence AS fs
    FROM library_article_vocabularies av
    WHERE av.library_article_id = p_article_id AND av.word ~ '^[a-z]' AND av.first_sentence IS NOT NULL
      AND (CASE WHEN lower(av.word) ~ '^[a-z]+$' THEN av.first_sentence ~ ('\m'||lower(av.word)||'\M') ELSE strpos(av.first_sentence, lower(av.word))>0 END)
      AND NOT EXISTS (SELECT 1 FROM shared_dictionary d WHERE d.word = lower(av.word) AND d.classified_by IS NOT NULL AND d.meaning_ko IS NOT NULL AND length(d.meaning_ko)>0)
  ),
  based AS (SELECT f.*, ARRAY[f.surface] || en_inflection_bases(f.surface) AS bases FROM filtered f),
  elig AS (SELECT * FROM based b WHERE NOT EXISTS (SELECT 1 FROM shared_dictionary d WHERE d.word = ANY(b.bases) AND d.classified_by IS NOT NULL AND d.meaning_ko IS NOT NULL AND length(d.meaning_ko)>0)),
  cand AS (
    SELECT DISTINCT ON (cov.word)
      cov.word AS word, cov.meaning_ko, cov.gloss_en, cov.pos, e.freq AS frequency_in_article, e.fs AS first_sentence, cov.frequency_rank
    FROM elig e JOIN lexicon_clean cov ON cov.word = ANY(e.bases)
    WHERE (cov.meaning_ko IS NOT NULL OR cov.gloss_en IS NOT NULL) AND length(cov.word)>=4
    ORDER BY cov.word, e.freq DESC NULLS LAST
  )
  SELECT word, meaning_ko, gloss_en, pos, frequency_in_article, first_sentence, frequency_rank
  FROM cand ORDER BY frequency_in_article DESC NULLS LAST, word
$function$;

CREATE OR REPLACE FUNCTION public.select_extraction_residual()
 RETURNS TABLE(word text, context text, freq integer, sources text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
 SET statement_timeout TO '60000'
AS $function$
  WITH tok AS (
    SELECT lower(coalesce(lemma,word)) AS w, first_sentence AS fs, frequency_in_chapter AS freq, 'book' AS src
    FROM library_book_vocabularies WHERE coalesce(lemma,word) ~ '^[a-z]+$'
    UNION ALL
    SELECT lower(word) AS w, first_sentence, frequency_in_article, 'article'
    FROM library_article_vocabularies WHERE word ~ '^[a-z]+$'
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
    AND NOT EXISTS (SELECT 1 FROM lexicon_clean c WHERE c.word=a.w AND (c.meaning_ko IS NOT NULL OR c.gloss_en IS NOT NULL))
  ORDER BY a.freq DESC NULLS LAST, a.w
$function$;
