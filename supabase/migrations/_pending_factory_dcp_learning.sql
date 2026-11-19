-- supabase/migrations/_pending_factory_dcp_learning.sql
-- ⚠️ 보류(적용 안 함) — 단계 1D. 공유 DB 적용은 별도 사용자 승인(L4). 격리 PGlite 시험에서만 적용한다.
--
-- 무엇: 1C 로 납품된 공장 DCP 지도 연습(guided_practice · r.central_meaning · topic/title/main_point)을 학습자 본인이
--   목록 · 열기 · 제출한다. 세 함수 모두 학습자 세션(auth.uid())만 — 관리자 · service_role 이 학습자를 흉내내지 않는다.
--   · 열기는 답변 전 payload 의 passage · stem_ko · choices 만 돌려준다(answer_key · 해설 · 검수 기록 없음).
--   · 제출은 기존 **실제** grade_dcp_item(uuid,jsonb) 을 호출해 정오와 csat_item_attempts id 를 얻고, 같은 트랜잭션에서
--     납품 결속 영수증을 남긴다. 영수증 insert 가 실패하면 채점 시도 행도 함께 되돌아간다(원자적).
--   · 같은 (학습자, mutation 키) + 같은 납품 · 같은 응답 = 저장된 같은 결과(응답 유실 복구). 다른 응답 · 다른 납품 = 거절.
--   · 정오가 boolean 이 아니면(빈 값 · 미상) 거절한다 — false 로 바꾸지 않는다.
--   · 연습은 근거가 아니다: evidence = false · non_evidence_reason = 'role_not_evidence' 를 CHECK 로 고정.
--
-- 왜 새 원장인가(기존 G2 를 재사용하지 않은 이유):
--   workspace_delivery_attempt 는 annotation_ref/annotation_hash 가 NOT NULL 이고 G2 기록기는 DCP 산출물을 지원하지 않는다.
--   그 칸을 가짜 Gold 로 채우지 않기 위해, 실제 채점 판본(grade_dcp_item@20260920120000) · 정답키 판본(artifact_revision)에
--   결속한 연습 전용 영수증을 둔다. E 축 · 독립 자격으로 승격하지 않는다. G2 결합(DCP×guided 분기)은 단계 2 범위.
--
-- 전제: _pending_factory_dcp_admission.sql(1C) 뒤 · grade_dcp_item(uuid,jsonb) 존재.
-- 되돌리기: drop function factory_dcp_attempt(uuid,jsonb,uuid); drop function factory_dcp_open(uuid);
--           drop function factory_dcp_deliveries(text); drop function factory_dcp_delivery_state(uuid);
--           drop function factory_dcp_learning_current(uuid); drop table factory_dcp_attempt;

do $$
declare v_missing text[];
begin
  select array_agg(x) into v_missing from unnest(array[
    'public.grade_dcp_item(uuid,jsonb)', 'public.supply_delivery_valid(uuid)', 'public.factory_lineage_personal_current(uuid)',
    'public.factory_product_order_is_current(text,integer)', 'public.forbid_ledger_mutation()', 'public.supply_writer_guard()']) x where to_regprocedure(x) is null;
  if v_missing is not null or to_regclass('public.factory_dcp_admission') is null then
    raise exception 'dcp learning requires 1C dcp admission + grade_dcp_item first (missing %)', v_missing;
  end if;
  if to_regclass('public.factory_dcp_attempt') is not null then raise exception 'dcp learning already installed'; end if;
end $$;

-- ── 연습 수행 영수증(추가 전용) ───────────────────────────────────────────
create table public.factory_dcp_attempt (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  mutation_id uuid not null,
  delivery_id uuid not null references public.workspace_content_delivery(id),
  workspace_id uuid not null,
  dcp_item_id uuid not null references public.factory_dcp_admission(dcp_item_id),
  artifact_revision text not null,
  answer jsonb not null,
  answer_hash text not null check (answer_hash ~ '^[0-9a-f]{64}$'),
  -- 실제 채점 시도 행에 FK 로 묶는다 — 가짜 id 는 저장되지 않는다(소유자 · 문항 · 정오 일치는 제출 함수가 확인)
  csat_attempt_id uuid not null references public.csat_item_attempts(id),
  is_correct boolean not null,
  result jsonb not null,
  grader text not null check (grader = 'grade_dcp_item@20260920120000'),
  role text not null check (role = 'guided_practice'),
  task_id text not null check (task_id = 'r.central_meaning'),
  evidence boolean not null default false check (evidence = false),
  non_evidence_reason text not null default 'role_not_evidence' check (non_evidence_reason = 'role_not_evidence'),
  received_at timestamptz not null default now(),
  unique (user_id, mutation_id)
);
create index factory_dcp_attempt_delivery on public.factory_dcp_attempt (delivery_id, received_at desc);
create trigger factory_dcp_attempt_append_only before update or delete on public.factory_dcp_attempt
  for each row execute function public.forbid_ledger_mutation();
-- 직접 쓰기 차단 — 1C 와 같은 기존 가드. 제출 함수만 vocaflow.supply_writer='rpc' 를 켜고 쓴다
create trigger factory_dcp_attempt_writer before insert on public.factory_dcp_attempt
  for each row execute function public.supply_writer_guard();
alter table public.factory_dcp_attempt enable row level security;
create policy fdat_own_read on public.factory_dcp_attempt for select using (user_id = auth.uid());
revoke all on public.factory_dcp_attempt from public, anon, authenticated;
grant select on public.factory_dcp_attempt to authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'revoke all on table public.factory_dcp_attempt from service_role';
    execute 'grant select on table public.factory_dcp_attempt to service_role';
  end if;
end $$;

-- ── 학습용 개인 계보 현재성 ─────────────────────────────────────────────
-- factory_lineage_personal_current 는 「아직 생산 중인 주문」만 true 다 — 새 납품 · 링크를 막는 생산 안전 계약이라 그대로 둔다.
-- 이미 받은 자료를 여는 판정은 그 계약을 빌리지 않고, 같은 Workspace(active) · 최신 goal/plan · 수요 계획 결속은 그대로 요구하되
-- 주문 상태는 정상 납품(delivered · partial)과 진행 중을 허용하고 failed 만 막는다. 철회는 supply_delivery_valid, 구 판본은 revision 비교가 막는다.
create function public.factory_dcp_learning_current(p_order uuid)
returns boolean language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select exists(select 1 from public.factory_order o join public.workspace_content_demand_line l on l.id=o.line_id
    join public.workspace_content_demand d on d.id=l.demand_id join public.learner_workspace w on w.id=o.workspace_id and w.user_id=o.user_id
    join lateral(select p.plan_version,p.goal_version_id from public.learner_workspace_plan p where p.workspace_id=w.id and p.user_id=w.user_id order by p.plan_version desc limit 1) p on true
    where o.id=p_order and w.status='active' and o.state <> 'failed'
      and d.plan_version=p.plan_version and d.goal_version_id is not distinct from p.goal_version_id
      and d.goal_version_id is not distinct from (select max(g.id) from public.csat_map_goal_version g where g.user_id=o.user_id))
$$;
revoke all on function public.factory_dcp_learning_current(uuid) from public, anon, authenticated;

-- ── 납품 판정 — 본인 · 등록 후보 · 역할/TASK · Workspace 열림 · 현재 유효 · 개인 계보 · 제품주문 링크/현재성 ─────────
-- 반환: 'ok' 또는 닫힌 거절 코드. 소유가 아니면 'not_found'(남의 납품 존재를 알리지 않는다).
create function public.factory_dcp_delivery_state(p_delivery uuid)
returns text language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $$
declare d record; a record; v_ws text;
begin
  select * into d from workspace_content_delivery w where w.id = p_delivery and w.user_id = auth.uid();
  if not found then return 'not_found'; end if;
  if d.artifact_kind <> 'dcp_item' then return 'not_factory_dcp'; end if;
  select * into a from factory_dcp_admission x where x.dcp_item_id::text = d.artifact_ref;
  if not found then return 'not_factory_dcp'; end if;
  if d.role <> 'guided_practice' or d.task_id <> 'r.central_meaning' or a.role <> d.role or a.task_id <> d.task_id then return 'wrong_role_task'; end if;
  select w.status into v_ws from learner_workspace w where w.id = d.workspace_id and w.user_id = d.user_id;
  if v_ws is distinct from 'active' then return 'workspace_closed'; end if;
  if d.artifact_revision is distinct from a.artifact_revision then return 'stale_revision'; end if;
  if public.supply_delivery_valid(d.id) is not true then return 'not_current'; end if;
  if d.order_id is null or public.factory_dcp_learning_current(d.order_id) is not true then return 'lineage_not_current'; end if;
  if not exists (select 1 from factory_order_product_link k where k.order_id = d.order_id and k.product_order_id = a.product_order_id
                 and k.order_revision = a.order_revision and k.order_hash = a.order_hash) then return 'product_link_mismatch'; end if;
  if public.factory_product_order_is_current(a.product_order_id, a.order_revision) is not true then return 'product_not_current'; end if;
  return 'ok';
end $$;
revoke all on function public.factory_dcp_delivery_state(uuid) from public, anon, authenticated;

-- ── 목록 — 이 Workspace(템플릿)의 공장 DCP 납품. 지문(source) 수와 문항 수를 따로 센다 ─────────────
create function public.factory_dcp_deliveries(p_template text)
returns jsonb language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $$
declare v_uid uuid := auth.uid(); v_ws uuid; v_rows jsonb;
begin
  if v_uid is null then raise exception 'Forbidden' using errcode = '42501'; end if;
  select w.id into v_ws from learner_workspace w where w.user_id = v_uid and w.template_id = p_template and w.status <> 'closed';
  if v_ws is null then return jsonb_build_object('workspace_id', null, 'rows', '[]'::jsonb); end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'delivery_id', d.id, 'dcp_item_id', x.dcp_item_id, 'source_id', x.source_id, 'type', i.type,
      'delivered_at', d.delivered_at, 'state', public.factory_dcp_delivery_state(d.id),
      'attempts', (select count(*) from factory_dcp_attempt t where t.delivery_id = d.id),
      'last_correct', (select t.is_correct from factory_dcp_attempt t where t.delivery_id = d.id order by t.received_at desc limit 1))
      order by d.delivered_at, i.type), '[]'::jsonb)
    into v_rows
    from workspace_content_delivery d
    join factory_dcp_admission x on x.dcp_item_id::text = d.artifact_ref
    join csat_dcp_items i on i.id = x.dcp_item_id
   where d.user_id = v_uid and d.workspace_id = v_ws and d.artifact_kind = 'dcp_item';
  return jsonb_build_object('workspace_id', v_ws, 'rows', v_rows);
end $$;
revoke all on function public.factory_dcp_deliveries(text) from public, anon;
grant execute on function public.factory_dcp_deliveries(text) to authenticated;

-- ── 열기 — 답변 전 문항(passage · stem_ko · choices 만) ────────────────────────────
create function public.factory_dcp_open(p_delivery uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $$
declare v_state text; d record; i record;
begin
  if auth.uid() is null then raise exception 'Forbidden' using errcode = '42501'; end if;
  v_state := public.factory_dcp_delivery_state(p_delivery);
  if v_state <> 'ok' then return jsonb_build_object('state', v_state); end if;
  select * into d from workspace_content_delivery w where w.id = p_delivery;
  select it.id, it.type, it.paragraph_idx, it.ref_id, it.payload into i from csat_dcp_items it where it.id = d.artifact_ref::uuid;
  return jsonb_build_object('state', 'ok', 'delivery_id', d.id, 'workspace_id', d.workspace_id, 'source_id', i.ref_id,
    'item', jsonb_build_object('id', i.id, 'type', i.type, 'paragraph_idx', i.paragraph_idx,
      'payload', jsonb_build_object('passage', i.payload->'passage', 'stem_ko', i.payload->'stem_ko', 'choices', i.payload->'choices')),
    'attempts', (select count(*) from factory_dcp_attempt t where t.delivery_id = d.id));
end $$;
revoke all on function public.factory_dcp_open(uuid) from public, anon;
grant execute on function public.factory_dcp_open(uuid) to authenticated;

-- ── 제출 — 실제 grade_dcp_item + 납품 결속 영수증(원자적 · 멱등) ─────────────────────────
create function public.factory_dcp_attempt(p_delivery uuid, p_answer jsonb, p_mutation uuid)
returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare
  v_uid uuid := auth.uid(); v_hash text; prev record; d record; a record; v_state text; g jsonb; v_id uuid; v_ws uuid; v_template text;
begin
  if v_uid is null then raise exception 'Forbidden' using errcode = '42501'; end if;
  if p_delivery is null or p_mutation is null or p_answer is null or jsonb_typeof(p_answer) <> 'object'
     or (select array_agg(k) from jsonb_object_keys(p_answer) k) is distinct from array['choice']
     or jsonb_typeof(p_answer->'choice') <> 'number' or (p_answer->>'choice') !~ '^[1-5]$' then
    raise exception 'attempt: answer must be {choice:1..5}' using errcode = '22023';
  end if;
  v_hash := encode(sha256(convert_to(p_answer::text, 'UTF8')), 'hex');
  perform pg_advisory_xact_lock(hashtextextended('factory_dcp_attempt:' || v_uid::text || ':' || p_mutation::text, 0));

  -- ① 같은 키 재전송 — 같은 납품 · 같은 응답일 때만 저장된 결과(납품이 그 뒤 철회돼도 같은 결과)
  select * into prev from factory_dcp_attempt t where t.user_id = v_uid and t.mutation_id = p_mutation;
  if found then
    if prev.delivery_id <> p_delivery or prev.answer_hash <> v_hash then
      raise exception 'attempt: mutation key reused with a different body' using errcode = '23505';
    end if;
    return prev.result || jsonb_build_object('replayed', true);
  end if;

  -- ② 잠금(현재성 조회 전) — 1C workspace_delivery_record 와 같은 순서 · 같은 키:
  --   map_goal 자문 → map_plan 자문 → learner_workspace 행 → factory_order 행 → 납품 행 → 승인 행 → 등록 후보 행.
  --   목표 · 계획 writer, Workspace 닫기, 주문 전이, 승인 철회, 등록 철회가 이 판정과 직렬화된다. 사용자 · 템플릿은 인자가 아니라
  --   auth.uid() 소유 납품 → 그 Workspace 에서 유도한다(남의 납품이면 존재를 알리지 않고 not_found).
  select w.workspace_id into v_ws from workspace_content_delivery w where w.id = p_delivery and w.user_id = v_uid;
  if not found then raise exception 'attempt: delivery not_found' using errcode = 'P0001'; end if;
  select w.template_id into v_template from learner_workspace w where w.id = v_ws and w.user_id = v_uid;
  if not found then raise exception 'attempt: delivery workspace_closed' using errcode = 'P0001'; end if;
  perform pg_advisory_xact_lock(hashtext('map_goal:' || v_uid::text));
  perform pg_advisory_xact_lock(hashtext('map_plan:' || v_uid::text || ':' || v_template));
  perform 1 from learner_workspace w where w.id = v_ws and w.user_id = v_uid for share;
  select * into d from workspace_content_delivery w where w.id = p_delivery and w.user_id = v_uid;
  if d.order_id is not null then perform 1 from factory_order o where o.id = d.order_id for share; end if;
  perform 1 from workspace_content_delivery w where w.id = p_delivery for share;
  perform 1 from content_release_approval r where r.id = d.approval_id for share;
  perform 1 from factory_dcp_admission x where x.dcp_item_id::text = d.artifact_ref for share;

  -- ③ 납품 판정(소유 · 등록 후보 · 역할 · Workspace · 현재성 · 학습용 계보 · 제품 링크) — 잠근 뒤에 본다
  v_state := public.factory_dcp_delivery_state(p_delivery);
  if v_state <> 'ok' then raise exception 'attempt: delivery %', v_state using errcode = 'P0001'; end if;
  select * into a from factory_dcp_admission x where x.dcp_item_id::text = d.artifact_ref;

  -- ④ 실제 채점기 — 정오가 boolean 이 아니거나, 시도 id 가 UUID 가 아니거나, 그 시도 행이 이 학습자 · 이 DCP 문항 · 반환 정오와
  --    맞지 않으면 예외로 트랜잭션 전체(채점 시도 행 포함)를 되돌린다. 미상을 false 로 바꾸지 않는다
  g := public.grade_dcp_item(a.dcp_item_id, p_answer);
  if g is null or jsonb_typeof(g->'correct') <> 'boolean'
     or coalesce(g->>'attempt_id', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'attempt: grader returned no verdict';
  end if;
  if not exists (select 1 from csat_item_attempts c where c.id = (g->>'attempt_id')::uuid and c.user_id = v_uid
                 and c.dcp_item_id = a.dcp_item_id and c.is_correct is not distinct from (g->>'correct')::boolean) then
    raise exception 'attempt: grader attempt does not match learner/item/verdict';
  end if;

  -- 추가 전용이라 update 할 수 없다 — id 를 먼저 정하고 재전송이 돌려줄 완성본 결과를 처음부터 넣는다
  v_id := gen_random_uuid();
  g := jsonb_build_object('receipt_id', v_id, 'delivery_id', d.id, 'correct', (g->>'correct')::boolean,
    'csat_attempt_id', g->>'attempt_id', 'answer_key', g->'answer_key', 'evidence', false, 'non_evidence_reason', 'role_not_evidence');
  perform set_config('vocaflow.supply_writer', 'rpc', true);
  insert into factory_dcp_attempt (id, user_id, mutation_id, delivery_id, workspace_id, dcp_item_id, artifact_revision, answer, answer_hash,
    csat_attempt_id, is_correct, result, grader, role, task_id)
  values (v_id, v_uid, p_mutation, d.id, d.workspace_id, a.dcp_item_id, a.artifact_revision, p_answer, v_hash,
    (g->>'csat_attempt_id')::uuid, (g->>'correct')::boolean, g, 'grade_dcp_item@20260920120000', 'guided_practice', 'r.central_meaning');
  return g || jsonb_build_object('replayed', false);
end $$;
revoke all on function public.factory_dcp_attempt(uuid, jsonb, uuid) from public, anon;
grant execute on function public.factory_dcp_attempt(uuid, jsonb, uuid) to authenticated;

-- ── 계측 허용 목록(funnel_events CHECK) — 1D 이벤트 3종 ──────────────────────────────
-- csat_factory_dcp_opened · csat_factory_dcp_submitted · csat_factory_dcp_returned · 2F csat_factory_dcp_requested(lib/analytics/events.ts · 속성은 숫자/불리언/닫힌 열거형).
-- 목록을 손으로 옮기지 않는다 — 적용 시점의 실제 제약에서 기존 이름을 읽어 세 이름만 더한다(다른 세션이 그 사이 늘린 값을 잃지 않는다).
-- 제약이 없거나 모양이 다르면(이름 0개) 실패한다. 되돌리기: 같은 방식으로 세 이름을 뺀 배열로 다시 만든다. 데이터는 지우지 않는다.
do $$
declare v_names text[]; v_new constant text[] := array['csat_factory_dcp_opened', 'csat_factory_dcp_submitted', 'csat_factory_dcp_returned', 'csat_factory_dcp_requested'];
begin
  select array_agg(m[1]) into v_names
    from pg_constraint c, regexp_matches(pg_get_constraintdef(c.oid), '''([a-z0-9_]+)''', 'g') m
   where c.conrelid = 'public.funnel_events'::regclass and c.conname = 'funnel_events_event_check';
  if v_names is null or cardinality(v_names) = 0 then raise exception 'funnel_events_event_check not found or unreadable'; end if;
  v_names := array(select distinct x from unnest(v_names || v_new) x order by x);
  alter table public.funnel_events drop constraint funnel_events_event_check;
  execute format('alter table public.funnel_events add constraint funnel_events_event_check check (event = any (%L::text[]))', v_names);
end $$;
