-- 20260607170000_admin_bulk_return_to_source.sql
--
-- "→ 소스 GET" 시맨틱 재정의: library_books DELETE → BulkFetchTab 으로 복귀.
--
-- 사용자 모델:
--   - 소스 GET = library_seed_catalog 의 row (도서가 library_books 에 들어오기 전)
--   - Curated Books = library_books 에 있는 도서 (ingest 이후)
--   - "→ 소스 GET" 액션 = library_books 에서 빼고 seed 의 imported_book_id 를 자동 NULL 로 되돌려
--     BulkFetchTab 에서 다시 fetch 가능하게.
--
-- 기존 admin_bulk_requeue_books (status='queued' UPDATE 만) 는 의도와 어긋남 — 본문 교체.
--
-- 자동 cascade:
--   library_book_vocabularies         → ON DELETE CASCADE
--   library_chapters_master           → ON DELETE CASCADE
--   library_seed_catalog              → ON DELETE SET NULL (imported_book_id) ✓ 핵심
--   user_word_set_subscriptions       → ON DELETE SET NULL (source_book_id)
--   echo_match_sessions               → ON DELETE SET NULL (library_book_id)
--
-- 명시적 cleanup:
--   shared_word_sets drafts           → FK 없음 (curation_query JSONB 참조) → 명시 DELETE
--   pgmq library_pipeline 메시지      → archive_book_pipeline_messages() 호출
--
-- 안전 가드 (변경 없음):
--   - is_published=true 단어장 존재 시 row 스킵 (학습자 노출 중인 도서 보호)
--   - texts.library_book_id 참조 시 row 스킵 (사용자 진도 보호)

DROP FUNCTION IF EXISTS public.admin_bulk_requeue_books(uuid[]);

CREATE OR REPLACE FUNCTION public.admin_bulk_requeue_books(p_book_ids uuid[])
RETURNS TABLE(
  deleted_count           int,
  skipped_count           int,
  word_sets_deleted       int,
  seed_unlocked           int,
  blocked_by_users        int,
  blocked_by_published    int
)
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
  -- 자격 status: 아직 게시 안 된 모든 상태 (게시본은 안전 가드에서 별도 차단)
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
    -- 안전 가드 1: 이미 published 된 단어장 (학습자 노출 중) → 절대 삭제 X
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

    -- 안전 가드 2: 사용자 texts 가 이 도서 참조 → 진도 손상 차단
    SELECT EXISTS(SELECT 1 FROM texts WHERE library_book_id = v_id) INTO v_has_users;
    IF v_has_users THEN
      v_blocked_users := v_blocked_users + 1;
      CONTINUE;
    END IF;

    -- 1) draft 챕터 단어장 명시 삭제 (FK 없음 — JSONB 참조)
    --    cascade: shared_words / user_word_set_subscriptions FK CASCADE 로 자동 정리
    WITH del AS (
      DELETE FROM shared_word_sets
       WHERE category = 'library_book'
         AND curation_query->>'book_id' = v_id::text
         AND is_published = false
       RETURNING 1
    )
    SELECT COUNT(*)::int INTO v_temp FROM del;
    v_sets_deleted := v_sets_deleted + v_temp;

    -- 2) pgmq library_pipeline 큐의 이 book_id 메시지 archive
    BEGIN
      PERFORM archive_book_pipeline_messages(v_id);
    EXCEPTION WHEN OTHERS THEN
      -- best-effort — 큐 정리 실패해도 본 작업 계속
      NULL;
    END;

    -- 3-a) DELETE 전에 seed catalog 매칭 여부 카운트 (직접 ID 입력 도서는 seed 없음)
    IF EXISTS(SELECT 1 FROM library_seed_catalog WHERE imported_book_id = v_id) THEN
      v_seed_unlocked := v_seed_unlocked + 1;
    END IF;

    -- 3-b) library_books DELETE
    --    cascade:  library_book_vocabularies, library_chapters_master 자동 삭제
    --    set null: library_seed_catalog.imported_book_id ← seed 자동 unlock!
    --              user_word_set_subscriptions.source_book_id, echo_match_sessions.library_book_id
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

REVOKE ALL ON FUNCTION public.admin_bulk_requeue_books(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_bulk_requeue_books(uuid[]) TO authenticated;

COMMENT ON FUNCTION public.admin_bulk_requeue_books(uuid[]) IS
'Curated Books bulk: DELETE library_books rows -> auto seed unlock (FK SET NULL) -> book returns to BulkFetchTab. Guards: published sets / user texts. Admin or curator only.';
