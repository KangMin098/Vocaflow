-- 20260810100100_shared_words_v_level.sql
-- ADR 0004 D6 — 발행된 단어장 항목에 v_level 보존.
--
-- 결함: shared_words 는 cefr_level 만 갖고 v_level 이 없다. 선정 시점에는 v_level 로 밴드를
--       판정해놓고 발행 후에는 그 정보가 사라져, 같은 세트를 V6 학습자와 V9 학습자가
--       다르게 소비하는 하위 필터링이 불가능하다. (VRL V-Level 0~11 이 학습 SSoT 인데
--       발행물만 CEFR 6단계로 정보가 깎여 있었다.)

ALTER TABLE public.shared_words
  ADD COLUMN IF NOT EXISTS v_level smallint;

COMMENT ON COLUMN public.shared_words.v_level IS
  'ADR 0004 D6 — 선정 시점의 VRL V-Level(0~11). 학습자 개인 레벨 기준 하위 필터링용. NULL = v06.35 이전 발행분.';

-- 기존 발행분 백필 — lemma 로 사전 표제어를 되짚는다 (선정 로직과 동일 키).
UPDATE public.shared_words sw
SET v_level = sd.v_level
FROM public.shared_dictionary sd
WHERE sw.v_level IS NULL
  AND sd.word = sw.lemma
  AND sd.v_level IS NOT NULL;

-- 발행 시 v_level 적재 — 나머지 로직은 그대로.
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
      v_book.title || ' 챕터 ' || v_chapter.chapter_idx || ' 핵심 어휘 (V'
        || GREATEST(v_book.book_v_level - 1, 1) || '~V'
        || LEAST(v_book.book_v_level + 3, 11) || ')',
      'library_book', v_book.cefr_level, true, true,
      'book-' || v_book.id::text || '-ch-' || v_chapter.chapter_idx,
      '📖', 3,
      jsonb_build_object(
        'book_id', v_book.id,
        'chapter_idx', v_chapter.chapter_idx,
        'filter', 'select_book_chapter_vocab',
        'book_v_level', v_book.book_v_level,
        'band_floor', GREATEST(v_book.book_v_level - 1, 1),
        'band_ceil', LEAST(v_book.book_v_level + 3, 11),
        'cap', p_cap,
        'selection', 'ADR 0004 D1+D2 relative band (floor=bvl-1, ceil=bvl+3, i+1 composite, cap)'
      )
    ) RETURNING id INTO v_set_id;

    INSERT INTO shared_words (
      set_id, word, lemma, meaning_ko, cefr_level, v_level, sort_order,
      library_book_vocabulary_id, source_sentence
    )
    SELECT v_set_id, s.word, s.lemma, s.meaning_ko, s.cefr_level, s.v_level, s.sort_order,
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

COMMENT ON FUNCTION public.publish_book_word_sets(uuid, integer) IS
  'ADR 0004 — 챕터 단어장 발행. v_level 적재 + 세트 설명/curation_query 에 밴드 범위 기록(version=3).';
