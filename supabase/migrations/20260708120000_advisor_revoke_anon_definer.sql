-- 20260708120000_advisor_revoke_anon_definer.sql
-- 보안 advisor 후속 — anon 키(클라 번들 공개)로 앱 인증을 우회해 호출 가능하던
-- 무가드 SECURITY DEFINER 함수 잠금. 정당한 호출자는 전부 service_role(LCP 파이프라인·cron)
-- 이므로 grant 회수와 무관하게 계속 동작(service_role 은 EXECUTE grant 우회).
-- (사용자 명시 승인 — 2026-07-08)

-- 쓰기/액션 3종: anon + authenticated 모두 회수 (service_role 전용)
--   enrich_shared_dictionary       : 마스터 사전 임의 INSERT 오염 차단
--   regenerate_auto_curated_set    : 발행 단어장 shared_words 파괴 차단
--   process_library_pipeline_batch : 내부 토큰 외부 HTTP POST 트리거 차단
REVOKE EXECUTE ON FUNCTION enrich_shared_dictionary(jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION regenerate_auto_curated_set(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION process_library_pipeline_batch(integer) FROM anon, authenticated;

-- admin 대시보드 읽기 6종: anon만 회수 (authenticated admin 서버컴포넌트 유지)
REVOKE EXECUTE ON FUNCTION admin_vrl_cron_jobs() FROM anon;
REVOKE EXECUTE ON FUNCTION admin_vrl_cron_runs() FROM anon;
REVOKE EXECUTE ON FUNCTION admin_vrl_diagnostic_use() FROM anon;
REVOKE EXECUTE ON FUNCTION admin_vrl_snapshot_counts() FROM anon;
REVOKE EXECUTE ON FUNCTION admin_vrl_track_distribution() FROM anon;
REVOKE EXECUTE ON FUNCTION admin_vrl_v_level_distribution() FROM anon;
