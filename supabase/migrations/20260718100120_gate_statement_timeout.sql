-- 게이트는 관리자 도구(비-hot path) — 함수 진입 시 statement_timeout 상향.
-- PostgREST 기본 timeout(~8s)이 global scan/big-book select 보다 짧아 앱/테스트에서 취소됨.
ALTER FUNCTION public.run_content_quality_gates(text, uuid) SET statement_timeout TO '60000';
ALTER FUNCTION public.content_gate_publishable(text, uuid) SET statement_timeout TO '60000';
ALTER FUNCTION public.collect_content_gate_metrics() SET statement_timeout TO '120000';
