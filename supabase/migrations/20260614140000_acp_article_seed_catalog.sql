-- supabase/migrations/20260614140000_acp_article_seed_catalog.sql
-- v06.46 — ACP article seed catalog (LCP library_seed_catalog 동형)
--
-- LCP 와 동일 패턴:
--   RSS GET → library_article_seed_catalog 영구 보존 → enqueue 시 library_articles 로
--   imported_to_articles 플래그로 LCP 의 imported_to_books 패턴 그대로

BEGIN;

CREATE TABLE IF NOT EXISTS library_article_seed_catalog (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  source                TEXT NOT NULL CHECK (source IN ('voa','nasa','nih','arxiv','manual')),
  source_id             TEXT NOT NULL,

  feed_id               TEXT,
  feed_label            TEXT,
  title                 TEXT NOT NULL,
  author                TEXT,
  source_url            TEXT,
  published_at          TIMESTAMPTZ,
  description           TEXT,
  language              TEXT DEFAULT 'en',

  score_total           REAL,
  score_recency         REAL,
  score_source          REAL,
  score_length          REAL,
  score_level           REAL,
  has_audio             BOOLEAN DEFAULT FALSE,

  fetched_at            TIMESTAMPTZ DEFAULT now(),
  imported_to_articles  BOOLEAN DEFAULT FALSE,
  imported_article_id   UUID REFERENCES library_articles(id) ON DELETE SET NULL,
  imported_at           TIMESTAMPTZ,

  curation_meta         JSONB DEFAULT '{}'::jsonb,
  curation_status       TEXT NOT NULL DEFAULT 'pending'
                        CHECK (curation_status IN ('pending','enqueued','published','rejected','hidden')),

  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),

  UNIQUE (source, source_id)
);

CREATE INDEX IF NOT EXISTS idx_article_seed_source ON library_article_seed_catalog(source);
CREATE INDEX IF NOT EXISTS idx_article_seed_feed ON library_article_seed_catalog(source, feed_id);
CREATE INDEX IF NOT EXISTS idx_article_seed_status ON library_article_seed_catalog(curation_status);
CREATE INDEX IF NOT EXISTS idx_article_seed_fetched ON library_article_seed_catalog(fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_article_seed_score ON library_article_seed_catalog(score_total DESC);

CREATE OR REPLACE FUNCTION public.article_seed_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_article_seed_updated_at ON library_article_seed_catalog;
CREATE TRIGGER trg_article_seed_updated_at
  BEFORE UPDATE ON library_article_seed_catalog
  FOR EACH ROW EXECUTE FUNCTION public.article_seed_set_updated_at();

ALTER TABLE library_article_seed_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS article_seed_admin_all ON library_article_seed_catalog;
CREATE POLICY article_seed_admin_all ON library_article_seed_catalog
  FOR ALL TO authenticated
  USING (is_admin_or_curator())
  WITH CHECK (is_admin_or_curator());

COMMENT ON TABLE library_article_seed_catalog IS
  'ACP article RSS GET 결과 영구 보존. LCP library_seed_catalog 동형. RSS fetch → seed → enqueue (library_articles) 단계 분리.';

COMMIT;
