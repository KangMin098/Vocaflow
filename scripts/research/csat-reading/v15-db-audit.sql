-- scripts/research/csat-reading/v15-db-audit.sql
-- Read-only metadata queries; no learner records, originals, answers, Gold or credentials.
select to_regclass('public.csat_items'),to_regclass('public.csat_item_analyses'),
 to_regclass('public.knowledge_applications'),to_regclass('public.csat_exams'),to_regclass('public.csat_dx_answer_key');
select split_part(surface_ref,':',1) content_key,status,coalesce(audience->>'role','confirm') role,
 count(distinct split_part(surface_ref,':',2)) items,count(*) rows,
 count(*) filter(where release_approved_by is not null) release_marked
from knowledge_applications where surface='csat_item_task' group by 1,2,3 order by 1,2,3;
select i.type_id,count(distinct i.id) published_v3_items
from csat_items i join csat_item_analyses a on a.item_id=i.id and a.version=3 and a.status='published'
where i.id ~ '^(201[4-9]|202[0-7])[AB]?#|^M(1[4-9]|2[0-7])(06|09)[AB]?#'
group by 1 order by 1;
select e.id,e.organizer,e.item_count,e.has_answer_key,
 count(k.no) key_rows,count(distinct k.no) distinct_numbers,min(k.no) min_number,max(k.no) max_number,sum(k.points) total_points
from csat_exams e left join csat_dx_answer_key k on k.exam_id=e.id
where e.organizer='kice' group by e.id,e.organizer,e.item_count,e.has_answer_key order by e.id;
