-- supabase/migrations/20260817055500_acp_compose_source_access_record.sql
--
-- ACP §20 — 수집 근거를 기록으로 남긴다.
--
-- 상업 뉴스를 사실의 증인으로 읽는 것은 저작권 문제가 아니지만(사실에는 저작권이 없다),
-- 남의 서버에서 읽어 오는 절차(robots·간격·본문 비보관)는 **지켰다고 말하는 것과
-- 지킨 기록이 있는 것이 다르다**. 나중에 "어떤 근거로 저 페이지를 읽었나" 를 물었을 때
-- 답할 수 있어야 한다.
--
-- TS 측 정본은 compose/access.ts(CrawlGate · readForFacts) · compose/sources.ts(AccessPolicy).

BEGIN;

ALTER TABLE public.article_compose_sources
  ADD COLUMN IF NOT EXISTS access_basis text NOT NULL DEFAULT 'publisher-feed'
    CHECK (access_basis IN ('public-api','publisher-feed','page-fetch')),
  ADD COLUMN IF NOT EXISTS robots_checked_at timestamptz,
  -- 취재 계통 (통신사). NULL = 자체 취재. 같은 계통은 독립 출처로 세지 않는다.
  ADD COLUMN IF NOT EXISTS wire text;

-- 일반 페이지 조회는 robots 확인 기록이 없으면 행 자체가 들어가지 못한다.
ALTER TABLE public.article_compose_sources DROP CONSTRAINT IF EXISTS chk_compose_source_robots;
ALTER TABLE public.article_compose_sources ADD CONSTRAINT chk_compose_source_robots CHECK (
  access_basis <> 'page-fetch' OR robots_checked_at IS NOT NULL
);

COMMENT ON COLUMN public.article_compose_sources.access_basis IS
  'ACP §20 — 무엇을 통해 읽었나. page-fetch 는 robots_checked_at 이 없으면 INSERT 가 막힌다.';
COMMENT ON COLUMN public.article_compose_sources.wire IS
  'ACP §20 — 취재 계통(통신사). 같은 계통은 I12 독립 출처로 세지 않는다. NULL=자체 취재.';

-- 취재 묶음의 독립 계통 수 — I12 판정의 DB 측 근거.
CREATE OR REPLACE FUNCTION public.acp_batch_independent_lines(p_batch_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT count(DISTINCT COALESCE(wire, lower(publisher)))::int
  FROM public.article_compose_sources
  WHERE batch_id = p_batch_id;
$function$;

COMMENT ON FUNCTION public.acp_batch_independent_lines(uuid) IS
  'ACP §20 — 취재 묶음의 독립 계통 수. 발행사가 달라도 wire 가 같으면 하나로 센다.';

REVOKE EXECUTE ON FUNCTION public.acp_batch_independent_lines(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acp_batch_independent_lines(uuid) TO authenticated, service_role;

COMMIT;
