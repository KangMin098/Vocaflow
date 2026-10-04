-- supabase/migrations/20261004010000_csat_review_ledger_atomic.sql
-- Issue #145: both review ledgers must succeed or roll back together.
begin;

create or replace function public.csat_review_ledgers_import(p_batches jsonb, p_followups jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  batch_count integer;
  followup_count integer;
begin
  if jsonb_typeof(p_batches) is distinct from 'array'
     or jsonb_typeof(p_followups) is distinct from 'array' then
    raise exception 'Both review ledgers must be JSON arrays';
  end if;

  insert into public.csat_review_batches
    (batch, run_date, kind, chunk_size, items, agents, tokens, published, refused, re_rejected, detail, note)
  select batch, run_date, kind, chunk_size, items, agents, tokens, published, refused, re_rejected,
         coalesce(detail, '{}'::jsonb), note
  from jsonb_populate_recordset(null::public.csat_review_batches, p_batches)
  on conflict (batch) do update set
    run_date = excluded.run_date, kind = excluded.kind, chunk_size = excluded.chunk_size,
    items = excluded.items, agents = excluded.agents, tokens = excluded.tokens,
    published = excluded.published, refused = excluded.refused, re_rejected = excluded.re_rejected,
    detail = excluded.detail, note = excluded.note;
  get diagnostics batch_count = row_count;

  insert into public.csat_review_followups
    (item_id, source, finding_key, finding, severity, status, noted_on, updated_at)
  select item_id, source, finding_key, finding, severity, status, noted_on, coalesce(updated_at, now())
  from jsonb_populate_recordset(null::public.csat_review_followups, p_followups)
  on conflict (item_id, source, finding_key) do update set
    finding = excluded.finding, severity = excluded.severity, status = excluded.status,
    noted_on = excluded.noted_on, updated_at = excluded.updated_at;
  get diagnostics followup_count = row_count;

  return jsonb_build_object('batches', batch_count, 'followups', followup_count);
end;
$function$;

revoke all on function public.csat_review_ledgers_import(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.csat_review_ledgers_import(jsonb, jsonb) to service_role;
comment on function public.csat_review_ledgers_import(jsonb, jsonb)
  is 'Atomic review ledger import; both natural-key upserts commit together or neither does. Service role only.';

commit;

