-- Supabase advisor "Security Definer View" 경고 5건 일괄 해결.
-- public 스키마의 모든 view 를 SECURITY INVOKER 로 전환 (Postgres 15+ feature).
-- → view 가 호출자 권한으로 실행 → 기반 테이블 RLS 가 정상 적용.
--
-- 기능 변화 0 — 모든 기반 테이블이 이미 RLS 활성화 + 정책 갖춤.
--   library_seed_catalog · library_book_vocabularies → admin role 정책
--   vocabularies · texts                           → user_id 본인 필터 정책
--   shared_dictionary · library_chapters_master ·
--   content_chunks · library_books                 → public read 정책
--
-- 검증:
--   SELECT relname, reloptions FROM pg_class
--   WHERE relnamespace = 'public'::regnamespace AND relkind = 'v'
--   ORDER BY relname;
--   → 5 행 모두 reloptions = {security_invoker=true}

ALTER VIEW public.library_seed_catalog_view SET (security_invoker = true);
ALTER VIEW public.user_vocab_enriched       SET (security_invoker = true);
ALTER VIEW public.v_book_extraction_stats   SET (security_invoker = true);
ALTER VIEW public.v_text_content            SET (security_invoker = true);
ALTER VIEW public.v_user_book_progress      SET (security_invoker = true);
