-- supabase/migrations/20260808140000_comic_pipeline_fixes.sql
--
-- CCP QA 수정(3관점 감사 반영):
--   ① 리더 전권 로드 — select_book_comic_all: 도서의 발행 만화 전 챕터/컷을 한 번에.
--      (기존 select_book_comic 은 1챕터만 → stave-dot 레일 1개 붕괴 + 챕터별 dead-end)
--   ② 발행본 재생성(보완) 시 미발행 — enqueue_comic_jobs 가 published 헤더를 draft 로 강등
--      (학습자에 stale/불일치 컷 노출 차단).
--   ③ 원자적 삭제 — admin_delete_comic: pages+header+job 단일 트랜잭션(고아 행 방지).
-- 적용: 2026-08-08 dev(jajenrevcbmrpaliomxv) Management API 적용 완료 + 검증(전권 90컷·5 stave·삭제 RPC).

-- ① 리더 전권 로드 (published 게이트)
CREATE OR REPLACE FUNCTION public.select_book_comic_all(p_book_id uuid)
RETURNS TABLE(
  page_order int, chapter_idx int, image_url text,
  bubbles jsonb, target_vocab text[], stave_label text, book_v_level smallint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.page_order, p.chapter_idx, p.image_url, p.bubbles, p.target_vocab, p.stave_label, p.book_v_level
  FROM comic_pages p
  JOIN comic_books cb ON cb.library_book_id = p.library_book_id AND cb.status = 'published'
  JOIN library_books b ON b.id = p.library_book_id AND b.status = 'published'
  WHERE p.library_book_id = p_book_id
  ORDER BY p.chapter_idx, p.page_order;
$$;
REVOKE ALL ON FUNCTION public.select_book_comic_all(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.select_book_comic_all(uuid) TO authenticated;

-- ② enqueue_comic_jobs — 재생성 시 published→draft 강등(학습자 노출 차단)
CREATE OR REPLACE FUNCTION public.enqueue_comic_jobs(p_book_ids uuid[])
RETURNS TABLE(queued integer, skipped integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_queued int := 0; v_skipped int := 0; v_uid uuid := auth.uid(); r record;
BEGIN
  IF NOT is_admin_or_curator() THEN RAISE EXCEPTION 'Forbidden: admin or curator only'; END IF;
  FOR r IN SELECT id, status, book_v_level FROM library_books WHERE id = ANY(p_book_ids) LOOP
    IF r.status NOT IN ('ready','published') THEN
      v_skipped := v_skipped + 1; CONTINUE;
    END IF;
    -- 헤더 보장 + 발행본이면 draft 강등(재생성 중 학습자 노출 차단)
    INSERT INTO comic_books (library_book_id, book_v_level, created_by)
    VALUES (r.id, r.book_v_level, v_uid)
    ON CONFLICT (library_book_id) DO UPDATE SET
      status = CASE WHEN comic_books.status = 'published' THEN 'draft' ELSE comic_books.status END,
      published_at = CASE WHEN comic_books.status = 'published' THEN NULL ELSE comic_books.published_at END,
      updated_at = now();
    INSERT INTO book_curation_jobs (book_id, task_type, status, book_v_level, created_by)
    VALUES (r.id, 'comic_gen', 'pending', r.book_v_level, v_uid)
    ON CONFLICT (book_id, task_type) DO UPDATE SET
      status='pending', result=NULL, error=NULL, note=NULL, claimed_at=NULL,
      panels_done=NULL, created_by=EXCLUDED.created_by, updated_at=now();
    v_queued := v_queued + 1;
  END LOOP;
  RETURN QUERY SELECT v_queued, v_skipped;
END $fn$;
REVOKE ALL ON FUNCTION public.enqueue_comic_jobs(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_comic_jobs(uuid[]) TO authenticated;

-- ③ 원자적 삭제(pages+header+job 단일 트랜잭션)
CREATE OR REPLACE FUNCTION public.admin_delete_comic(p_book_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
BEGIN
  IF NOT is_admin_or_curator() THEN RAISE EXCEPTION 'Forbidden: admin or curator only'; END IF;
  DELETE FROM comic_pages WHERE library_book_id = p_book_id;
  DELETE FROM comic_books WHERE library_book_id = p_book_id;
  DELETE FROM book_curation_jobs WHERE book_id = p_book_id AND task_type = 'comic_gen';
END $fn$;
REVOKE ALL ON FUNCTION public.admin_delete_comic(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_comic(uuid) TO authenticated;
