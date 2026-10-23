-- verification/reviews/T-0131-codex-s0-20261023/REPRODUCE.sql
-- SELECT-only recipes. No original passage/choice strings or learner records are returned.
select clock_timestamp() as measured_at;
select count(*) as stored_items,
       count(*) filter(where type_id is null) as unmapped
from public.csat_items;
select count(*) as public_catalog_items from public.csat_items_public;
select section,count(*) as types from public.csat_types group by section;
select t.id,t.name,t.section,e.kind,count(*) as items
from public.csat_items i join public.csat_types t on t.id=i.type_id
join public.csat_exams e on e.id=i.exam_id
group by t.id,t.name,t.section,e.kind order by t.id,e.kind;

-- Distinguish latest revision from the latest published revision.
with latest as (
 select distinct on(item_id) item_id,version,status
 from public.csat_item_analyses order by item_id,version desc
), published as (
 select item_id,max(version) as published_version
 from public.csat_item_analyses where status='published' group by item_id
)
select l.item_id,l.version,l.status,p.published_version
from latest l left join published p using(item_id)
where l.status='in_review' order by l.item_id;

select id,type_id,body_ok from public.csat_items where type_id is null order by id;
select count(*) as exams,sum(item_count) as declared_items,
 sum(listening_end) as declared_listening_end_sum
from public.csat_exams;
select id,listening_end from public.csat_exams where listening_end<>17;

select item_id,attribute_code,weight,source,reviewed_at is not null as reviewed
from public.csat_dx_item_attribute order by item_id,attribute_code;
select item_id,case when jsonb_typeof(data->'sentences')='array'
 then jsonb_array_length(data->'sentences') end as sentence_count
from public.csat_item_skeletons order by item_id;

-- Static security metadata is not an authenticated RLS runtime test.
select tablename,policyname,roles,cmd,qual from pg_policies
where schemaname='public' and tablename in ('csat_items','csat_item_analyses','csat_exams');
select pg_get_viewdef('public.csat_items_public'::regclass,true);
select table_name,column_name,grantee,privilege_type
from information_schema.column_privileges where table_schema='public'
and table_name='csat_items_public' and grantee in ('anon','authenticated');

-- Do not use a latest units_version row as proof that its input_hash matches current input.
-- Full csat_valid_review_personas_row over all published analyses timed out in this run.
-- Current protocol/hash validity remains UNKNOWN; this file does not retry that expensive query.
