-- 20260713160500_book_extract_resolve_forms.sql
-- select_book_chapter_vocab: 도서 단어추출 시 굴절형·파생형이 탈락하지 않고 사전 뜻과 함께 추출되도록.
--   기존: JOIN sd ON sd.word = COALESCE(bv.lemma, bv.word) — 직접 매칭 실패 시 탈락.
--   변경: JOIN sd ON sd.word = resolve_dict_headword(COALESCE(bv.lemma, bv.word)) — 굴절/파생 해소 회수.
--   시그니처 동일(호출부 무변). resolve_dict_headword 는 base 실재 시에만 해소 → 쓰레기·노이즈 없음.
CREATE OR REPLACE FUNCTION public.select_book_chapter_vocab(p_book_id uuid)
 RETURNS TABLE(chapter_idx integer, word text, lemma text, meaning_ko text, v_level smallint, cefr_level text, pos text, example_en text, word_register text, frequency_rank integer, frequency_in_chapter integer, skill_level smallint, composite_score numeric, sort_order integer, library_book_vocabulary_id uuid, first_sentence text)
 LANGUAGE sql STABLE SET search_path TO 'public'
AS $function$
  WITH bk AS (SELECT lb.id, lb.book_v_level FROM library_books lb WHERE lb.id = p_book_id),
  cand AS (
    SELECT DISTINCT ON (bv.chapter_idx, sd.word)
      bv.chapter_idx::int AS chapter_idx, sd.word AS word,
      COALESCE(cs.sense_meaning, sd.meaning_ko) AS meaning_ko,
      COALESCE(cs.sense_v, sd.v_level) AS v_level,
      sd.cefr_level AS cefr_level, COALESCE(cs.sense_pos, sd.pos) AS pos,
      sd.example_en AS example_en, sd.verified AS verified,
      COALESCE(sd.word_register, 'standard') AS word_register,
      sd.frequency_rank AS frequency_rank, bv.frequency_in_chapter AS frequency_in_chapter,
      sd.skill_level AS skill_level, bv.id AS library_book_vocabulary_id,
      bv.first_sentence AS first_sentence, bk.book_v_level AS bvl
    FROM bk
    JOIN library_book_vocabularies bv ON bv.library_book_id = bk.id
    JOIN shared_dictionary sd ON sd.word = resolve_dict_headword(COALESCE(bv.lemma, bv.word))
    LEFT JOIN LATERAL (
      SELECT (s->>'v_level')::smallint AS sense_v, s->>'meaning' AS sense_meaning, s->>'pos' AS sense_pos
      FROM jsonb_array_elements(sd.meanings_ko) s
      WHERE bv.context_pos IS NOT NULL AND s->>'pos' = bv.context_pos
      ORDER BY ((s->>'v_level') IS NOT NULL) DESC LIMIT 1
    ) cs ON true
    WHERE COALESCE(cs.sense_v, sd.v_level) >= 6
      AND sd.classified_by IS NOT NULL
      AND COALESCE(cs.sense_meaning, sd.meaning_ko) IS NOT NULL
      AND length(COALESCE(cs.sense_meaning, sd.meaning_ko)) > 0
      AND COALESCE(sd.word_register, 'standard') NOT IN ('archaic_literary', 'period_cultural', 'phrase_unit', 'brand', 'abbreviation', 'proper_noun')
    ORDER BY bv.chapter_idx, sd.word, bv.frequency_in_chapter DESC NULLS LAST
  ),
  norm AS (SELECT c.*, MAX(c.frequency_in_chapter) OVER (PARTITION BY c.chapter_idx) AS chapter_max_freq FROM cand c),
  scored AS (SELECT n.*, public._extract_composite_score(n.frequency_rank, n.frequency_in_chapter, n.chapter_max_freq::int, n.v_level, n.verified, n.example_en, n.skill_level, n.bvl) AS composite_score FROM norm n)
  SELECT s.chapter_idx, s.word, s.word AS lemma, s.meaning_ko, s.v_level, s.cefr_level, s.pos, s.example_en, s.word_register,
    s.frequency_rank, s.frequency_in_chapter, s.skill_level, s.composite_score,
    ROW_NUMBER() OVER (PARTITION BY s.chapter_idx ORDER BY s.composite_score DESC, s.frequency_in_chapter DESC NULLS LAST, s.v_level ASC, s.word)::int AS sort_order,
    s.library_book_vocabulary_id, s.first_sentence
  FROM scored s
$function$;
