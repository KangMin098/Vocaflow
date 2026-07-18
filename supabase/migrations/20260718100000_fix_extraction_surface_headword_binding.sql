-- D1: 표면형이 자체 quality 표제어이면 그 표제어로 바인딩 (파생/부정접두 과잉 stem 차단).
-- 근본원인: select_*_vocab 가 pre-stem 된 bv.lemma 를 resolve_dict_headword 에 넘겨,
--   resolver 의 exact-surface 우선 분기가 표면형을 보지 못함 (forbearance→forbear, imprudent→prudent 등).
-- dry-run 검증: 782 재바인딩(654 POS 교정·36 반의어 플립 해소·+143 회수), 0 extraction-readiness 실패,
--   17 gate-out 전량 비-KICE 정당. 발행 세트 영향 0.
-- 근거: docs/AI_CONTEXT/diagnostics/ext_quality_p0_20260718.md §4

CREATE OR REPLACE FUNCTION public.select_book_chapter_vocab(p_book_id uuid)
 RETURNS TABLE(chapter_idx integer, word text, lemma text, meaning_ko text, v_level smallint, cefr_level text, pos text, example_en text, word_register text, frequency_rank integer, frequency_in_chapter integer, skill_level smallint, composite_score numeric, sort_order integer, library_book_vocabulary_id uuid, first_sentence text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH bk AS (SELECT lb.id, lb.book_v_level FROM library_books lb WHERE lb.id = p_book_id),
  cand AS (
    SELECT DISTINCT ON (bv.chapter_idx, sd.word)
      bv.chapter_idx::int AS chapter_idx, lower(bv.word) AS surface, sd.word AS headword,
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
    JOIN shared_dictionary sd ON sd.word = CASE
      WHEN EXISTS (SELECT 1 FROM shared_dictionary x
                   WHERE x.word = lower(bv.word)
                     AND x.classified_by IS NOT NULL
                     AND x.meaning_ko IS NOT NULL AND length(x.meaning_ko) > 0)
      THEN lower(bv.word)
      ELSE resolve_dict_headword(COALESCE(bv.lemma, bv.word))
    END
    LEFT JOIN LATERAL (
      SELECT (s->>'v_level')::smallint AS sense_v, s->>'meaning' AS sense_meaning, s->>'pos' AS sense_pos
      FROM jsonb_array_elements(sd.meanings_ko) s
      WHERE s->>'pos' = COALESCE(bv.context_pos, infer_form_pos(lower(bv.word), sd.word))
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
  SELECT s.chapter_idx, s.surface AS word, s.headword AS lemma, s.meaning_ko, s.v_level, s.cefr_level, s.pos, s.example_en, s.word_register,
    s.frequency_rank, s.frequency_in_chapter, s.skill_level, s.composite_score,
    ROW_NUMBER() OVER (PARTITION BY s.chapter_idx ORDER BY s.composite_score DESC, s.frequency_in_chapter DESC NULLS LAST, s.v_level ASC, s.surface)::int AS sort_order,
    s.library_book_vocabulary_id, s.first_sentence
  FROM scored s
$function$;

CREATE OR REPLACE FUNCTION public.select_article_vocab(p_article_id uuid)
 RETURNS TABLE(word text, lemma text, meaning_ko text, v_level smallint, cefr_level text, pos text, example_en text, word_register text, frequency_rank integer, frequency_in_article integer, skill_level smallint, composite_score numeric, sort_order integer, first_sentence text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
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
    JOIN shared_dictionary sd ON sd.word = CASE
      WHEN EXISTS (SELECT 1 FROM shared_dictionary x
                   WHERE x.word = lower(av.word)
                     AND x.classified_by IS NOT NULL
                     AND x.meaning_ko IS NOT NULL AND length(x.meaning_ko) > 0)
      THEN lower(av.word)
      ELSE resolve_dict_headword(COALESCE(av.lemma, av.word))
    END
    LEFT JOIN LATERAL (
      SELECT (s->>'v_level')::smallint AS sense_v, s->>'meaning' AS sense_meaning, s->>'pos' AS sense_pos
      FROM jsonb_array_elements(sd.meanings_ko) s
      WHERE s->>'pos' = COALESCE(av.context_pos, infer_form_pos(lower(av.word), sd.word))
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
