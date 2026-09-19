-- supabase/migrations/20260906063831_idx_la_band_id.sql
--
-- 조판이 밴드로 원글을 고르는 질의가 **전량 Seq Scan** 이라 8초 statement timeout 을 넘겼다.
--
-- ⚠️ **이 파일은 원격에 이미 적용된 것을 저장소에 뒤늦게 채운 것이다.**
--    `supabase_migrations.schema_migrations` 에는 `20260906063831 idx_la_band_id` 가 있는데
--    저장소에는 대응 파일이 없었다(실측 2026-09-06). 파일이 없으면 다음 사람이 이 인덱스를
--    "누가 언제 왜 만들었는지" 못 찾고, `db diff` 가 계속 이 인덱스를 지우자고 한다.
--    `IF NOT EXISTS` 라 다시 돌려도 무해하다.
--
-- ── 무엇이 문제였나 (실측 2026-09-06 · PostgREST 경유) ─────────────────────
-- `loadVolume`(scripts/textbook/volume-pool.mjs)이 권마다 던지는 질의:
--
--     select ... from library_articles
--      where status in ('ready','published') and article_v_level = $1
--      order by id asc limit 1000
--
-- 조건만 바꿔 재면 갈리는 지점이 분명했다:
--
--     status 만 + keyset(order by id)              200 ·  6,184ms · 1,000행
--     status + article_v_level = 9 (재고 11편)      500 ·  8,048ms · statement timeout
--     article_v_level = 9 만                        500 ·  8,308ms · statement timeout
--     status + article_v_level = 4 (재고 856편)     500 ·  8,658ms · statement timeout
--
-- **밴드가 붙는 순간 죽었다 — 그 밴드에 몇 편이 있든 상관없이.** `article_v_level` 로 시작하는
-- 인덱스가 없어 11편을 찾으려고 91,358행을 전부 훑었고, 본문이 1.3GB 라 그 훑기가 8초를 넘었다.
-- 그래서 **어느 밴드의 권도 조판되지 않았다.**
--
-- ── 적용 후 (실측) ──────────────────────────────────────────────────────────
--     explain (analyze, buffers) 같은 질의 (V4)
--       BitmapAnd(idx_la_band_id · idx_la_status_date) → Bitmap Heap Scan
--       Execution Time **59.275 ms** (8,658ms 타임아웃에서)
--
-- 조판도 실제로 돌아온다 — V4 2단원 12문항이 만들어졌다(같은 날 실측).
--
-- ⚠️ **부분 인덱스로 좁히지 않았다.** `WHERE status IN ('ready','published')` 를 붙이면
--    21,839행(전체의 24%)만 담아 더 작지만, 그러면 **조판의 status 조건과 한 벌로 묶인다** —
--    그쪽이 바뀌는 순간 인덱스가 조용히 안 쓰이고 다시 8초 절벽으로 돌아간다.
--    지금 계획은 `idx_la_status_date` 와 BitmapAnd 로 엮이므로 status 조건이 바뀌어도 살아남는다.
--    (부분 인덱스 판(`20260906030000_idx_la_pool_band`)은 이 이유로 **철회했다.**)
--
-- ── 되돌리기 ────────────────────────────────────────────────────────────────
--   drop index if exists public.idx_la_band_id;
--   인덱스만 지우면 되고 데이터는 건드리지 않는다. 조판은 다시 8초 절벽으로 돌아간다.

CREATE INDEX IF NOT EXISTS idx_la_band_id
  ON public.library_articles (article_v_level, id);

COMMENT ON INDEX public.idx_la_band_id IS
  '조판 풀 조회 — volume-pool.loadVolume 의 (status in (ready,published) AND article_v_level = $1 ORDER BY id). '
  '없으면 밴드 필터가 91,358행 Seq Scan 이 되어 8초 statement timeout 으로 조판이 통째로 선다(실측 2026-09-06: 8,658ms → 59ms).';
