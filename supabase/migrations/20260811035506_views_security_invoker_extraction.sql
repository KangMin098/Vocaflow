-- 20260811120000_views_security_invoker.sql
-- 추출 진단 뷰 2건을 SECURITY INVOKER 로 — Supabase advisor `security_definer_view` ERROR 해소.
--
-- 프로젝트 규약: `20260614150000_views_security_invoker` 에서 뷰는 호출자 권한으로 기반 테이블
--   RLS 를 타도록 정했다. v_book_extraction_stats 는 그 이전부터 옵션이 빠져 있었고,
--   v06.35 에서 추가한 v_book_extraction_reasons 도 같은 상태였다.
--
-- 부작용 검토 (2026-08-11):
--   · 어드민 콘솔은 createClient()(사용자 JWT)로 호출한다. 실제 admin 로그인이면
--     library_book_vocabularies 의 admin_curator_read_vocab 정책(is_admin_or_curator())을 통과한다.
--   · 두 뷰는 어드민 전용 조회다 — 학습자 화면(/library/books)은 shared_word_sets 를 읽지
--     이 뷰를 보지 않는다.
--   · DEV_ADMIN_BYPASS 는 이 환경에 미설정. 다만 그 우회는 DB 신원 없이 anon 으로 붙는 구조라,
--     활성화된 환경에서는 미발행 도서 통계가 안 보이게 된다. 그건 우회 경로가
--     service-role 클라이언트를 쓰도록 고칠 별건이지, 뷰를 RLS 우회 상태로 두는 근거가 아니다.

ALTER VIEW public.v_book_extraction_stats   SET (security_invoker = true);
ALTER VIEW public.v_book_extraction_reasons SET (security_invoker = true);
