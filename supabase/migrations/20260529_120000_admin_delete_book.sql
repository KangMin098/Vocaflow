-- 20260529_120000_admin_delete_book.sql
-- ready / archived 상태 도서 영구 삭제 — 다른 소스 도서로 교체용.
--
-- 안전 가드:
--   * status IN ('ready','archived') 만 허용 (published / 처리 중 차단)
--   * library_seed_catalog imported_to_books 해제 → 같은 시드 재enqueue 가능
--   * shared_word_sets(category='library_book') 도 함께 정리 (published 였던 archived 대비)
--   * texts.library_book_id / archaic_candidates.first_seen_book_id 사전 NULL (NO ACTION FK)
--   * library_book_vocabularies / library_chapters_master 는 ON DELETE CASCADE 로 자동 정리

BEGIN;

CREATE OR REPLACE FUNCTION admin_delete_book(p_book_id UUID)
RETURNS TABLE(
  deleted_book_id UUID,
  status_was TEXT,
  word_sets_deleted INT,
  texts_unlinked INT,
  seed_unlocked INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_status TEXT;
  v_word_sets INT := 0;
  v_texts INT := 0;
  v_seed INT := 0;
BEGIN
  IF NOT is_admin_or_curator() THEN
    RAISE EXCEPTION 'Forbidden: admin or curator only';
  END IF;

  SELECT status INTO v_status
  FROM library_books
  WHERE id = p_book_id
  FOR UPDATE;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Book not found: %', p_book_id;
  END IF;

  IF v_status NOT IN ('ready', 'archived') THEN
    RAISE EXCEPTION '삭제 불가: 현재 상태 % (ready/archived 만 삭제 가능). published 도서는 먼저 검토 대기로 되돌리세요.', v_status;
  END IF;

  -- 1) 게시 트리거가 만든 챕터 단어장 (archived 가 이전에 published 였을 수도)
  WITH d AS (
    DELETE FROM shared_word_sets
    WHERE category = 'library_book'
      AND curation_query->>'book_id' = p_book_id::text
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_word_sets FROM d;

  -- 2) library_seed_catalog 의 imported 플래그 해제 → 재enqueue 가능
  WITH u AS (
    UPDATE library_seed_catalog
    SET imported_to_books = false, imported_book_id = NULL
    WHERE imported_book_id = p_book_id
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_seed FROM u;

  -- 3) NO ACTION FK 사전 NULL 처리
  WITH t AS (
    UPDATE texts SET library_book_id = NULL
    WHERE library_book_id = p_book_id
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_texts FROM t;

  UPDATE archaic_candidates SET first_seen_book_id = NULL
  WHERE first_seen_book_id = p_book_id;

  -- 4) 본체 삭제 (CASCADE 로 vocabularies / chapters_master 정리)
  DELETE FROM library_books WHERE id = p_book_id;

  RETURN QUERY SELECT p_book_id, v_status, v_word_sets, v_texts, v_seed;
END $$;

REVOKE ALL ON FUNCTION admin_delete_book(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_delete_book(UUID) TO authenticated;

COMMIT;
