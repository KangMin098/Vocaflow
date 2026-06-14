-- supabase/migrations/20260614220000_fix_bulk_requeue_seed_unlock.sql
-- 버그 수정: "→ 소스 GET" 일괄 복귀(admin_bulk_requeue_books) 가 seed catalog 의
--   imported 플래그를 실제로 해제하지 않아, 도서 삭제 후에도 소스 GET 탭에 "큐" 표시 잔류.
--
-- 원인: admin_bulk_requeue_books 가 `IF EXISTS(... imported_book_id=v_id) THEN count++`
--   로 카운트만 하고 UPDATE 를 안 함. 이후 DELETE library_books 시 FK(imported_book_id
--   ON DELETE SET NULL)가 imported_book_id 만 null 로, imported_to_books 는 true 로 잔존.
--   → BulkFetchTab 의 "큐" 배지(imported_to_books 기준)가 영구 표시.
--   (단건 admin_delete_book 은 DELETE 전 UPDATE 로 정상 해제 — bulk 경로만 결함.)
--
-- 수정: DELETE 전에 library_seed_catalog 를 실제 UPDATE (imported_book_id 가 아직 살아있을 때).
--   + 기존 orphan(매칭 library_books 없는 imported_to_books=true) 정리.

CREATE OR REPLACE FUNCTION public.admin_bulk_requeue_books(p_book_ids uuid[])
 RETURNS TABLE(deleted_count integer, skipped_count integer, word_sets_deleted integer, seed_unlocked integer, blocked_by_users integer, blocked_by_published integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pgmq', 'extensions'
AS $function$
DECLARE
  v_id                UUID;
  v_total             INT := COALESCE(array_length(p_book_ids, 1), 0);
  v_deleted           INT := 0;
  v_sets_deleted      INT := 0;
  v_seed_unlocked     INT := 0;
  v_blocked_users     INT := 0;
  v_blocked_published INT := 0;
  v_has_users         BOOLEAN;
  v_has_published     BOOLEAN;
  v_temp              INT;
  v_eligible          CONSTANT TEXT[] := ARRAY[
    'queued','ingesting','normalizing','segmenting','analyzing','curating',
    'ready','failed'
  ];
BEGIN
  IF NOT is_admin_or_curator() THEN
    RAISE EXCEPTION 'Forbidden: admin or curator only';
  END IF;

  IF v_total = 0 THEN
    deleted_count := 0; skipped_count := 0;
    word_sets_deleted := 0; seed_unlocked := 0;
    blocked_by_users := 0; blocked_by_published := 0;
    RETURN NEXT; RETURN;
  END IF;

  FOR v_id IN
    SELECT id FROM library_books
     WHERE id = ANY(p_book_ids) AND status = ANY(v_eligible)
  LOOP
    SELECT EXISTS(
      SELECT 1 FROM shared_word_sets
       WHERE category = 'library_book'
         AND curation_query->>'book_id' = v_id::text
         AND is_published = true
    ) INTO v_has_published;
    IF v_has_published THEN
      v_blocked_published := v_blocked_published + 1;
      CONTINUE;
    END IF;

    SELECT EXISTS(SELECT 1 FROM texts WHERE library_book_id = v_id) INTO v_has_users;
    IF v_has_users THEN
      v_blocked_users := v_blocked_users + 1;
      CONTINUE;
    END IF;

    WITH del AS (
      DELETE FROM shared_word_sets
       WHERE category = 'library_book'
         AND curation_query->>'book_id' = v_id::text
         AND is_published = false
       RETURNING 1
    )
    SELECT COUNT(*)::int INTO v_temp FROM del;
    v_sets_deleted := v_sets_deleted + v_temp;

    BEGIN
      PERFORM archive_book_pipeline_messages(v_id);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    -- v06.61 fix: seed catalog imported 플래그 실제 해제 (이전엔 EXISTS 카운트만).
    --   DELETE 전에 실행해야 imported_book_id(= v_id)가 아직 살아있어 매칭됨.
    WITH u AS (
      UPDATE library_seed_catalog
         SET imported_to_books = false, imported_book_id = NULL
       WHERE imported_book_id = v_id
      RETURNING 1
    )
    SELECT COUNT(*)::int INTO v_temp FROM u;
    v_seed_unlocked := v_seed_unlocked + v_temp;

    DELETE FROM library_books WHERE id = v_id;
    v_deleted := v_deleted + 1;
  END LOOP;

  deleted_count        := v_deleted;
  skipped_count        := v_total - v_deleted;
  word_sets_deleted    := v_sets_deleted;
  seed_unlocked        := v_seed_unlocked;
  blocked_by_users     := v_blocked_users;
  blocked_by_published := v_blocked_published;
  RETURN NEXT;
END $function$;

-- 기존 orphan 정리 — imported_to_books=true 이나 매칭 library_books 없는 seed (이번 버그 잔류분, Ammachi 등).
UPDATE library_seed_catalog s
   SET imported_to_books = false, imported_book_id = NULL
 WHERE s.imported_to_books = true
   AND NOT EXISTS (
     SELECT 1 FROM library_books b
      WHERE b.source = s.source AND b.source_id = s.source_id
   );
