-- supabase/migrations/20260508120500_lcp_v2_enroll.sql
-- ═══════════════════════════════════════════════════════════
-- LCP v2.0 — Phase 8: U3 ENROLL 트랜잭션
-- ═══════════════════════════════════════════════════════════
-- enroll_library_book(book_id):
--   라이브러리 책 1권을 사용자 텍스트로 1초 안에 등록.
--   chapter 수만큼 texts row 생성 (content=NULL, master에서 lazy load).
--   재enroll 시 기존 row 그대로 반환 (멱등).
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
      NULL,  -- content lazy load via v_text_content view
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

  RETURN v_text_ids;
END $$;

REVOKE ALL ON FUNCTION enroll_library_book(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION enroll_library_book(UUID) TO authenticated;

COMMENT ON FUNCTION enroll_library_book(UUID) IS
  'LCP v2.0 Phase 8 — 라이브러리 책을 사용자 학습용 texts로 등록. 1초 트랜잭션. 멱등.';

COMMIT;
