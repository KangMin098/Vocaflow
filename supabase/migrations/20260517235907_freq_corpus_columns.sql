-- Frequency corpus integration — add multi-source frequency metadata to shared_dictionary.
--
-- New columns:
--   frequency_sources jsonb  — multi-corpus rank/band map (existing NGSL data migrated in)
--   frequency_band    text   — unified band label (top1k…top25k, phrase, compound, rare)
--   lemma_band        text   — lemma-family band ("1k"…"25k")
--   inflections       jsonb  — { forms: [{form, freq}, ...], source: '<key>' }

ALTER TABLE public.shared_dictionary
  ADD COLUMN IF NOT EXISTS frequency_sources JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS frequency_band    TEXT,
  ADD COLUMN IF NOT EXISTS lemma_band        TEXT,
  ADD COLUMN IF NOT EXISTS inflections       JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.shared_dictionary
  ADD CONSTRAINT shared_dictionary_frequency_band_check
  CHECK (frequency_band IS NULL OR frequency_band IN (
    'top1k','top2k','top3k','top5k','top10k','top15k','top20k','top25k',
    'beyond_25k','phrase','compound','rare'
  ));

ALTER TABLE public.shared_dictionary
  ADD CONSTRAINT shared_dictionary_lemma_band_check
  CHECK (lemma_band IS NULL OR lemma_band ~ '^[0-9]+k$');

CREATE INDEX IF NOT EXISTS idx_sd_frequency_band       ON public.shared_dictionary (frequency_band);
CREATE INDEX IF NOT EXISTS idx_sd_lemma_band           ON public.shared_dictionary (lemma_band);
CREATE INDEX IF NOT EXISTS idx_sd_frequency_sources_gin ON public.shared_dictionary USING gin (frequency_sources);
CREATE INDEX IF NOT EXISTS idx_sd_inflections_gin       ON public.shared_dictionary USING gin (inflections);

-- Backfill existing NGSL frequency_rank/ngsl_sfi into frequency_sources jsonb.
UPDATE public.shared_dictionary
SET frequency_sources = jsonb_build_object(
  'ngsl_1.2', jsonb_build_object(
    'rank', frequency_rank,
    'sfi',  ngsl_sfi
  )
)
WHERE frequency_rank IS NOT NULL
  AND (frequency_sources = '{}'::jsonb OR NOT (frequency_sources ? 'ngsl_1.2'));
