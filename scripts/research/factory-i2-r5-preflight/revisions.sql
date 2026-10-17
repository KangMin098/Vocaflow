-- scripts/research/factory-i2-r5-preflight/revisions.sql
--
-- R5 claim-support 후보의 현재 revision — 미적용 B(`_pending_workspace_supply_b_orders.sql` supply_artifact_revision 'csat_item')와 같은 공식.
-- 읽기 전용(SELECT 만). 결과 행 배열을 docs/research/factory-i2-r5-preflight-20261017/db-revisions.json 에 저장한다.
select c.id,
       encode(sha256(convert_to(coalesce(c.stem, '') || '|' || coalesce(c.passage, '') || '|' || coalesce(c.choices::text, '') || '|' || coalesce(c.answer::text, ''), 'UTF8')), 'hex') as b_revision
from csat_items c
where c.id in (select distinct a.audience->>'item' from knowledge_applications a
               where a.surface = 'csat_item_task' and a.surface_ref like 'claim-support:%')
order by c.id;
