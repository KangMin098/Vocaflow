-- LCP: publish_book_word_sets 설명 라벨을 실제 V6 floor 와 정합 (v06.221).
--
-- 드리프트: description 이 "(V{book_v_level}+)" 로 표기됐으나 단어는 select_book_chapter_vocab 의
--   P1 고정 floor=V6 로 선정 → 라벨/내용 불일치(예: V7 도서인데 words 는 V6+). description 한 줄만 (V6+) 로 교정.
--   (제목·slug·curation_query·단어 선정 전부 불변.)
-- 기존 발행 세트 829건 description 은 데이터 백필(regexp_replace '(V{n}+)'→'(V6+)')로 별도 정합.

CREATE OR REPLACE FUNCTION public.publish_book_word_sets(p_book_id uuid, p_cap integer DEFAULT 40)
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
      v_book.title || ' 챕터 ' || v_chapter.chapter_idx || ' 핵심 어휘 (V6+)',
      'library_book', v_book.cefr_level, true, true,
      'book-' || v_book.id::text || '-ch-' || v_chapter.chapter_idx,
      '📖', 2,
      jsonb_build_object(
        'book_id', v_book.id,
        'chapter_idx', v_chapter.chapter_idx,
        'filter', 'select_book_chapter_vocab',
        'book_v_level', v_book.book_v_level,
        'cap', p_cap,
        'selection', 'v06.79 learning-optimal (P1+P2+P3: floor=V6, composite=4-axis, cap)'
      )
    ) RETURNING id INTO v_set_id;

    INSERT INTO shared_words (
      set_id, word, lemma, meaning_ko, cefr_level, sort_order, library_book_vocabulary_id, source_sentence
    )
    SELECT v_set_id, s.word, s.lemma, s.meaning_ko, s.cefr_level, s.sort_order,
           s.library_book_vocabulary_id, s.first_sentence
    FROM _sel s
    WHERE s.chapter_idx = v_chapter.chapter_idx
      AND s.sort_order <= p_cap
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
