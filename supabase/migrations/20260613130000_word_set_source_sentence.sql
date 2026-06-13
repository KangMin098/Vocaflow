-- supabase/migrations/20260613130000_word_set_source_sentence.sql
-- 도서 챕터 단어장 예문 = 도서 본문 문장 (context-dependent 학습원칙 #5).
--
-- 배경: publish_book_word_sets 가 shared_words.example_en 을 적재하지 않아 도서 단어장은
--   예문이 비어 있었다(7,450 단어 전부 example NULL). 한편 library_book_vocabularies.first_sentence
--   (챕터 첫 출현 문장)는 100% 적재돼 있고 shared_words.library_book_vocabulary_id FK 로 연결됨.
--
-- 이 마이그레이션:
--   1) shared_words.source_sentence 컬럼 추가 (원문 문장 · example_en=dict 폴백은 보존)
--   2) select_book_chapter_vocab (SSoT) 가 first_sentence 도 emit → preview/publish 공유
--   3) publish_book_word_sets 가 source_sentence 적재
--   4) 기존 도서 단어장 + 그로부터 import 된 개인 vocabularies 백필

-- 1) 컬럼
ALTER TABLE shared_words
  ADD COLUMN IF NOT EXISTS source_sentence text;

COMMENT ON COLUMN shared_words.source_sentence IS
  '원문(도서 챕터/스크립트)에서의 해당 단어 출현 문장. 렌더는 source_sentence → example_en(dict) 순 폴백.';

-- 2) SSoT 함수 — first_sentence 추가 (RETURNS TABLE 변경이라 DROP 후 CREATE).
--    호출자(extract_book_vocabulary_admin · publish_book_word_sets)는 named-column 접근이라 호환.
DROP FUNCTION IF EXISTS public.select_book_chapter_vocab(uuid);
CREATE FUNCTION public.select_book_chapter_vocab(p_book_id uuid)
 RETURNS TABLE(chapter_idx integer, word text, lemma text, meaning_ko text, v_level smallint, cefr_level text, pos text, example_en text, word_register text, frequency_rank integer, frequency_in_chapter integer, skill_level smallint, composite_score numeric, sort_order integer, library_book_vocabulary_id uuid, first_sentence text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH bk AS (
    SELECT lb.id, lb.book_v_level FROM library_books lb WHERE lb.id = p_book_id
  ),
  cand AS (
    SELECT DISTINCT ON (bv.chapter_idx, sd.word)
      bv.chapter_idx::int            AS chapter_idx,
      sd.word                        AS word,
      sd.meaning_ko                  AS meaning_ko,
      sd.v_level                     AS v_level,
      sd.cefr_level                  AS cefr_level,
      sd.pos                         AS pos,
      sd.example_en                  AS example_en,
      COALESCE(sd.word_register, 'standard') AS word_register,
      sd.frequency_rank              AS frequency_rank,
      bv.frequency_in_chapter        AS frequency_in_chapter,
      sd.skill_level                 AS skill_level,
      bv.id                          AS library_book_vocabulary_id,
      bv.first_sentence              AS first_sentence,
      bk.book_v_level                AS bvl
    FROM bk
    JOIN library_book_vocabularies bv ON bv.library_book_id = bk.id
    JOIN shared_dictionary sd ON sd.word = COALESCE(bv.lemma, bv.word)
    WHERE sd.v_level >= bk.book_v_level
      AND sd.classified_by IS NOT NULL
      AND sd.meaning_ko IS NOT NULL AND length(sd.meaning_ko) > 0
      AND COALESCE(sd.word_register, 'standard')
            NOT IN ('archaic_literary', 'period_cultural', 'phrase_unit')
    ORDER BY bv.chapter_idx, sd.word, bv.frequency_in_chapter DESC NULLS LAST
  ),
  scored AS (
    SELECT c.*,
      ROUND(
          0.70 * (1.0 / LOG(10, COALESCE(c.frequency_rank, 50000)::numeric + 10))
        + 0.10 * (1.0 - 1.0 / (COALESCE(c.frequency_in_chapter, 1) + 1))
        + CASE WHEN c.skill_level = 4 AND c.bvl < 6 THEN -0.10 ELSE 0 END
      , 4) AS composite_score
    FROM cand c
  )
  SELECT
    s.chapter_idx,
    s.word,
    s.word AS lemma,
    s.meaning_ko,
    s.v_level,
    s.cefr_level,
    s.pos,
    s.example_en,
    s.word_register,
    s.frequency_rank,
    s.frequency_in_chapter,
    s.skill_level,
    s.composite_score,
    ROW_NUMBER() OVER (
      PARTITION BY s.chapter_idx
      ORDER BY s.composite_score DESC, s.frequency_in_chapter DESC NULLS LAST,
               s.v_level ASC, s.word
    )::int AS sort_order,
    s.library_book_vocabulary_id,
    s.first_sentence
  FROM scored s
$function$;

-- 3) publish — source_sentence 적재 (= 챕터 첫 출현 문장)
CREATE OR REPLACE FUNCTION public.publish_book_word_sets(p_book_id uuid)
 RETURNS TABLE(chapter_idx integer, set_id uuid, word_count integer)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_book RECORD;
  v_set_id uuid;
  v_chapter RECORD;
  v_count int;
BEGIN
  SELECT id, title, book_v_level, cefr_level INTO v_book
  FROM library_books WHERE id = p_book_id;
  IF v_book IS NULL THEN RAISE EXCEPTION 'Book % not found', p_book_id; END IF;
  IF v_book.book_v_level IS NULL THEN
    RAISE EXCEPTION 'Book % has no book_v_level', p_book_id;
  END IF;

  DROP TABLE IF EXISTS _sel;
  CREATE TEMP TABLE _sel ON COMMIT DROP AS
    SELECT * FROM select_book_chapter_vocab(p_book_id);

  FOR v_chapter IN
    SELECT DISTINCT s.chapter_idx FROM _sel s ORDER BY s.chapter_idx
  LOOP
    SELECT id INTO v_set_id FROM shared_word_sets
    WHERE (curation_query->>'book_id') = p_book_id::text
      AND (curation_query->>'chapter_idx')::int = v_chapter.chapter_idx;
    IF v_set_id IS NOT NULL THEN CONTINUE; END IF;

    INSERT INTO shared_word_sets (
      title, description, category, cefr_level, is_published, auto_curated,
      slug, cover_emoji, version, curation_query
    ) VALUES (
      v_book.title || ' — Ch.' || v_chapter.chapter_idx,
      v_book.title || ' 챕터 ' || v_chapter.chapter_idx || ' 핵심 어휘 (V' || v_book.book_v_level || '+)',
      'library_book', v_book.cefr_level, true, true,
      'book-' || v_book.id::text || '-ch-' || v_chapter.chapter_idx,
      '📖', 2,
      jsonb_build_object(
        'book_id', v_book.id,
        'chapter_idx', v_chapter.chapter_idx,
        'filter', 'select_book_chapter_vocab',
        'book_v_level', v_book.book_v_level,
        'selection', 'v06.35 learning-optimal (register-filtered, composite-ranked)'
      )
    ) RETURNING id INTO v_set_id;

    INSERT INTO shared_words (
      set_id, word, lemma, meaning_ko, cefr_level, sort_order, library_book_vocabulary_id, source_sentence
    )
    SELECT v_set_id, s.word, s.lemma, s.meaning_ko, s.cefr_level, s.sort_order,
           s.library_book_vocabulary_id, s.first_sentence
    FROM _sel s
    WHERE s.chapter_idx = v_chapter.chapter_idx
    ORDER BY s.sort_order;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    UPDATE shared_word_sets SET word_count = v_count WHERE id = v_set_id;

    chapter_idx := v_chapter.chapter_idx;
    set_id := v_set_id;
    word_count := v_count;
    RETURN NEXT;
  END LOOP;

  DROP TABLE IF EXISTS _sel;
END;
$function$;

-- 4) 백필 — 기존 도서 단어장 + 그로부터 import 된 개인 vocabularies (NULL 만)
UPDATE shared_words sw
SET source_sentence = lbv.first_sentence
FROM library_book_vocabularies lbv
WHERE sw.library_book_vocabulary_id = lbv.id
  AND sw.source_sentence IS NULL
  AND lbv.first_sentence IS NOT NULL;

UPDATE vocabularies v
SET example_sentence = sw.source_sentence
FROM shared_words sw
WHERE v.shared_set_id = sw.set_id
  AND v.word = sw.word
  AND v.origin = 'shared_set'
  AND (v.example_sentence IS NULL OR v.example_sentence = '')
  AND sw.source_sentence IS NOT NULL;
