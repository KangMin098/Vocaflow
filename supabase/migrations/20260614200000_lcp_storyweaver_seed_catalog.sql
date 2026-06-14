-- supabase/migrations/20260614200000_lcp_storyweaver_seed_catalog.sql
-- LCP — StoryWeaver 를 "소스 GET (대량)" (BulkFetch → library_seed_catalog) 에 추가.
--
-- BulkFetchTab → /api/admin/library/fetch-seed-batch → storyweaver fetcher(books-search API)
--   → library_seed_catalog UPSERT. source CHECK 제약에 storyweaver 추가 필요.
--   (library_books 제약은 20260614190000 에서 이미 확장됨 — enqueue 경로용.)

ALTER TABLE public.library_seed_catalog DROP CONSTRAINT IF EXISTS library_seed_catalog_source_check;
ALTER TABLE public.library_seed_catalog ADD CONSTRAINT library_seed_catalog_source_check
  CHECK (source = ANY (ARRAY[
    'gutenberg','standard_ebooks','wikibooks','librivox','openstax',
    'simple_wikipedia','lit2go','storyweaver'
  ]::text[]));
