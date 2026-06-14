-- supabase/migrations/20260614160000_library_articles_admin_rls.sql
-- ACP — admin Curated 탭 빈 목록 버그 수정.
--
-- 원인: library_articles RLS 에 admin/curator 정책이 누락. 기존 정책은
--   anyone_read_published_safe_articles(public, status='published' AND copyright_safe) +
--   service_role_all 뿐 → admin 의 직접 SELECT(listAdminArticles)가 published 외(queued/ready/
--   failed)를 못 읽어 Curated 탭이 빈 목록. (library_books 는 admin_curator_all_books 보유 — 미러.)
-- 수정: library_books 와 동일하게 is_admin_or_curator() ALL 정책 추가.
--   (enqueue/publish/archive 쓰기는 SECURITY DEFINER RPC 라 영향 없음 — 읽기 가시화가 핵심.)

DROP POLICY IF EXISTS admin_curator_all_articles ON library_articles;
CREATE POLICY admin_curator_all_articles ON library_articles
  FOR ALL TO public
  USING (is_admin_or_curator())
  WITH CHECK (is_admin_or_curator());
