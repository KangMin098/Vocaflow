-- supabase/migrations/_pending_workspace_supply_i1_partial.sql
-- ⚠️ 보류(적용 안 함) — Factory I1-P 부분 납품 정책. 적용 순서: C → B → I1 안전(safety) → **이 파일**. D3 와 독립.
--
-- 문제(B): 'delivered' 는 공급 행 1개로 충분했다. 요청 5 · 적격 2 인 주문도 「납품 완료」가 되고, 남은 3 은 어디에도 기록되지 않았다.
-- 정책(최소 변경 — 기존 상태 · 전이는 그대로 두고 닫힘 상태 하나만 더한다):
--   · delivered = 전이 시점에 유효한 그 주문의 공급 수 = 주문 수량(전량). 이후 철회는 이력 대신 현재 충족도만 내린다.
--   · partial   = 새 닫힘 상태. 1 ≤ 현재 유효 공급 수 < 주문 수량 · 공백 아닌 이유 필수. stock_search · reviewing 에서만 들어간다.
--   · 남은 부족 = 줄 수량 − 그 줄의 **지금 유효한** 공급 수(supply_delivery_valid). 주문 상태가 아니라 줄에서 계산한다
--                (권리 철회 · 산출물 변경으로 이미 공급된 자료가 무효가 되면 부족이 다시 생긴다).
--   · 재주문: shortfall = 직전 주문이 partial 또는 delivered(뒤에 무효 발생) · 수량 ≤ 남은 부족.
--             retry_after_failure = 직전 failed(B 그대로) · plan_revision = 직전 닫힘 아무것. 모든 재주문 수량 ≤ 남은 부족.
--             initial 수량 ≤ 줄 수량.
--   · PLAN 변경: 새 PLAN 은 새 수요 · 새 줄이 된다(B 의 수요 서명). 옛 줄의 열린 주문은 관리자가 held/failed 로 닫는다 — 자동 취소 없음.
--   · 수요 완료 표시는 workspace_line_fulfillment 의 shortfall = 0 일 때만(앱 fulfillmentOf 와 같은 뜻).
--
-- 바뀌는 객체: factory_order.state CHECK(+'partial') · 부분 고유 인덱스 factory_order_one_open_per_line(닫힘에 partial 포함)
--             · function factory_order_transition · factory_order_open(같은 서명) · 새 function workspace_line_fulfillment(uuid)
-- 데이터 변경 없음(B 적용 직후에는 주문 0행). 되돌리기: partial 행이 0일 때만 CHECK · 인덱스 · 두 함수를 B 원본으로, drop workspace_line_fulfillment.
--           partial 행이 있으면 되돌리지 않는다(닫힌 주문을 다시 열린 것으로 보이게 만든다).

alter table public.factory_order drop constraint factory_order_state_check;
alter table public.factory_order add constraint factory_order_state_check
  check (state in ('requested','stock_search','awaiting_production','producing','reviewing','delivered','partial','held','failed'));
drop index public.factory_order_one_open_per_line;
create unique index factory_order_one_open_per_line on public.factory_order (line_id)
  where state not in ('delivered','partial','failed');

/** 줄 충족도 — 요청 · 공급 기록 · 지금 유효한 공급 · 남은 부족. 본인 또는 관리자만(다른 학습자 줄은 not found 와 같은 오류) */
create or replace function public.workspace_line_fulfillment(p_line uuid)
returns table (requested int, delivered_total int, delivered_valid int, shortfall int)
language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $$
declare ln record;
begin
  if auth.uid() is null then raise exception 'Forbidden' using errcode = '42501'; end if;
  select * into ln from workspace_content_demand_line l where l.id = p_line and (l.user_id = auth.uid() or public.is_admin_or_curator());
  if not found then raise exception 'fulfillment: line not found or not owned' using errcode = '42501'; end if;
  return query
    select ln.quantity::int,
           count(d.id)::int,
           count(d.id) filter (where public.supply_delivery_valid(d.id))::int,
           greatest(0, ln.quantity - count(d.id) filter (where public.supply_delivery_valid(d.id)))::int
    from workspace_content_delivery d where d.line_id = p_line;
end $$;
revoke all on function public.workspace_line_fulfillment(uuid) from public, anon;
grant execute on function public.workspace_line_fulfillment(uuid) to authenticated;

/** 주문 열기 — B 와 같고 (P) 재주문 이유 · 수량을 남은 부족에 묶는다 */
create or replace function public.factory_order_open(p_line uuid, p_reason text, p_quantity smallint, p_request_key uuid)
returns uuid language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare v_uid uuid := auth.uid(); ln record; v_id uuid; v_prev record; v_seq smallint; v_short int;
begin
  if v_uid is null then raise exception 'Forbidden' using errcode = '42501'; end if;
  perform set_config('vocaflow.supply_writer', 'rpc', true);
  select * into ln from workspace_content_demand_line where id = p_line and user_id = v_uid for update;
  select id, line_id, reason, quantity into v_prev from factory_order where user_id = v_uid and request_key = p_request_key;
  if found then
    if (v_prev.line_id, v_prev.reason, v_prev.quantity) is distinct from (p_line, p_reason, p_quantity) then
      raise exception 'order: request_key reused with a different body' using errcode = '23505';
    end if;
    return v_prev.id;
  end if;
  if ln.id is null then raise exception 'order: line not found or not owned' using errcode = '42501'; end if;
  select * into v_prev from factory_order where line_id = p_line order by order_seq desc limit 1;
  if found and v_prev.state not in ('delivered','partial','failed') then raise exception 'order: open order exists' using errcode = '23505'; end if;
  if not found and p_reason <> 'initial' then raise exception 'order: first order must be initial'; end if;
  if found and p_reason = 'initial' then raise exception 'order: reorder needs a reason'; end if;
  if found and p_reason = 'retry_after_failure' and v_prev.state <> 'failed' then raise exception 'order: retry needs a failed parent'; end if;
  -- (P) 부족분 재주문은 부분 납품 · 납품 뒤에만
  if found and p_reason = 'shortfall' and v_prev.state not in ('partial','delivered') then raise exception 'order: shortfall needs a partial or delivered parent'; end if;
  -- (P) 수량 ≤ 남은 부족(지금 유효한 공급 기준)
  select count(*) into v_short from workspace_content_delivery d where d.line_id = p_line and public.supply_delivery_valid(d.id);
  v_short := ln.quantity - v_short;
  if v_short <= 0 then raise exception 'order: line already fully supplied'; end if;
  if p_quantity > v_short then raise exception 'order: quantity % exceeds remaining shortfall %', p_quantity, v_short; end if;
  v_seq := coalesce(v_prev.order_seq, 0) + 1;
  insert into factory_order (line_id, user_id, workspace_id, role, task_id, order_seq, reason, parent_order_id, quantity, request_key)
  values (p_line, v_uid, ln.workspace_id, ln.role, ln.task_id, v_seq, p_reason, case when v_prev.id is null then null else v_prev.id end, p_quantity, p_request_key)
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.factory_order_open(uuid, text, smallint, uuid) from public, anon;
grant execute on function public.factory_order_open(uuid, text, smallint, uuid) to authenticated;

/** 주문 전이 — B 와 같고 (P) delivered = 전량 · partial = 일부(이유 필수) */
create or replace function public.factory_order_transition(p_order uuid, p_expected text, p_to text, p_reason text,
  p_run_id text, p_qualification uuid, p_request_key uuid)
returns integer language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare o record; v_seq int; ok boolean; e record; v_n int;
begin
  if auth.uid() is null or not public.is_admin_or_curator() then raise exception 'Forbidden' using errcode = '42501'; end if;
  perform set_config('vocaflow.supply_writer', 'rpc', true);
  -- 공급/재주문과 같은 줄 → 주문 순서. 닫힘 검사와 공급 INSERT가 교차하지 않는다.
  perform 1 from workspace_content_demand_line where id = (select line_id from factory_order where id = p_order) for update;
  select * into o from factory_order where id = p_order for update;
  if not found then raise exception 'order: not found'; end if;
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
    ('stock_search','delivered'),('stock_search','partial'),('stock_search','awaiting_production'),('stock_search','held'),('stock_search','failed'),
    ('awaiting_production','producing'),('awaiting_production','held'),('awaiting_production','failed'),
    ('producing','reviewing'),('producing','failed'),
    ('reviewing','delivered'),('reviewing','partial'),('reviewing','held'),('reviewing','failed'),
    ('held','stock_search'),('held','awaiting_production'),('held','failed'));
  if not ok then raise exception 'order: transition % -> % not allowed', o.state, p_to; end if;
  -- 종결 시점의 자격/승인 유효성을 고정한다. supersede(FOR UPDATE) · 철회(FOR UPDATE)와 직렬화.
  perform 1 from content_qualification q where q.id in (
    select d.qualification_id from workspace_content_delivery d where d.order_id = p_order) order by q.id for share;
  perform 1 from content_release_approval a where a.qualification_id in (
    select d.qualification_id from workspace_content_delivery d where d.order_id = p_order) order by a.id for share;
  select count(*) into v_n from workspace_content_delivery d where d.order_id = p_order and public.supply_delivery_valid(d.id);
  if p_to = 'delivered' then
    if not exists (select 1 from workspace_content_delivery d where d.order_id = p_order and d.qualification_id = p_qualification and public.supply_delivery_valid(d.id)) then
      raise exception 'order: delivered needs a delivery row with this qualification';
    end if;
    if v_n < o.quantity then raise exception 'order: delivered needs full quantity (% of %) — use partial', v_n, o.quantity; end if;
  elsif p_to = 'partial' then
    if p_reason is null or length(btrim(p_reason)) = 0 then raise exception 'order: partial needs a reason'; end if;
    if v_n = 0 then raise exception 'order: partial needs at least one delivery — use failed'; end if;
    if v_n >= o.quantity then raise exception 'order: partial with full quantity — use delivered'; end if;
  end if;
  v_seq := o.event_seq + 1;
  insert into factory_order_event (order_id, seq, from_state, to_state, reason, production_run_id, qualification_id, actor, request_key)
  values (p_order, v_seq, o.state, p_to, p_reason, p_run_id, p_qualification, auth.uid(), p_request_key);
  update factory_order set state = p_to, event_seq = v_seq,
    production_run_id = coalesce(p_run_id, production_run_id) where id = p_order;
  return v_seq;
end $$;
revoke all on function public.factory_order_transition(uuid, text, text, text, text, uuid, uuid) from public, anon;
grant execute on function public.factory_order_transition(uuid, text, text, text, text, uuid, uuid) to authenticated;
