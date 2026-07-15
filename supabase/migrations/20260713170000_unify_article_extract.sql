-- 20260713170000_unify_article_extract.sql
-- 추출 경로 통합(1단계) — select_article_vocab 를 select_book_chapter_vocab 와 동일 규칙으로.
--   추가: resolve_dict_headword(굴절/파생 해소) + 형태 POS 추론(context_pos NULL 폴백) + 표면형 그대로 표시(word=실제 형태, lemma=표제어).
--   유지: article_v_level 기준, composite 스코어, 노이즈 register 제외.
--   시그니처 동일(호출부 무변).
CREATE OR REPLACE FUNCTION public.select_article_vocab(p_article_id uuid)
 RETURNS TABLE(word text, lemma text, meaning_ko text, v_level smallint, cefr_level text, pos text, example_en text, word_register text, frequency_rank integer, frequency_in_article integer, skill_level smallint, composite_score numeric, sort_order integer, first_sentence text)
 LANGUAGE sql STABLE SET search_path TO 'public'
AS $function$
  WITH art AS (SELECT la.id, la.article_v_level FROM library_articles la WHERE la.id = p_article_id),
  cand AS (
    SELECT DISTINCT ON (sd.word)
      lower(av.word) AS surface, sd.word AS headword,
      COALESCE(cs.sense_meaning, sd.meaning_ko) AS meaning_ko,
      COALESCE(cs.sense_v, sd.v_level) AS v_level,
      sd.cefr_level AS cefr_level, COALESCE(cs.sense_pos, sd.pos) AS pos,
      sd.example_en AS example_en, sd.verified AS verified,
      COALESCE(sd.word_register, 'standard') AS word_register,
      sd.frequency_rank AS frequency_rank, av.frequency_in_article AS frequency_in_article,
      sd.skill_level AS skill_level, av.first_sentence AS first_sentence,
      art.article_v_level AS avl
    FROM art
    JOIN library_article_vocabularies av ON av.library_article_id = art.id
    JOIN shared_dictionary sd ON sd.word = resolve_dict_headword(COALESCE(av.lemma, av.word))
    LEFT JOIN LATERAL (
      SELECT (s->>'v_level')::smallint AS sense_v, s->>'meaning' AS sense_meaning, s->>'pos' AS sense_pos
      FROM jsonb_array_elements(sd.meanings_ko) s
      WHERE s->>'pos' = COALESCE(
        av.context_pos,
        CASE
          WHEN lower(av.word) = sd.word||'ed' OR lower(av.word) = sd.word||'d'
               OR lower(av.word) = regexp_replace(sd.word,'y$','ied') THEN 'verb'
          WHEN lower(av.word) = sd.word||'ing'
               OR lower(av.word) = regexp_replace(sd.word,'e$','ing') THEN 'verb'
          WHEN lower(av.word) = sd.word||'ly'
               OR lower(av.word) = regexp_replace(sd.word,'y$','ily')
               OR lower(av.word) = regexp_replace(sd.word,'ic$','ically') THEN 'adverb'
          WHEN lower(av.word) <> sd.word AND lower(av.word) ~ '(tion|sion|ment|ness|ity|ance|ence)$' THEN 'noun'
          WHEN lower(av.word) <> sd.word AND lower(av.word) ~ '(ous|ive|ful|less|ish|able|ible)$' THEN 'adjective'
          ELSE NULL
        END)
      ORDER BY ((s->>'v_level') IS NOT NULL) DESC LIMIT 1
    ) cs ON true
    WHERE COALESCE(cs.sense_v, sd.v_level) >= 6
      AND sd.classified_by IS NOT NULL
      AND COALESCE(cs.sense_meaning, sd.meaning_ko) IS NOT NULL
      AND length(COALESCE(cs.sense_meaning, sd.meaning_ko)) > 0
      AND COALESCE(sd.word_register, 'standard') NOT IN ('archaic_literary', 'period_cultural', 'phrase_unit', 'brand', 'abbreviation', 'proper_noun')
    ORDER BY sd.word, av.frequency_in_article DESC NULLS LAST
  ),
  norm AS (SELECT c.*, MAX(c.frequency_in_article) OVER () AS article_max_freq FROM cand c),
  scored AS (SELECT n.*, public._extract_composite_score(n.frequency_rank, n.frequency_in_article, n.article_max_freq::int, n.v_level, n.verified, n.example_en, n.skill_level, n.avl) AS composite_score FROM norm n)
  SELECT s.surface AS word, s.headword AS lemma, s.meaning_ko, s.v_level, s.cefr_level, s.pos, s.example_en, s.word_register,
    s.frequency_rank, s.frequency_in_article, s.skill_level, s.composite_score,
    ROW_NUMBER() OVER (ORDER BY s.composite_score DESC, s.frequency_in_article DESC NULLS LAST, s.v_level ASC, s.surface)::int AS sort_order,
    s.first_sentence
  FROM scored s
$function$;
