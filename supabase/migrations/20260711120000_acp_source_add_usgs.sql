-- library_articles + seed_catalog source CHECK 에 'usgs' 추가 (ACP §18 — USGS 지구과학·자연재해)
ALTER TABLE library_articles DROP CONSTRAINT library_articles_source_check;
ALTER TABLE library_articles
  ADD CONSTRAINT library_articles_source_check
  CHECK (source = ANY (ARRAY[
    'voa','nasa','nih','manual','cdc','medlineplus',
    'wikinews','the_conversation','simple_wikipedia','owid','factbook','elife','wikipedia','plos','wikivoyage','usgs'
  ]));

ALTER TABLE library_article_seed_catalog DROP CONSTRAINT library_article_seed_catalog_source_check;
ALTER TABLE library_article_seed_catalog
  ADD CONSTRAINT library_article_seed_catalog_source_check
  CHECK (source = ANY (ARRAY[
    'voa','nasa','nih','manual','wikinews','the_conversation','simple_wikipedia',
    'owid','factbook','elife','wikipedia','plos','wikivoyage','usgs'
  ]));
