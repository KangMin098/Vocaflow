-- scripts/research/factory-i0-277-independent/read-only-exposure.sql
with events as (
select 'g2_attempt'::text as kind,t.user_id,t.item_ref from public.learning_task_attempts t join public.csat_items c on c.id=t.item_ref
union all
select 'explanation_session_without_attempt',s.user_id,s.item_ref from public.learning_sessions s join public.csat_items c on c.id=s.item_ref where s.deleted_at is null and (s.explanation_viewed_at is not null or s.explanation_server_at is not null or s.revealed_at is not null) and not exists(select 1 from public.learning_task_attempts t where t.user_id=s.user_id and t.item_ref=s.item_ref)
), evaluated as (
select e.kind,
not exists(select 1 from public.csat_dx_response r join public.csat_dx_session d on d.id=r.session_id where d.user_id=e.user_id and r.item_id=e.item_ref)
and not exists(select 1 from public.csat_dx_session d where d.user_id=e.user_id and d.exam_id=c.exam_id)
and not (c.passage is not null and exists(select 1 from public.csat_dx_response r join public.csat_dx_session d on d.id=r.session_id join public.csat_items j on j.id=r.item_id where d.user_id=e.user_id and j.passage is not null and md5(regexp_replace(lower(j.passage), '\s+', ' ', 'g'))=md5(regexp_replace(lower(c.passage), '\s+', ' ', 'g')))) as original_b_returns_none
from events e join public.csat_items c on c.id=e.item_ref
) select kind,count(*) as observed_rows,count(*) filter(where original_b_returns_none) as omitted_by_original_b,now() as observed_at from evaluated group by kind;