-- 20260628111709_acp_delete_article_seed_unlock.sql
--
-- admin_delete_article 패치 — seed 완전 unlock.
--   기존: imported_article_id FK SET NULL 에만 의존 → imported_to_articles=true 잔존 → 재-GET 불가.
--   수정: 삭제 前 library_article_seed_catalog flags 명시 리셋 (LCP admin_bulk_requeue_books 미러).
-- 라우트 /api/admin/articles/delete 는 동등 로직을 TS 로 수행(DEV_ADMIN_BYPASS 함정 회피) — 본 함수는 SSoT 정합.

CREATE OR REPLACE FUNCTION public.admin_delete_article(p_article_id uuid)
 RETURNS TABLE(deleted_article_id uuid, status_was text, word_sets_deleted integer, seed_unlocked integer)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','extensions'
AS $function$
DECLARE v_status TEXT; v_word_sets INT := 0; v_seed INT := 0;
BEGIN
  IF NOT is_admin_or_curator() THEN RAISE EXCEPTION 'Forbidden: admin or curator only'; END IF;
  SELECT status INTO v_status FROM library_articles WHERE id = p_article_id FOR UPDATE;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Article not found: %', p_article_id; END IF;
  IF v_status NOT IN ('ready','archived','queued','failed') THEN
    RAISE EXCEPTION 'Delete blocked: current status % (allowed: ready/archived/queued/failed). Revert published articles first.', v_status;
  END IF;
  WITH d AS (DELETE FROM shared_word_sets
    WHERE category='library_article' AND curation_query->>'article_id' = p_article_id::text RETURNING 1)
  SELECT COUNT(*) INTO v_word_sets FROM d;
  WITH u AS (UPDATE library_article_seed_catalog
       SET imported_to_articles=false, imported_article_id=NULL, curation_status='pending'
     WHERE imported_article_id = p_article_id RETURNING 1)
  SELECT COUNT(*) INTO v_seed FROM u;
  DELETE FROM library_articles WHERE id = p_article_id;
  RETURN QUERY SELECT p_article_id, v_status, v_word_sets, v_seed;
END $function$;
