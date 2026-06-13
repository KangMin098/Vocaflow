-- 20260607130000_admin_bulk_book_status.sql
--
-- /admin/curation Curated Books 목록 다건 일괄 상태 전환.
-- 단권 함수(admin_requeue_book)는 이미 존재 — 본 마이그레이션은 단순 bulk wrapper 2종.
--   1) admin_bulk_set_books_curating(uuid[]) — status='ready' 인 row 만 'curating' 으로 reclassify
--                                              (pgmq 재발행 X — 단순 분류 이동)
--   2) admin_bulk_requeue_books(uuid[])      — status IN (queued..curating) row 만 'queued' 로 되돌리고
--                                              status_message 클리어 + pgmq library_pipeline 재발행
--
-- 두 함수 모두 SECURITY DEFINER + is_admin_or_curator() 게이트. 권한 외 row 는 silently skip.
-- 반환: 적용된 row 수와 스킵 된 row 수.

-- ── 1. ready → curating (분류만) ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_bulk_set_books_curating(p_book_ids uuid[])
RETURNS TABLE(updated_count int, skipped_count int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pgmq', 'extensions'
AS $function$
DECLARE
  v_updated INT := 0;
  v_total   INT := COALESCE(array_length(p_book_ids, 1), 0);
BEGIN
  IF NOT is_admin_or_curator() THEN
    RAISE EXCEPTION 'Forbidden: admin or curator only';
  END IF;

  IF v_total = 0 THEN
    updated_count := 0;
    skipped_count := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  WITH upd AS (
    UPDATE library_books
       SET status = 'curating',
           status_message = NULL,
           updated_at = now()
     WHERE id = ANY(p_book_ids)
       AND status = 'ready'
     RETURNING 1
  )
  SELECT COUNT(*)::int INTO v_updated FROM upd;

  updated_count := v_updated;
  skipped_count := v_total - v_updated;
  RETURN NEXT;
END $function$;

REVOKE ALL ON FUNCTION public.admin_bulk_set_books_curating(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_bulk_set_books_curating(uuid[]) TO authenticated;

COMMENT ON FUNCTION public.admin_bulk_set_books_curating(uuid[]) IS
'Curated Books bulk: status=ready → curating (분류 이동, pgmq 재발행 X). Admin/curator only.';


-- ── 2. in_progress → queued + pgmq 재발행 ─────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_bulk_requeue_books(p_book_ids uuid[])
RETURNS TABLE(updated_count int, skipped_count int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pgmq', 'extensions'
AS $function$
DECLARE
  v_id        UUID;
  v_updated   INT := 0;
  v_total     INT := COALESCE(array_length(p_book_ids, 1), 0);
  v_eligible  CONSTANT TEXT[] := ARRAY[
    'queued','ingesting','normalizing','segmenting','analyzing','curating'
  ];
BEGIN
  IF NOT is_admin_or_curator() THEN
    RAISE EXCEPTION 'Forbidden: admin or curator only';
  END IF;

  IF v_total = 0 THEN
    updated_count := 0;
    skipped_count := 0;
    RETURN NEXT;
    RETURN;
  END IF;

  -- row 단위로 admin_requeue_book 와 동일 효과: status reset + pgmq 발행.
  -- 한 row 가 자격 미달이면 pgmq 발행도 건너뜀 (skip).
  FOR v_id IN
    SELECT id FROM library_books
     WHERE id = ANY(p_book_ids)
       AND status = ANY(v_eligible)
  LOOP
    UPDATE library_books
       SET status = 'queued',
           status_message = NULL,
           updated_at = now()
     WHERE id = v_id;

    PERFORM pgmq.send(
      'library_pipeline',
      jsonb_build_object('book_id', v_id, 'enqueued_at', now(), 'requeued', true)
    );

    v_updated := v_updated + 1;
  END LOOP;

  updated_count := v_updated;
  skipped_count := v_total - v_updated;
  RETURN NEXT;
END $function$;

REVOKE ALL ON FUNCTION public.admin_bulk_requeue_books(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_bulk_requeue_books(uuid[]) TO authenticated;

COMMENT ON FUNCTION public.admin_bulk_requeue_books(uuid[]) IS
'Curated Books bulk: in_progress → queued + pgmq library_pipeline 재발행. Admin/curator only.';
