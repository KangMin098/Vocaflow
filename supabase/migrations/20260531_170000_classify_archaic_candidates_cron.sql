-- 20260531_170000_classify_archaic_candidates_cron.sql
-- pg_cron 일일 job — archaic_candidates pending 자동 분류.
--
-- collect_archaic_candidates 는 권당 ingest 에서 미바인딩어를 pending 으로 누적하고,
-- classify_archaic_candidates 는 본 cron 으로 하루 1회 전역 pending 을 재분류한다
-- (cluster 회수 → processed / 파생 base → addable_modern). 권당 ingest 에 넣지 않는 이유:
-- 전역 재스캔이라 책마다 호출하면 중복 비용 → 일일 1회가 스케일 정합.
--
-- 실행 컨텍스트: pg_cron job 은 postgres 로 실행 → 함수 소유자(postgres)라 EXECUTE 가능
-- (service_role 전용 GRANT 와 무관). 멱등 — cron.schedule 은 jobname 기준 upsert.
-- 시간: 0 20 * * * UTC (KST 05:00) — 기존 job(18/19시 UTC)과 비충돌.

BEGIN;

SELECT cron.schedule(
  'classify-archaic-candidates-daily',
  '0 20 * * *',
  $cmd$ SELECT public.classify_archaic_candidates(); $cmd$
);

COMMIT;
