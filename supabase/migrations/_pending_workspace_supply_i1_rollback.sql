-- supabase/migrations/_pending_workspace_supply_i1_rollback.sql
-- ⚠️ 보류(적용 안 함) — Factory I1 되돌리기. **생성물**: scripts/csat/map/v62/gen-supply-i1-rollback.mjs 가 B · C 원본에서 함수 정의를 글자 그대로 잘라 만든다(손으로 고치지 않는다).
-- 원본: _pending_workspace_supply_b_orders.sql sha256 e3f929d06f20518495682a36e0d1f8f483988f2a39feabd3e5d490c02a5293b2
--       _pending_workspace_supply_c_qualification.sql sha256 dd940568ef7170212bf23ac9f7fb89bb090e8f529eeb4c26bb9ccdbc1e503f66
-- 순서: D3 → P → safety 의 역순. 데이터 보존 조건(승인 패키지 §7):
--   · D3 표에 행이 있으면 아래 §1 을 실행하지 않는다(보존 표로 복사한 뒤에만).
--   · factory_order 에 state = 'partial' 행이 있으면 §2 를 실행하지 않는다(닫힌 주문을 열린 것처럼 보이게 만든다).
--   · §3(safety 되돌리기)은 데이터와 무관 — 언제든 가능. 단 되돌리면 D1/D2 결함(노출 누락 · 승인 범위)이 다시 생긴다.

begin;
-- §0. 보존 조건을 **무엇이든 지우기 전에** 모두 검사한다(트랜잭션 — 하나라도 실패하면 아무것도 바뀌지 않는다)
do $$ begin
  if to_regclass('public.factory_order_product_link') is not null then
    if exists (select 1 from public.factory_order_product_link) then
      raise exception 'rollback D3: factory_order_product_link has rows — preserve history; rollback refused';
    end if;
  end if;
  if to_regclass('public.factory_product_order') is not null then
    if exists (select 1 from public.factory_product_order) then
      raise exception 'rollback D3: factory_product_order has rows — preserve history; rollback refused';
    end if;
  end if;
  if exists (select 1 from public.factory_order where state = 'partial') then
    raise exception 'rollback P: partial orders exist — do not reopen closed orders';
  end if;
end $$;

-- §1. D3 되돌리기
drop function if exists public.factory_order_link_product(uuid, text, integer, text, uuid);
drop function if exists public.factory_product_order_register(text, integer, text, text, text, text, text, integer, text, uuid);
drop function if exists public.factory_product_order_is_current(text, integer);
drop table if exists public.factory_order_product_link;
drop table if exists public.factory_product_order;

-- §2. P 되돌리기
drop function if exists public.workspace_line_fulfillment(uuid);
drop index public.factory_order_one_open_per_line;
create unique index factory_order_one_open_per_line on public.factory_order (line_id)
  where state not in ('delivered','failed');
alter table public.factory_order drop constraint factory_order_state_check;
alter table public.factory_order add constraint factory_order_state_check
  check (state in ('requested','stock_search','awaiting_production','producing','reviewing','delivered','held','failed'));
create or replace function public.factory_order_open(p_line uuid, p_reason text, p_quantity smallint, p_request_key uuid)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); ln record; v_id uuid; v_prev record; v_seq smallint;
begin
  if v_uid is null then raise exception 'Forbidden' using errcode = '42501'; end if;
  perform set_config('vocaflow.supply_writer', 'rpc', true);
  -- 줄 잠금 먼저 = 같은 줄 동시 주문 직렬화. 잠근 **뒤에** 요청 키를 본다 — 같은 키 동시 재전송이
  -- 먼저 커밋된 주문을 보고 같은 결과를 받게 한다(잠금 전에 보면 둘째가 「열린 주문 있음」으로 실패할 수 있다 — 설계 검토로 고침, 고친 뒤 실제 Postgres 동시 재전송 20/20 같은 id).
  select * into ln from workspace_content_demand_line where id = p_line and user_id = v_uid for update;
  -- 같은 요청 키 재전송: **같은 본문(줄 · 이유 · 수량)일 때만** 이전 결과. 다른 본문이면 거절(P-M2b 계획 저장 결함과 같은 종류 방지)
  select id, line_id, reason, quantity into v_prev from factory_order where user_id = v_uid and request_key = p_request_key;
  if found then
    if (v_prev.line_id, v_prev.reason, v_prev.quantity) is distinct from (p_line, p_reason, p_quantity) then
      raise exception 'order: request_key reused with a different body' using errcode = '23505';
    end if;
    return v_prev.id;
  end if;
  if ln.id is null then raise exception 'order: line not found or not owned' using errcode = '42501'; end if;
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
create or replace function public.factory_order_transition(p_order uuid, p_expected text, p_to text, p_reason text,
  p_run_id text, p_qualification uuid, p_request_key uuid)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare o record; v_seq int; ok boolean; e record;
begin
  if auth.uid() is null or not public.is_admin_or_curator() then raise exception 'Forbidden' using errcode = '42501'; end if;
  perform set_config('vocaflow.supply_writer', 'rpc', true);
  select * into o from factory_order where id = p_order for update;
  if not found then raise exception 'order: not found'; end if;
  -- 같은 요청 재전송: 같은 본문(기대 상태 · 목표 · 이유 · 실행 · 자격)일 때만 이전 seq
  select * into e from factory_order_event where order_id = p_order and request_key = p_request_key;
  if found then
    if (e.from_state, e.to_state, e.reason, e.production_run_id, e.qualification_id)
       is distinct from (p_expected, p_to, p_reason, p_run_id, p_qualification) then
      raise exception 'order: request_key reused with a different body' using errcode = '23505';
    end if;
    return e.seq;
  end if;
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
revoke all on function public.factory_order_open(uuid, text, smallint, uuid) from public, anon;
revoke all on function public.factory_order_transition(uuid, text, text, text, text, uuid, uuid) from public, anon;
grant execute on function public.factory_order_open(uuid, text, smallint, uuid) to authenticated;
grant execute on function public.factory_order_transition(uuid, text, text, text, text, uuid, uuid) to authenticated;

-- §3. safety 되돌리기(B · C 원본 정의)
create or replace function public.supply_learner_exposure(p_kind text, p_ref text, p_uid uuid)
returns text language plpgsql stable security definer set search_path to 'public' as $$
declare c record;
begin
  if p_kind = 'csat_item' then
    select * into c from csat_items where id = p_ref;
    if not found then return 'unknown'; end if;
    if exists (select 1 from csat_dx_response r join csat_dx_session s on s.id = r.session_id
               where s.user_id = p_uid and r.item_id = p_ref) then return 'attempted'; end if;
    if exists (select 1 from csat_dx_session s where s.user_id = p_uid and s.exam_id = c.exam_id) then return 'exam_seen'; end if;
    if c.passage is not null and exists (
      select 1 from csat_dx_response r join csat_dx_session s on s.id = r.session_id join csat_items j on j.id = r.item_id
      where s.user_id = p_uid and j.passage is not null
        and md5(regexp_replace(lower(j.passage), '\s+', ' ', 'g')) = md5(regexp_replace(lower(c.passage), '\s+', ' ', 'g'))) then
      return 'shared_passage_seen';
    end if;
    return 'none';
  elsif p_kind = 'dcp_item' then
    if exists (select 1 from csat_item_attempts t where t.user_id = p_uid and t.dcp_item_id = p_ref::uuid) then return 'attempted'; end if;
    return 'unknown';
  end if;
  return 'unknown';
end $$;
create or replace function public.workspace_delivery_record(p_line uuid, p_order uuid, p_qualification uuid, p_approval uuid, p_request_key uuid)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); ln record; q record; a record; d record; v_id uuid; v_src uuid; v_rev text; v_exp text;
begin
  if v_uid is null then raise exception 'Forbidden' using errcode = '42501'; end if;
  perform set_config('vocaflow.supply_writer', 'rpc', true);
  select * into d from workspace_content_delivery where user_id = v_uid and request_key = p_request_key;
  if found then
    if (d.line_id, d.order_id, d.qualification_id, d.approval_id) is distinct from (p_line, p_order, p_qualification, p_approval) then
      raise exception 'delivery: request_key reused with a different body' using errcode = '23505';
    end if;
    return d.id;
  end if;
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
  v_rev := public.supply_artifact_revision(q.artifact_kind, q.artifact_ref);
  if v_rev is null then raise exception 'delivery: artifact not found or kind unsupported (%)', q.artifact_kind; end if;
  if v_rev <> q.artifact_revision then raise exception 'delivery: artifact changed since qualification'; end if;
  select * into a from content_release_approval where id = p_approval and qualification_id = q.id;
  if not found then raise exception 'delivery: approval missing'; end if;
  if exists (select 1 from content_release_revocation r where r.approval_id = a.id) then raise exception 'delivery: approval revoked'; end if;
  if q.role in ('independent_check','transfer','delayed_check') and a.scope <> 'assessment' then raise exception 'delivery: assessment approval required'; end if;
  if q.artifact_kind = 'dcp_item' then
    select i.ref_id into v_src from csat_dcp_items i where i.id = q.artifact_ref::uuid;
    if v_src is null or not public.csat_source_is_eligible(v_src) then raise exception 'delivery: source not eligible'; end if;
  end if;
  if q.role in ('independent_check','transfer','delayed_check') then
    v_exp := public.supply_learner_exposure(q.artifact_kind, q.artifact_ref, v_uid);
    if v_exp <> 'none' then raise exception 'delivery: G — exposure %', v_exp; end if;
  end if;
  insert into workspace_content_delivery (line_id, user_id, workspace_id, role, task_id, order_id, artifact_kind, artifact_ref,
    artifact_revision, qualification_id, approval_id, request_key)
  values (p_line, v_uid, ln.workspace_id, ln.role, ln.task_id, p_order, q.artifact_kind, q.artifact_ref, q.artifact_revision, q.id, a.id, p_request_key)
  returning id into v_id;
  return v_id;
end $$;
create or replace function public.content_release_revoke(p_approval uuid, p_reason text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null or not public.is_admin_or_curator() then raise exception 'Forbidden' using errcode = '42501'; end if;
  perform set_config('vocaflow.supply_writer', 'rpc', true);
  insert into content_release_revocation (approval_id, revoked_by, reason) values (p_approval, auth.uid(), p_reason)
  on conflict (approval_id) do nothing;   -- 이미 철회됨 = 같은 결과
end $$;
create or replace function public.fq_axes_valid(p jsonb) returns boolean
language sql immutable set search_path to 'public' as $$
  select jsonb_typeof(p) = 'object'
     and (select count(*) from jsonb_object_keys(p)) = 8
     and (select bool_and(k in ('A','B','C','D','E','F','G','H')
                          and jsonb_typeof(p -> k) = 'object'
                          and (p -> k ->> 'state') in ('pass','fail','unknown','not_applicable'))
          from jsonb_object_keys(p) k)
$$;
create or replace function public.fq_role_ok(p jsonb, p_role text) returns boolean
language sql immutable set search_path to 'public' as $$
  select (p->'A'->>'state') = 'pass' and (p->'B'->>'state') = 'pass' and (p->'C'->>'state') = 'pass'
     and (p->'F'->>'state') = 'pass' and (p->'H'->>'state') = 'pass'
     and (p_role not in ('source_analysis','model_explanation','guided_practice') or (p->'D'->>'state') = 'pass')
     and (p_role not in ('independent_check','transfer','delayed_check') or (p->'E'->>'state') = 'pass')
$$;
alter function public.content_qualification_record(text,text,text,text,text,text,jsonb,text,text,text,text,text,text[],text[],text,uuid) set search_path to 'public';
alter function public.content_release_approve(uuid,text,text) set search_path to 'public';
alter function public.workspace_demand_record(text) set search_path to 'public';
alter function public.supply_artifact_revision(text,text) set search_path to 'public';
drop function if exists public.supply_delivery_valid(uuid);
revoke all on function public.supply_learner_exposure(text, text, uuid) from public, anon, authenticated;
revoke all on function public.workspace_delivery_record(uuid, uuid, uuid, uuid, uuid) from public, anon;
-- B의 알려진 안전 결함을 다시 열지 않는다. 패치된 공급 함수 재승인 전까지 호출 금지.
revoke all on function public.workspace_delivery_record(uuid, uuid, uuid, uuid, uuid) from authenticated;
revoke all on function public.content_release_revoke(uuid, text) from public, anon;
grant execute on function public.content_release_revoke(uuid, text) to authenticated;
commit;
