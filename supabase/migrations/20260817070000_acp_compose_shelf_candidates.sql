-- supabase/migrations/20260817070000_acp_compose_shelf_candidates.sql
--
-- ACP §20 — I17(서가 중복) 대조군 조회.
--
-- 사실 출처 14곳 중 **9곳이 ACP 소스와 같다**. 그래서 같은 사건을 ACP 가 이미 본문으로
-- 발행해 뒀을 수 있고, 그걸 모르고 재저작하면 서가에 같은 내용이 두 편 생긴다.
-- I13(표현 독립성)은 외부 소스와만 대조하므로 이 경우를 보지 못한다.
--
-- drain 이 지문을 쓰기 전에 "이 사건으로 우리가 이미 낸 글" 을 찾아 shelf 로 넘겨야
-- I17 이 실제로 작동한다. 그 조회를 매번 손으로 짜면 조건이 갈리므로 RPC 로 고정한다.
--
-- ⚠ 여기서 나온 글을 gates 의 `sources` 에 넣으면 안 된다 — I12·I14 가 우리 글을 외부
--   취재로 오인한다. `shelf` 인자로만 넘긴다(compose/gates.ts shelfRecordFrom 참조).

BEGIN;

CREATE OR REPLACE FUNCTION public.acp_compose_shelf_candidates(p_batch_id uuid)
RETURNS TABLE (
  id uuid,
  title text,
  source text,
  content text,
  reason text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  -- ① 같은 취재 묶음의 형제 판 (같은 사실로 쓴 다른 난이도)
  SELECT a.id, a.title, a.source, a.content, 'sibling'::text
  FROM public.library_articles a
  WHERE a.compose_batch_id = p_batch_id
    AND a.status IN ('ready','published')
  UNION
  -- ② 이 묶음이 읽은 기사를 ACP 가 이미 본문으로 가져간 경우
  SELECT a.id, a.title, a.source, a.content, 'acp_same_url'::text
  FROM public.library_articles a
  WHERE a.status = 'published'
    AND a.source <> 'original'
    AND a.source_url IN (
      SELECT s.url FROM public.article_compose_sources s WHERE s.batch_id = p_batch_id
    );
$function$;

COMMENT ON FUNCTION public.acp_compose_shelf_candidates(uuid) IS
  'ACP §20 — I17 대조군. 같은 묶음의 형제 판 + 같은 URL 을 ACP 가 이미 가져간 글. drain 이 shelf 로 넘긴다.';

REVOKE EXECUTE ON FUNCTION public.acp_compose_shelf_candidates(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acp_compose_shelf_candidates(uuid) TO authenticated, service_role;

COMMIT;
