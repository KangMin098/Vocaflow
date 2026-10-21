-- supabase/migrations/_pending_workspace_supply_i1_d3_lineage.sql
-- ARCHIVED: 계약 미완성 당시 회귀 시험용 초안. 실제 적용 금지.
-- 대체 정본은 scripts/db/factory-i1/d3.sql 및 docs/admin-restructure/product-order-lineage.md.
-- 두 SQL을 함께 적용하지 않는다. 이 초안의 기존 시험은 새 D3 구현의 수용 근거가 아니다.
-- ⚠️ 보류(적용 안 함) — Factory I1-D3 공용 Product Order 계보. **D1/D2(safety) 와 따로 승인한다** — 이 파일 없이도 D1/D2 는 완결된다.
-- 적용 순서: C → B → I1 safety → (P) → **이 파일**. I0 delta(PR #277) 의 D3 표 초안을 대체한다(함께 적용하지 않는다).
--
-- 문제: factory_order 는 학습자별 줄에 묶이고 공장 주문과의 결속 칸이 production_run_id(text)뿐이다. 공장 계약(textbook-product-order/1)의
--       product_order_id · order_revision · order_hash 를 DB 에서 검증할 수 없고, 여러 학습자의 같은 요구를 한 생산으로 묶는 계보가 없다.
--       개발 DB 에는 Product Order 표가 없다(to_regclass 2026-10-17: textbook_product_order · product_order 모두 null) — 그래서 「실제 존재 · 현재성」을
--       검증하려면 공장 주문을 받아 적는 **등록부**가 먼저 있어야 한다.
-- 설계:
--   factory_product_order       공용 생산 주문 등록부(학습자 정보 없음). (product_order_id, order_revision) 하나에 해시 하나. 추가 전용.
--                               현재 = 그 product_order_id 의 최고 revision 이고 status = 'active'. 철회는 새 revision(status 'withdrawn').
--   factory_order_product_link  학습자별 factory_order ↔ 공용 주문 revision N:M. 추가 전용. 현재성 · 제출 해시 · TASK · 역할 검사.
--                               share_key 요구 결속 · 정본 hash 계산 · 공유 생산량 배분은 미확정: DB-3 보류 조건.
--   공용 생산과 개인 납품은 분리된다: 납품은 여전히 학습자별 workspace_content_delivery(D2 재검증)로만 생긴다. 링크는 납품이 아니다.
--   학습자 간 노출 차단: 두 표 모두 관리자 · 큐레이터 읽기만. 학습자는 자기 factory_order(B RLS)만 보고, 같은 공장 주문을 누가 공유하는지 모른다.
--   쓰기 = 아래 정의자 함수(관리자 · 큐레이터) + B/C 와 같은 writer guard. 서비스 키 직접 INSERT 거부.
--
-- 새 객체: table factory_product_order · factory_order_product_link · function factory_product_order_register · factory_order_link_product
--          · factory_product_order_is_current. 기존 객체 변경 없음.
-- 되돌리기: 두 표가 비어 있을 때만 drop function ×3, drop table factory_order_product_link, factory_product_order.
--           행이 있으면 보존 표로 복사(create table … as select) 뒤에만 drop.

create table public.factory_product_order (
  product_order_id text not null check (product_order_id ~ '^[A-Za-z0-9._:-]{1,200}$'),
  order_revision integer not null check (order_revision > 0),
  order_hash text not null check (order_hash ~ '^[0-9a-f]{64}$'),
  contract text not null check (contract = 'textbook-product-order/1'),
  status text not null check (status in ('active','withdrawn')),
  share_key text not null check (share_key ~ '^[0-9a-f]{32}$'),   -- production-need.ts shareKey(vf.production-share/2) — 학습자 정보 없음
  task_id text not null check (task_id ~ '^[a-z]\.[a-z_]{2,60}$'),
  role text not null check (role in ('source_analysis','model_explanation','guided_practice','independent_check','transfer','delayed_check')),
  quantity integer not null check (quantity between 1 and 10000),
  note text check (note is null or length(note) <= 500),
  registered_by uuid not null references auth.users(id),
  request_key uuid not null unique,
  created_at timestamptz not null default now(),
  primary key (product_order_id, order_revision),
  unique (product_order_id, order_revision, order_hash)
);
create trigger factory_product_order_append_only before update or delete on public.factory_product_order
  for each row execute function public.forbid_ledger_mutation();
create trigger factory_product_order_writer before insert on public.factory_product_order
  for each row execute function public.supply_writer_guard();

create table public.factory_order_product_link (
  order_id uuid not null references public.factory_order(id) on delete cascade,
  product_order_id text not null,
  order_revision integer not null,
  order_hash text not null,
  linked_by uuid not null references auth.users(id),
  request_key uuid not null unique,
  created_at timestamptz not null default now(),
  primary key (order_id, product_order_id, order_revision),
  foreign key (product_order_id, order_revision, order_hash)
    references public.factory_product_order(product_order_id, order_revision, order_hash)
);
create trigger factory_order_product_link_append_only before update or delete on public.factory_order_product_link
  for each row execute function public.forbid_ledger_mutation();
create trigger factory_order_product_link_writer before insert on public.factory_order_product_link
  for each row execute function public.supply_writer_guard();

alter table public.factory_product_order enable row level security;
alter table public.factory_order_product_link enable row level security;
create policy fpo_admin_read on public.factory_product_order for select using (public.is_admin_or_curator());
create policy fopl_admin_read on public.factory_order_product_link for select using (public.is_admin_or_curator());
revoke all on public.factory_product_order, public.factory_order_product_link from public, anon, authenticated;
grant select on public.factory_product_order, public.factory_order_product_link to authenticated;

/** 현재성 — 그 주문 id 의 최고 revision 이고 active 인가 */
create or replace function public.factory_product_order_is_current(p_id text, p_revision integer)
returns boolean language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select exists (select 1 from factory_product_order f where f.product_order_id = p_id and f.order_revision = p_revision and f.status = 'active'
                 and f.order_revision = (select max(g.order_revision) from factory_product_order g where g.product_order_id = p_id))
$$;
revoke all on function public.factory_product_order_is_current(text, integer) from public, anon, authenticated;

/** 등록 — 관리자 · 큐레이터. revision 은 직전 + 1 만(건너뛰기 · 되감기 거부). 같은 요청 키 = 같은 본문일 때만 멱등 */
create or replace function public.factory_product_order_register(p_id text, p_revision integer, p_hash text, p_status text,
  p_share_key text, p_task text, p_role text, p_quantity integer, p_note text, p_request_key uuid)
returns void language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare prev record; v_max integer;
begin
  if auth.uid() is null or public.is_admin_or_curator() is not true then raise exception 'Forbidden' using errcode = '42501'; end if;
  perform set_config('vocaflow.supply_writer', 'rpc', true);
  -- 같은 주문 id 의 등록을 직렬화(revision 순서 · 같은 키 재전송)
  perform pg_advisory_xact_lock(hashtext('factory_product_order:' || p_id));
  select * into prev from factory_product_order where request_key = p_request_key;
  if found then
    if (prev.product_order_id, prev.order_revision, prev.order_hash, prev.status, prev.share_key, prev.task_id, prev.role, prev.quantity)
       is distinct from (p_id, p_revision, p_hash, p_status, p_share_key, p_task, p_role, p_quantity) then
      raise exception 'product order: request_key reused with a different body' using errcode = '23505';
    end if;
    return;
  end if;
  select max(order_revision) into v_max from factory_product_order where product_order_id = p_id;
  if p_revision <> coalesce(v_max, 0) + 1 then raise exception 'product order: revision must be % (got %)', coalesce(v_max, 0) + 1, p_revision; end if;
  if v_max is not null and exists (select 1 from factory_product_order where product_order_id = p_id and (task_id, role) is distinct from (p_task, p_role)) then
    raise exception 'product order: task/role cannot change across revisions';
  end if;
  insert into factory_product_order (product_order_id, order_revision, order_hash, contract, status, share_key, task_id, role, quantity, note, registered_by, request_key)
  values (p_id, p_revision, p_hash, 'textbook-product-order/1', p_status, p_share_key, p_task, p_role, p_quantity, p_note, auth.uid(), p_request_key);
end $$;
revoke all on function public.factory_product_order_register(text, integer, text, text, text, text, text, integer, text, uuid) from public, anon;
grant execute on function public.factory_product_order_register(text, integer, text, text, text, text, text, integer, text, uuid) to authenticated;

/** 학습자 주문 ↔ 공용 주문 revision 링크 — 관리자 · 큐레이터. 현재 · active · 해시 일치 · TASK · 역할 일치 · 학습자 주문이 열려 있을 때만 */
create or replace function public.factory_order_link_product(p_order uuid, p_id text, p_revision integer, p_hash text, p_request_key uuid)
returns void language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare o record; f record; prev record;
begin
  if auth.uid() is null or public.is_admin_or_curator() is not true then raise exception 'Forbidden' using errcode = '42501'; end if;
  perform set_config('vocaflow.supply_writer', 'rpc', true);
  select * into o from factory_order where id = p_order for update;
  if not found then raise exception 'link: order not found'; end if;
  select * into prev from factory_order_product_link where request_key = p_request_key;
  if found then
    if (prev.order_id, prev.product_order_id, prev.order_revision, prev.order_hash) is distinct from (p_order, p_id, p_revision, p_hash) then
      raise exception 'link: request_key reused with a different body' using errcode = '23505';
    end if;
    return;
  end if;
  -- 이미 있는 같은 링크(다른 키) = 새로 기록할 것이 없다 — 현재성 검사 전에 같은 결과로 돌려준다(나중에 낡아도 과거 링크는 사실이다)
  if exists (select 1 from factory_order_product_link l where l.order_id = p_order and l.product_order_id = p_id
             and l.order_revision = p_revision and l.order_hash = p_hash) then
    return;
  end if;
  if o.state in ('delivered','partial','failed') then raise exception 'link: order closed (%)', o.state; end if;
  perform pg_advisory_xact_lock(hashtext('factory_product_order:' || p_id));   -- 등록(새 revision)과 직렬화
  select * into f from factory_product_order where product_order_id = p_id and order_revision = p_revision;
  if not found then raise exception 'link: product order not registered'; end if;
  if f.order_hash <> p_hash then raise exception 'link: order_hash mismatch'; end if;
  if not public.factory_product_order_is_current(p_id, p_revision) then raise exception 'link: product order revision not current or withdrawn'; end if;
  if (f.task_id, f.role) is distinct from (o.task_id, o.role) then raise exception 'link: task/role mismatch'; end if;
  insert into factory_order_product_link (order_id, product_order_id, order_revision, order_hash, linked_by, request_key)
  values (p_order, p_id, p_revision, p_hash, auth.uid(), p_request_key)
  on conflict (order_id, product_order_id, order_revision) do nothing;   -- 다른 키로 같은 링크 = 이미 있음(같은 결과)
end $$;
revoke all on function public.factory_order_link_product(uuid, text, integer, text, uuid) from public, anon;
grant execute on function public.factory_order_link_product(uuid, text, integer, text, uuid) to authenticated;
