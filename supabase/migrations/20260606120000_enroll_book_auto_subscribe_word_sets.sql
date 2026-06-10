-- supabase/migrations/20260606120000_enroll_book_auto_subscribe_word_sets.sql
-- ═══════════════════════════════════════════════════════════
-- v06.34 — 도서 enroll = 도서 단어장 자동 학습대상
--
-- 사용자 의도:
--   "학습자가 도서를 선택해서 학습하기로 했으면 도서의 단어장도 학습자의
--    학습대상으로 set. 학습 도서와 도서의 단어장은 set 임."
--
-- 변경:
--   enroll_library_book(book_id) 마지막 단계에 2-step 자동 구독 추가.
--   (1) 도서의 모든 chapter shared_word_sets 를 user_word_set_subscriptions 에 INSERT
--   (2) 그 sets 의 shared_words 를 vocabularies 에 INSERT
--   둘 다 ON CONFLICT DO NOTHING 으로 멱등.
--
-- 멱등 분기 (이미 enroll) 에도 동일 단계 실행 — 추후 발행된 chapter set 도 catch up.
--
-- 트랜잭션 단일성 보장: 기존 BEGIN/COMMIT 안에서 모두 실행.
-- ═══════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION enroll_library_book(p_book_id UUID)
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id UUID;
  v_book RECORD;
  v_text_ids UUID[];
BEGIN
  -- 인증 검증
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 책 조회 + KR safe + published 검증
  SELECT * INTO v_book FROM library_books
   WHERE id = p_book_id
     AND status = 'published'
     AND copyright_safe_in_kr = true;
  IF v_book IS NULL THEN
    RAISE EXCEPTION 'Book not available (must be published + copyright_safe_in_kr=true)';
  END IF;

  -- B23 가드: 책 cefr_level이 유효하지 않으면 enroll 거부
  IF v_book.cefr_level IS NULL
     OR v_book.cefr_level NOT IN ('A1','A2','B1','B2','C1','C2')
  THEN
    RAISE EXCEPTION 'Book has invalid cefr_level: %', v_book.cefr_level;
  END IF;

  -- chapter master 존재 검증
  IF NOT EXISTS (
    SELECT 1 FROM library_chapters_master WHERE library_book_id = p_book_id
  ) THEN
    RAISE EXCEPTION 'Book has no chapters in master: %', p_book_id;
  END IF;

  -- 이미 enroll 했는지 확인 (멱등성)
  IF EXISTS (
    SELECT 1 FROM texts
     WHERE user_id = v_user_id AND library_book_id = p_book_id
  ) THEN
    SELECT array_agg(id ORDER BY chapter_idx) INTO v_text_ids
      FROM texts WHERE user_id = v_user_id AND library_book_id = p_book_id;
    -- ★ catch up: 이미 enroll 한 경우에도 단어장 구독 적용 (이후 발행된 set 흡수)
    PERFORM _enroll_book_subscribe_word_sets(v_user_id, p_book_id);
    RETURN v_text_ids;
  END IF;

  -- chapter 복제 (content=NULL, view에서 master JOIN으로 lazy load)
  -- B23 가드: chapter 단위 cefr_level이 유효하지 않으면 책 단위 cefr_level fallback
  WITH inserted AS (
    INSERT INTO texts (
      user_id, source, library_book_id, chapter_idx, chapter_title,
      title, content, cefr_level, status, progress_percent,
      cover_from, cover_to, author
    )
    SELECT
      v_user_id,
      'library'::text_source,
      p_book_id,
      lcm.chapter_idx,
      lcm.chapter_title,
      v_book.title || ' — ' || COALESCE(lcm.chapter_title, 'Chapter ' || lcm.chapter_idx),
      NULL,
      CASE
        WHEN lcm.cefr_level IN ('A1','A2','B1','B2','C1','C2') THEN lcm.cefr_level
        ELSE v_book.cefr_level
      END,
      'not_started',
      0,
      v_book.cover_from,
      v_book.cover_to,
      v_book.author
    FROM library_chapters_master lcm
    WHERE lcm.library_book_id = p_book_id
    ORDER BY lcm.chapter_idx
    RETURNING id
  )
  SELECT array_agg(id) INTO v_text_ids FROM inserted;

  -- ★ 신규 enroll 도 동일 단어장 구독 적용
  PERFORM _enroll_book_subscribe_word_sets(v_user_id, p_book_id);

  RETURN v_text_ids;
END $$;


-- ───────────────────────────────────────────────────────────
-- 내부 헬퍼: 도서의 모든 chapter shared_word_sets 자동 구독 + vocabularies import
--
-- 멱등 보장:
--   - user_word_set_subscriptions : ON CONFLICT (user_id, set_id) DO NOTHING
--   - vocabularies                 : ON CONFLICT (user_id, word) DO NOTHING
--
-- vocabularies origin 은 'shared_set' (vocab/actions.ts subscribeSet 와 정합).
-- ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION _enroll_book_subscribe_word_sets(
  p_user_id UUID,
  p_book_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  -- (1) 그 도서의 published chapter sets 전부 구독 (멱등)
  INSERT INTO user_word_set_subscriptions (user_id, set_id)
  SELECT p_user_id, sws.id
    FROM shared_word_sets sws
   WHERE sws.is_published = true
     AND sws.category = 'library_book'
     AND sws.curation_query->>'book_id' = p_book_id::text
  ON CONFLICT (user_id, set_id) DO NOTHING;

  -- (2) 그 sets 의 shared_words → vocabularies import (멱등)
  INSERT INTO vocabularies (
    user_id, word, meaning, example_sentence,
    pronunciation, pos, cefr_level,
    origin, shared_set_id
  )
  SELECT
    p_user_id,
    sw.word,
    sw.meaning_ko,
    sw.example_en,
    sw.pronunciation,
    sw.part_of_speech,
    sw.cefr_level,
    'shared_set',
    sw.set_id
  FROM shared_words sw
   JOIN shared_word_sets sws ON sws.id = sw.set_id
  WHERE sws.is_published = true
    AND sws.category = 'library_book'
    AND sws.curation_query->>'book_id' = p_book_id::text
  ON CONFLICT (user_id, word) DO NOTHING;
END $$;

REVOKE ALL ON FUNCTION _enroll_book_subscribe_word_sets(UUID, UUID) FROM PUBLIC;
-- 내부 헬퍼 — direct call 금지. enroll_library_book 안에서만 호출.

COMMENT ON FUNCTION enroll_library_book(UUID) IS
  'v06.34 — 라이브러리 책을 사용자 학습용 texts 로 등록 + 도서의 모든 chapter 단어장 자동 구독 + vocabularies import. 멱등.';
COMMENT ON FUNCTION _enroll_book_subscribe_word_sets(UUID, UUID) IS
  'v06.34 internal — enroll_library_book 안에서만 호출. 도서 chapter shared_word_sets 자동 구독 + vocabularies upsert.';

COMMIT;
