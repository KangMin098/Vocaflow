-- docs/research/final-independent-20261018/reaccept-dev-readonly-20261019.sql
-- Aggregate metadata and migration digests only; no learner data or writes.
begin read only;
select jsonb_build_object(
'observedAt', clock_timestamp(), 'readOnly', current_setting('transaction_read_only'),
'authoredInstalled', to_regclass('public.authored_item') is not null,
'humanDecisionInstalled', to_regclass('public.content_human_decision') is not null,
'qualifications', (select count(*) from public.content_qualification),
'deliveries', (select count(*) from public.workspace_content_delivery),
'bindings', (select count(*) from public.workspace_delivery_attempt),
'releaseApprovals', (select count(*) from public.content_release_approval),
'migrations', (select jsonb_agg(jsonb_build_object('version',version,'statementsSha256',encode(sha256(convert_to(array_to_string(statements,''),'UTF8')),'hex')) order by version) from supabase_migrations.schema_migrations where version in ('20261014091841','20261017200000','20261017200100','20261018120000','20261018120100'))
) snapshot;
commit;
