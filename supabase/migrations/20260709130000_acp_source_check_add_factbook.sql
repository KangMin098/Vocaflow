-- library_articles.source CHECK 에 'factbook' 추가 (ACP §18 — CIA World Factbook reference ingester)
-- register(reference)·license_class(public_domain) CHECK 는 기존 값으로 factbook 통과 → 추가 변경 불요.
--   (chk_article_register 이미 'reference' 포함 · license_class 는 트리거 acp_classify_license 산정)
ALTER TABLE library_articles DROP CONSTRAINT library_articles_source_check;
ALTER TABLE library_articles
  ADD CONSTRAINT library_articles_source_check
  CHECK (source = ANY (ARRAY[
    'voa','nasa','nih','manual','cdc','medlineplus',
    'wikinews','the_conversation','simple_wikipedia','owid','factbook'
  ]));
