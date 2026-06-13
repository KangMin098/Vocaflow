-- supabase/migrations/20260606123000_reattach_publish_book_word_sets_trigger.sql
-- ═══════════════════════════════════════════════════════════
-- v06.34 — trg_publish_book_word_sets() trigger 재부착
--
-- 진단:
--   trg_publish_book_word_sets() 함수는 정의되어 있으나
--   library_books 테이블에 트리거 attach 안 됨. → 88권 ready 상태에서
--   status='published' 전환해도 chapter sets 자동 발행 0건.
--
-- 동작:
--   library_books AFTER UPDATE OF status — status 가 'published' 로
--   전환되는 시점에 publish_book_word_sets(NEW.id) 자동 호출.
--   publish_book_word_sets 가 자체 idempotency (curation_query 매칭 SKIP) 보유 →
--   재호출 안전.
-- ═══════════════════════════════════════════════════════════

BEGIN;

-- 멱등: 이미 부착돼 있으면 DROP 후 재생성
DROP TRIGGER IF EXISTS trg_publish_book_word_sets_t ON library_books;

CREATE TRIGGER trg_publish_book_word_sets_t
AFTER UPDATE OF status ON library_books
FOR EACH ROW
EXECUTE FUNCTION trg_publish_book_word_sets();

COMMENT ON TRIGGER trg_publish_book_word_sets_t ON library_books IS
  'v06.34 — status ready→published 전환 시 publish_book_word_sets 자동 호출. 멱등.';

COMMIT;
