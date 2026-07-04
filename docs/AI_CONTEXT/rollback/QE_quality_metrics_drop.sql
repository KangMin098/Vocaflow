-- docs/AI_CONTEXT/rollback/QE_quality_metrics_drop.sql
-- 품질평가 Q2 (v06.119 · migration 20260704043934_quality_metrics) 완전 롤백.
-- 실행 순서 고정: cron → function → table.

select cron.unschedule('quality-metrics-nightly');

drop function if exists collect_quality_metrics();

drop table if exists quality_metrics;
