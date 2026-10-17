-- supabase/deploy/factory-i1/db2-restore.sql
-- 생성물(scripts/db/factory-i1/restore.mjs). DB-2(20261017200100) 를 커밋 뒤 되돌린다 → DB-1 직후 상태.
-- 보존 조건: factory_order.state = 'partial' 행이 있으면 거절(닫힌 주문을 열린 것으로 보이게 만든다). D3 표가 있으면 거절(D3 를 먼저).
-- 함수 정의 출처: factory_order_open = B 원본 · factory_order_transition = S 원본(글자 그대로).
begin;
set local lock_timeout = '15s';
lock table public.factory_order in access exclusive mode;
do $vf$ begin
  if to_regclass('public.factory_product_order') is not null or to_regclass('public.factory_order_product_link') is not null then
    raise exception 'RESTORE_BLOCKED D3 표가 있다 — D3 를 먼저 되돌린다';
  end if;
  if exists (select 1 from public.factory_order where state = 'partial') then
    raise exception 'RESTORE_BLOCKED partial 주문이 있다 — 되돌리지 않는다(보존)';
  end if;
end $vf$;
drop function public.workspace_line_fulfillment(uuid);
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
returns integer language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare o record; v_seq int; ok boolean; e record;
begin
  if auth.uid() is null or public.is_admin_or_curator() is not true then raise exception 'Forbidden' using errcode = '42501'; end if;
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
alter function public.factory_order_open(uuid,text,smallint,uuid) set search_path to 'public', 'pg_temp';
alter function public.factory_order_transition(uuid,text,text,text,text,uuid,uuid) set search_path to 'public', 'pg_temp';
delete from supabase_migrations.schema_migrations where version = '20261017200100';
commit;
