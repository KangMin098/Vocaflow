-- supabase/migrations/20260927161216_csat_items_public_restore_authenticated_select.sql
--
-- 학습자 기출 화면(`/csat/*`)의 유일한 읽기 경로 `csat_items_public` 에 authenticated SELECT 를 되돌린다.
-- 20260923103943(csat_items_public_readonly)은 쓰기·anon 만 회수하고 «authenticated SELECT 는 회수 금지»
-- 로 남겼는데, 2026-09-28 실측 acl 이 `authenticated=m` 뿐이었다(언제 빠졌는지는 DB 기록에 없다).
-- 증상: copyright-boundary 통합 테스트 `permission denied for view csat_items_public`.
-- anon SELECT·쓰기 권한은 주지 않는다(그대로 회수 상태).
grant select on table public.csat_items_public to authenticated;
