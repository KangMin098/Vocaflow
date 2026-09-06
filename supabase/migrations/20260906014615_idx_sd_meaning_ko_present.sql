-- shared_dictionary 의 「뜻이 채워진 행」 카운트를 위한 부분 인덱스.
--
-- ── 왜 필요한가 (실측 2026-09-06) ──────────────────────────────────
-- CLAUDE.md §DB 핵심 통계는 `pnpm docs:db-stats` 가 생성한다. 그 스크립트가 이틀째
-- 실패했고, 원인은 부하가 아니라 이 한 줄이었다:
--
--   select count(*) from shared_dictionary
--   where meaning_ko is not null and meaning_ko <> ''
--     → Seq Scan 49,244행 · buffers 19,801 · **11.2초**
--
-- PostgREST 의 statement timeout 은 8초라 매번 HTTP 500(빈 message)으로 끊겼다.
-- 테이블이 65열 · heap 155MB 라 열 하나만 걸러도 전체를 훑는다.
--
-- 부분 인덱스는 「뜻이 있는 행」만 담으므로 이 카운트가 index-only 로 바뀐다.
-- 키를 word(=pk)로 두어 index-only scan 이 성립한다.
--
--   적용 후: Index Only Scan · Heap Fetches 0 · **0.66초** (PostgREST 66ms)
--
-- ⚠️ 같은 날 `VACUUM (ANALYZE) shared_dictionary` 도 함께 돌렸다(사용자 승인).
--    이 테이블은 last_autovacuum 이 NULL 이었고 dead 8,630 이라 가시성 맵이 비어 있어
--    전체 카운트조차 heap fetch 35,056 번을 하고 있었다. VACUUM 은 마이그레이션에 넣지
--    않는다 — 스키마가 아니라 유지보수이고, 트랜잭션 안에서 못 돈다.
CREATE INDEX IF NOT EXISTS idx_sd_meaning_ko_present
  ON public.shared_dictionary (word)
  WHERE meaning_ko IS NOT NULL AND meaning_ko <> '';
