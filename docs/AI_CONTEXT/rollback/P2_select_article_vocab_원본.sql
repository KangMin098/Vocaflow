-- P2 rollback baseline (= P1 적용 본문, 2026-06-20)
-- 롤백 시 본 파일 전문을 그대로 apply.

CREATE OR REPLACE FUNCTION public.select_article_vocab(p_article_id uuid)
 RETURNS TABLE(word text, lemma text, meaning_ko text, v_level smallint, cefr_level text, pos text, example_en text, word_register text, frequency_rank integer, frequency_in_article integer, skill_level smallint, composite_score numeric, sort_order integer, first_sentence text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH art AS (
    SELECT la.id, la.article_v_level FROM library_articles la WHERE la.id = p_article_id
  ),
  cand AS (
    SELECT DISTINCT ON (sd.word)
      sd.word, sd.meaning_ko, sd.v_level, sd.cefr_level, sd.pos, sd.example_en,
      COALESCE(sd.word_register, 'standard') AS word_register,
      sd.frequency_rank, av.frequency_in_article, sd.skill_level, av.first_sentence,
      art.article_v_level AS avl
    FROM art
    JOIN library_article_vocabularies av ON av.library_article_id = art.id
    JOIN shared_dictionary sd ON sd.word = COALESCE(av.lemma, av.word)
    WHERE sd.v_level >= 6
      AND sd.classified_by IS NOT NULL
      AND sd.meaning_ko IS NOT NULL AND length(sd.meaning_ko) > 0
      AND COALESCE(sd.word_register, 'standard') NOT IN ('archaic_literary', 'period_cultural', 'phrase_unit')
    ORDER BY sd.word, av.frequency_in_article DESC NULLS LAST
  ),
  scored AS (
    SELECT c.*,
      ROUND(
          0.70 * (1.0 / LOG(10, COALESCE(c.frequency_rank, 50000)::numeric + 10))
        + 0.10 * (1.0 - 1.0 / (COALESCE(c.frequency_in_article, 1) + 1))
        + CASE WHEN c.skill_level = 4 AND c.avl < 6 THEN -0.10 ELSE 0 END
      , 4) AS composite_score
    FROM cand c
  )
  SELECT
    s.word, s.word AS lemma, s.meaning_ko, s.v_level, s.cefr_level, s.pos, s.example_en,
    s.word_register, s.frequency_rank, s.frequency_in_article, s.skill_level, s.composite_score,
    ROW_NUMBER() OVER (
      ORDER BY s.composite_score DESC, s.frequency_in_article DESC NULLS LAST,
               s.v_level ASC, s.word
    )::int AS sort_order,
    s.first_sentence
  FROM scored s
$function$;
