-- G2: 최초 발행 경로에 게이트 가드 — publish_book_word_sets / publish_article_word_set 가
--   content_gate_publishable() FAIL 시 게시 차단(critical 불변식 실패 콘텐츠 게시 방지).
-- 재발행 함수(republish_*)는 이미 가드 내장. 여기서 최초 발행 RPC 도 게이트.

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

  -- ★ G2 게이트 가드: critical 불변식 실패 콘텐츠 게시 차단
  IF NOT content_gate_publishable('book', p_book_id) THEN
    RAISE EXCEPTION 'Book % 콘텐츠 품질 게이트 FAIL — 게시 차단(run_content_quality_gates(book) critical 확인)', p_book_id;
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

CREATE OR REPLACE FUNCTION public.publish_article_word_set(p_article_id uuid, p_cap integer DEFAULT 40)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_art RECORD;
  v_set_id uuid;
  v_count int;
BEGIN
  SELECT id, title, cefr_level, source INTO v_art
  FROM library_articles WHERE id = p_article_id;
  IF v_art IS NULL THEN RAISE EXCEPTION 'Article % not found', p_article_id; END IF;

  -- ★ G2 게이트 가드
  IF NOT content_gate_publishable('article', p_article_id) THEN
    RAISE EXCEPTION 'Article % 콘텐츠 품질 게이트 FAIL — 게시 차단', p_article_id;
  END IF;

  SELECT id INTO v_set_id FROM shared_word_sets
   WHERE category = 'library_article'
     AND (curation_query->>'article_id') = p_article_id::text;
  IF v_set_id IS NOT NULL THEN RETURN v_set_id; END IF;

  INSERT INTO shared_word_sets (
    title, description, category, cefr_level, is_published, auto_curated,
    slug, cover_emoji, version, curation_query
  ) VALUES (
    v_art.title,
    '스크립트 핵심 어휘 — ' || COALESCE(v_art.source, 'article'),
    'library_article', v_art.cefr_level, true, true,
    'article-' || v_art.id::text,
    '📄', 1,
    jsonb_build_object(
      'article_id', v_art.id,
      'filter', 'select_article_vocab',
      'cap', p_cap,
      'selection', 'v06.79 learning-optimal (P1+P2+P3: floor=V6, composite=4-axis, cap)'
    )
  ) RETURNING id INTO v_set_id;

  INSERT INTO shared_words (
    set_id, word, lemma, meaning_ko, cefr_level, sort_order,
    source_sentence, part_of_speech, example_en
  )
  SELECT v_set_id, s.word, s.lemma, s.meaning_ko, s.cefr_level, s.sort_order,
         s.first_sentence, s.pos, s.example_en
  FROM select_article_vocab(p_article_id) s
  WHERE s.sort_order <= p_cap
  ORDER BY s.sort_order;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  UPDATE shared_word_sets SET word_count = v_count WHERE id = v_set_id;

  RETURN v_set_id;
END;
$function$;
