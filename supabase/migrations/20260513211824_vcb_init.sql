-- VCB (Vocabulary Corpus Builder) — P0 init
-- 8 tables + RLS + indexes + ENUMs
-- 정합: CLAUDE.md §19.3

-- ── ENUMs ─────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE vcb_run_status AS ENUM (
    'created', 'ingesting', 'normalized', 'extracted',
    'looked_up', 'enriching', 'qa', 'curating', 'publishing', 'published', 'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE vcb_queue_status AS ENUM (
    'pending', 'exported', 'enriched', 'enriched_flagged', 'failed', 'skipped'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE vcb_license_tier AS ENUM ('T1', 'T2', 'T3');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 1. vocab_sources ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.vocab_sources (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('frequency_list', 'corpus', 'dictionary', 'curated_list')),
  license_tier vcb_license_tier NOT NULL,
  citation TEXT NOT NULL,
  url TEXT,
  language TEXT DEFAULT 'en',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── 2. vocab_runs ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vocab_runs (
  id BIGSERIAL PRIMARY KEY,
  collection_slug TEXT NOT NULL,
  collection_title TEXT NOT NULL,
  status vcb_run_status NOT NULL DEFAULT 'created',
  config JSONB NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vocab_runs_status ON public.vocab_runs(status);
CREATE INDEX IF NOT EXISTS idx_vocab_runs_collection ON public.vocab_runs(collection_slug);

-- ── 3. vocab_raw_texts ────────────────────────────
CREATE TABLE IF NOT EXISTS public.vocab_raw_texts (
  id BIGSERIAL PRIMARY KEY,
  run_id BIGINT NOT NULL REFERENCES public.vocab_runs(id) ON DELETE CASCADE,
  source_id BIGINT REFERENCES public.vocab_sources(id) ON DELETE SET NULL,
  external_ref TEXT,
  content_hash TEXT NOT NULL,
  content_bytes INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (run_id, content_hash)
);
CREATE INDEX IF NOT EXISTS idx_vocab_raw_run ON public.vocab_raw_texts(run_id);

-- ── 4. vocab_seed_candidates ──────────────────────
CREATE TABLE IF NOT EXISTS public.vocab_seed_candidates (
  id BIGSERIAL PRIMARY KEY,
  run_id BIGINT NOT NULL REFERENCES public.vocab_runs(id) ON DELETE CASCADE,
  lemma TEXT NOT NULL,
  pos TEXT NOT NULL,
  raw_count INT NOT NULL CHECK (raw_count > 0),
  normalized_freq NUMERIC(8,3),
  rank_in_run INT,
  context_samples TEXT[] DEFAULT '{}'
    CHECK (
      array_length(context_samples, 1) IS NULL
      OR array_length(context_samples, 1) <= 3
    ),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (run_id, lemma, pos)
);
CREATE INDEX IF NOT EXISTS idx_vocab_seed_run_rank ON public.vocab_seed_candidates(run_id, rank_in_run);

-- ── 5. vocab_dict_hits ────────────────────────────
CREATE TABLE IF NOT EXISTS public.vocab_dict_hits (
  id BIGSERIAL PRIMARY KEY,
  seed_id BIGINT NOT NULL REFERENCES public.vocab_seed_candidates(id) ON DELETE CASCADE,
  hit_level TEXT NOT NULL CHECK (hit_level IN ('full', 'partial', 'miss')),
  source_table TEXT,
  existing_payload JSONB,
  missing_fields TEXT[],
  checked_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (seed_id)
);

-- ── 6. vocab_enrichment_queue ─────────────────────
CREATE TABLE IF NOT EXISTS public.vocab_enrichment_queue (
  id BIGSERIAL PRIMARY KEY,
  seed_id BIGINT NOT NULL REFERENCES public.vocab_seed_candidates(id) ON DELETE CASCADE,
  status vcb_queue_status NOT NULL DEFAULT 'pending',
  hit_level TEXT,
  missing_fields TEXT[],
  exported_job_file TEXT,
  enriched_job_file TEXT,
  exported_at TIMESTAMPTZ,
  enriched_at TIMESTAMPTZ,
  enriched_payload JSONB,
  qa_flags TEXT[] DEFAULT '{}',
  retry_count INT DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (seed_id)
);
CREATE INDEX IF NOT EXISTS idx_vcb_queue_status ON public.vocab_enrichment_queue(status);
CREATE INDEX IF NOT EXISTS idx_vcb_queue_export_file ON public.vocab_enrichment_queue(exported_job_file);

-- ── 7. vocab_curation_decisions ───────────────────
CREATE TABLE IF NOT EXISTS public.vocab_curation_decisions (
  id BIGSERIAL PRIMARY KEY,
  queue_id BIGINT NOT NULL REFERENCES public.vocab_enrichment_queue(id) ON DELETE CASCADE,
  decision TEXT NOT NULL CHECK (decision IN ('approve', 'reject', 'edit', 'reenrich')),
  edited_payload JSONB,
  note TEXT,
  decided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vcb_curation_queue ON public.vocab_curation_decisions(queue_id);

-- ── 8. vocab_collections ──────────────────────────
CREATE TABLE IF NOT EXISTS public.vocab_collections (
  id BIGSERIAL PRIMARY KEY,
  run_id BIGINT NOT NULL REFERENCES public.vocab_runs(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  published_word_count INT NOT NULL,
  shared_word_set_id UUID REFERENCES public.shared_word_sets(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT,
  UNIQUE (slug, version)
);
CREATE INDEX IF NOT EXISTS idx_vcb_collections_run ON public.vocab_collections(run_id);

-- ── updated_at 트리거 ─────────────────────────────
DROP TRIGGER IF EXISTS trg_vocab_runs_updated ON public.vocab_runs;
CREATE TRIGGER trg_vocab_runs_updated
  BEFORE UPDATE ON public.vocab_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_vcb_queue_updated ON public.vocab_enrichment_queue;
CREATE TRIGGER trg_vcb_queue_updated
  BEFORE UPDATE ON public.vocab_enrichment_queue
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ───────────────────────────────────────────
ALTER TABLE public.vocab_sources              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vocab_runs                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vocab_raw_texts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vocab_seed_candidates      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vocab_dict_hits            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vocab_enrichment_queue     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vocab_curation_decisions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vocab_collections          ENABLE ROW LEVEL SECURITY;

-- admin/curator 전용 정책 8건
DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'vocab_sources','vocab_runs','vocab_raw_texts','vocab_seed_candidates',
    'vocab_dict_hits','vocab_enrichment_queue','vocab_curation_decisions','vocab_collections'
  ]
  LOOP
    EXECUTE format($f$
      DROP POLICY IF EXISTS "admin_curator_all" ON public.%I;
      CREATE POLICY "admin_curator_all" ON public.%I FOR ALL
        USING (
          EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid()
              AND role IN ('admin','curator')
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE user_id = auth.uid()
              AND role IN ('admin','curator')
          )
        );
    $f$, t, t);
  END LOOP;
END $$;
