-- coverage-metric 함수 4종을 coverage_lexicon(kaikki) → lexicon_clean(청정) 으로 repoint.
-- 변경: 테이블명 교체(coverage_lexicon→lexicon_clean) + source<>'skip' 필터 제거(lexicon_clean엔 source 없음). 나머지 로직 불변.
-- 이후 coverage_lexicon 테이블 폐기 가능(20260722170000).

CREATE OR REPLACE FUNCTION public.select_article_coverage(p_article_id uuid)
 RETURNS TABLE(word text, meaning_ko text, gloss_en text, pos text, frequency_in_article integer, first_sentence text, frequency_rank integer)
 LANGUAGE sql STABLE SET search_path TO 'public' SET statement_timeout TO '30000'
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

CREATE OR REPLACE FUNCTION public.select_book_chapter_coverage(p_book_id uuid, p_chapter_idx integer DEFAULT NULL::integer)
 RETURNS TABLE(chapter_idx integer, word text, meaning_ko text, gloss_en text, pos text, frequency_in_chapter integer, first_sentence text, frequency_rank integer)
 LANGUAGE sql STABLE SET search_path TO 'public' SET statement_timeout TO '30000'
AS $function$
  WITH filtered AS (
    SELECT bv.chapter_idx::int AS ci, lower(bv.word) AS surface, bv.frequency_in_chapter AS freq, bv.first_sentence AS fs
    FROM library_book_vocabularies bv
    WHERE bv.library_book_id = p_book_id
      AND (p_chapter_idx IS NULL OR bv.chapter_idx = p_chapter_idx)
      AND bv.word ~ '^[a-z]' AND bv.first_sentence IS NOT NULL
      AND (CASE WHEN lower(bv.word) ~ '^[a-z]+$' THEN bv.first_sentence ~ ('\m'||lower(bv.word)||'\M') ELSE strpos(bv.first_sentence, lower(bv.word))>0 END)
      AND NOT EXISTS (SELECT 1 FROM shared_dictionary d WHERE d.word = lower(bv.word) AND d.classified_by IS NOT NULL AND d.meaning_ko IS NOT NULL AND length(d.meaning_ko)>0)
  ),
  based AS (SELECT f.*, ARRAY[f.surface] || en_inflection_bases(f.surface) AS bases FROM filtered f),
  elig AS (SELECT * FROM based b WHERE NOT EXISTS (SELECT 1 FROM shared_dictionary d WHERE d.word = ANY(b.bases) AND d.classified_by IS NOT NULL AND d.meaning_ko IS NOT NULL AND length(d.meaning_ko)>0)),
  cand AS (
    SELECT DISTINCT ON (e.ci, cov.word)
      e.ci AS chapter_idx, cov.word AS word, cov.meaning_ko, cov.gloss_en, cov.pos, e.freq AS frequency_in_chapter, e.fs AS first_sentence, cov.frequency_rank
    FROM elig e JOIN lexicon_clean cov ON cov.word = ANY(e.bases)
    WHERE (cov.meaning_ko IS NOT NULL OR cov.gloss_en IS NOT NULL) AND length(cov.word)>=4
    ORDER BY e.ci, cov.word, e.freq DESC NULLS LAST
  )
  SELECT chapter_idx, word, meaning_ko, gloss_en, pos, frequency_in_chapter, first_sentence, frequency_rank
  FROM cand ORDER BY chapter_idx, frequency_in_chapter DESC NULLS LAST, word
$function$;

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
    JOIN lexicon_clean cov ON cov.word = ANY (e.bases)
    WHERE (cov.meaning_ko IS NOT NULL OR cov.gloss_en IS NOT NULL) AND length(cov.word) >= 4
    ORDER BY e.surface, (cov.word = lower(e.surface)) DESC, (cov.meaning_ko IS NOT NULL) DESC, cov.frequency_rank NULLS LAST
  )
  SELECT word, matched_surface, meaning_ko, gloss_en, pos, frequency_rank
  FROM c ORDER BY frequency_rank NULLS LAST, word
$function$;

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
    AND NOT EXISTS (SELECT 1 FROM lexicon_clean c WHERE c.word=a.w AND (c.meaning_ko IS NOT NULL OR c.gloss_en IS NOT NULL))
  ORDER BY a.freq DESC NULLS LAST, a.w
$function$;
