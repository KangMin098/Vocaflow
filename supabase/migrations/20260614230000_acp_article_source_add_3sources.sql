-- v06.66 — library_articles + library_article_seed_catalog CHECK constraint 에
-- wikinews / the_conversation / simple_wikipedia 추가.
--
-- 배경: ingester (ingestWikinewsArticle / ingestTheConversationArticle /
-- ingestSimpleWikipediaArticle) 는 v06.35 부터 존재했지만 SOURCE_SPECS / listFeed /
-- DB CHECK 미동기화로 대량 GET 불가했음. v06.66 에서 7종 모두 활성화.

ALTER TABLE public.library_article_seed_catalog
  DROP CONSTRAINT IF EXISTS library_article_seed_catalog_source_check;
ALTER TABLE public.library_article_seed_catalog
  ADD CONSTRAINT library_article_seed_catalog_source_check CHECK (
    source = ANY (ARRAY[
      'voa', 'nasa', 'nih', 'arxiv', 'manual',
      'wikinews', 'the_conversation', 'simple_wikipedia'
    ]::text[])
  );

ALTER TABLE public.library_articles
  DROP CONSTRAINT IF EXISTS library_articles_source_check;
ALTER TABLE public.library_articles
  ADD CONSTRAINT library_articles_source_check CHECK (
    source = ANY (ARRAY[
      'voa', 'nasa', 'nih', 'arxiv', 'manual',
      'cdc', 'medlineplus',
      'wikinews', 'the_conversation', 'simple_wikipedia'
    ]::text[])
  );
