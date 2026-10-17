-- scripts/research/factory-i2-r5-preflight/snapshot.sql
--
-- Factory I2 R5(r.central_meaning) 실제 공급 사전 감사 — DB 상태 스냅샷(읽기 전용 · SELECT 만 · 쓰기 0).
-- 실행: Supabase MCP execute_sql 또는 psql 로 이 파일 전체를 실행하고, 결과 한 행의 `snapshot` 값을
--       docs/research/factory-i2-r5-preflight-20261017/db-snapshot.json 에 그대로 저장한 뒤 audit.mts 를 돌린다.
-- 학습자 식별자는 내보내지 않는다(사용자별 노출은 해시한 키만).
with r5_types as (
  select unnest(array['R-TOPIC','R-TITLE','R-GIST','R-CLAIM']) as type_id
),
pool as (
  select i.id, i.exam_id, i.no, i.type_id, i.body_ok, i.in_scope, i.answer is not null as has_answer,
         e.kind as exam_kind, e.organizer,
         case when i.passage is null then null else encode(sha256(convert_to(i.passage, 'UTF8')), 'hex') end as passage_sha256,
         exists (select 1 from csat_items_public p where p.id = i.id) as in_public_view
  from csat_items i
  join r5_types t on t.type_id = i.type_id
  left join csat_exams e on e.id = i.exam_id
),
ana as (
  select item_id, max(version) filter (where status = 'published') as published_version,
         (array_agg(units_hash order by version desc) filter (where status = 'published'))[1] as units_hash,
         string_agg(distinct status, ',') as statuses
  from csat_item_analyses where item_id in (select id from pool) group by item_id
),
apps as (
  select a.id, a.surface_ref, split_part(a.surface_ref, ':', 1) as task_key, a.status, a.version,
         a.audience->>'item' as item, a.audience->>'type' as type_id, coalesce(a.audience->>'role', 'check') as role,
         a.released_at is not null as released, a.release_approved_at is not null as release_approved
  from knowledge_applications a
  where a.surface = 'csat_item_task' and a.audience->>'type' in (select type_id from r5_types)
),
cs_items as (select distinct item from apps where task_key = 'claim-support'),
-- 같은 지문(passage sha256) 을 쓰는 다른 문항 — 공유 지문 반례
shared as (
  select p.id, array_agg(q.id order by q.id) filter (where q.id <> p.id) as same_passage_items
  from pool p join csat_items q on q.passage is not null and encode(sha256(convert_to(q.passage, 'UTF8')), 'hex') = p.passage_sha256
  where p.id in (select item from cs_items) group by p.id
),
att as (
  select item_ref, md5(user_id::text) as learner, bool_or(synthetic) as synthetic, string_agg(distinct task_key, ',') as tasks,
         string_agg(distinct phase, ',') as phases, count(*) as n, count(distinct content_hash) as content_hashes
  from learning_task_attempts where item_ref in (select item from cs_items) group by item_ref, user_id
),
sess as (
  select item_ref, md5(user_id::text) as learner, bool_or(synthetic) as synthetic, count(*) as sessions,
         count(explanation_viewed_at) as explanation_viewed, count(revealed_at) as revealed
  from learning_sessions where deleted_at is null and item_ref in (select item from cs_items) group by item_ref, user_id
),
dx as (
  select r.item_id as item_ref, md5(s.user_id::text) as learner, count(*) as n
  from csat_dx_response r join csat_dx_session s on s.id = r.session_id
  where r.item_id in (select item from cs_items) group by r.item_id, s.user_id
),
dx_exam as (
  select s.exam_id, count(distinct s.user_id) as learners from csat_dx_session s
  where s.exam_id in (select exam_id from pool where id in (select item from cs_items)) group by s.exam_id
),
ledgers as (
  select t, to_regclass('public.' || t) is not null as installed
  from unnest(array['content_qualification','content_release_approval','content_release_revocation',
                    'workspace_content_demand','workspace_content_demand_line','factory_order','factory_order_event',
                    'workspace_content_delivery','factory_order_product_link']) t
)
select jsonb_build_object(
  'schema', 'vf.factory-i2-r5-snapshot/1',
  'measuredAt', now(),
  'ledgers', (select jsonb_object_agg(t, installed) from ledgers),
  'poolByType', (select jsonb_object_agg(type_id, x) from (
      select type_id, jsonb_build_object('items', count(*), 'bodyOk', count(*) filter (where body_ok), 'hasAnswer', count(*) filter (where has_answer),
             'inPublicView', count(*) filter (where in_public_view),
             'analysisPublished', count(*) filter (where exists (select 1 from ana where ana.item_id = pool.id and ana.published_version is not null)),
             'byOrganizer', (select jsonb_object_agg(coalesce(o, 'unknown'), c) from (select organizer o, count(*) c from pool p2 where p2.type_id = pool.type_id group by organizer) z)) x
      from pool group by type_id) y),
  'applications', (select coalesce(jsonb_agg(to_jsonb(apps) - 'id' order by surface_ref), '[]') from apps),
  'items', (select jsonb_agg(jsonb_build_object(
      'id', p.id, 'type', p.type_id, 'examKind', p.exam_kind, 'organizer', p.organizer, 'bodyOk', p.body_ok, 'hasAnswer', p.has_answer,
      'inPublicView', p.in_public_view, 'passageSha256', p.passage_sha256,
      'analysis', (select to_jsonb(ana) - 'item_id' from ana where ana.item_id = p.id),
      'samePassageItems', coalesce((select same_passage_items from shared where shared.id = p.id), '{}'),
      'exposure', jsonb_build_object(
        'attemptLearnersReal', (select count(*) from att x where x.item_ref = p.id and not x.synthetic),
        'attemptLearnersSynthetic', (select count(*) from att x where x.item_ref = p.id and x.synthetic),
        'attemptPhases', (select string_agg(distinct x.phases, ',') from att x where x.item_ref = p.id),
        'attemptTasks', (select string_agg(distinct x.tasks, ',') from att x where x.item_ref = p.id),
        'maxContentHashes', (select max(x.content_hashes) from att x where x.item_ref = p.id),
        'explanationOnlyLearnersReal', (select count(*) from sess s where s.item_ref = p.id and s.explanation_viewed > 0 and not s.synthetic
                                         and not exists (select 1 from att y where y.item_ref = p.id and y.learner = s.learner)),
        'explanationOnlyLearnersSynthetic', (select count(*) from sess s where s.item_ref = p.id and s.explanation_viewed > 0 and s.synthetic
                                         and not exists (select 1 from att y where y.item_ref = p.id and y.learner = s.learner)),
        'sessionLearners', (select count(*) from sess s where s.item_ref = p.id),
        'dxResponseLearners', (select count(*) from dx d where d.item_ref = p.id)),
      'dxExamLearners', coalesce((select learners from dx_exam where dx_exam.exam_id = p.exam_id), 0)
    ) order by p.id) from pool p where p.id in (select item from cs_items))
) as snapshot;
