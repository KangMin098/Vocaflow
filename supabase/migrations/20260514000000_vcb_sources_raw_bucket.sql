-- VCB Method A — Storage 버킷 + RLS 정책
-- 의존: vcb_init (vocab_raw_texts.external_ref 가 이 버킷의 storage key)
-- 정합: CLAUDE.md §19.4 Step 2 (Ingest) + scripts/vcb/01-ingest.ts readFromStorage()

-- ─── 1. 버킷 생성 ──────────────────────────────
-- private 버킷 (public=false) — admin/curator 만 접근.
-- file_size_limit: 50MB (대용량 코퍼스 대비)
-- allowed_mime_types: text/csv, text/plain, text/tab-separated-values

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vocab-sources-raw',
  'vocab-sources-raw',
  false,
  52428800,                                              -- 50 MB
  ARRAY['text/csv', 'text/plain', 'text/tab-separated-values', 'application/octet-stream']
)
ON CONFLICT (id) DO NOTHING;

-- ─── 2. RLS 정책 — admin/curator FOR ALL ─────────
-- storage.objects 의 RLS 는 이미 활성화되어 있음.
-- 4개 operation 별 정책 분리 (Supabase Storage 표준 패턴).

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'storage.objects'::regclass
      AND polname = 'vocab_sources_raw_admin_curator_select'
  ) THEN
    CREATE POLICY "vocab_sources_raw_admin_curator_select" ON storage.objects
      FOR SELECT
      USING (
        bucket_id = 'vocab-sources-raw'
        AND EXISTS (
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
    WHERE polrelid = 'storage.objects'::regclass
      AND polname = 'vocab_sources_raw_admin_curator_insert'
  ) THEN
    CREATE POLICY "vocab_sources_raw_admin_curator_insert" ON storage.objects
      FOR INSERT
      WITH CHECK (
        bucket_id = 'vocab-sources-raw'
        AND EXISTS (
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
    WHERE polrelid = 'storage.objects'::regclass
      AND polname = 'vocab_sources_raw_admin_curator_update'
  ) THEN
    CREATE POLICY "vocab_sources_raw_admin_curator_update" ON storage.objects
      FOR UPDATE
      USING (
        bucket_id = 'vocab-sources-raw'
        AND EXISTS (
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
    WHERE polrelid = 'storage.objects'::regclass
      AND polname = 'vocab_sources_raw_admin_curator_delete'
  ) THEN
    CREATE POLICY "vocab_sources_raw_admin_curator_delete" ON storage.objects
      FOR DELETE
      USING (
        bucket_id = 'vocab-sources-raw'
        AND EXISTS (
          SELECT 1 FROM public.user_profiles
          WHERE user_id = auth.uid()
            AND role IN ('admin','curator')
        )
      );
  END IF;
END $$;
