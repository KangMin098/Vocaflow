-- library_books.source CHECK 에 'pressbooks' 추가 (T-2 α — OBP 동결 해제 retarget)
-- Pressbooks(opentextbc.ca 등) = CC-BY 서버렌더 HTML OA book → dependency-0 ingester(ingest/pressbooks.ts).
-- 기존 값 전부 보존 + 'pressbooks' 만 추가. seed_catalog/enqueue 는 후속(별도 dev 경로).
ALTER TABLE library_books DROP CONSTRAINT library_books_source_check;
ALTER TABLE library_books
  ADD CONSTRAINT library_books_source_check
  CHECK (source = ANY (ARRAY[
    'gutenberg','standard_ebooks','wikisource','wikibooks','simple_wikipedia',
    'openstax','open_library','hathitrust','voa_learning','librivox',
    'lit2go','storyweaver','pressbooks','manual'
  ]));
