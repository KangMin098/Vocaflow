-- supabase/migrations/20260817061500_acp_compose_feeds.sql
--
-- ACP §20 — 재저작 수집 피드 등록부.
--
-- 발행사별 어댑터를 만들지 않는다 — compose/news-feed.ts 가 표준 RSS/Atom 범용 수집기다.
-- 발행사마다 달라지는 것은 **피드 주소뿐**이고, 그건 코드가 아니라 운영자가 등록한다.
-- (코드에 박으면 발행사가 주소를 바꿀 때마다 배포가 필요하고, 무엇을 긁고 있는지
--  운영자가 화면에서 볼 수 없다.)
--
-- 수집이 실제로 일어나려면 세 가지가 모두 있어야 한다:
--   ① 운영자 승인 (FACT_SOURCES[].access.termsReviewed)
--   ② 등록된 피드 + enabled=true (이 표)
--   ③ 매 수집 시 robots 통과 (compose/access.ts CrawlGate)

BEGIN;

CREATE TABLE IF NOT EXISTS public.article_compose_feeds (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- FACT_SOURCES 키 (reuters·ap·bbc·dw·koreaherald·voa …)
  source_key    text NOT NULL,
  url           text NOT NULL UNIQUE,
  label         text NOT NULL,
  enabled       boolean NOT NULL DEFAULT false,
  -- 마지막 robots 확인 결과 — 'ok' | 'absent' | 'failed'
  robots_status text CHECK (robots_status IN ('ok','absent','failed')),
  robots_at     timestamptz,
  last_polled_at timestamptz,
  -- 마지막 수집에서 발견한 후보 수 / 건너뛴 사유 (운영 화면 표시)
  last_found    integer,
  last_note     text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compose_feeds_source ON public.article_compose_feeds(source_key);

COMMENT ON TABLE public.article_compose_feeds IS
  'ACP §20 — 재저작 수집 피드. 주소는 코드가 아니라 여기서 온다. enabled 기본 false — 등록만으로 수집이 시작되지 않는다.';
COMMENT ON COLUMN public.article_compose_feeds.robots_status IS
  'failed 면 그 실행에서 해당 호스트를 통째로 건너뛴다. 확인하지 못한 것을 허용으로 해석하지 않는다.';

DROP TRIGGER IF EXISTS trg_acf_set_updated_at ON public.article_compose_feeds;
CREATE TRIGGER trg_acf_set_updated_at
  BEFORE UPDATE ON public.article_compose_feeds
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.article_compose_feeds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS compose_feeds_admin_all ON public.article_compose_feeds;
CREATE POLICY compose_feeds_admin_all ON public.article_compose_feeds
  FOR ALL TO authenticated USING (is_admin_or_curator()) WITH CHECK (is_admin_or_curator());

COMMIT;
