-- library_articles + seed_catalog source CHECK 에 'plos' 추가 (ACP §18 — PLOS 오픈 학술)
ALTER TABLE library_articles DROP CONSTRAINT library_articles_source_check;
ALTER TABLE library_articles
  ADD CONSTRAINT library_articles_source_check
  CHECK (source = ANY (ARRAY[
    'voa','nasa','nih','manual','cdc','medlineplus',
    'wikinews','the_conversation','simple_wikipedia','owid','factbook','elife','wikipedia','plos'
  ]));

ALTER TABLE library_article_seed_catalog DROP CONSTRAINT library_article_seed_catalog_source_check;
ALTER TABLE library_article_seed_catalog
  ADD CONSTRAINT library_article_seed_catalog_source_check
  CHECK (source = ANY (ARRAY[
    'voa','nasa','nih','manual','wikinews','the_conversation','simple_wikipedia',
    'owid','factbook','elife','wikipedia','plos'
  ]));
