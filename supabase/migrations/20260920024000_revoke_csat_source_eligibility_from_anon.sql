-- supabase/migrations/20260920024000_revoke_csat_source_eligibility_from_anon.sql
--
-- 발견 160 · 161 — 2026-09-18 에 새로 만들어진 SECURITY DEFINER 둘이 anon 에 열려 있었다.
--
-- 이 둘은 기본 권한 결함의 **증상**이다. 원인은 20260919231528·20260919232557 에서 고쳤지만
-- 기본 권한은 **앞으로 CREATE 되는** 함수에만 적용되므로, 이미 만들어진 이 둘은 따로 걷는다.
--
-- ── csat_source_is_eligible(uuid) : anon 만 회수 ──────────────────────────────
-- 원 마이그레이션 20260918140000:73-74 는 일부러 이렇게 썼다:
--     REVOKE ALL ON FUNCTION … FROM PUBLIC;
--     GRANT EXECUTE ON FUNCTION … TO authenticated, service_role;
-- 즉 **authenticated 는 의도해서 준 것**이다. 그 판단은 뒤집지 않는다.
-- anon 이 남은 건 의도가 아니라 스키마 기본 ACL 의 `anon=X` 가 CREATE 시점에 박혔기 때문이다
-- (proacl 에 PUBLIC `=X/` 항목이 없는 것이 그 증거 — 작성자의 REVOKE 는 실제로 먹었다).
--
-- 안전: 저장소에 직접 `.rpc('csat_source_is_eligible')` 호출이 0건이고, 내부 호출자 3개
--   (textbook_practice_items · prescribe_today · grade_dcp_item)는 전부 SECURITY DEFINER 라
--   소유자 권한으로 돌아 호출자의 EXECUTE 권한과 무관하다.
--
-- ── retain_source_eligibility_history() : 전 역할 회수 ────────────────────────
-- 트리거 전용 함수다:
--   CREATE TRIGGER source_eligibility_history BEFORE UPDATE ON public.csat_source_eligibility
--     FOR EACH ROW EXECUTE FUNCTION retain_source_eligibility_history()
-- **PostgreSQL 은 트리거 함수에 EXECUTE 권한을 검사하지 않는다** — 트리거는 UPDATE 의 일부로
-- 그대로 돈다. 그래서 아무 역할도 EXECUTE 가 필요 없고, 여기만 PUBLIC 항목(`=X/postgres`)이
-- 남아 있었으므로 PUBLIC 까지 함께 걷는다.
--
-- 검증은 마이그레이션 성공이 아니라 **실제 동작**으로 한다 — 적용 후 service_role 로
-- csat_source_eligibility 를 UPDATE 해 history 행이 계속 쌓이는지 본다.
--
-- 되돌리기:
--   GRANT EXECUTE ON FUNCTION public.csat_source_is_eligible(uuid) TO anon;
--   GRANT EXECUTE ON FUNCTION public.retain_source_eligibility_history() TO PUBLIC;

REVOKE EXECUTE ON FUNCTION public.csat_source_is_eligible(uuid)
  FROM anon;

REVOKE EXECUTE ON FUNCTION public.retain_source_eligibility_history()
  FROM PUBLIC, anon, authenticated;
