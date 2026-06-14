-- v06.69 — ACP 에서 arxiv 소스 영구 제거 (사용자 명시: 플랫폼 전체에서 삭제).
--
-- 사전 확인: library_articles 2 arxiv rows (vocabularies/word_sets/seed_catalog 연결 0).
-- 데이터 손실 위험 없음.

-- 1. 잔존 arxiv article 삭제 (CASCADE 로 vocabularies, SET NULL 로 seed unlock — 모두 0건)
DELETE FROM library_articles WHERE source = 'arxiv';

-- 2. CHECK constraint 에서 'arxiv' 제거
ALTER TABLE public.library_article_seed_catalog
  DROP CONSTRAINT IF EXISTS library_article_seed_catalog_source_check;
ALTER TABLE public.library_article_seed_catalog
  ADD CONSTRAINT library_article_seed_catalog_source_check CHECK (
    source = ANY (ARRAY[
      'voa', 'nasa', 'nih', 'manual',
      'wikinews', 'the_conversation', 'simple_wikipedia'
    ]::text[])
  );

ALTER TABLE public.library_articles
  DROP CONSTRAINT IF EXISTS library_articles_source_check;
ALTER TABLE public.library_articles
  ADD CONSTRAINT library_articles_source_check CHECK (
    source = ANY (ARRAY[
      'voa', 'nasa', 'nih', 'manual',
      'cdc', 'medlineplus',
      'wikinews', 'the_conversation', 'simple_wikipedia'
    ]::text[])
  );
