-- scripts/research/factory-i2-r5-qualification/evidence.sql
--
-- Factory I2 R5 첫 자료(2020#24 · 대안 2021#24) 자격 근거 — DB 쪽. 읽기 전용(SELECT 만 · 쓰기 0). 학습자 식별자는 내보내지 않는다.
-- B revision 공식은 미적용 B(`_pending_workspace_supply_b_orders.sql` supply_artifact_revision('csat_item'))와 같다.
-- analysis_content_sha256 = 최신 published 분석의 내용 칸만(시각 · 실행 id 제외) jsonb 배열 text 의 sha256 — 이 패킷이 제안하는 analysis_revision 표기.
-- 결과 한 행의 `evidence` 를 docs/research/factory-i2-r5-qualification-20261017/evidence.json 의 `db` 에 옮긴다.
with target(id) as (values ('2020#24'), ('2021#24')),
ana as (
  select distinct on (a.item_id) a.item_id, a.version, a.status, a.units_hash,
         encode(sha256(convert_to(jsonb_build_array(a.measured_ability, a.design_intent, a.answer_locus, a.choice_analysis,
                a.solve_procedure, a.time_budget_sec, a.difficulty, a.required_vocab)::text, 'UTF8')), 'hex') as content_sha
  from csat_item_analyses a join target t on t.id = a.item_id
  where a.status = 'published' order by a.item_id, a.version desc
)
select jsonb_build_object(
  'schema', 'vf.factory-i2-r5-qualification-db/1',
  'measuredAt', now(),
  'ledgers', (select jsonb_object_agg(n, to_regclass('public.' || n) is not null) from unnest(array[
      'content_qualification','content_release_approval','content_release_revocation','workspace_content_demand',
      'workspace_content_demand_line','factory_order','workspace_content_delivery']) n),
  'items', (select jsonb_object_agg(i.id, jsonb_build_object(
      'type', i.type_id, 'examId', i.exam_id, 'no', i.no, 'bodyOk', i.body_ok, 'inScope', i.in_scope, 'answer', i.answer,
      'exam', (select jsonb_build_object('kind', e.kind, 'organizer', e.organizer, 'year', e.year, 'paperForm', e.paper_form,
                'hasAnswerKey', e.has_answer_key, 'sourceNote', e.source_note) from csat_exams e where e.id = i.exam_id),
      'passageSha256', encode(sha256(convert_to(coalesce(i.passage, ''), 'UTF8')), 'hex'),
      'bRevision', encode(sha256(convert_to(coalesce(i.stem, '') || '|' || coalesce(i.passage, '') || '|' || coalesce(i.choices::text, '') || '|' || coalesce(i.answer::text, ''), 'UTF8')), 'hex'),
      'inPublicView', exists (select 1 from csat_items_public p where p.id = i.id),
      'analysis', (select jsonb_build_object('version', a.version, 'unitsHash', a.units_hash, 'contentSha256', a.content_sha) from ana a where a.item_id = i.id),
      'applications', (select coalesce(jsonb_agg(jsonb_build_object('surfaceRef', k.surface_ref, 'status', k.status, 'version', k.version,
                'role', k.audience->>'role', 'released', k.released_at is not null, 'releaseApproved', k.release_approved_at is not null) order by k.surface_ref), '[]')
                from knowledge_applications k where k.audience->>'item' = i.id),
      'samePassageItems', (select coalesce(jsonb_agg(q.id order by q.id), '[]') from csat_items q where q.id <> i.id and q.passage = i.passage),
      'exposure', jsonb_build_object(
        'attempts', (select count(*) from learning_task_attempts x where x.item_ref = i.id),
        'attemptsByActivityPhase', (select coalesce(jsonb_object_agg(k, n), '{}') from (select x.activity || ':' || x.phase || ':' || case when x.synthetic then 'synthetic' else 'real' end k, count(*) n
                from learning_task_attempts x where x.item_ref = i.id group by 1) z),
        'sessions', (select count(*) from learning_sessions s where s.item_ref = i.id),
        'explanationViewedSessions', (select count(*) from learning_sessions s where s.item_ref = i.id and s.explanation_viewed_at is not null),
        'dxResponses', (select count(*) from csat_dx_response r where r.item_id = i.id))
    )) from csat_items i join target t on t.id = i.id),
  -- 확인 · 전이 후보 전체의 전이 시도(연습 화면 포함) — 노출 0 이 시점 관찰임을 보이는 대조
  'claimSupportAttemptsByActivityPhase', (select coalesce(jsonb_object_agg(k, n), '{}') from (
      select x.activity || ':' || x.phase || ':' || case when x.synthetic then 'synthetic' else 'real' end k, count(*) n
      from learning_task_attempts x where x.task_key = 'claim-support' group by 1) z),
  'transferAttempts', (select coalesce(jsonb_agg(jsonb_build_object('item', x.item_ref, 'activity', x.activity, 'synthetic', x.synthetic, 'answeredAt', x.answered_at) order by x.answered_at), '[]')
      from learning_task_attempts x where x.task_key = 'claim-support' and x.phase = 'transfer')
) as evidence;
