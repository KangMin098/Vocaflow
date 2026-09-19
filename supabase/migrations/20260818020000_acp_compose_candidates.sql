-- supabase/migrations/20260818020000_acp_compose_candidates.sql
--
-- ACP §20 — 발견 후보 보관.
--
-- 왜 필요한가 (2026-08-18 실측): 뉴스 피드는 대개 **최근 1~2일치만** 싣는다. 그런데 I15 가
-- 사건 후 48시간을 요구하므로, 매 수집에서 거의 모든 항목이 "보류" 로 빠지고 발견 결과가
-- 사실상 0이 된다. 실측(BBC·Guardian·Al Jazeera·DW 4피드)에서 **보류 58 · 취재 대상 0** 이었다.
--
-- 보류분을 메모리에만 두면 다음 실행 때 그 기사는 이미 피드에서 내려가 영영 못 쓴다.
-- 그래서 후보를 저장한다 — **오늘 보류된 것이 이틀 뒤에 저절로 취재 대상이 된다.**
-- 이게 없으면 "수집을 눌러도 아무것도 안 나온다" 가 정상 동작이 되어 버린다.

BEGIN;

CREATE TABLE IF NOT EXISTS public.article_compose_candidates (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key   text NOT NULL,
  publisher    text NOT NULL,
  -- 취재 계통 — 같은 계통은 독립 출처로 세지 않는다.
  wire         text,
  title        text NOT NULL,
  url          text NOT NULL UNIQUE,
  published_at timestamptz NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  -- 취재로 넘어갔거나 사람이 버린 후보는 목록에서 빠진다.
  status       text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','used','dismissed')),
  batch_id     uuid REFERENCES public.article_compose_batches(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_compose_candidates_open
  ON public.article_compose_candidates(published_at DESC) WHERE status = 'open';

COMMENT ON TABLE public.article_compose_candidates IS
  'ACP §20 — 발견 후보 보관. 피드는 최근분만 싣고 I15 는 48시간을 요구해, 저장하지 않으면 보류분이 영영 사라진다.';

-- 오래된 미사용 후보 정리 — 30일이면 사건으로서 가치가 없다.
CREATE OR REPLACE FUNCTION public.acp_prune_compose_candidates(p_days integer DEFAULT 30)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH d AS (
    DELETE FROM public.article_compose_candidates
    WHERE status = 'open' AND published_at < now() - make_interval(days => p_days)
    RETURNING 1
  ) SELECT count(*)::int FROM d;
$function$;

REVOKE EXECUTE ON FUNCTION public.acp_prune_compose_candidates(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acp_prune_compose_candidates(integer) TO authenticated, service_role;

ALTER TABLE public.article_compose_candidates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS compose_candidates_admin_all ON public.article_compose_candidates;
CREATE POLICY compose_candidates_admin_all ON public.article_compose_candidates
  FOR ALL TO authenticated USING (is_admin_or_curator()) WITH CHECK (is_admin_or_curator());

COMMIT;
