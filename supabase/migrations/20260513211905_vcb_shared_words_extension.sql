-- VCB §19.8 — shared_words 확장 + shared_word_sets 확장 + admin/curator RLS
-- 의존: vcb_init + 기존 shared_words 9 컬럼 존재
-- 패턴: ALTER ADD IF NOT EXISTS + DO $$ guard

-- ─── 1. shared_words 확장 컬럼 ───
ALTER TABLE public.shared_words
  ADD COLUMN IF NOT EXISTS ipa TEXT,
  ADD COLUMN IF NOT EXISTS definitions_ko_full JSONB,
  ADD COLUMN IF NOT EXISTS definitions_en_full JSONB,
  ADD COLUMN IF NOT EXISTS examples_full JSONB,
  ADD COLUMN IF NOT EXISTS synonyms TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS antonyms TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS collocations TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS korean_learner_note TEXT,
  ADD COLUMN IF NOT EXISTS confidence NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS source_run_id BIGINT REFERENCES public.vocab_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_queue_id BIGINT REFERENCES public.vocab_enrichment_queue(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- cefr_level CHECK
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.shared_words'::regclass
      AND conname = 'shared_words_cefr_level_check'
  ) THEN
    ALTER TABLE public.shared_words
      ADD CONSTRAINT shared_words_cefr_level_check
      CHECK (cefr_level IS NULL OR cefr_level IN ('A1','A2','B1','B2','C1','C2'));
  END IF;
END $$;

-- UNIQUE (set_id, word, part_of_speech)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.shared_words'::regclass
      AND conname = 'shared_words_set_word_pos_unique'
  ) THEN
    ALTER TABLE public.shared_words
      ADD CONSTRAINT shared_words_set_word_pos_unique
      UNIQUE (set_id, word, part_of_speech);
  END IF;
END $$;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_shared_words_set_v2 ON public.shared_words(set_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_shared_words_word ON public.shared_words(word);
CREATE INDEX IF NOT EXISTS idx_shared_words_cefr ON public.shared_words(cefr_level);
CREATE INDEX IF NOT EXISTS idx_shared_words_word_pos ON public.shared_words(word, part_of_speech);
CREATE INDEX IF NOT EXISTS idx_shared_words_source_run ON public.shared_words(source_run_id);

-- ─── 2. shared_word_sets 확장 ───
ALTER TABLE public.shared_word_sets
  ADD COLUMN IF NOT EXISTS source_run_id BIGINT REFERENCES public.vocab_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_version_id UUID REFERENCES public.shared_word_sets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_attributions JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS slug TEXT;

-- slug NOT NULL 안전 적용
DO $$
DECLARE
  has_null_slug BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.shared_word_sets WHERE slug IS NULL) INTO has_null_slug;
  IF NOT has_null_slug THEN
    ALTER TABLE public.shared_word_sets ALTER COLUMN slug SET NOT NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_shared_word_sets_slug_version
  ON public.shared_word_sets(slug, version);
CREATE INDEX IF NOT EXISTS idx_shared_word_sets_published_v2
  ON public.shared_word_sets(is_published, category);

-- ─── 3. admin/curator FOR ALL 정책 추가 ───
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'public.shared_word_sets'::regclass
      AND polname = 'admin_curator_all_shared_word_sets'
  ) THEN
    CREATE POLICY "admin_curator_all_shared_word_sets" ON public.shared_word_sets
      FOR ALL
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
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'public.shared_words'::regclass
      AND polname = 'admin_curator_all_shared_words'
  ) THEN
    CREATE POLICY "admin_curator_all_shared_words" ON public.shared_words
      FOR ALL
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
  END IF;
END $$;
