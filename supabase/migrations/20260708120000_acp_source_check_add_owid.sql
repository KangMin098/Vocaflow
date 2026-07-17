-- library_articles.source CHECK 에 'owid' 추가 (T-2 — OWID ingester enqueue enabler)
-- register(argumentative)·license_class(cc_by) CHECK 는 기존 값으로 owid 통과 → 추가 변경 불요.
ALTER TABLE library_articles DROP CONSTRAINT library_articles_source_check;
ALTER TABLE library_articles
  ADD CONSTRAINT library_articles_source_check
  CHECK (source = ANY (ARRAY[
    'voa','nasa','nih','manual','cdc','medlineplus',
    'wikinews','the_conversation','simple_wikipedia','owid'
  ]));
