-- supabase/migrations/20260809120000_comic_reader_format.sql
-- CCP 리더 구성 방식(포맷) 노출 — 학습자 리더가 도서의 구성 방식(웹툰/만화/그래픽노블)을 알아
-- 읽는 방식(세로 스크롤 vs 페이지 넘김)을 자동 결정한다.
--   comic_books · comic_styles 는 admin-RLS(is_admin_or_curator) 라 학습자가 직접 못 읽는다 →
--   SECURITY DEFINER RPC 로만 format 을 전달. 발행 이중 게이트(comic_books + library_books) 유지.
--   기존 리더 RPC(select_book_comic_all) 는 건드리지 않는 최소 침습 — 신규 함수만 추가.
CREATE OR REPLACE FUNCTION public.get_comic_format(p_book_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.format::text
  FROM comic_books cb
  JOIN comic_styles s  ON s.key = cb.style_key
  JOIN library_books b ON b.id = cb.library_book_id AND b.status = 'published'
  WHERE cb.library_book_id = p_book_id AND cb.status = 'published'
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_comic_format(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_comic_format(uuid) TO authenticated, anon;
COMMENT ON FUNCTION public.get_comic_format(uuid) IS
  'CCP 리더 구성 방식(comic_styles.format via comic_books.style_key) — 발행 만화의 읽는 방식(scroll/page) 자동 결정. style_key/미발행 시 NULL.';
