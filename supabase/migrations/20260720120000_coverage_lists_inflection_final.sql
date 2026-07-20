-- supabase/migrations/20260720120000_coverage_lists_inflection_final.sql
-- coverage 참고 목록(도서·기사) 정련 최종본 — 이 세션 3단계(굴절 해소 → core-제외 → 챕터 파라미터)를 통합.
--   ① 굴절 해소: 본문 surface를 en_inflection_bases로 coverage 표제어 매칭(굴절형 롱테일 회수). 직접 lemma만 쓰던
--      이전엔 P&P 18개만 잡혔는데, 굴절 해소로 실적용 대상이 대폭 확대.
--   ② core-제외: 토큰이 core로 해소되면 학습 대상이므로 coverage 목록에서 배제(character→charact 노이즈 차단).
--      en_inflection_bases가 character→[charact] 등 과잉 stem을 만드는데, core엔 없어 무해하나 kaikki coverage엔
--      obscure 고어가 있어 오매칭 → core-제외 가드로 차단.
--   ③ 성능: p_chapter_idx로 해당 챕터만 처리(전권 스캔 회피, 큰 도서 11s→1.2s) + direct-core 선필터로
--      en_inflection_bases 호출을 core 아닌 토큰에만.
-- 고유명사는 surface가 first_sentence에 소문자로 출현해야 통과(Darcy·Collins 배제). cov.word 길이≥4 노이즈 컷.

DROP FUNCTION IF EXISTS public.select_book_chapter_coverage(uuid);
CREATE FUNCTION public.select_book_chapter_coverage(p_book_id uuid, p_chapter_idx integer DEFAULT NULL)
 RETURNS TABLE(chapter_idx integer, word text, meaning_ko text, gloss_en text, pos text,
   frequency_in_chapter integer, first_sentence text, frequency_rank integer)
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
    FROM elig e JOIN coverage_lexicon cov ON cov.word = ANY(e.bases)
    WHERE cov.source<>'skip' AND (cov.meaning_ko IS NOT NULL OR cov.gloss_en IS NOT NULL) AND length(cov.word)>=4
    ORDER BY e.ci, cov.word, e.freq DESC NULLS LAST
  )
  SELECT chapter_idx, word, meaning_ko, gloss_en, pos, frequency_in_chapter, first_sentence, frequency_rank
  FROM cand ORDER BY chapter_idx, frequency_in_chapter DESC NULLS LAST, word
$function$;

CREATE OR REPLACE FUNCTION public.select_article_coverage(p_article_id uuid)
 RETURNS TABLE(word text, meaning_ko text, gloss_en text, pos text,
   frequency_in_article integer, first_sentence text, frequency_rank integer)
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
    FROM elig e JOIN coverage_lexicon cov ON cov.word = ANY(e.bases)
    WHERE cov.source<>'skip' AND (cov.meaning_ko IS NOT NULL OR cov.gloss_en IS NOT NULL) AND length(cov.word)>=4
    ORDER BY cov.word, e.freq DESC NULLS LAST
  )
  SELECT word, meaning_ko, gloss_en, pos, frequency_in_article, first_sentence, frequency_rank
  FROM cand ORDER BY frequency_in_article DESC NULLS LAST, word
$function$;
