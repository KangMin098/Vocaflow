-- 20260713161500_book_extract_infer_form_pos.sql
-- select_book_chapter_vocab: 표면형 형태로 POS 추론 → 형태에 맞는 sense 선택.
--   목적: "ransomed"(=ransom+ed)가 추출되면 동사 뜻("몸값을 치르고 풀어주다")이 나와야지
--     표제어 대표 뜻(명사 "몸값")이 나오면 안 됨.
--   context_pos(winkNLP)가 있으면 그것을, NULL이면 표면형↔표제어 형태차로 POS 추론:
--     +ed/+d/+ied → verb · +ing → verb · +ly/+ily/+ically → adverb ·
--     -tion/sion/ment/ness/ity/ance/ence → noun · -ous/ive/ful/less/ish/able/ible → adjective.
--   맞는 sense 없으면 대표 뜻으로 폴백(= polysemy gap 노출, 사전 보강 신호).
CREATE OR REPLACE FUNCTION public.select_book_chapter_vocab(p_book_id uuid)
 RETURNS TABLE(chapter_idx integer, word text, lemma text, meaning_ko text, v_level smallint, cefr_level text, pos text, example_en text, word_register text, frequency_rank integer, frequency_in_chapter integer, skill_level smallint, composite_score numeric, sort_order integer, library_book_vocabulary_id uuid, first_sentence text)
 LANGUAGE sql STABLE SET search_path TO 'public'
AS $function$
  WITH bk AS (SELECT lb.id, lb.book_v_level FROM library_books lb WHERE lb.id = p_book_id),
  cand AS (
    SELECT DISTINCT ON (bv.chapter_idx, sd.word)
      bv.chapter_idx::int AS chapter_idx,
      lower(bv.word) AS surface,
      sd.word AS headword,
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
      WHERE s->>'pos' = COALESCE(
        bv.context_pos,
        CASE
          WHEN lower(bv.word) = sd.word||'ed' OR lower(bv.word) = sd.word||'d'
               OR lower(bv.word) = regexp_replace(sd.word,'y$','ied') THEN 'verb'
          WHEN lower(bv.word) = sd.word||'ing'
               OR lower(bv.word) = regexp_replace(sd.word,'e$','ing') THEN 'verb'
          WHEN lower(bv.word) = sd.word||'ly'
               OR lower(bv.word) = regexp_replace(sd.word,'y$','ily')
               OR lower(bv.word) = regexp_replace(sd.word,'ic$','ically') THEN 'adverb'
          WHEN lower(bv.word) <> sd.word AND lower(bv.word) ~ '(tion|sion|ment|ness|ity|ance|ence)$' THEN 'noun'
          WHEN lower(bv.word) <> sd.word AND lower(bv.word) ~ '(ous|ive|ful|less|ish|able|ible)$' THEN 'adjective'
          ELSE NULL
        END)
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
