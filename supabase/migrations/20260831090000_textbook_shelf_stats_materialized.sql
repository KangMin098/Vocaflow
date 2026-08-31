-- 20260831090000_textbook_shelf_stats_materialized.sql
--
-- **공개 카탈로그가 19만 행을 세는 것을 그만둔다.**
--
-- ── 왜 인덱스와 VACUUM 만으로는 부족했나 ────────────────────────────────
-- `20260830170000`(부분 인덱스) + `20260830180000`(autovacuum insert 임계값)으로
-- 서가 집계를 3,533ms → 274ms 로 줄였고, 드레인 5.3만 행이 들어온 뒤에도 autovacuum 이
-- 24초 만에 따라붙는 것을 실측했다. **드레인과 드레인 사이에는** 잘 동작한다.
--
-- 그런데 드레인이 **도는 동안**에는 다시 무너진다(실측 2026-08-31, 3회 연속):
--   textbook_shelf_inventory   3,384~4,548 ms  → statement timeout (anon 3s)
--   textbook_shelf_sources     3,072~3,665 ms  → statement timeout
-- 새로 들어온 페이지는 가시성 맵이 아직 비어 있어 힙을 읽어야 하고, 그 위에 드레인의
-- 쓰기 부하가 겹친다. 그 결과 **공개 서가가 다시 7권 중 6권을 '재고 확인 중' 으로** 인쇄했고,
-- 지문 출처 축은 통째로 사라졌다(`bySource` 가 빈 객체가 된다).
--
-- 근본 원인은 튜닝이 아니라 **설계**다 — 요청마다 19만 행을 세는 한, 재고가 늘수록 지는 싸움이다.
-- 실제로 이 표는 오늘 하루에만 140,754 → 198,132 로 늘었다.
--
-- ── 고치는 법: 집계를 미리 해 둔다 ─────────────────────────────────────
-- 집계 결과는 **114행**(유형×레벨)과 **65행**(레벨×출처)뿐이다. 미리 계산해 두면
-- 요청 경로는 재고 크기와 **무관**해진다.
--
-- ⚠️ 대신 값이 낡을 수 있다. 그래서 **갱신 시각을 함께 내보내고**, 화면이 "언제 센 값인지"
--    를 말할 수 있게 한다. 이 저장소가 0 과 '못 잼' 을 구별해 온 것과 같은 규칙이다 —
--    낡은 값을 지금 값인 척하지 않는다.
--
-- ⚠️ `REFRESH ... CONCURRENTLY` 는 읽는 쪽을 막지 않는다(그래서 UNIQUE 인덱스가 필수다).
--    비싼 스캔은 그대로 있지만 **요청 경로 밖**에서 돈다.
--
-- 되돌리기: cron.unschedule → DROP FUNCTION → DROP MATERIALIZED VIEW ×2 → DROP TABLE,
--           그리고 `20260822090000` 의 함수 본문을 복원. 원본 표는 건드리지 않는다.

-- ── 1. 재고 집계 ────────────────────────────────────────────────────────
-- ⚠️ 해설 보유 판정은 **키 존재가 아니라 비어 있지 않은 값**으로 한다.
--    드레인 규칙(CLAUDE.md §🤖)이 "빈 값을 넣지 않는다" 인 것과 같은 이유다 —
--    키만 있고 값이 빈 문항을 '해설 있음' 으로 세면 구멍이 영영 안 보인다.
--    JS 쪽 판정(`explanation_ko || rationale_ko`)과도 이렇게 해야 같은 수가 나온다.
CREATE MATERIALIZED VIEW public.textbook_shelf_inventory_mv AS
SELECT i.type::text AS item_type,
       i.v_level    AS v_level,
       count(*)     AS item_count,
       count(*) FILTER (
         WHERE COALESCE(
           NULLIF(i.answer_key->>'explanation_ko', ''),
           NULLIF(i.answer_key->>'rationale_ko', '')
         ) IS NOT NULL
       ) AS explained_count
  FROM public.csat_dcp_items i
 WHERE i.v_level IS NOT NULL
 GROUP BY 1, 2;

-- CONCURRENTLY 갱신에 필요하다(없으면 갱신이 읽기를 막는다).
CREATE UNIQUE INDEX textbook_shelf_inventory_mv_pk
  ON public.textbook_shelf_inventory_mv (item_type, v_level);

-- ── 2. 출처 집계 ────────────────────────────────────────────────────────
CREATE MATERIALIZED VIEW public.textbook_shelf_sources_mv AS
SELECT i.v_level,
       CASE
         WHEN i.kind = 'book' THEN 'book'
         ELSE COALESCE(NULLIF(split_part(la.source_id, ':', 1), ''), 'unknown')
       END      AS source_family,
       count(*) AS item_count
  FROM public.csat_dcp_items i
  LEFT JOIN public.library_articles la
         ON la.id = i.ref_id
        AND i.kind = 'article'
 WHERE i.v_level IS NOT NULL
 GROUP BY 1, 2;

CREATE UNIQUE INDEX textbook_shelf_sources_mv_pk
  ON public.textbook_shelf_sources_mv (v_level, source_family);

-- ── 3. 갱신 시각 ────────────────────────────────────────────────────────
-- 한 행짜리 표. `id` 를 true 로 고정해 두 행이 생길 수 없게 한다.
CREATE TABLE public.textbook_shelf_stats_meta (
  id           boolean     PRIMARY KEY DEFAULT true CHECK (id),
  refreshed_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.textbook_shelf_stats_meta (id) VALUES (true)
  ON CONFLICT (id) DO NOTHING;

-- ── 4. 갱신 함수 ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.refresh_textbook_shelf_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.textbook_shelf_inventory_mv;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.textbook_shelf_sources_mv;
  UPDATE public.textbook_shelf_stats_meta SET refreshed_at = now() WHERE id;
END;
$$;

-- ── 5. 읽기 RPC 를 집계표로 갈아끼운다 ──────────────────────────────────
-- ⚠️ 반환 컬럼이 늘어나므로 CREATE OR REPLACE 로는 안 되고 DROP 이 필요하다.
--    호출부(`shelf-query.ts`)는 item_type·v_level·item_count 만 읽으므로 컬럼이 늘어도 안전하다.
DROP FUNCTION IF EXISTS public.textbook_shelf_inventory();
CREATE FUNCTION public.textbook_shelf_inventory()
RETURNS TABLE(item_type text, v_level integer, item_count bigint, explained_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT item_type, v_level, item_count, explained_count
    FROM public.textbook_shelf_inventory_mv;
$$;

DROP FUNCTION IF EXISTS public.textbook_shelf_sources();
CREATE FUNCTION public.textbook_shelf_sources()
RETURNS TABLE(v_level integer, source_family text, item_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT v_level, source_family, item_count
    FROM public.textbook_shelf_sources_mv;
$$;

-- 화면이 "언제 센 값인지" 를 말할 수 있도록.
CREATE OR REPLACE FUNCTION public.textbook_shelf_refreshed_at()
RETURNS timestamptz
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT refreshed_at FROM public.textbook_shelf_stats_meta WHERE id;
$$;

-- ── 6. 노출 최소화 ──────────────────────────────────────────────────────
-- 집계 뷰 자체는 PostgREST 로 열지 않는다. 읽기는 위 SECURITY DEFINER RPC 로만.
REVOKE ALL ON public.textbook_shelf_inventory_mv FROM anon, authenticated;
REVOKE ALL ON public.textbook_shelf_sources_mv   FROM anon, authenticated;
REVOKE ALL ON public.textbook_shelf_stats_meta   FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.textbook_shelf_inventory()     TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.textbook_shelf_sources()       TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.textbook_shelf_refreshed_at()  TO anon, authenticated;

-- ── 7. 주기 갱신 ────────────────────────────────────────────────────────
-- 5분마다. 드레인 직후에는 import 스크립트가 `refresh_textbook_shelf_stats()` 를
-- 직접 불러 즉시 반영한다(5분을 기다리지 않는다).
SELECT cron.schedule(
  'refresh-textbook-shelf-stats',
  '*/5 * * * *',
  $cron$SELECT public.refresh_textbook_shelf_stats()$cron$
);

-- 첫 채움 — CONCURRENTLY 는 한 번은 일반 REFRESH 가 선행돼야 한다(생성 직후 MV 는 비어 있다).
REFRESH MATERIALIZED VIEW public.textbook_shelf_inventory_mv;
REFRESH MATERIALIZED VIEW public.textbook_shelf_sources_mv;
UPDATE public.textbook_shelf_stats_meta SET refreshed_at = now() WHERE id;
