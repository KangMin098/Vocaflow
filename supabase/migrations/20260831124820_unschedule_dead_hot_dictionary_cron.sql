-- supabase/migrations/20260831124820_unschedule_dead_hot_dictionary_cron.sql
--
-- 사문화된 cron 제거 — refresh-hot-dictionary (jobid 1)
--
-- 이 작업은 `REFRESH MATERIALIZED VIEW CONCURRENTLY hot_dictionary` 를 매주
-- 토요일 18:00 UTC 에 실행해 왔는데, 그 matview 가 **없다**(to_regclass = NULL).
-- 20260508120000_lcp_v2 가 만들고 20260508120200_lcp_v2_analyze 가 재정의했으나
-- 이후 삭제됐고, cron 작업만 남았다.
--
-- ⚠️ CLAUDE.md 가 경고하는 드리프트가 **함수가 아니라 스케줄러에서** 재현된 사례다.
--    `DROP TABLE ... CASCADE` 는 함수 일부를 함께 지우지만 `cron.job` 행은 손대지 않는다.
--    그래서 아무 신호 없이 매주 실패하는 작업이 남는다.
--
-- **되살리지 않고 지우는 이유** — 소비자가 없다(`word_lexicon` 때와 다른 경우다):
--   · RPC 본문 참조 0건 (pg_proc.prosrc 전수)
--   · 앱 코드 참조 0건 (*.ts/tsx/mjs/mts/js 전수) — 남은 참조는 migration 과 문서뿐
--   · cron.job_run_details 의 last_ok = NULL — **생성 이래 한 번도 성공한 적이 없다**
--   즉 이 뷰가 없어서 깨진 기능이 없다. 되살릴 대상이 아니라 지울 대상이다.

SELECT cron.unschedule('refresh-hot-dictionary');
