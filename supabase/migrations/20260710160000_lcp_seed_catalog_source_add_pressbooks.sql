-- library_seed_catalog source CHECK +pressbooks (LCP 대량 GET — pressbooks 후보 enqueue)
ALTER TABLE library_seed_catalog DROP CONSTRAINT library_seed_catalog_source_check;
ALTER TABLE library_seed_catalog
  ADD CONSTRAINT library_seed_catalog_source_check
  CHECK (source = ANY (ARRAY[
    'gutenberg','standard_ebooks','wikibooks','librivox','openstax',
    'simple_wikipedia','lit2go','storyweaver','pressbooks'
  ]));
