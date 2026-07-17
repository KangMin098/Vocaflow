-- 20260708120500_advisor_revoke_public_definer.sql
-- 직전 마이그레이션 보정 — 일부 함수는 EXECUTE 가 PUBLIC 에 grant 돼 있어
-- (Postgres 기본 · ACL `=X/postgres`) anon 에서 REVOKE 해도 PUBLIC 경유로 상속됨.
-- PUBLIC 에서 회수해야 실제 잠금. service_role·authenticated 의 명시 grant 는 유지되므로 무영향.
-- (사용자 명시 승인 연장 — 2026-07-08)

-- 쓰기: PUBLIC 회수 → service_role 명시 grant 만 남음 (백엔드 전용)
REVOKE EXECUTE ON FUNCTION regenerate_auto_curated_set(uuid) FROM PUBLIC;

-- admin 대시보드 읽기 6종: PUBLIC(=anon 상속) 회수 → authenticated·service_role 명시 grant 유지
REVOKE EXECUTE ON FUNCTION admin_vrl_cron_jobs() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION admin_vrl_cron_runs() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION admin_vrl_diagnostic_use() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION admin_vrl_snapshot_counts() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION admin_vrl_track_distribution() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION admin_vrl_v_level_distribution() FROM PUBLIC;
