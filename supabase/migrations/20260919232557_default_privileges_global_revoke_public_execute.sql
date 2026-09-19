-- supabase/migrations/20260919232557_default_privileges_global_revoke_public_execute.sql
--
-- 발견 111 근본 원인 조치 — 3편 중 3편. **실제로 듣는 문장.**
--
-- PUBLIC EXECUTE 는 전역(스키마 미지정) 기본 권한에서만 회수된다(20260919231822 주석 참조).
-- 다만 전역이라 postgres 가 **다른 스키마에** 만드는 함수에도 걸린다. 2026-09-20 실계수로
-- postgres 소유 함수는 public 260 · extensions 49 · pgmq 40 이므로, 확장을 설치·업그레이드할 때
-- extensions/pgmq 함수가 PUBLIC 을 잃지 않도록 그 두 스키마만 명시 허용해 영향을 public 으로 가둔다.
--
-- 적용 전 롤백 트랜잭션 안에서 탐침 함수로 검증했고, 적용 후 실제로 다시 확인했다:
--   public 일반 함수        anon=false  acl={postgres=X, authenticated=X, service_role=X}
--   public SECURITY DEFINER anon=false  (발견 111 이 겨냥한 바로 그 계열)
--   extensions 함수         anon=true   acl=null (내장 기본값 유지)
-- 기존 함수 302/84/398 은 조치 전후 동일 — 회귀 없음.
--
-- ⚠️ 이후 anon 이 직접 호출해야 하는 RPC(funnel_events_allow_anonymous · peek_class_by_code 계열)를
--    새로 만들면 그 마이그레이션에 `GRANT EXECUTE ON FUNCTION <f> TO anon;` 을 **명시**해야 한다.
--    빠뜨리면 브라우저에서 조용히 권한 오류가 난다. 회귀 가드: scripts/db/check-anon-rpc-grants.mjs
--
-- 되돌리기(한 문장으로 완전 복원):
--   ALTER DEFAULT PRIVILEGES GRANT EXECUTE ON FUNCTIONS TO PUBLIC;

ALTER DEFAULT PRIVILEGES
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

ALTER DEFAULT PRIVILEGES IN SCHEMA extensions
  GRANT EXECUTE ON FUNCTIONS TO PUBLIC;

ALTER DEFAULT PRIVILEGES IN SCHEMA pgmq
  GRANT EXECUTE ON FUNCTIONS TO PUBLIC;
