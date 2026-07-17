-- library_article_seed_catalog source CHECK +owid/factbook/elife
-- 대량 GET(BulkArticlesTab)의 seed 영속화(새로고침 보존)를 신규 소스로 확장.
ALTER TABLE library_article_seed_catalog DROP CONSTRAINT library_article_seed_catalog_source_check;
ALTER TABLE library_article_seed_catalog
  ADD CONSTRAINT library_article_seed_catalog_source_check
  CHECK (source = ANY (ARRAY[
    'voa','nasa','nih','manual','wikinews','the_conversation','simple_wikipedia',
    'owid','factbook','elife'
  ]));
