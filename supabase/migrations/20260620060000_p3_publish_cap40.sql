-- 20260620060000_p3_publish_cap40.sql
-- ═══════════════════════════════════════════════════════════
-- P3 — 챕터/글당 학습어 top-N cap (C4 · Cognitive Load · v06.80)
--
-- 변경 (handoff §P3, 옵션 B = 발행 함수 측 cap):
--   · publish_book_word_sets    : (p_book_id uuid, p_cap int DEFAULT 40)
--   · publish_article_word_set  : (p_article_id uuid, p_cap int DEFAULT 40)
--
--   INSERT shared_words 의 SELECT 절에 `WHERE sort_order <= p_cap`
--   curation_query JSONB 에 `'cap', p_cap` 기록 (handoff §3-2 미래 가변)
--
-- 보존:
--   · 게이트 (P1), composite 식 (P2), select_*_vocab 함수 본문 무변동
--   · 기존 set 존재 시 CONTINUE (옵션 B 결정 = 재발행 보류)
--   · 트리거 trg_publish_book_word_sets / trg_publish_article_word_set 본문 무변동
--     (1-arg PERFORM → 새 2-arg DEFAULT 자동 매칭, 별도 migration 20260620061000 에서
--      옛 1-arg overload DROP 으로 모호성 해소)
--
-- 효과 (P0 측정 + 실측):
--   · 챕터당 word_count max=239 / p90=57 → ≤40 cap
--   · Les Misérables 359 챕터 시뮬: cap=40 clip 44 챕터 (12.3%)
--   · p75=32 안전권 → 75% sets 영향 0
--   · Sweller Cognitive Load (작업기억 ~4, 세션 30~50) 정합
--
-- 롤백:
--   docs/AI_CONTEXT/rollback/P3_publish_book_word_sets_원본.sql
--   docs/AI_CONTEXT/rollback/P3_publish_article_word_set_원본.sql
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.publish_book_word_sets(p_book_id uuid, p_cap int DEFAULT 40)
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

CREATE OR REPLACE FUNCTION public.publish_article_word_set(p_article_id uuid, p_cap int DEFAULT 40)
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
END $function$;
