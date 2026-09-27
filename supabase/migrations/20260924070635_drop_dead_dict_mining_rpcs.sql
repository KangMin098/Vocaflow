-- supabase/migrations/20260924070635_drop_dead_dict_mining_rpcs.sql
--
-- **호출자 0 인 사전 채굴 함수 둘을 지운다** — `select_article_coverage(uuid)` · `select_extraction_residual()`.
--
-- 근거(실측 2026-09-24 · docs/reports/lav-retention-2026-09-24.md §2):
--   · 저장소 코드 호출 0곳 — git 이력에 호출자가 생긴 적도 없다(타입 정의·마이그레이션·주석만).
--   · `pg_proc` 에서 이 둘을 부르는 함수 0 · `pg_depend` 의존 0.
--   · `pg_stat_statements`(2026-09-23 06:11 리셋 이후) 호출 0.
--   · 두 함수가 읽는 `library_article_vocabularies` 는 발행·가공 글 몫(12.5만 행)만 남아
--     옛 목적(전 재고의 사전 미등재 낱말 채굴)을 더는 못 한다. 실제 채굴은
--     `scripts/dict/drain-article-lemmas.mjs` 가 본문에서 직접 한다.
-- 사용자 결정(2026-09-24): 삭제.
-- 되돌리기: docs/AI_CONTEXT/rollback/drop_dead_dict_mining_rpcs-rollback.sql (원문 그대로).
-- 재실행 안전 — IF EXISTS.

DROP FUNCTION IF EXISTS public.select_article_coverage(uuid);
DROP FUNCTION IF EXISTS public.select_extraction_residual();
