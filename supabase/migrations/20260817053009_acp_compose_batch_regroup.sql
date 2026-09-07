-- supabase/migrations/20260817053009_acp_compose_batch_regroup.sql
--
-- ACP §20 — 사실 원장을 아티클이 아니라 "취재 묶음(batch)" 에 매단다.
--
-- 왜: 수집·교차확인이 이 파이프라인에서 가장 비싼 단계인데, 사실 원장 하나로
--   A2판·B1판을 함께 뽑으면 그 비용을 두 번 쓴다(News in Levels 3단계 모델).
--   학습 설계로도 옳다 — 같은 내용을 두 난이도로 읽는 것이 i+1 사다리가 된다.
--   원장이 article_id 에 1:1 로 묶여 있으면 이게 불가능하다.
--
--   커버리지 매트릭스 관점에서도 다르다: 한 칸이 아니라 **한 열(같은 register 의
--   A2·B1·B2)** 을 한 번의 취재로 채우게 된다.
--
-- 4테이블 전부 0행 상태에서 재구성 (데이터 이관 없음).

BEGIN;

CREATE TABLE IF NOT EXISTS public.article_compose_batches (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 사람이 읽는 사건/주제명 (예: "2026-08 캘리포니아 중부 지진")
  topic             text NOT NULL,
  -- I15 발행 지연의 재료. 사건이 아닌 주제글이면 NULL.
  event_occurred_at timestamptz,
  status            text NOT NULL DEFAULT 'collecting'
    CHECK (status IN ('collecting','ledger_ready','composing','done','abandoned')),
  created_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.article_compose_batches IS
  'ACP §20 — 취재 묶음. 사실 원장 1개 → 난이도별 아티클 N개. 수집 비용을 여러 판이 나눠 쓴다.';

DROP TRIGGER IF EXISTS trg_acb_set_updated_at ON public.article_compose_batches;
CREATE TRIGGER trg_acb_set_updated_at
  BEFORE UPDATE ON public.article_compose_batches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 소스·사실을 batch 소속으로 이동
ALTER TABLE public.article_compose_sources
  DROP CONSTRAINT IF EXISTS uq_compose_source_url,
  DROP COLUMN IF EXISTS article_id,
  ADD COLUMN IF NOT EXISTS batch_id uuid NOT NULL
    REFERENCES public.article_compose_batches(id) ON DELETE CASCADE;
ALTER TABLE public.article_compose_sources
  ADD CONSTRAINT uq_compose_source_url UNIQUE (batch_id, url);
DROP INDEX IF EXISTS public.idx_compose_sources_article;
CREATE INDEX IF NOT EXISTS idx_compose_sources_batch ON public.article_compose_sources(batch_id);

ALTER TABLE public.article_fact_ledger
  DROP COLUMN IF EXISTS article_id,
  ADD COLUMN IF NOT EXISTS batch_id uuid NOT NULL
    REFERENCES public.article_compose_batches(id) ON DELETE CASCADE;
DROP INDEX IF EXISTS public.idx_fact_ledger_article;
CREATE INDEX IF NOT EXISTS idx_fact_ledger_batch ON public.article_fact_ledger(batch_id);

-- 아티클 → 자기가 나온 취재 묶음
ALTER TABLE public.library_articles
  ADD COLUMN IF NOT EXISTS compose_batch_id uuid
    REFERENCES public.article_compose_batches(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_la_compose_batch ON public.library_articles(compose_batch_id)
  WHERE compose_batch_id IS NOT NULL;

COMMENT ON COLUMN public.library_articles.compose_batch_id IS
  'ACP §20 — 이 아티클이 나온 취재 묶음. 같은 batch 의 형제 = 같은 사실의 다른 난이도 판.';

-- 재저작 아티클은 반드시 취재 묶음과 발주서를 갖는다 (원장 없는 자체 저작 차단).
ALTER TABLE public.library_articles DROP CONSTRAINT IF EXISTS chk_original_needs_batch;
ALTER TABLE public.library_articles ADD CONSTRAINT chk_original_needs_batch CHECK (
  source <> 'original' OR (compose_batch_id IS NOT NULL AND composed_spec IS NOT NULL)
);

ALTER TABLE public.article_compose_batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS compose_batches_admin_all ON public.article_compose_batches;
CREATE POLICY compose_batches_admin_all ON public.article_compose_batches
  FOR ALL TO authenticated USING (is_admin_or_curator()) WITH CHECK (is_admin_or_curator());

COMMIT;
