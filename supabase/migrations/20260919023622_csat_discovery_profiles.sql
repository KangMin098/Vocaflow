-- supabase/migrations/20260919023622_csat_discovery_profiles.sql
-- Requires explicit user approval. No article body, answer, publication or active flag is changed.
-- Preserve the live source allowlist rather than replacing it with a stale copy.
do $$
declare old_expression text;
begin
  select pg_get_expr(conbin, conrelid) into old_expression
  from pg_constraint
  where conrelid = 'public.library_articles'::regclass
    and conname = 'library_articles_source_check' and contype = 'c';
  if old_expression is null then raise exception 'Article source constraint missing'; end if;
  execute format('alter table public.library_articles add constraint library_articles_source_discovery_check check ((%s) or source = %L) not valid', old_expression, 'african_storybook');
  alter table public.library_articles validate constraint library_articles_source_discovery_check;
  alter table public.library_articles drop constraint library_articles_source_check;
  alter table public.library_articles rename constraint library_articles_source_discovery_check to library_articles_source_check;
end $$;

alter table public.csat_source_registry add column if not exists profile jsonb;
alter table public.csat_source_registry add constraint csat_source_profile_object
  check (profile is null or jsonb_typeof(profile) = 'object');
comment on column public.csat_source_registry.profile is
  'Measured SourceProfile with validation time, evidence and explicit unknowns. Role is advisory; active controls collection independently.';

insert into public.csat_source_registry
  (source, label, license_class, homepage, role_note, harvest_cmd, feed_ids, active, added_by, note)
values
  ('african_storybook', 'African Storybook', 'cc_by', 'https://www.africanstorybook.org',
   'EXPERIMENTAL — individually licensed and reviewed stories only',
   'pnpm exec tsx scripts/acp/import-corpus-pilot.mjs', array['reviewed-pilot'], false, 'codex',
   'No daily crawler. Exact pinned text, author, license, review and duplicate evidence required. No automatic publication.')
on conflict (source) do nothing;

-- Reconcile inventory sources missing from the registry without activating collectors
-- or inventing a blanket license. Per-article license fields remain authoritative.
insert into public.csat_source_registry (source,label,homepage,role_note,active,added_by,note)
values
 ('europe_pmc','Europe PMC','https://europepmc.org','HOLD — existing inventory review',false,'codex','Registry reconciliation; not a new provider or collection authorization.'),
 ('frontiers','Frontiers','https://www.frontiersin.org','HOLD — existing inventory review',false,'codex','Separate from Frontiers for Young Minds.'),
 ('nist','NIST','https://www.nist.gov','EXPERIMENTAL — existing inventory review',false,'codex','Per-article authorship and rights require verification.')
on conflict (source) do nothing;
