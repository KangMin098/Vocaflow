-- docs/research/final-independent-20261018/completion-db-readonly.sql
-- Aggregate metadata only; no learner identifiers, responses or remote writes.
begin read only;
select jsonb_build_object(
  'observedAt', clock_timestamp(),
  'readOnly', current_setting('transaction_read_only'),
  'authoredInstalled', to_regclass('public.authored_item') is not null,
  'humanDecisionInstalled', to_regclass('public.content_human_decision') is not null,
  'qualifications', (select count(*) from public.content_qualification),
  'deliveries', (select count(*) from public.workspace_content_delivery),
  'bindings', (select count(*) from public.workspace_delivery_attempt),
  'releaseApprovals', (select count(*) from public.content_release_approval)
) snapshot;
commit;
