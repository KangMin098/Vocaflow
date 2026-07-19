-- supabase/migrations/20260719130000_coverage_reference_lists.sql
-- 비학습 롱테일(coverage_lexicon) "독해 참고 단어" 목록 — 도서 챕터 / 기사별.
-- coverage.word는 학습 core와 물리 분리 → 매칭 자체가 "비학습" 보장.
-- 고유명사(Darcy·Collins)는 first_sentence 소문자 출현 필터로 제외(원본 대소문자 신호).
-- SECURITY INVOKER — library_*_vocabularies RLS(read_via_published)로 learner 접근 자연 스코프.

-- 도서 챕터별 비학습 롱테일 참고 목록
CREATE OR REPLACE FUNCTION public.select_book_chapter_coverage(p_book_id uuid)
 RETURNS TABLE(chapter_idx integer, word text, meaning_ko text, gloss_en text, pos text,
   frequency_in_chapter integer, first_sentence text, frequency_rank integer)
 LANGUAGE sql STABLE SET search_path TO 'public' SET statement_timeout TO '30000'
AS $function$
  WITH cand AS (
    SELECT DISTINCT ON (bv.chapter_idx, cov.word)
      bv.chapter_idx::int AS chapter_idx, cov.word AS word, cov.meaning_ko, cov.gloss_en,
      cov.pos, bv.frequency_in_chapter, bv.first_sentence, cov.frequency_rank
    FROM library_book_vocabularies bv
    JOIN coverage_lexicon cov ON cov.word = lower(COALESCE(bv.lemma, bv.word))
    WHERE bv.library_book_id = p_book_id
      AND cov.source <> 'skip'
      AND (cov.meaning_ko IS NOT NULL OR cov.gloss_en IS NOT NULL)
      AND bv.first_sentence IS NOT NULL
      AND CASE WHEN cov.word ~ '^[a-z]+$'
               THEN bv.first_sentence ~ ('\m' || cov.word || '\M')  -- 소문자 출현=일반명사(고유명사 제외)
               ELSE strpos(bv.first_sentence, cov.word) > 0 END
    ORDER BY bv.chapter_idx, cov.word, bv.frequency_in_chapter DESC NULLS LAST
  )
  SELECT chapter_idx, word, meaning_ko, gloss_en, pos, frequency_in_chapter, first_sentence, frequency_rank
  FROM cand ORDER BY chapter_idx, frequency_in_chapter DESC NULLS LAST, word
$function$;

-- 기사별 비학습 롱테일 참고 목록 (동일 로직, 챕터 없음)
CREATE OR REPLACE FUNCTION public.select_article_coverage(p_article_id uuid)
 RETURNS TABLE(word text, meaning_ko text, gloss_en text, pos text,
   frequency_in_article integer, first_sentence text, frequency_rank integer)
 LANGUAGE sql STABLE SET search_path TO 'public' SET statement_timeout TO '30000'
AS $function$
  WITH cand AS (
    SELECT DISTINCT ON (cov.word)
      cov.word AS word, cov.meaning_ko, cov.gloss_en, cov.pos,
      av.frequency_in_article, av.first_sentence, cov.frequency_rank
    FROM library_article_vocabularies av
    JOIN coverage_lexicon cov ON cov.word = lower(COALESCE(av.lemma, av.word))
    WHERE av.library_article_id = p_article_id
      AND cov.source <> 'skip'
      AND (cov.meaning_ko IS NOT NULL OR cov.gloss_en IS NOT NULL)
      AND av.first_sentence IS NOT NULL
      AND CASE WHEN cov.word ~ '^[a-z]+$'
               THEN av.first_sentence ~ ('\m' || cov.word || '\M')
               ELSE strpos(av.first_sentence, cov.word) > 0 END
    ORDER BY cov.word, av.frequency_in_article DESC NULLS LAST
  )
  SELECT word, meaning_ko, gloss_en, pos, frequency_in_article, first_sentence, frequency_rank
  FROM cand ORDER BY frequency_in_article DESC NULLS LAST, word
$function$;
