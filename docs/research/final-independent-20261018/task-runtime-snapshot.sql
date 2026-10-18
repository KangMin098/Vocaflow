-- docs/research/final-independent-20261018/task-runtime-snapshot.sql
-- Aggregate metadata only; no learner IDs or responses. Execute in READ ONLY transaction.
begin read only;
select jsonb_build_object(
 'observedAt',clock_timestamp(),'readOnly',current_setting('transaction_read_only'),
 'authoredInstalled',to_regclass('public.authored_item') is not null,
 'qualifications',coalesce((select jsonb_agg(x) from (select task_id,role,artifact_kind,count(*)::int n from public.content_qualification group by task_id,role,artifact_kind order by task_id,role)x),'[]'::jsonb),
 'deliveries',coalesce((select jsonb_agg(x) from (select task_id,role,artifact_kind,count(*)::int n from public.workspace_content_delivery group by task_id,role,artifact_kind order by task_id,role)x),'[]'::jsonb),
 'bindings',coalesce((select jsonb_agg(x) from (select task_id,role,evidence,count(*)::int n from public.workspace_delivery_attempt group by task_id,role,evidence order by task_id,role,evidence)x),'[]'::jsonb),
 'attemptMetadata',coalesce((select jsonb_agg(x) from (select task_key,activity,help_level,count(*)::int n,count(*) filter(where synthetic is true)::int synthetic_flagged from public.learning_task_attempts group by task_key,activity,help_level order by task_key,activity,help_level)x),'[]'::jsonb)
) snapshot;
commit;
