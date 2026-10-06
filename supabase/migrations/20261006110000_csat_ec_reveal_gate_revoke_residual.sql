-- supabase/migrations/20261006110000_csat_ec_reveal_gate_revoke_residual.sql
--
-- Reveal Gate ②b — ②(20261005170100) 이 남긴 표 단위 권한을 닫는다. 2026-10-06 ② 적용 뒤 표면 검사(check-surfaces)가 찾았다.
--
-- ② 는 authenticated 의 SELECT 만 다뤘다. 그런데 네 표에는 Supabase 기본 표 권한이 그대로 남아 있었다(적용 뒤 실측 relacl):
--   anon          = arwdDxtm(전부)          — csat_dx_session · csat_dx_response · csat_dx_snapshot · csat_learner_state
--   authenticated = awdDxtm(SELECT 외 전부) — csat_dx_session · csat_dx_response · csat_dx_snapshot
-- 실제 노출은 0 이다 — 네 표 모두 RLS 가 켜져 있고 anon 정책 · authenticated 쓰기 정책이 없다(실제 API 스모크로 거부 확인).
-- 그래도 Reveal Gate 의 기본 거부는 「정책이 막아 준다」가 아니라 권한 단위로 닫는 것이라 남긴 권한을 회수한다.
--
-- 쓰기 주체: 앱은 네 표를 service role 로만 쓴다(저장 = csat_ec_record_session_held · 스냅샷/상태 = 서버 경로, Track B).
-- 학습자 읽기: ② 가 남긴 컬럼 SELECT(dx_session 9열 · dx_response 5열)는 그대로다 — 여기서 건드리지 않는다.
-- 되돌리기: scripts/db/rollback-20261006110000.sql

revoke all on public.csat_dx_session, public.csat_dx_response, public.csat_dx_snapshot, public.csat_learner_state from anon;
revoke insert, update, delete, truncate, references, trigger on public.csat_dx_session, public.csat_dx_response, public.csat_dx_snapshot, public.csat_learner_state from authenticated;
