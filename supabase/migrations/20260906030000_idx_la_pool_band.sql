-- supabase/migrations/20260906030000_idx_la_pool_band.sql
--
-- 조판이 밴드로 원글을 고르는 질의가 **전량 Seq Scan** 이라 8초 statement timeout 을 넘긴다.
--
-- ── 무엇을 봤나 (실측 2026-09-06 · PostgREST 경유) ──────────────────────────
-- `loadVolume`(scripts/textbook/volume-pool.mjs)이 권마다 던지는 질의는 이 모양이다:
--
--     select ... from library_articles
--      where status in ('ready','published') and article_v_level = $1
--      order by id asc limit 1000
--
-- 같은 서버·같은 순간에 조건만 바꿔 재 보면 갈리는 지점이 분명하다:
--
--     status 만 + keyset(order by id)              200 ·  6,184ms · 1,000행
--     status + article_v_level = 9 (재고 11편)      500 ·  8,048ms · statement timeout
--     article_v_level = 9 만                        500 ·  8,308ms · statement timeout
--     status + article_v_level = 4 (재고 856편)     500 ·  8,658ms · statement timeout
--
-- **밴드가 붙는 순간 죽는다 — 그 밴드에 몇 편이 있든 상관없다.** `article_v_level` 로 시작하는
-- 인덱스가 하나도 없어서(현재 이 표의 인덱스는 `idx_la_compose_batch` ·
-- `idx_library_articles_cover_missing` · `idx_la_csat_fit_pass` 셋뿐이다) 11편을 찾으려고
-- **91,358행을 전부 훑고**, 본문 컬럼이 1.3GB 라 그 훑기가 8초를 넘는다.
--
-- 그래서 지금 **어느 밴드의 권도 조판되지 않는다.** 화면·회귀는 멀쩡히 통과하므로
-- 조판을 실제로 돌려 보기 전에는 안 보인다(2026-09-06 에 그렇게 발견했다 — V4 조판이
-- `library_articles 커서 조회 실패: canceling statement due to statement timeout` 로 죽었다).
--
-- ⚠️ 이 표가 커지면서 넘은 절벽이다. 같은 계열을 오늘 이미 한 번 고쳤다
--    (`20260906080000_idx_dcp_items_ref_id` — `csat_dcp_items` 의 `ref_id` 선두 인덱스).
--    거기서 배운 것과 같다: **거르는 곳과 인덱스를 타는 곳이 달랐다.**
--
-- ── 처방 ────────────────────────────────────────────────────────────────────
-- 부분 인덱스 하나. 조판 질의의 술어를 그대로 담는다.
--
--   · 선두 열이 `article_v_level` 이라 밴드 필터가 인덱스를 탄다.
--   · 둘째 열이 `id` 라 **커서 페이징의 정렬까지** 인덱스가 준다(별도 sort 가 사라진다).
--   · `where status in ('ready','published')` 로 좁혀 **21,839행**만 담는다 —
--     전체 91,358행의 24% 다. 큐(51,760)와 격리(17,758)는 조판이 안 보므로 넣지 않는다.
--
-- ⚠️ **부분 인덱스라 술어가 바뀌면 안 탄다.** 조판이 `status` 조건을 바꾸면(예: `queued` 를
--    포함하면) 이 인덱스는 조용히 쓸모없어지고 다시 8초 절벽으로 돌아간다.
--    `volume-pool.mjs` 의 `.in('status', ['ready','published'])` 와 **한 벌로 묶여 있다.**
--
-- ⚠️ `CONCURRENTLY` 를 쓰지 않는다 — `apply_migration` 이 트랜잭션 안에서 돌아 쓸 수 없다
--    (`20260906080000` 이 남긴 기록). 적용 동안 이 표에 **쓰기가 잠긴다.** 21,839행짜리
--    부분 인덱스라 짧지만, 수확·드레인이 도는 중이면 끝난 뒤에 적용할 것.
--
-- ── 적용 후 확인 ────────────────────────────────────────────────────────────
--   explain analyze
--     select id from public.library_articles
--      where status in ('ready','published') and article_v_level = 4
--      order by id asc limit 1000;
--   → `Index Scan using idx_la_pool_band` 이어야 한다. `Seq Scan` 이면 술어가 어긋난 것이다.
--
--   그리고 실제로 조판해 본다 — 회귀로는 안 잡힌다:
--     pnpm dlx tsx scripts/textbook/render-volume.mjs --band 4 --units 2 --out /tmp/v4.html
--
-- ── 되돌리기 ────────────────────────────────────────────────────────────────
--   drop index if exists public.idx_la_pool_band;
--   인덱스만 지우면 되고 데이터는 건드리지 않는다. 조판은 다시 8초 절벽으로 돌아간다.

CREATE INDEX IF NOT EXISTS idx_la_pool_band
  ON public.library_articles (article_v_level, id)
  WHERE status IN ('ready', 'published');

COMMENT ON INDEX public.idx_la_pool_band IS
  '조판 풀 조회 전용 부분 인덱스 — volume-pool.loadVolume 의 '
  '(status in (ready,published) AND article_v_level = $1 ORDER BY id) 를 그대로 탄다. '
  '없으면 밴드 필터가 91,358행 Seq Scan 이 되어 8초 statement timeout 으로 조판이 통째로 선다(실측 2026-09-06). '
  'volume-pool 의 status 조건과 한 벌이다 — 그쪽이 바뀌면 이 인덱스는 조용히 안 쓰인다.';
