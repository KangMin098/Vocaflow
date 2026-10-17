-- scripts/research/factory-i2-independent/exposure.sql
with candidates as (
  select distinct audience->>'item' as id from knowledge_applications where surface='csat_item_task' and surface_ref like 'claim-support:%'
), c as (select i.* from csat_items i join candidates c on c.id=i.id)
select jsonb_build_object('measuredAt',now(),
 'exposureByItem',(select jsonb_agg(jsonb_build_object('item',c.id,
 'g2Attempts',(select count(*) from learning_task_attempts a left join learning_sessions s on s.id=a.session_id where a.item_ref=c.id or (a.item_ref is null and s.item_ref=c.id)),
 'allSessions',(select count(*) from learning_sessions s where s.item_ref=c.id),
 'deletedSessions',(select count(*) from learning_sessions s where s.item_ref=c.id and s.deleted_at is not null),
 'trapAttempts',(select count(*) from csat_trap_attempts a where a.item_id=c.id),
 'paperAttempts',(select count(*) from csat_session_attempts a where a.item_id=c.id),
 'reviewQueue',(select count(*) from csat_review_queue a where a.item_id=c.id),
 'dxResponses',(select count(*) from csat_dx_response r where r.item_id=c.id),
 'dxExamSessions',(select count(*) from csat_dx_session s where s.exam_id=c.exam_id),
 'embargoed', exists(select 1 from csat_ec_capture_session s where s.exam_id=c.exam_id and s.status in ('held','collecting')) or exists(select 1 from csat_ec_capture_tombstone t where t.exam_id=c.exam_id and t.closed_at is null)
 ) order by c.id) from c),
 'privateHelpers',(select jsonb_agg(jsonb_build_object('name',p.proname,'volatility',p.provolatile,'body',p.prosrc)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='csat_ec_private' and p.proname in ('exam_answer_embargoed','item_answer_embargoed')),
 'otherOrderTables',(select jsonb_object_agg(t,to_regclass('public.'||t) is not null) from unnest(array['textbook_product_order','product_order','factory_product_order','factory_order_product_link']) t),
 'factoryFunctions',(select coalesce(jsonb_agg(proname order by proname),'[]'::jsonb) from pg_proc where pronamespace='public'::regnamespace and proname in ('supply_artifact_revision','supply_learner_exposure','workspace_delivery_record','content_qualification_record','content_release_approve','workspace_demand_record','factory_order_open'))
) as audit;

-- Separate result set: count people internally, export aggregates only.
with ids as (select distinct audience->>'item' id from knowledge_applications where surface='csat_item_task' and surface_ref like 'claim-support:%')
select jsonb_agg(jsonb_build_object('item',i.id,'trapRows',x.n,'trapLearners',x.learners,'trapOnlyLearners',x.only_learners) order by i.id) as audit
from ids i cross join lateral (select count(*) n,count(distinct a.user_id) learners,count(distinct a.user_id) filter (where not exists(select 1 from learning_task_attempts g where g.user_id=a.user_id and g.item_ref=i.id) and not exists(select 1 from learning_sessions s where s.user_id=a.user_id and s.item_ref=i.id) and not exists(select 1 from csat_dx_response r join csat_dx_session s on s.id=r.session_id where s.user_id=a.user_id and r.item_id=i.id)) only_learners from csat_trap_attempts a where a.item_id=i.id) x;
