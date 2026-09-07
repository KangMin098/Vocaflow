-- supabase/migrations/20260821120000_textbook_shelf_inventory.sql
--
-- 학습자가 **교재 서가의 재고를 볼 수 있게** 한다. 문항 본문은 주지 않는다.
--
-- ── 왜 필요한가 (실측 2026-08-21) ───────────────────────────────────
-- `/library/textbooks` 를 만들고 실제로 열어 보니 7권 중 6권이 "재고 0" 으로 나왔다.
-- DB 에는 그 계단들의 문항이 실재한다:
--     V4 510 · V5 1,132 · V6 1,241 · V7 465  (csat_dcp_items 실측)
--
-- 원인은 재고가 아니라 **권한**이었다. `csat_dcp_items` 의 RLS 정책은 `dcp_admin [ALL]`
-- 하나뿐이라 학습자·비로그인 조회가 **빈 배열**을 받는다. 화면은 그것을 '재료 없음' 으로
-- 인쇄했다 — 문항 1,241개를 가진 계단이 '근간 예정' 으로 보였다.
-- (화면 쪽은 이미 고쳤다: 못 잰 것을 0 으로 적지 않고 '재고 확인 중' 으로 구별한다.
--  하지만 그건 정직해진 것일 뿐, 서가는 여전히 제 일을 못 한다.)
--
-- ── 무엇을 여는가 ───────────────────────────────────────────────────
-- **집계만 연다.** 유형×V레벨별 개수뿐이고 지문·선지·정답은 나가지 않는다.
-- 그래서 정책을 푸는 대신 `SECURITY DEFINER` 함수 하나를 둔다 — 테이블을 열면
-- 문항 본문까지 열리고, 그건 교재의 상품성 자체를 훼손한다.
--
-- 되돌리기: `DROP FUNCTION public.textbook_shelf_inventory();` 하나면 된다.
--          테이블 정책은 건드리지 않으므로 원상태가 그대로 남는다.

CREATE OR REPLACE FUNCTION public.textbook_shelf_inventory()
 RETURNS TABLE (item_type text, v_level integer, item_count bigint)
 LANGUAGE sql
 SECURITY DEFINER
 STABLE
 SET search_path TO 'public'
AS $function$
  -- 집계만. 본문 컬럼은 어떤 경우에도 선택하지 않는다.
  SELECT i.type::text AS item_type,
         i.v_level    AS v_level,
         count(*)     AS item_count
    FROM csat_dcp_items i
   WHERE i.v_level IS NOT NULL
   GROUP BY 1, 2;
$function$;

COMMENT ON FUNCTION public.textbook_shelf_inventory() IS
  '교재 서가 재고(유형×V레벨 개수)만 노출. 문항 본문 비공개 — 테이블 정책은 admin 전용 유지(20260821120000).';

-- 서가는 공개 표면이다(발견·SEO — apps/web/CLAUDE.md 공개 표면 표).
GRANT EXECUTE ON FUNCTION public.textbook_shelf_inventory() TO anon, authenticated;
