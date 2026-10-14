-- supabase/migrations/_pending_workspace_supply_b_orders.sql
-- ⚠️ 보류(적용 안 함) — v6.2 P-F7b 승인안 B. **C(_pending_workspace_supply_c_qualification.sql) 다음에** 적용한다.
--
-- 무엇: Workspace 수요 · 수요 줄 · 공장 주문 · 주문 이벤트(추가 전용) · Workspace 공급.
-- 원칙:
--   · 클라이언트의 userId · Workspace · 자격 상태를 믿지 않는다. 사용자는 auth.uid(), 소유는 복합 FK + 정의자 함수가 확인한다.
--   · 멱등: 수요 = (user, SHA-256(정규 본문)) + 본문 비교(같은 키 · 다른 본문 거절). 주문 · 이벤트 · 공급 = 요청 키(request_key).
--   · 주문 상태는 factory_order_transition() 한 함수만 바꾼다 — 행 잠금 · 기대 상태 비교 · 이벤트 삽입이 한 트랜잭션.
--   · 이벤트 · 공급은 추가 전용(UPDATE/DELETE 트리거 거부).
--   · 공급 시점 재검증: 현재 자격(대체되지 않음) · 유효 승인(철회 없음) · 역할 필수 축 · 원천 적격 · Workspace active · G(학습자 노출).
-- 옛 설계(P-F4b)의 unique(demand_id, role) 를 버린 이유: 한 수요의 여러 줄 · 부분 공급 뒤 부족분 · 실패 뒤 재생산 · PLAN 개정 재주문을 막았다.
--   대신 「줄(demand_line)」 을 두고, 줄마다 열린 주문은 하나(부분 고유 인덱스) · 닫힌 주문 뒤 새 주문은 이유 · 부모 필수.
-- 되돌리기: drop table workspace_content_delivery, factory_order_event, factory_order, workspace_content_demand_line, workspace_content_demand cascade;
--           drop function factory_order_transition, workspace_demand_record, factory_order_open, workspace_delivery_record;
--           alter table learner_workspace drop constraint learner_workspace_id_user_key;
--           alter table csat_map_goal_version drop constraint csat_map_goal_version_id_user_key;
--           alter table learner_workspace_plan drop constraint learner_workspace_plan_ws_ver_user_key;

-- ── 0. 기존 표에 복합 고유키(데이터 변경 없음 — id 가 이미 PK 라 위반 불가) ──────────
alter table public.learner_workspace add constraint learner_workspace_id_user_key unique (id, user_id);
alter table public.csat_map_goal_version add constraint csat_map_goal_version_id_user_key unique (id, user_id);
alter table public.learner_workspace_plan add constraint learner_workspace_plan_ws_ver_user_key unique (workspace_id, plan_version, user_id);

-- ── 1. 수요 ─────────────────────────────────────────────────────────────
create table public.workspace_content_demand (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null,
  goal_version_id bigint,
  plan_version integer not null,
  definition_version text not null check (length(definition_version) between 1 and 64),
  core_task text not null check (core_task ~ '^[a-z]\.[a-z_]{2,60}$'),
  canonical text not null check (length(canonical) <= 20000),
  signature text not null check (signature ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  -- 소유: Workspace · 목표 · PLAN 이 모두 같은 사용자 것이어야 한다(DB 강제)
  foreign key (workspace_id, user_id) references public.learner_workspace(id, user_id) on delete cascade,
  foreign key (goal_version_id, user_id) references public.csat_map_goal_version(id, user_id),
  foreign key (workspace_id, plan_version, user_id) references public.learner_workspace_plan(workspace_id, plan_version, user_id),
  -- 서명 = SHA-256(정규 본문) — 저장 시점에 DB 가 다시 계산해 맞춰 본다
  check (signature = encode(sha256(convert_to(canonical, 'UTF8')), 'hex')),
  unique (user_id, signature),
  unique (id, user_id, workspace_id)
);

create table public.workspace_content_demand_line (
  id uuid primary key default gen_random_uuid(),
  demand_id uuid not null,
  user_id uuid not null,
  workspace_id uuid not null,
  line_no smallint not null check (line_no between 0 and 99),
  role text not null check (role in ('source_analysis','model_explanation','guided_practice','independent_check','transfer','delayed_check')),
  task_id text not null check (task_id ~ '^[a-z]\.[a-z_]{2,60}$'),
  quantity smallint not null check (quantity between 1 and 50),
  foreign key (demand_id, user_id, workspace_id) references public.workspace_content_demand(id, user_id, workspace_id) on delete cascade,
  unique (demand_id, line_no),
  unique (demand_id, role, task_id),
  unique (id, user_id, workspace_id, role, task_id)
);

-- ── 2. 주문 ─────────────────────────────────────────────────────────────
create table public.factory_order (
  id uuid primary key default gen_random_uuid(),
  line_id uuid not null,
  user_id uuid not null,
  workspace_id uuid not null,
  role text not null,
  task_id text not null,
  order_seq smallint not null check (order_seq between 1 and 100),    -- 그 줄의 몇 번째 주문
  reason text not null check (reason in ('initial','shortfall','retry_after_failure','plan_revision')),
  parent_order_id uuid references public.factory_order(id),
  quantity smallint not null check (quantity between 1 and 50),
  state text not null default 'requested'
    check (state in ('requested','stock_search','awaiting_production','producing','reviewing','delivered','held','failed')),
  event_seq integer not null default 0,                                 -- 마지막 이벤트 번호(이벤트와 함께만 바뀐다)
  production_run_id text,
  request_key uuid not null,
  created_at timestamptz not null default now(),
  foreign key (line_id, user_id, workspace_id, role, task_id)
    references public.workspace_content_demand_line(id, user_id, workspace_id, role, task_id) on delete cascade,
  check ((reason = 'initial') = (parent_order_id is null)),
  check (state <> 'producing' or production_run_id is not null),
  unique (line_id, order_seq),
  unique (user_id, request_key)
);
-- 한 줄에 **열린** 주문은 하나 — 중복 주문 차단. 닫힘(delivered · failed) 뒤에만 새 주문.
create unique index factory_order_one_open_per_line on public.factory_order (line_id)
  where state not in ('delivered','failed');

create table public.factory_order_event (
  id bigserial primary key,
  order_id uuid not null references public.factory_order(id) on delete cascade,
  seq integer not null check (seq >= 1),
  from_state text,
  to_state text not null,
  reason text check (reason is null or length(reason) <= 500),
  production_run_id text,
  qualification_id uuid references public.content_qualification(id),
  actor uuid,
  request_key uuid not null,
  created_at timestamptz not null default now(),
  unique (order_id, seq),
  unique (order_id, request_key),
  check (to_state not in ('held','failed') or reason is not null),
  check (to_state <> 'producing' or production_run_id is not null),
  check (to_state <> 'delivered' or qualification_id is not null)
);
create trigger factory_order_event_append_only before update or delete on public.factory_order_event
  for each row execute function public.forbid_ledger_mutation();

-- 주문 상태는 이벤트와 함께만 바뀐다 — 직접 UPDATE(서비스 키 포함)로 state 만 바꾸면 거부
create or replace function public.factory_order_state_guard() returns trigger
language plpgsql set search_path to 'public' as $$
begin
  if new.state is distinct from old.state or new.event_seq is distinct from old.event_seq then
    if new.event_seq <> old.event_seq + 1 or not exists (
      select 1 from factory_order_event e where e.order_id = new.id and e.seq = new.event_seq
        and e.from_state is not distinct from old.state and e.to_state = new.state) then
      raise exception 'factory_order: state changes only via factory_order_transition()' using errcode = '42501';
    end if;
  end if;
  if (new.line_id, new.user_id, new.workspace_id, new.role, new.task_id, new.order_seq, new.reason, new.request_key)
     is distinct from (old.line_id, old.user_id, old.workspace_id, old.role, old.task_id, old.order_seq, old.reason, old.request_key) then
    raise exception 'factory_order: identity columns are immutable' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger factory_order_state_guard before update on public.factory_order
  for each row execute function public.factory_order_state_guard();
create trigger factory_order_no_delete before delete on public.factory_order
  for each row execute function public.forbid_ledger_mutation();

-- ── 3. 공급 ─────────────────────────────────────────────────────────────
create table public.workspace_content_delivery (
  id uuid primary key default gen_random_uuid(),
  line_id uuid not null,
  user_id uuid not null,
  workspace_id uuid not null,
  role text not null,
  task_id text not null,
  order_id uuid references public.factory_order(id),                  -- 재고 재사용(R5)은 null
  artifact_kind text not null,
  artifact_ref text not null,
  artifact_revision text not null,
  qualification_id uuid not null,
  approval_id uuid not null references public.content_release_approval(id),
  request_key uuid not null,
  delivered_at timestamptz not null default now(),
  foreign key (line_id, user_id, workspace_id, role, task_id)
    references public.workspace_content_demand_line(id, user_id, workspace_id, role, task_id) on delete cascade,
  -- 공급 정체성 = 자격 정체성(산출물 · revision · TASK · 역할) — DB 강제
  foreign key (qualification_id, artifact_kind, artifact_ref, artifact_revision, task_id, role)
    references public.content_qualification(id, artifact_kind, artifact_ref, artifact_revision, task_id, role),
  unique (line_id, artifact_kind, artifact_ref),                         -- 같은 줄에 같은 산출물 두 번 공급 금지
  unique (user_id, request_key)
);
create trigger workspace_content_delivery_append_only before update or delete on public.workspace_content_delivery
  for each row execute function public.forbid_ledger_mutation();

-- ── 4. RLS — 학습자는 자기 행 읽기만. 쓰기는 정의자 함수만 ────────────────────
alter table public.workspace_content_demand enable row level security;
alter table public.workspace_content_demand_line enable row level security;
alter table public.factory_order enable row level security;
alter table public.factory_order_event enable row level security;
alter table public.workspace_content_delivery enable row level security;
create policy wcd_owner_read on public.workspace_content_demand for select using ((select auth.uid()) = user_id or public.is_admin_or_curator());
create policy wcdl_owner_read on public.workspace_content_demand_line for select using ((select auth.uid()) = user_id or public.is_admin_or_curator());
create policy fo_owner_read on public.factory_order for select using ((select auth.uid()) = user_id or public.is_admin_or_curator());
create policy foe_owner_read on public.factory_order_event for select using (
  exists (select 1 from public.factory_order o where o.id = order_id and ((select auth.uid()) = o.user_id or public.is_admin_or_curator())));
create policy wcdel_owner_read on public.workspace_content_delivery for select using ((select auth.uid()) = user_id or public.is_admin_or_curator());
revoke insert, update, delete on public.workspace_content_demand, public.workspace_content_demand_line, public.factory_order,
  public.factory_order_event, public.workspace_content_delivery from anon, authenticated;

-- ── 5. 함수 ─────────────────────────────────────────────────────────────
/**
 * 수요 기록(멱등). 본문은 앱 `canonicalDemand()` 출력 그대로(text). DB 가 서명을 다시 계산하고,
 * 본문의 user 가 auth.uid() 와 같고 Workspace · 목표 · PLAN 이 그 사용자 것인지(복합 FK) 확인한다.
 * 같은 서명이 이미 있으면 본문 비교 — 같으면 그 id, 다르면 거절.
 */
create or replace function public.workspace_demand_record(p_canonical text)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); b jsonb; v_sig text; v_id uuid; v_stored text; l jsonb; i int := 0;
begin
  if v_uid is null then raise exception 'Forbidden' using errcode = '42501'; end if;
  b := p_canonical::jsonb;
  if (b->>'v') <> '1' or (b->>'user') is distinct from v_uid::text then raise exception 'demand: user mismatch' using errcode = '42501'; end if;
  if (b->>'workspaceId') is null or (b->>'planVersion') is null then raise exception 'demand: workspace and plan required'; end if;
  v_sig := encode(sha256(convert_to(p_canonical, 'UTF8')), 'hex');
  select id, canonical into v_id, v_stored from workspace_content_demand where user_id = v_uid and signature = v_sig;
  if found then
    if v_stored <> p_canonical then raise exception 'demand: same key different body' using errcode = '23505'; end if;
    return v_id;
  end if;
  if not exists (select 1 from learner_workspace w where w.id = (b->>'workspaceId')::uuid and w.user_id = v_uid and w.status = 'active') then
    raise exception 'demand: workspace not active or not owned' using errcode = '42501';
  end if;
  insert into workspace_content_demand (user_id, workspace_id, goal_version_id, plan_version, definition_version, core_task, canonical, signature)
  values (v_uid, (b->>'workspaceId')::uuid, (b->>'goalVersion')::bigint, (b->>'planVersion')::int, b->>'definitionVersion', b->>'core', p_canonical, v_sig)
  on conflict (user_id, signature) do nothing
  returning id into v_id;
  if v_id is null then   -- 동시 요청이 먼저 넣었다 — 본문 비교 후 그 id
    select id, canonical into v_id, v_stored from workspace_content_demand where user_id = v_uid and signature = v_sig;
    if v_stored <> p_canonical then raise exception 'demand: same key different body' using errcode = '23505'; end if;
    return v_id;
  end if;
  for l in select * from jsonb_array_elements(b->'lines') loop
    insert into workspace_content_demand_line (demand_id, user_id, workspace_id, line_no, role, task_id, quantity)
    values (v_id, v_uid, (b->>'workspaceId')::uuid, i, l->>'role', l->>'task', (l->>'n')::smallint);
    i := i + 1;
  end loop;
  return v_id;
end $$;

/** 주문 열기(멱등 request_key). 열린 주문이 있으면 거절. 두 번째부터는 이유 · 부모(그 줄의 직전 닫힌 주문) 필수 */
create or replace function public.factory_order_open(p_line uuid, p_reason text, p_quantity smallint, p_request_key uuid)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); ln record; v_id uuid; v_prev record; v_seq smallint;
begin
  if v_uid is null then raise exception 'Forbidden' using errcode = '42501'; end if;
  select id into v_id from factory_order where user_id = v_uid and request_key = p_request_key;
  if found then return v_id; end if;
  select * into ln from workspace_content_demand_line where id = p_line and user_id = v_uid for update;   -- 줄 잠금 = 같은 줄 동시 주문 직렬화
  if not found then raise exception 'order: line not found or not owned' using errcode = '42501'; end if;
  select * into v_prev from factory_order where line_id = p_line order by order_seq desc limit 1;
  if found and v_prev.state not in ('delivered','failed') then raise exception 'order: open order exists' using errcode = '23505'; end if;
  if not found and p_reason <> 'initial' then raise exception 'order: first order must be initial'; end if;
  if found and p_reason = 'initial' then raise exception 'order: reorder needs a reason'; end if;
  if found and p_reason = 'retry_after_failure' and v_prev.state <> 'failed' then raise exception 'order: retry needs a failed parent'; end if;
  v_seq := coalesce(v_prev.order_seq, 0) + 1;
  insert into factory_order (line_id, user_id, workspace_id, role, task_id, order_seq, reason, parent_order_id, quantity, request_key)
  values (p_line, v_uid, ln.workspace_id, ln.role, ln.task_id, v_seq, p_reason, case when v_prev.id is null then null else v_prev.id end, p_quantity, p_request_key)
  returning id into v_id;
  return v_id;
end $$;

/**
 * 주문 전이 — 유일한 상태 변경 경로. 관리자 · 생산 작업자(정의자 호출)만.
 * 행 잠금 → 같은 요청 키면 멱등 반환 → 기대 상태 비교(낙관 동시성) → 허용 전이 · 근거 → 이벤트 삽입 → 주문 갱신. 한 트랜잭션.
 */
create or replace function public.factory_order_transition(p_order uuid, p_expected text, p_to text, p_reason text,
  p_run_id text, p_qualification uuid, p_request_key uuid)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare o record; v_seq int; ok boolean;
begin
  if auth.uid() is null or not public.is_admin_or_curator() then raise exception 'Forbidden' using errcode = '42501'; end if;
  select * into o from factory_order where id = p_order for update;
  if not found then raise exception 'order: not found'; end if;
  select seq into v_seq from factory_order_event where order_id = p_order and request_key = p_request_key;
  if found then return v_seq; end if;                                   -- 같은 요청 재전송
  if o.state <> p_expected then raise exception 'order: conflict (expected %, is %)', p_expected, o.state using errcode = '40001'; end if;
  ok := (o.state, p_to) in (
    ('requested','stock_search'),('requested','held'),('requested','failed'),
    ('stock_search','delivered'),('stock_search','awaiting_production'),('stock_search','held'),('stock_search','failed'),
    ('awaiting_production','producing'),('awaiting_production','held'),('awaiting_production','failed'),
    ('producing','reviewing'),('producing','failed'),
    ('reviewing','delivered'),('reviewing','held'),('reviewing','failed'),
    ('held','stock_search'),('held','awaiting_production'),('held','failed'));
  if not ok then raise exception 'order: transition % -> % not allowed', o.state, p_to; end if;
  -- delivered 는 그 주문 줄에 실제 공급 행이 있고 그 자격이 이 이벤트의 자격일 때만
  if p_to = 'delivered' and not exists (
    select 1 from workspace_content_delivery d where d.order_id = p_order and d.qualification_id = p_qualification) then
    raise exception 'order: delivered needs a delivery row with this qualification';
  end if;
  v_seq := o.event_seq + 1;
  insert into factory_order_event (order_id, seq, from_state, to_state, reason, production_run_id, qualification_id, actor, request_key)
  values (p_order, v_seq, o.state, p_to, p_reason, p_run_id, p_qualification, auth.uid(), p_request_key);
  update factory_order set state = p_to, event_seq = v_seq,
    production_run_id = coalesce(p_run_id, production_run_id) where id = p_order;
  return v_seq;
end $$;

/**
 * 공급 기록 — 학습자 본인 호출. **공급 시점 재검증**(과거 자격이 있다는 사실만으로 공급하지 않는다):
 *   ① 줄 소유 ② 자격이 현재 행(대체 없음) · 정체성 일치 ③ 승인 존재 · 철회 없음 · 범위(평가 역할은 assessment)
 *   ④ 역할 필수 축 pass ⑤ 원천 적격(기사 원천이면 csat_source_is_eligible) ⑥ Workspace active
 *   ⑦ G(학습자 노출): 그 산출물을 이미 시도했으면 확인 · 전이 · 지연 확인 역할로 공급하지 않는다(독립 첫 시도 보존)
 *      — 공유 지문 · 해설 열람 기록은 아직 DB 에 없어 판정 불가 → 해당 역할은 G 를 실패로 본다(fail-closed, 문서 §G)
 */
create or replace function public.workspace_delivery_record(p_line uuid, p_order uuid, p_qualification uuid, p_approval uuid, p_request_key uuid)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); ln record; q record; a record; v_id uuid; v_art uuid;
begin
  if v_uid is null then raise exception 'Forbidden' using errcode = '42501'; end if;
  select id into v_id from workspace_content_delivery where user_id = v_uid and request_key = p_request_key;
  if found then return v_id; end if;
  select * into ln from workspace_content_demand_line where id = p_line and user_id = v_uid;
  if not found then raise exception 'delivery: line not found or not owned' using errcode = '42501'; end if;
  if not exists (select 1 from learner_workspace w where w.id = ln.workspace_id and w.user_id = v_uid and w.status = 'active') then
    raise exception 'delivery: workspace not active';
  end if;
  if p_order is not null and not exists (select 1 from factory_order o where o.id = p_order and o.line_id = p_line) then
    raise exception 'delivery: order not on this line';
  end if;
  select * into q from content_qualification where id = p_qualification;
  if not found or q.task_id <> ln.task_id or q.role <> ln.role then raise exception 'delivery: qualification identity mismatch'; end if;
  if exists (select 1 from content_qualification s where s.supersedes = q.id) then raise exception 'delivery: qualification superseded'; end if;
  if not public.fq_role_ok(q.axes, q.role) then raise exception 'delivery: required axes not pass'; end if;
  select * into a from content_release_approval where id = p_approval and qualification_id = q.id;
  if not found then raise exception 'delivery: approval missing'; end if;
  if exists (select 1 from content_release_revocation r where r.approval_id = a.id) then raise exception 'delivery: approval revoked'; end if;
  if q.role in ('independent_check','transfer','delayed_check') and a.scope <> 'assessment' then raise exception 'delivery: assessment approval required'; end if;
  if q.artifact_kind = 'dcp_item' then
    select i.ref_id into v_art from csat_dcp_items i where i.id = q.artifact_ref::uuid and i.kind = 'article';
    if v_art is not null and not public.csat_source_is_eligible(v_art) then raise exception 'delivery: source no longer eligible'; end if;
    if q.role in ('independent_check','transfer','delayed_check') and exists (
      select 1 from csat_item_attempts t where t.user_id = v_uid and t.dcp_item_id = q.artifact_ref::uuid) then
      raise exception 'delivery: G — learner already attempted this item';
    end if;
  elsif q.role in ('independent_check','transfer','delayed_check') then
    raise exception 'delivery: G — exposure unknown for %', q.artifact_kind;   -- 노출 기록이 없는 종류는 평가 역할 공급 불가
  end if;
  insert into workspace_content_delivery (line_id, user_id, workspace_id, role, task_id, order_id, artifact_kind, artifact_ref,
    artifact_revision, qualification_id, approval_id, request_key)
  values (p_line, v_uid, ln.workspace_id, ln.role, ln.task_id, p_order, q.artifact_kind, q.artifact_ref, q.artifact_revision, q.id, a.id, p_request_key)
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public.workspace_demand_record(text) from public, anon;
revoke all on function public.factory_order_open(uuid, text, smallint, uuid) from public, anon;
revoke all on function public.factory_order_transition(uuid, text, text, text, text, uuid, uuid) from public, anon;
revoke all on function public.workspace_delivery_record(uuid, uuid, uuid, uuid, uuid) from public, anon;
grant execute on function public.workspace_demand_record(text) to authenticated;
grant execute on function public.factory_order_open(uuid, text, smallint, uuid) to authenticated;
grant execute on function public.factory_order_transition(uuid, text, text, text, text, uuid, uuid) to authenticated;
grant execute on function public.workspace_delivery_record(uuid, uuid, uuid, uuid, uuid) to authenticated;
