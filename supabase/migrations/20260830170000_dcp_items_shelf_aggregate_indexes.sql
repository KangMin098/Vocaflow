-- 20260830170000_dcp_items_shelf_aggregate_indexes.sql
--
-- 교재 서가 집계 두 개가 `csat_dcp_items` 를 **매 요청 전량 스캔**하고 있었다.
--
-- ── 실측 (2026-08-30) ──────────────────────────────────────────────────
--   textbook_shelf_inventory()  573 ms   Seq Scan · shared buffers 21,222 (heap 166MB)
--   textbook_shelf_sources()    496 ms   Seq Scan · 같은 표
--   표: 136,532행 · heap 166MB · 인덱스 19MB (pk + unique(kind,ref_id,type,paragraph_idx))
--
-- 둘 다 **집계 전용**이다 — 지문·선지·정답 같은 본문 컬럼을 한 번도 읽지 않는데,
-- 집계에 필요한 열을 담은 인덱스가 없어서 166MB 힙을 통째로 훑고 있었다.
--
-- ── 왜 이게 화면 문제가 아니라 가용성 문제인가 ──────────────────────────
-- 이 두 함수는 `/library/textbooks` 와 `/text`(내 서재) 가 **요청마다** 부른다. 둘 다
-- 공개/로그인 카탈로그다. 프로덕션 빌드로 재도 1.13초였고 dev 와 거의 같았다 —
-- 남은 시간이 프레임워크가 아니라 **DB 왕복**이라는 뜻이다. 트래픽이 붙으면 화면이
-- 느려지는 게 아니라 DB 가 먼저 무너진다.
--
-- ── 부분 인덱스인 이유 ─────────────────────────────────────────────────
-- 두 함수 모두 `WHERE i.v_level IS NOT NULL` 로 시작한다. 같은 조건을 인덱스에 걸면
-- 인덱스가 작아지고 플래너가 곧바로 매칭한다. (현재 136,532행 전부가 v_level 을 갖지만,
-- 조건을 그대로 반영해 두는 편이 앞으로 NULL 이 생겨도 안전하다.)
--
-- 되돌리기: DROP INDEX 두 줄. 표·데이터·함수는 건드리지 않는다.

-- textbook_shelf_inventory: SELECT type, v_level, count(*) GROUP BY 1,2
CREATE INDEX IF NOT EXISTS idx_dcp_items_vlevel_type
  ON public.csat_dcp_items (v_level, type)
  WHERE v_level IS NOT NULL;

-- textbook_shelf_sources: v_level + kind + ref_id(library_articles 조인 키) 로 집계
CREATE INDEX IF NOT EXISTS idx_dcp_items_vlevel_kind_ref
  ON public.csat_dcp_items (v_level, kind, ref_id)
  WHERE v_level IS NOT NULL;

-- ⚠️ **인덱스만으로는 아무것도 나아지지 않았다 — VACUUM 이 함께 필요했다.**
--
-- 적용 직후 플래너는 곧바로 `Index Only Scan` 을 골랐는데 시간이 그대로였다. 이유는
-- `Heap Fetches: 119735` — 가시성 맵(visibility map)이 낡아서 **85% 의 행을 결국 힙에서**
-- 다시 읽고 있었다. 이름만 index-only 였던 셈이다.
--
--   VACUUM (ANALYZE) public.csat_dcp_items;   -- 온라인 · 잠금 없음 · VACUUM FULL 아님
--
-- 를 돌린 뒤에야 `Heap Fetches: 0` 이 되고 버퍼가 21,222 → 124 로 떨어졌다.
--
-- ── 최종 실측 (2026-08-30) ─────────────────────────────────────────────
--   textbook_shelf_inventory   573 ms → 30 ms   (Heap Fetches 0 · buffers 21,222 → 124)
--   textbook_shelf_sources     496 ms → 250 ms  (남은 비용은 library_articles 조인)
--   /library/textbooks       1.129 s → 0.197 s  (프로덕션 빌드 · next start)
--   /library/textbooks/5     1.339 s → 0.273 s
--
-- 이 표는 계속 적재된다(적용 시점 140,754행). 대량 적재 뒤에는 가시성 맵이 다시 낡으므로
-- **autovacuum 이 따라오지 못하면 이 효과가 조용히 사라진다** — 느려지면 Heap Fetches 를 먼저 볼 것.
