-- supabase/migrations/20260919231822_default_privileges_revoke_public_execute.sql
--
-- 발견 111 근본 원인 조치 — 3편 중 2편. **이 문장은 아무 효과가 없다.**
-- 원격에 이미 적용됐기 때문에 저장소를 원격과 일치시키려고 남긴다. 지우지 말 것 —
-- 지우면 다음 사람이 같은 문장을 "아직 안 했네" 하고 또 적용한다.
--
-- 왜 안 듣는가 — PostgreSQL 에서 **스키마별 기본 권한은 전역 기본 권한을 대체하지 않고 더한다.**
-- 새 함수의 ACL = 전역 기본값(소유자 + PUBLIC EXECUTE) + 스키마별 기본값(anon·authenticated·service_role).
-- 그래서 `IN SCHEMA public ... REVOKE ... FROM PUBLIC` 은 구조적으로 PUBLIC 을 지울 수 없다.
-- 적용 후 탐침 함수를 만들어 실측했고, proacl 에 `=X/postgres` 가 그대로 남아 있었다:
--   {=X/postgres, postgres=X, authenticated=X, service_role=X}  → anon 은 PUBLIC 멤버라 여전히 true
--
-- PUBLIC 은 전역에서만 회수된다 → 20260919232557 을 볼 것.

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
