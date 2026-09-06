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
-- ⚠️ MCP `apply_migration`·`execute_sql` 은 트랜잭션 안에서 돌아
--    CONCURRENTLY 를 못 쓴다(25001). 아래는 CONCURRENTLY 판이며,
--    psql 등 트랜잭션 밖 세션에서 실행해야 한다:
--
--      SET statement_timeout = 0;
--      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lbv_word_lemma
--        ON public.library_book_vocabularies (word)
--        INCLUDE (lemma) WHERE lemma IS NOT NULL;
--
--    트랜잭션 안에서 적용해야 한다면 CONCURRENTLY 를 빼면 되지만,
--    빌드 동안 이 테이블의 **쓰기가 잠긴다** — 이 테이블은 유휴가 아니다
--    (lemma 백필로 n_tup_upd 80,403). 20260906080000 과 같은 성질이다.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lbv_word_lemma
  ON public.library_book_vocabularies (word)
  INCLUDE (lemma)
  WHERE lemma IS NOT NULL;
