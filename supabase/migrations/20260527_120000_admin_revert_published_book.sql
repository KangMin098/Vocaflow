-- 20260527_120000_admin_revert_published_book.sql
-- 게시된 도서를 검토 대기(ready) 상태로 되돌리는 admin RPC.
--
-- 동작:
--  1. status='published' 인지 확인 (아니면 예외).
--  2. 게시 시 trigger_publish_book_word_sets 가 생성한 챕터 단어장 삭제.
--     - shared_word_sets WHERE category='library_book'
--       AND curation_query->>'book_id' = p_book_id::text
--     - shared_words / user_word_set_subscriptions 는 FK CASCADE 로 자동 정리.
--  3. library_books.status = 'ready', published_at = NULL.
--
-- 멱등: 이미 ready/archived 등 다른 상태면 예외 (실수 방지).
-- 재게시: 이후 강제 게시 호출 시 trigger 가 단어장 재생성.

BEGIN;

CREATE OR REPLACE FUNCTION admin_revert_published_book(p_book_id UUID)
RETURNS TABLE(reverted_book_id UUID, deleted_word_sets INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_status TEXT;
  v_deleted INT;
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

  IF v_status <> 'published' THEN
    RAISE EXCEPTION 'Book is not published (current status: %)', v_status;
  END IF;

  WITH del AS (
    DELETE FROM shared_word_sets
    WHERE category = 'library_book'
      AND curation_query->>'book_id' = p_book_id::text
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_deleted FROM del;

  UPDATE library_books
  SET status = 'ready',
      published_at = NULL
  WHERE id = p_book_id;

  RETURN QUERY SELECT p_book_id, v_deleted;
END $$;

REVOKE ALL ON FUNCTION admin_revert_published_book(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_revert_published_book(UUID) TO authenticated;

COMMIT;
