-- VCB §19.4b — Method B (AI-generated seed) 지원
-- 의존: vcb_init 선행 적용 완료

-- 1. vocab_sources.kind 확장: 'ai_generated' 추가
ALTER TABLE public.vocab_sources
  DROP CONSTRAINT IF EXISTS vocab_sources_kind_check;

ALTER TABLE public.vocab_sources
  ADD CONSTRAINT vocab_sources_kind_check
  CHECK (kind IN (
    'frequency_list',
    'corpus',
    'dictionary',
    'curated_list',
    'ai_generated'
  ));

-- 2. vocab_seed_candidates.seed_origin 추가
ALTER TABLE public.vocab_seed_candidates
  ADD COLUMN IF NOT EXISTS seed_origin TEXT NOT NULL DEFAULT 'extracted'
    CHECK (seed_origin IN ('extracted', 'ai_generated', 'manual'));

CREATE INDEX IF NOT EXISTS idx_vocab_seed_origin
  ON public.vocab_seed_candidates(run_id, seed_origin);

-- 3. ai_generated source 의 license_tier 가드 (T1 강제)
CREATE OR REPLACE FUNCTION public.guard_ai_generated_license()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.kind = 'ai_generated' AND NEW.license_tier <> 'T1' THEN
    RAISE EXCEPTION 'ai_generated source must have license_tier = T1 (got %)', NEW.license_tier;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vocab_sources_ai_license ON public.vocab_sources;
CREATE TRIGGER trg_vocab_sources_ai_license
  BEFORE INSERT OR UPDATE ON public.vocab_sources
  FOR EACH ROW EXECUTE FUNCTION public.guard_ai_generated_license();
