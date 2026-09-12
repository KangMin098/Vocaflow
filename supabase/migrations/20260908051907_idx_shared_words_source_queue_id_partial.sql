-- supabase/migrations/20260908051907_idx_shared_words_source_queue_id_partial.sql
--
-- shared_words.source_queue_id 의 FK 인덱스 (advisor: unindexed_foreign_keys).
--
-- **부분 인덱스**인 이유 — 2026-09-08 실측:
--   shared_words 681,023행 중 source_queue_id 가 채워진 행은 1,998행(0.29%)뿐이다.
--   btree 는 NULL 도 담으므로 전체 인덱스를 만들면 679,025개의 NULL 까지 안고 ~15MB 가 된다.
--   이 인스턴스는 shared_buffers 256MB 에 데이터 7,139MB(캐시 3.6%)라 쓰이지 않을 15MB 가
--   실제 데이터를 캐시에서 밀어낸다. 부분 인덱스는 같은 일을 64 kB 로 한다(실측).
--
-- 무엇을 막는가: 부모 vocab_enrichment_queue(4.6MB)에서 행이 지워질 때 Postgres 가
-- 자식의 참조를 확인해야 하는데, 인덱스가 없으면 681,023행을 순차 스캔한다.
-- (재기동 후 13시간 부모 삭제는 0건이었다 — 지금 아픈 것이 아니라 큐가 비워질 때 아프다.)
--
-- ⚠️ CONCURRENTLY 를 쓰지 않았다. MCP 는 트랜잭션 안에서 실행하므로 25001 로 거부된다.
--    대신 대상이 작아 짧게 끝난다. CREATE INDEX 는 SHARE 락 — 읽기는 안 막고 쓰기만 잠깐 막는다.
--
-- 검증: indisvalid=true · 64 kB · EXPLAIN ANALYZE 가 Index Only Scan 채택
--       (Heap Fetches 0 · buffers 4 · 실행 1.0ms).
--
-- 되돌리기: drop index if exists public.idx_sw_source_queue_id;

create index if not exists idx_sw_source_queue_id
  on public.shared_words (source_queue_id)
  where source_queue_id is not null;

comment on index public.idx_sw_source_queue_id is
  'FK shared_words_source_queue_id_fkey 용 부분 인덱스. 전체 인덱스는 NULL 679,025개를 담아 ~15MB 가 된다 (2026-09-08 실측 · 채워진 행 1,998 · 부분 인덱스 실측 64 kB).';
