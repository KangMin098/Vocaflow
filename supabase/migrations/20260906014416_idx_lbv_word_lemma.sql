-- library_book_vocabularies 를 word 순으로 훑는 인덱스.
--
-- ── 왜 필요한가 (실측 2026-09-06) ──────────────────────────────────
-- 드레인 커서가 `lemma IS NOT NULL AND word > $1 ORDER BY word LIMIT n` 로
-- 이 테이블을 페이징하는데, word 로 시작하는 인덱스가 하나도 없었다.
-- 있는 것은 (library_book_id, word) 유일 인덱스라 word 가 선두가 아니고,
-- idx_lbv_lemma 는 lemma 만 담아 정렬을 못 준다.
--
--   EXPLAIN (ANALYZE, BUFFERS) — LIMIT 1000
--     Parallel Seq Scan on library_book_vocabularies
--       rows=795,845 (loops=2) · Buffers: shared read=72,225 · 53,668 ms
--
-- 한 페이지에 53.7초다. pg_stat_statements 실측으로 이 한 구문이
-- 787회 호출에 누적 3,337초(약 56분) — 이 DB 에서 세 번째로 비싼 구문이다.
-- 테이블 전체 seq scan 은 1,927회 · 누적 15억 행 판독으로 압도적 1위였다.
--
-- (word) INCLUDE (lemma) WHERE lemma IS NOT NULL 로 두는 이유:
-- 커서가 읽는 열이 word·lemma 둘뿐이라 index-only scan 이 되고,
-- 부분 인덱스라 lemma 없는 행(약 8.7만)을 담지 않는다.
--
-- ⚠️ 원격에는 CONCURRENTLY **없이** 적용했다(version 20260906014416).
--    MCP 는 SET 과 DDL 을 한 implicit transaction 으로 묶어 보내 CONCURRENTLY 가 25001 로 거부된다.
--    빌드 동안 이 표의 쓰기가 잠기므로, 적용 직전 pg_stat_activity 로 쓰는 세션 0 을 확인하고 넣었다.
--    20260906080000_idx_dcp_items_ref_id 와 같은 성질이다.
--
-- ── 적용 후 실측 ────────────────────────────────────────────────────
--   인덱스 53MB · Index Only Scan 전환 · buffers 72,225 -> 1,070 (98.5% 감소)
--   53,668ms -> 7,375ms
--
--   아직 Heap Fetches 844 가 남아 시간을 다 먹는다. 이 표는 vacuum 이력이 0 이라
--   visibility map 이 5.0% 밖에 안 차 있다(relallvisible 3,638 / relpages 72,225).
--   VACUUM 을 statement_timeout(120s) 안에서 끝낼 수 없어서(블록 62,001 에서 취소)
--   타임아웃이 없는 autovacuum 에 맡기는 것이 남은 절반이다.
CREATE INDEX IF NOT EXISTS idx_lbv_word_lemma
  ON public.library_book_vocabularies (word)
  INCLUDE (lemma)
  WHERE lemma IS NOT NULL;
