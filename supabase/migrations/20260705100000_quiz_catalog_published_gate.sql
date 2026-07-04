-- supabase/migrations/20260705100000_quiz_catalog_published_gate.sql
-- v06.129 큐레이션 점검 후속: /scriptquiz 카탈로그 노출 게이트를 도서 탐색과 동일화.
-- 기존: 게이트 0 (ready 포함 11권 노출) → published + copyright_safe + published_at 3중 게이트.
-- ready 도서의 퀴즈 데이터는 보존 — 도서 publish 시 자동 재노출.

CREATE OR REPLACE FUNCTION public.list_book_chapter_quiz_catalog()
 RETURNS TABLE(book_id uuid, book_title text, book_v_level smallint, chapter_idx integer, chapter_title text, question_count integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    q.library_book_id,
    b.title,
    b.book_v_level,
    q.chapter_idx,
    max(m.chapter_title) AS chapter_title,
    count(*)::int AS question_count
  FROM library_chapter_quiz q
  JOIN library_books b ON b.id = q.library_book_id
  LEFT JOIN library_chapters_master m
    ON m.library_book_id = q.library_book_id AND m.chapter_idx = q.chapter_idx
  WHERE b.status = 'published'
    AND b.copyright_safe_in_kr
    AND b.published_at IS NOT NULL
  GROUP BY q.library_book_id, b.title, b.book_v_level, q.chapter_idx
  ORDER BY b.title, q.chapter_idx
$function$;
