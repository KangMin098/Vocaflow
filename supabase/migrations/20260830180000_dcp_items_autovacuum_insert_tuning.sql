-- 20260830180000_dcp_items_autovacuum_insert_tuning.sql
--
-- **VACUUM 한 번으로 고친 것은, 다음 드레인 한 번으로 되돌아간다.**
--
-- ── 앞 이야기 ───────────────────────────────────────────────────────────
-- `20260830170000` 이 집계용 부분 인덱스 둘을 넣었지만 시간이 그대로였다. 원인은
-- 가시성 맵(visibility map)이 낡아 `Heap Fetches: 119735` — 이름만 index-only 였다.
-- `VACUUM (ANALYZE)` 를 돌린 뒤에야 `Heap Fetches: 0` 이 되고,
--   textbook_shelf_sources   3,533ms → 274ms  (인덱스 스캔 3,105ms → 27ms)
--   textbook_shelf_inventory 3,235ms(타임아웃) → 243ms
-- 가 됐다. 공개 서가가 익명 방문자에게 7권 중 6권을 '재고 확인 중' 으로 보여주던 것이
-- 이것 때문이었다(statement_timeout 3s 초과).
--
-- ── 그런데 이 효과는 유지되지 않는다 ────────────────────────────────────
-- 이 표는 드레인마다 대량 INSERT 된다. INSERT 는 죽은 튜플을 만들지 않으므로
-- 일반 autovacuum 임계값이 아니라 **insert 전용 임계값**(PG13+)이 이 표의 방아쇠다:
--
--   현재(기본값)  autovacuum_vacuum_insert_threshold    = 1000
--                autovacuum_vacuum_insert_scale_factor = 0.2
--   → 방아쇠 = 1000 + 0.2 × 140,754 = **29,151행**
--
-- 즉 3만 행 가까이 쌓일 때까지 가시성 맵이 낡은 채로 있고, 그동안 공개 카탈로그는
-- **조용히 타임아웃으로 되돌아간다.** 아무도 배포를 안 했는데 화면만 다시 거짓말한다 —
-- 이 저장소가 가장 잡기 어려워하는 종류의 회귀다.
--
-- ── 고치는 법 ───────────────────────────────────────────────────────────
-- 이 표에만 insert 임계값을 낮춘다. 전역 설정은 건드리지 않는다.
--
--   변경 후  방아쇠 = 2000 + 0.01 × 140,754 = **3,408행**
--
-- 비용: vacuum 이 더 자주 돈다. 이 표는 append 위주라 vacuum 이 훑는 것은
-- **직전 vacuum 이후 새로 들어온 페이지뿐**이므로(PG14+ 는 frozen 페이지를 건너뛴다)
-- 회당 비용이 작다. 반대로 얻는 것은 공개 카탈로그의 가용성이다.
--
-- ⚠️ analyze 도 같이 조인다 — 플래너가 113개 그룹을 225개로 추정하고 있었다.
--
-- 되돌리기: ALTER TABLE ... RESET (해당 4개 옵션). 데이터·인덱스·함수는 건드리지 않는다.
-- 잠금: ALTER TABLE ... SET (reloptions) 는 SHARE UPDATE EXCLUSIVE — 읽기/쓰기를 막지 않는다.

ALTER TABLE public.csat_dcp_items SET (
  autovacuum_vacuum_insert_threshold    = 2000,
  autovacuum_vacuum_insert_scale_factor = 0.01,
  autovacuum_analyze_threshold          = 2000,
  autovacuum_analyze_scale_factor       = 0.01
);
