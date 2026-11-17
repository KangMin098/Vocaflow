-- supabase/migrations/_pending_factory_dcp_admission.sql
-- ⚠️ 보류(적용 안 함) — 단계 1C. 공유 DB 적용은 별도 사용자 승인(L4). 격리 PGlite 시험에서만 적용한다.
--
-- 무엇: 원문 파생 DCP 후보(1B 지도 연습 문항)를 기존 csat_dcp_items 에 **후보**로 넣고, 그 등록 영수증을 추가 전용으로 남긴다.
--   · 자격 · 출시 승인 · 학습자 공급은 기존 RPC(content_qualification_record · content_release_approve ·
--     factory_order_open · workspace_delivery_record)를 그대로 쓴다. 이 파일은 새 자격 · 승인 체계를 만들지 않는다.
--   · 후보 insert 와 영수증은 한 함수 안에서 원자적이다. 같은 요청 키 + 같은 본문 = 같은 결과, 다른 본문 = 거절.
--   · 기존 문항 자리(kind, ref_id, type, paragraph_idx)를 덮어쓰지 않는다.
--   · 실제 등록된 현재 공장 주문(D3 factory_product_order)이 없으면 거절 — 합성 준비본은 실등록되지 않는다.
--   · 역할은 guided_practice · TASK r.central_meaning · 유형 topic/title/main_point 만(현재 단계 범위).
--   · 검수 기록 종류는 'ai' 만 받는다. 사람 검수 문구를 쓰지 않는다(권리 · Gold 사람 결정과 별개).
--   · supply_artifact_revision 을 감싸, 등록된 후보의 **원문 본문이 등록 뒤 바뀌면** revision = null(공급 거절 · 현재 유효성 false).
--     _pending_authored_supply.sql 이 나중에 이 함수를 다시 감싸도 이름이 겹치지 않는다(이 파일의 원본 이름은 *_pre_dcp_admission).
--   · 자격은 factory_dcp_qualify 가 기존 content_qualification_record 를 한 트랜잭션에서 호출하고 후보당 1건 영수증으로 잠근다
--     (자격 실패 · 응답 유실 뒤 재요청 = 같은 자격 id, 행 추가 없음).
--   · workspace_delivery_record 를 감싸, 등록 후보 공급은 현재 개인 계보(factory_lineage_personal_current) +
--     그 주문의 D3 제품주문 링크(factory_order_link_product 가 만든 행) + 제품주문 현재성을 확인한다. 확인 전에
--     map_goal → map_plan 자문 잠금(csat_map_goal_set · learner_workspace_plan_commit 과 같은 키) → Workspace 행 → 주문 행 순서로 잠근다.
-- 전제: C → B → I1-S → I2 → G2 → D3(20261020063000) 적용 뒤, library_articles 존재.
-- 되돌리기: drop function factory_dcp_admit(uuid,jsonb); drop function supply_artifact_revision(text,text);
--           alter function supply_artifact_revision_pre_dcp_admission(text,text) rename to supply_artifact_revision;
--           drop function workspace_delivery_record(uuid,uuid,uuid,uuid,uuid);
--           alter function workspace_delivery_record_pre_dcp_admission(uuid,uuid,uuid,uuid,uuid) rename to workspace_delivery_record; (authenticated 실행 권한 복원)
--           drop function factory_dcp_qualify(uuid,jsonb); drop table factory_dcp_qualification;
--           drop table factory_dcp_admission;  (등록된 csat_dcp_items 후보 행 삭제는 별도 데이터 삭제 승인)

do $$
declare v_missing text[];
begin
  select array_agg(x) into v_missing from unnest(array[
    'public.supply_artifact_revision(text,text)', 'public.content_release_approve(uuid,text,text)',
    'public.workspace_delivery_record(uuid,uuid,uuid,uuid,uuid)', 'public.factory_product_order_is_current(text,integer)',
    'public.forbid_ledger_mutation()', 'public.csat_source_is_eligible(uuid)',
    'public.factory_lineage_personal_current(uuid)', 'public.factory_order_link_product(uuid,uuid,text,integer,text,text,integer,text,uuid)',
    'public.content_qualification_record(text,text,text,text,text,text,jsonb,text,text,text,text,text,text,text,text[],text[],text,uuid)']) x where to_regprocedure(x) is null;
  if v_missing is not null or to_regclass('public.library_articles') is null or to_regclass('public.factory_product_order') is null then
    raise exception 'dcp admission requires C/B/I1/I2/G2/D3 + library_articles first (missing %)', v_missing;
  end if;
  if to_regclass('public.factory_dcp_admission') is not null then raise exception 'dcp admission already installed'; end if;
end $$;

-- ── 등록 영수증(추가 전용) ───────────────────────────────────────────────
create table public.factory_dcp_admission (
  id uuid primary key default gen_random_uuid(),
  request_key uuid not null unique,
  dcp_item_id uuid not null unique references public.csat_dcp_items(id),
  body jsonb not null,
  body_hash text not null check (body_hash ~ '^[0-9a-f]{64}$'),
  source_id uuid not null,
  source_content_sha256 text not null check (source_content_sha256 ~ '^[0-9a-f]{64}$'),
  artifact_revision text not null check (artifact_revision ~ '^[0-9a-f]{64}$'),
  product_order_id text not null,
  order_revision integer not null,
  order_hash text not null check (order_hash ~ '^[0-9a-f]{64}$'),
  role text not null check (role = 'guided_practice'),
  task_id text not null check (task_id = 'r.central_meaning'),
  review_kind text not null check (review_kind = 'ai'),
  review_model text not null check (review_model in ('claude','codex')),
  review_sha256 text not null check (review_sha256 ~ '^[0-9a-f]{64}$'),
  admitted_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (product_order_id, order_revision, order_hash) references public.factory_product_order(product_order_id, order_revision, order_hash)
);
create trigger factory_dcp_admission_append_only before update or delete on public.factory_dcp_admission
  for each row execute function public.forbid_ledger_mutation();
create trigger factory_dcp_admission_writer before insert on public.factory_dcp_admission
  for each row execute function public.supply_writer_guard();
alter table public.factory_dcp_admission enable row level security;
create policy fda_admin_read on public.factory_dcp_admission for select using (public.is_admin_or_curator());
revoke all on public.factory_dcp_admission from public, anon, authenticated;
grant select on public.factory_dcp_admission to authenticated;

-- ── 후보 등록 — 관리자 · 큐레이터 세션만. 본문은 TS(dcp-admission.ts)가 만든 계획 그대로 ─────────────
create function public.factory_dcp_admit(p_request_key uuid, p_body jsonb)
returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare
  prev record; ex record; v_hash text; v_src uuid; v_content text; v_id uuid; v_rev text;
  r jsonb := p_body->'row'; o jsonb := p_body->'order'; rv jsonb := p_body->'review';
begin
  if auth.uid() is null or public.is_admin_or_curator() is not true then raise exception 'Forbidden' using errcode = '42501'; end if;
  if p_request_key is null or p_body is null or jsonb_typeof(p_body) <> 'object' then raise exception 'admission: required body'; end if;
  perform set_config('vocaflow.supply_writer', 'rpc', true);
  v_hash := encode(sha256(convert_to(p_body::text, 'UTF8')), 'hex');
  perform pg_advisory_xact_lock(hashtextextended('factory_dcp_admission:' || p_request_key::text, 0));

  -- ① 같은 요청 키 = 같은 본문일 때만 이전 결과
  select * into prev from factory_dcp_admission where request_key = p_request_key;
  if found then
    if prev.body_hash <> v_hash then raise exception 'admission: request_key reused with a different body' using errcode = '23505'; end if;
    return jsonb_build_object('dcp_item_id', prev.dcp_item_id, 'artifact_revision', prev.artifact_revision, 'replayed', true);
  end if;

  -- ② 본문 범위 — 현재 단계(지도 연습 · 중심 의미 · 기사 원천)만
  if p_body->>'schema' is distinct from 'vf.dcp-admission/1' then raise exception 'admission: schema'; end if;
  if p_body->>'synthetic_demand' is distinct from 'false' then raise exception 'admission: synthetic demand cannot be admitted'; end if;
  if p_body->>'role' is distinct from 'guided_practice' or p_body->>'task' is distinct from 'r.central_meaning' then
    raise exception 'admission: only guided_practice x r.central_meaning is supported';
  end if;
  if r->>'kind' is distinct from 'article' or r->>'type' not in ('topic','title','main_point') or (r->>'paragraph_idx') is null
     or jsonb_typeof(r->'payload') <> 'object' or jsonb_typeof(r->'answer_key') <> 'object'
     or jsonb_array_length(r->'payload'->'choices') <> 5 or coalesce(btrim(r->'payload'->>'stem_ko'), '') = ''
     or coalesce(btrim(r->'payload'->>'passage'), '') = '' or (r->'answer_key'->>'answer')::int not between 1 and 5 then
    raise exception 'admission: row shape';
  end if;
  if rv->>'kind' is distinct from 'ai' or rv->>'model' not in ('claude','codex') or coalesce(rv->>'sha256', '') !~ '^[0-9a-f]{64}$' then
    raise exception 'admission: AI review reference required';
  end if;

  -- ③ 실제 등록된 현재 공장 주문(합성 준비본 · 철회 · 낡은 판 거절)
  if public.factory_product_order_is_current(o->>'product_order_id', (o->>'order_revision')::int) is not true
     or not exists (select 1 from factory_product_order f where f.product_order_id = o->>'product_order_id'
                    and f.order_revision = (o->>'order_revision')::int and f.order_hash = o->>'order_hash'
                    and f.spec->>'role' = 'guided_practice' and f.spec->>'task' = 'r.central_meaning') then
    raise exception 'admission: registered current product order required';
  end if;

  -- ④ 원문 — 지금 DB 행의 본문 hash 가 계획과 같고 지금 적격일 때만
  v_src := (p_body->'source'->>'id')::uuid;
  select a.content into v_content from library_articles a where a.id = v_src;
  if v_content is null then raise exception 'admission: source not found'; end if;
  if encode(sha256(convert_to(v_content, 'UTF8')), 'hex') is distinct from p_body->'source'->>'content_sha256' then
    raise exception 'admission: source changed since review';
  end if;
  if public.csat_source_is_eligible(v_src) is not true then raise exception 'admission: source not eligible'; end if;
  if (r->>'ref_id')::uuid is distinct from v_src then raise exception 'admission: row source mismatch'; end if;

  if p_body ? 'existing' then
    -- ⑤' 명시적 재사용(04-EXISTING-DCP-REUSE-SPEC) — 지정한 현재 행을 잠그고 자연키 · practice · 본문 JSONB 동등성을 다시 잰다.
    --     기존 행은 수정 · 삭제하지 않고 영수증만 더한다. 새 id 를 만들지 않는다.
    if jsonb_typeof(p_body->'existing') <> 'object' or coalesce(p_body->'existing'->>'dcp_item_id', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or coalesce(p_body->'existing'->>'row_sha256', '') !~ '^[0-9a-f]{64}$' then
      raise exception 'admission: existing reference shape';
    end if;
    v_id := (p_body->'existing'->>'dcp_item_id')::uuid;
    select * into ex from csat_dcp_items i where i.id = v_id for update;
    if not found then raise exception 'admission: existing dcp item not found'; end if;
    if ex.kind is distinct from 'article' or ex.ref_id is distinct from v_src or ex.type is distinct from r->>'type'
       or ex.paragraph_idx is distinct from (r->>'paragraph_idx')::int or ex.item_role is distinct from 'practice' then
      raise exception 'admission: existing dcp item identity mismatch';
    end if;
    if ex.payload is distinct from r->'payload' or ex.answer_key is distinct from r->'answer_key' then
      raise exception 'admission: existing dcp item changed since review';
    end if;
    if exists (select 1 from factory_dcp_admission a where a.dcp_item_id = v_id) then
      raise exception 'admission: existing dcp item already admitted' using errcode = '23505';
    end if;
  else
    -- ⑤ 기존 문항 자리를 덮어쓰지 않는다
    if exists (select 1 from csat_dcp_items i where i.kind = 'article' and i.ref_id = v_src and i.type = r->>'type'
               and i.paragraph_idx = (r->>'paragraph_idx')::int) then
      raise exception 'admission: dcp slot occupied (kind, ref_id, type, paragraph_idx)' using errcode = '23505';
    end if;

    insert into csat_dcp_items (kind, ref_id, type, item_role, payload, answer_key, paragraph_idx)
    values ('article', v_src, r->>'type', 'practice', r->'payload', r->'answer_key', (r->>'paragraph_idx')::int)
    returning id into v_id;
  end if;
  v_rev := public.supply_artifact_revision_pre_dcp_admission('dcp_item', v_id::text);
  if v_rev is null then raise exception 'admission: revision unavailable'; end if;

  insert into factory_dcp_admission (request_key, dcp_item_id, body, body_hash, source_id, source_content_sha256, artifact_revision,
    product_order_id, order_revision, order_hash, role, task_id, review_kind, review_model, review_sha256, admitted_by)
  values (p_request_key, v_id, p_body, v_hash, v_src, p_body->'source'->>'content_sha256', v_rev,
    o->>'product_order_id', (o->>'order_revision')::int, o->>'order_hash', 'guided_practice', 'r.central_meaning',
    'ai', rv->>'model', rv->>'sha256', auth.uid());
  return jsonb_build_object('dcp_item_id', v_id, 'artifact_revision', v_rev, 'replayed', false);
end $$;
revoke all on function public.factory_dcp_admit(uuid, jsonb) from public, anon;
grant execute on function public.factory_dcp_admit(uuid, jsonb) to authenticated;

-- ── revision 감싸기 — 등록 후보의 원문이 바뀌면 null ───────────────────────────────
alter function public.supply_artifact_revision(text, text) rename to supply_artifact_revision_pre_dcp_admission;
revoke all on function public.supply_artifact_revision_pre_dcp_admission(text, text) from public, anon, authenticated;
create function public.supply_artifact_revision(p_kind text, p_ref text)
returns text language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $$
declare a record;
begin
  if p_kind = 'dcp_item' and p_ref ~ '^[0-9a-f-]{36}$' then
    select x.source_id, x.source_content_sha256 into a from factory_dcp_admission x where x.dcp_item_id = p_ref::uuid;
    if found and not exists (select 1 from library_articles l where l.id = a.source_id
                             and encode(sha256(convert_to(l.content, 'UTF8')), 'hex') = a.source_content_sha256) then
      return null;
    end if;
  end if;
  return public.supply_artifact_revision_pre_dcp_admission(p_kind, p_ref);
end $$;
revoke all on function public.supply_artifact_revision(text, text) from public, anon, authenticated;

-- ── 자격 기록 영수증 — 등록 후보 1건당 자격 1건(멱등 · 응답 유실 복구) ──────────────────────────
-- 기존 content_qualification_record 를 그대로 호출한다(새 자격 체계 아님). 같은 인자 재요청 = 같은 자격 id,
-- 다른 인자 = 거절. 보류(held) 후보를 나중에 개선하려면 새 판본을 새로 등록한다 — 이전 자격 · 승인을 상속하지 않는다.
create table public.factory_dcp_qualification (
  dcp_item_id uuid primary key references public.factory_dcp_admission(dcp_item_id),
  artifact_revision text not null,
  args_hash text not null check (args_hash ~ '^[0-9a-f]{64}$'),
  qualification_id uuid not null unique references public.content_qualification(id),
  recorded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
create trigger factory_dcp_qualification_append_only before update or delete on public.factory_dcp_qualification
  for each row execute function public.forbid_ledger_mutation();
create trigger factory_dcp_qualification_writer before insert on public.factory_dcp_qualification
  for each row execute function public.supply_writer_guard();
alter table public.factory_dcp_qualification enable row level security;
create policy fdq_admin_read on public.factory_dcp_qualification for select using (public.is_admin_or_curator());
revoke all on public.factory_dcp_qualification from public, anon, authenticated;
grant select on public.factory_dcp_qualification to authenticated;

-- Supabase grants service_role mutation privileges by default. Keep these receipts RPC-only even for backend clients.
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'revoke all on table public.factory_dcp_admission, public.factory_dcp_qualification from service_role';
    execute 'grant select on table public.factory_dcp_admission, public.factory_dcp_qualification to service_role';
  end if;
end $$;

create function public.factory_dcp_qualify(p_dcp_item uuid, p_args jsonb)
returns uuid language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare a record; prev record; v_hash text; v_id uuid;
begin
  if auth.uid() is null or public.is_admin_or_curator() is not true then raise exception 'Forbidden' using errcode = '42501'; end if;
  if p_dcp_item is null or p_args is null or jsonb_typeof(p_args) <> 'object' then raise exception 'qualify: required body'; end if;
  -- 등록 영수증 행을 잠가 같은 후보의 동시 자격 기록을 직렬화한다
  select * into a from factory_dcp_admission where dcp_item_id = p_dcp_item for update;
  if not found then raise exception 'qualify: candidate not admitted'; end if;
  v_hash := encode(sha256(convert_to(p_args::text, 'UTF8')), 'hex');
  select * into prev from factory_dcp_qualification where dcp_item_id = p_dcp_item;
  if found then
    if prev.args_hash <> v_hash then raise exception 'qualify: already qualified with a different body' using errcode = '23505'; end if;
    return prev.qualification_id;
  end if;
  if p_args->>'p_kind' is distinct from 'dcp_item' or p_args->>'p_ref' is distinct from p_dcp_item::text
     or p_args->>'p_revision' is distinct from a.artifact_revision or p_args->>'p_source_hash' is distinct from a.source_content_sha256
     or p_args->>'p_task' is distinct from a.task_id or p_args->>'p_role' is distinct from a.role
     or (p_args ? 'p_supersedes' and p_args->>'p_supersedes' is not null) then
    raise exception 'qualify: arguments do not match the admission receipt';
  end if;
  if public.supply_artifact_revision('dcp_item', p_dcp_item::text) is distinct from a.artifact_revision then
    raise exception 'qualify: artifact changed since admission';
  end if;
  v_id := public.content_qualification_record(
    p_args->>'p_rules_version', 'dcp_item', p_dcp_item::text, a.artifact_revision, a.task_id, a.role, p_args->'p_axes',
    p_args->>'p_source_revision', a.source_content_sha256, p_args->>'p_analysis_revision', p_args->>'p_gold_revision', p_args->>'p_gold_hash',
    p_args->>'p_annotation_ref', p_args->>'p_annotation_hash',
    array(select jsonb_array_elements_text(coalesce(p_args->'p_defects', '[]'::jsonb))),
    array(select jsonb_array_elements_text(coalesce(p_args->'p_evidence_ids', '[]'::jsonb))),
    p_args->>'p_method', null);
  if v_id is null then raise exception 'qualify: qualification not recorded'; end if;
  insert into factory_dcp_qualification (dcp_item_id, artifact_revision, args_hash, qualification_id, recorded_by)
  values (p_dcp_item, a.artifact_revision, v_hash, v_id, auth.uid());
  return v_id;
end $$;
revoke all on function public.factory_dcp_qualify(uuid, jsonb) from public, anon;
grant execute on function public.factory_dcp_qualify(uuid, jsonb) to authenticated;

-- ── 납품 감싸기 — 등록 후보의 공급은 현재 개인 계보 + D3 제품주문 링크가 같은 트랜잭션에서 맞을 때만 ──────────
-- 목표 → 계획 자문 잠금(승인 writer 와 같은 키) → Workspace 행 → 개인 주문 행을 잠근 채 factory_lineage_personal_current(goal/plan/Workspace/line) · 그 주문에 링크된 제품주문 =
-- 등록 영수증의 제품주문 · 제품주문 현재성(철회 · 새 판 없음)을 확인하고 기존 함수로 넘긴다. 등록 후보가 아닌 자격은 그대로 넘긴다.
alter function public.workspace_delivery_record(uuid, uuid, uuid, uuid, uuid) rename to workspace_delivery_record_pre_dcp_admission;
revoke all on function public.workspace_delivery_record_pre_dcp_admission(uuid, uuid, uuid, uuid, uuid) from public, anon, authenticated;
create function public.workspace_delivery_record(p_line uuid, p_order uuid, p_qualification uuid, p_approval uuid, p_request_key uuid)
returns uuid language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare a record; o record; v_user uuid; v_ws uuid; v_template text;
begin
  select x.* into a from content_qualification q join factory_dcp_admission x on x.dcp_item_id::text = q.artifact_ref
   where q.id = p_qualification and q.artifact_kind = 'dcp_item';
  -- 같은 요청 키 재전송은 기존 함수의 멱등 판정으로(납품 뒤 주문 상태가 바뀌어도 같은 결과를 돌려준다)
  if found and not exists (select 1 from workspace_content_delivery w where w.request_key = p_request_key and w.user_id = auth.uid()) then
    -- 잠금 순서(현재성 조회 전): ① map_goal 자문 잠금 → ② map_plan 자문 잠금 → ③ learner_workspace 행 → ④ factory_order 행.
    --   ①② 는 승인된 writer(csat_map_goal_set · learner_workspace_plan_commit)와 **같은 키**라 목표 · 계획 insert 와 직렬화된다.
    --   사용자 · 템플릿은 클라이언트 인자가 아니라 auth.uid() 소유 주문 → 그 Workspace 행에서 유도한다.
    select f.user_id, f.workspace_id into v_user, v_ws from factory_order f where f.id = p_order and f.user_id = auth.uid();
    if not found then raise exception 'dcp supply: order/line identity mismatch'; end if;
    select w.template_id into v_template from learner_workspace w where w.id = v_ws and w.user_id = v_user;
    if not found then raise exception 'dcp supply: workspace not found'; end if;
    perform pg_advisory_xact_lock(hashtext('map_goal:' || v_user::text));
    perform pg_advisory_xact_lock(hashtext('map_plan:' || v_user::text || ':' || v_template));
    -- Workspace 상태 변경(닫기 등)은 행 잠금으로 막는다. 잠근 뒤 소유 · 템플릿을 다시 확인한다
    perform 1 from learner_workspace w where w.id = v_ws and w.user_id = v_user and w.template_id = v_template for update;
    if not found then raise exception 'dcp supply: workspace changed'; end if;
    select * into o from factory_order where id = p_order for update;
    if not found or o.line_id is distinct from p_line or o.user_id is distinct from auth.uid()
       or o.user_id is distinct from v_user or o.workspace_id is distinct from v_ws then
      raise exception 'dcp supply: order/line identity mismatch';
    end if;
    if public.factory_lineage_personal_current(p_order) is not true then raise exception 'dcp supply: personal lineage not current'; end if;
    if not exists (select 1 from factory_order_product_link k where k.order_id = p_order and k.product_order_id = a.product_order_id
                   and k.order_revision = a.order_revision and k.order_hash = a.order_hash) then
      raise exception 'dcp supply: order not linked to the admitted product order';
    end if;
    if public.factory_product_order_is_current(a.product_order_id, a.order_revision) is not true then
      raise exception 'dcp supply: product order not current';
    end if;
  end if;
  return public.workspace_delivery_record_pre_dcp_admission(p_line, p_order, p_qualification, p_approval, p_request_key);
end $$;
revoke all on function public.workspace_delivery_record(uuid, uuid, uuid, uuid, uuid) from public, anon;
grant execute on function public.workspace_delivery_record(uuid, uuid, uuid, uuid, uuid) to authenticated;
