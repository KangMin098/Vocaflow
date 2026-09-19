-- supabase/migrations/20260919231528_default_privileges_revoke_anon_execute.sql
--
-- 발견 111 (advisor:default_acl:public_functions) 근본 원인 조치 — 3편 중 1편.
-- 같은 조치의 나머지: 20260919231822(무영향 기록) · 20260919232557(실제로 듣는 문장).
--
-- 무엇이 문제였나 — public 스키마의 기본 ACL 이 새 함수에 anon EXECUTE 를 **명시적으로** 부여했다:
--   pg_default_acl(postgres, public, 'f') = {postgres=X, anon=X, authenticated=X, service_role=X}
--
-- 그래서 함수를 만들며 `REVOKE ALL ... FROM PUBLIC` 을 해도 anon 은 막히지 않았다.
-- 실제 사례 — 20260918140000_csat_source_eligibility_cache.sql:73-74 는
--     REVOKE ALL ON FUNCTION csat_source_is_eligible(uuid) FROM PUBLIC;
--     GRANT EXECUTE ... TO authenticated, service_role;
-- 로 이미 잠갔는데도 2026-09-20 has_function_privilege 실측에서 anon=true 였다.
-- 잠그려는 의도가 있었고, 그 의도가 조용히 무효화되고 있었다.
--
-- 기존 함수에는 영향이 없다 — 기본 ACL 은 **앞으로 CREATE 되는** 함수에만 적용된다.
-- 적용 대상은 postgres 가 만드는 객체다. 우리 마이그레이션 함수는 전부 postgres 소유이고,
-- supabase_admin 몫 기본 ACL 은 postgres 가 그 역할의 멤버가 아니라 고칠 수 없다(고칠 필요도 없다).
--
-- 되돌리기:
--   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon;
