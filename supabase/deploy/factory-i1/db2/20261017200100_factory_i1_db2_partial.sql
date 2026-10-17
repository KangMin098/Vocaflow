-- supabase/deploy/factory-i1/db2/20261017200100_factory_i1_db2_partial.sql
-- Factory I1 DB2 — 생성물(scripts/db/factory-i1/build.mjs). 손으로 고치지 않는다. 검증: node scripts/db/factory-i1/build.mjs --check
-- 대상 프로젝트 jajenrevcbmrpaliomxv · 이전 이력 최댓값 20261014091841 · 버전 20261017200100 (factory_i1_db2_partial)
-- 원본 세그먼트(바이트 그대로): P=_pending_workspace_supply_i1_partial.sql sha256=79807c38244982389ad2eb25b36350bc7121a84cc10b5ab54a1293b758e95041
-- 원자 단위: 이 파일 전체가 한 트랜잭션이어야 한다. 프롤로그가 xid 를 표식하고 세그먼트 경계마다 같은 xid 인지 확인한다
--   (비원자 러너는 첫 DDL 전에 DEPLOY_BLOCKED[atomicity] 로 멈춘다). 에필로그가 카탈로그 diff 를 허용 목록과 비교한다.
-- 적용: node scripts/db/factory-i1/deploy.mjs apply --stage db2 …  (절차: docs/csat-learner/v62/FACTORY_I1_DEPLOY_PACKAGE.md)
-- ⚠️ DB-2 는 DB-1 실DB 적용 · 검증 기록 뒤에만. 이 파일은 supabase/migrations 밖에 둔다(승격은 별도 PR).

-- ── VF 프롤로그: 차단 조건 검사 · 트랜잭션 표식 · 적용 전 카탈로그 지문 ────────────────
set local lock_timeout = '15s';
set local statement_timeout = '120s';
do $vf$
declare v_bad text[]; v_hist boolean := false;
begin
  perform set_config('vf.i1_deploy_xid', txid_current()::text, true);
  perform set_config('vf.i1_deploy_stage', 'db2', true);
  perform set_config('vf.i1_db1_sha', '766b88841cc65511592d847f4da3d87a2441a44682d5f4f1383f25ab2c1fa211', true);
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    execute 'select exists (select 1 from supabase_migrations.schema_migrations)' into v_hist;
  end if;
  if v_hist then
    if exists (select 1 from supabase_migrations.schema_migrations where version = '20261017200100') then
      raise exception 'DEPLOY_BLOCKED[history] 버전 20261017200100 이 이미 이력에 있다';
    end if;
    if not exists (select 1 from supabase_migrations.schema_migrations where version = '20261017200000'
                   and encode(sha256(convert_to(array_to_string(statements, ''), 'UTF8')), 'hex') = current_setting('vf.i1_db1_sha', true)) then
      raise exception 'DEPLOY_BLOCKED[history] DB-1(20261017200000) 이 이력에 없거나 본문 sha256 이 패키지와 다르다 — DB-1 실DB 검증 전에는 DB-2 를 적용하지 않는다';
    end if;
  end if;
  select array_agg(x) into v_bad from unnest(array['auth.users', 'public.learner_workspace', 'public.learner_workspace_plan', 'public.csat_map_goal_version', 'public.csat_items', 'public.csat_dcp_items', 'public.csat_dx_response', 'public.csat_dx_session', 'public.learning_task_attempts', 'public.learning_sessions', 'public.csat_trap_attempts', 'public.csat_session_attempts', 'public.csat_review_queue', 'public.csat_item_attempts']::text[]) x where to_regclass(x) is null;
  if v_bad is not null then raise exception 'DEPLOY_BLOCKED[prereq] 전제 표가 없다: %', v_bad; end if;
  select array_agg(x) into v_bad from unnest(array['auth.uid()', 'public.is_admin()', 'public.is_admin_or_curator()', 'public.csat_source_is_eligible(uuid)', 'public.csat_ec_embargoed_items(text[])']::text[]) x where to_regprocedure(x) is null;
  if v_bad is not null then raise exception 'DEPLOY_BLOCKED[prereq] 전제 함수가 없다: %', v_bad; end if;
  select array_agg(n) into v_bad from unnest(array['content_qualification', 'content_release_approval', 'content_release_revocation', 'workspace_content_demand', 'workspace_content_demand_line', 'factory_order', 'factory_order_event', 'workspace_content_delivery']::text[]) n where to_regclass('public.'||n) is null;
  if v_bad is not null then raise exception 'DEPLOY_BLOCKED[target] DB-1 표가 없다: %', v_bad; end if;
  select array_agg(n) into v_bad from unnest(array['factory_product_order', 'factory_order_product_link']::text[]) n where to_regclass('public.'||n) is not null;
  if v_bad is not null then raise exception 'DEPLOY_BLOCKED[target] 승인 밖 D3 표가 있다: %', v_bad; end if;
  if exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'workspace_line_fulfillment') then
    raise exception 'DEPLOY_BLOCKED[target] workspace_line_fulfillment 가 이미 있다';
  end if;
  if exists (select 1 from pg_constraint where conname = 'factory_order_state_check' and pg_get_constraintdef(oid) like '%partial%') then
    raise exception 'DEPLOY_BLOCKED[target] factory_order.state 에 partial 이 이미 있다';
  end if;
  -- 기존 권한 helper 설정이 실측(또는 DB-1 뒤 값)과 다르면 누군가 승인 밖에서 바꾼 것이다
  select array_agg(h.f||'='||coalesce(p.proconfig::text, 'NULL')) into v_bad
  from (values
    ('is_admin', array['{"search_path=public, pg_temp"}']),
    ('is_admin_or_curator', array['{"search_path=public, auth, pg_temp"}'])) h(f, ok)
  left join pg_proc p on p.pronamespace = 'public'::regnamespace and p.proname = h.f and p.pronargs = 0
  where p.oid is null or coalesce(p.proconfig::text, 'NULL') <> all(h.ok);
  -- 빈 이력 DB(CI 의 빈 Supabase)는 helper 설정이 저장소 migration 결과라 실측과 다를 수 있다 — 이력 있는 DB 에서만 차단한다
  if v_bad is not null and v_hist then
    raise exception 'DEPLOY_BLOCKED[drift] 권한 helper 설정이 예상과 다르다: %', v_bad;
  end if;
end $vf$;
-- 커밋 시점 가드: 이 트랜잭션은 에필로그 검증(vf.i1_deploy_done = 이 xid)을 통과해야만 커밋된다.
-- 파일을 잘라 「프롤로그 + 일부 세그먼트」만 커밋하려는 러너는 COMMIT 에서 실패해 그 조각 전체가 롤백된다. 임시 객체라 카탈로그 밖이다.
create or replace function pg_temp.vf_i1_commit_guard() returns trigger language plpgsql as $vf$ begin
  if coalesce(current_setting('vf.i1_deploy_done', true), '') <> txid_current()::text then
    raise exception 'DEPLOY_BLOCKED[atomicity] 에필로그 검증 없이 커밋하려 했다 — 전체 롤백';
  end if;
  return null;
end $vf$;
create temp table vf_i1_db2_guard (x int) on commit drop;
create constraint trigger vf_i1_commit_guard after insert on pg_temp.vf_i1_db2_guard
  deferrable initially deferred for each row execute function pg_temp.vf_i1_commit_guard();
insert into pg_temp.vf_i1_db2_guard values (1);
create temp table vf_i1_db2_before on commit drop as
select 'rel'::text k, n.nspname||'.'||c.relname name,
  c.relkind::text||'|'||coalesce(c.relacl::text,'')||'|'||c.relrowsecurity||'|'||c.relforcerowsecurity||'|'||coalesce(case when c.relkind = 'i' then pg_get_indexdef(c.oid) end,'')
  ||'|'||c.relowner::regrole::text||'|'||coalesce(c.reloptions::text,'')||'|'||coalesce(case when c.relkind in ('v','m') then md5(pg_get_viewdef(c.oid)) end,'') fp
  from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname not in ('pg_catalog','information_schema','pg_toast') and n.nspname not like 'pg\_temp\_%' and n.nspname not like 'pg\_toast\_temp\_%' and c.relkind <> 't'
union all
select 'col', n.nspname||'.'||c.relname||'.'||a.attname,
  format_type(a.atttypid, a.atttypmod)||'|'||a.attnotnull||'|'||coalesce(pg_get_expr(d.adbin, d.adrelid),'')||'|'||coalesce(a.attacl::text,'')
  from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
  left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
  where a.attnum > 0 and not a.attisdropped and c.relkind in ('r','p','v','m','f') and n.nspname not in ('pg_catalog','information_schema','pg_toast') and n.nspname not like 'pg\_temp\_%' and n.nspname not like 'pg\_toast\_temp\_%'
union all
select 'typ', n.nspname||'.'||t.typname, t.typtype::text||'|'||t.typowner::regrole::text||'|'||coalesce(t.typacl::text,'')||'|'||format_type(t.typbasetype, t.typtypmod)||'|'||t.typnotnull
  ||'|'||coalesce((select string_agg(e.enumlabel, ',' order by e.enumsortorder) from pg_enum e where e.enumtypid = t.oid),'')
  ||'|'||coalesce((select string_agg(pg_get_constraintdef(o.oid), ',' order by o.conname) from pg_constraint o where o.contypid = t.oid),'')
  from pg_type t join pg_namespace n on n.oid = t.typnamespace
  where n.nspname not in ('pg_catalog','information_schema','pg_toast') and n.nspname not like 'pg\_temp\_%' and n.nspname not like 'pg\_toast\_temp\_%' and (t.typtype in ('e','d','r','m') or (t.typtype = 'c' and (select relkind from pg_class where oid = t.typrelid) = 'c'))
union all
select 'dacl', coalesce(d.defaclrole::regrole::text,'')||'.'||coalesce(d.defaclnamespace::regnamespace::text,'*')||'.'||d.defaclobjtype::text, coalesce(d.defaclacl::text,'') from pg_default_acl d
union all
select 'ext', x.extname, x.extversion||'|'||x.extnamespace::regnamespace::text||'|'||x.extowner::regrole::text from pg_extension x
union all
select 'evt', e.evtname, e.evtevent||'|'||e.evtfoid::regproc::text||'|'||e.evtenabled::text||'|'||coalesce(e.evttags::text,'') from pg_event_trigger e
union all
select 'cmt', 'all', coalesce(md5(string_agg(d.classoid::regclass::text||':'||d.objoid||':'||d.objsubid||'='||d.description, E'\n' order by d.classoid, d.objoid, d.objsubid)),'') from pg_description d
union all
select 'con', n.nspname||'.'||c.relname||'.'||o.conname, pg_get_constraintdef(o.oid)
  from pg_constraint o join pg_class c on c.oid = o.conrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname not in ('pg_catalog','information_schema','pg_toast') and n.nspname not like 'pg\_temp\_%' and n.nspname not like 'pg\_toast\_temp\_%'
union all
select 'fn', n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')',
  md5(coalesce(p.prosrc,''))||'|'||coalesce(p.proconfig::text,'')||'|'||coalesce(p.proacl::text,'')||'|'||p.prosecdef||'|'||p.provolatile::text||'|'||p.prokind::text||'|'||p.proowner::regrole::text
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname not in ('pg_catalog','information_schema','pg_toast') and n.nspname not like 'pg\_temp\_%' and n.nspname not like 'pg\_toast\_temp\_%'
union all
select 'pol', n.nspname||'.'||c.relname||'.'||p.polname,
  p.polcmd::text||'|'||p.polpermissive||'|'||p.polroles::text||'|'||coalesce(pg_get_expr(p.polqual, p.polrelid),'')||'|'||coalesce(pg_get_expr(p.polwithcheck, p.polrelid),'')
  from pg_policy p join pg_class c on c.oid = p.polrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname not in ('pg_catalog','information_schema','pg_toast') and n.nspname not like 'pg\_temp\_%' and n.nspname not like 'pg\_toast\_temp\_%'
union all
select 'trg', n.nspname||'.'||c.relname||'.'||t.tgname, pg_get_triggerdef(t.oid)||'|'||t.tgenabled::text
  from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname not in ('pg_catalog','information_schema','pg_toast') and n.nspname not like 'pg\_temp\_%' and n.nspname not like 'pg\_toast\_temp\_%' and not t.tgisinternal
union all
select 'nsp', n.nspname, coalesce(n.nspacl::text,'')||'|'||n.nspowner::regrole::text from pg_namespace n where n.nspname not in ('pg_catalog','information_schema','pg_toast') and n.nspname not like 'pg\_temp\_%' and n.nspname not like 'pg\_toast\_temp\_%';
do $vf$ begin
  if coalesce(current_setting('vf.i1_deploy_xid', true), '') <> txid_current()::text
     or coalesce(current_setting('vf.i1_deploy_stage', true), '') <> 'db2' then
    raise exception 'DEPLOY_BLOCKED[atomicity] DB2 이 한 트랜잭션으로 실행되지 않았다(%). scripts/db/factory-i1/deploy.mjs apply 로만 적용한다(이력 행을 같은 트랜잭션에 쓴다)', 'prologue→P';
  end if;
end $vf$;
-- >>> VF-SEGMENT P _pending_workspace_supply_i1_partial.sql sha256=79807c38244982389ad2eb25b36350bc7121a84cc10b5ab54a1293b758e95041 bytes=11485
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
  if auth.uid() is null or public.is_admin_or_curator() is not true then raise exception 'Forbidden' using errcode = '42501'; end if;
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
-- <<< VF-SEGMENT P
do $vf$ begin
  if coalesce(current_setting('vf.i1_deploy_xid', true), '') <> txid_current()::text
     or coalesce(current_setting('vf.i1_deploy_stage', true), '') <> 'db2' then
    raise exception 'DEPLOY_BLOCKED[atomicity] DB2 이 한 트랜잭션으로 실행되지 않았다(%). scripts/db/factory-i1/deploy.mjs apply 로만 적용한다(이력 행을 같은 트랜잭션에 쓴다)', 'P→epilogue';
  end if;
end $vf$;
-- ── VF 에필로그: 카탈로그 diff = 허용 목록(정확히) · 보안 속성 검증 — 하나라도 어긋나면 전체 롤백 ──────────
do $vf$
declare v_added text[]; v_removed text[]; v_changed text[]; v_bad text[];
  exp_added text[] := array['fn:public.workspace_line_fulfillment(p_line uuid)']::text[];
  exp_changed text[] := array['con:public.factory_order.factory_order_state_check', 'rel:public.factory_order_one_open_per_line', 'fn:public.factory_order_open(p_line uuid, p_reason text, p_quantity smallint, p_request_key uuid)', 'fn:public.factory_order_transition(p_order uuid, p_expected text, p_to text, p_reason text, p_run_id text, p_qualification uuid, p_request_key uuid)']::text[];
  con_tables text[] := '{}'::text[];
  v_unexpected text[]; v_missing text[];
begin
  if coalesce(current_setting('vf.i1_deploy_xid', true), '') <> txid_current()::text then
    raise exception 'DEPLOY_BLOCKED[atomicity] 에필로그가 프롤로그와 다른 트랜잭션이다';
  end if;
  select d.added, d.removed, d.changed into v_added, v_removed, v_changed
  from (with a as (select 'rel'::text k, n.nspname||'.'||c.relname name,
  c.relkind::text||'|'||coalesce(c.relacl::text,'')||'|'||c.relrowsecurity||'|'||c.relforcerowsecurity||'|'||coalesce(case when c.relkind = 'i' then pg_get_indexdef(c.oid) end,'')
  ||'|'||c.relowner::regrole::text||'|'||coalesce(c.reloptions::text,'')||'|'||coalesce(case when c.relkind in ('v','m') then md5(pg_get_viewdef(c.oid)) end,'') fp
  from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname not in ('pg_catalog','information_schema','pg_toast') and n.nspname not like 'pg\_temp\_%' and n.nspname not like 'pg\_toast\_temp\_%' and c.relkind <> 't'
union all
select 'col', n.nspname||'.'||c.relname||'.'||a.attname,
  format_type(a.atttypid, a.atttypmod)||'|'||a.attnotnull||'|'||coalesce(pg_get_expr(d.adbin, d.adrelid),'')||'|'||coalesce(a.attacl::text,'')
  from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
  left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
  where a.attnum > 0 and not a.attisdropped and c.relkind in ('r','p','v','m','f') and n.nspname not in ('pg_catalog','information_schema','pg_toast') and n.nspname not like 'pg\_temp\_%' and n.nspname not like 'pg\_toast\_temp\_%'
union all
select 'typ', n.nspname||'.'||t.typname, t.typtype::text||'|'||t.typowner::regrole::text||'|'||coalesce(t.typacl::text,'')||'|'||format_type(t.typbasetype, t.typtypmod)||'|'||t.typnotnull
  ||'|'||coalesce((select string_agg(e.enumlabel, ',' order by e.enumsortorder) from pg_enum e where e.enumtypid = t.oid),'')
  ||'|'||coalesce((select string_agg(pg_get_constraintdef(o.oid), ',' order by o.conname) from pg_constraint o where o.contypid = t.oid),'')
  from pg_type t join pg_namespace n on n.oid = t.typnamespace
  where n.nspname not in ('pg_catalog','information_schema','pg_toast') and n.nspname not like 'pg\_temp\_%' and n.nspname not like 'pg\_toast\_temp\_%' and (t.typtype in ('e','d','r','m') or (t.typtype = 'c' and (select relkind from pg_class where oid = t.typrelid) = 'c'))
union all
select 'dacl', coalesce(d.defaclrole::regrole::text,'')||'.'||coalesce(d.defaclnamespace::regnamespace::text,'*')||'.'||d.defaclobjtype::text, coalesce(d.defaclacl::text,'') from pg_default_acl d
union all
select 'ext', x.extname, x.extversion||'|'||x.extnamespace::regnamespace::text||'|'||x.extowner::regrole::text from pg_extension x
union all
select 'evt', e.evtname, e.evtevent||'|'||e.evtfoid::regproc::text||'|'||e.evtenabled::text||'|'||coalesce(e.evttags::text,'') from pg_event_trigger e
union all
select 'cmt', 'all', coalesce(md5(string_agg(d.classoid::regclass::text||':'||d.objoid||':'||d.objsubid||'='||d.description, E'\n' order by d.classoid, d.objoid, d.objsubid)),'') from pg_description d
union all
select 'con', n.nspname||'.'||c.relname||'.'||o.conname, pg_get_constraintdef(o.oid)
  from pg_constraint o join pg_class c on c.oid = o.conrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname not in ('pg_catalog','information_schema','pg_toast') and n.nspname not like 'pg\_temp\_%' and n.nspname not like 'pg\_toast\_temp\_%'
union all
select 'fn', n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')',
  md5(coalesce(p.prosrc,''))||'|'||coalesce(p.proconfig::text,'')||'|'||coalesce(p.proacl::text,'')||'|'||p.prosecdef||'|'||p.provolatile::text||'|'||p.prokind::text||'|'||p.proowner::regrole::text
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname not in ('pg_catalog','information_schema','pg_toast') and n.nspname not like 'pg\_temp\_%' and n.nspname not like 'pg\_toast\_temp\_%'
union all
select 'pol', n.nspname||'.'||c.relname||'.'||p.polname,
  p.polcmd::text||'|'||p.polpermissive||'|'||p.polroles::text||'|'||coalesce(pg_get_expr(p.polqual, p.polrelid),'')||'|'||coalesce(pg_get_expr(p.polwithcheck, p.polrelid),'')
  from pg_policy p join pg_class c on c.oid = p.polrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname not in ('pg_catalog','information_schema','pg_toast') and n.nspname not like 'pg\_temp\_%' and n.nspname not like 'pg\_toast\_temp\_%'
union all
select 'trg', n.nspname||'.'||c.relname||'.'||t.tgname, pg_get_triggerdef(t.oid)||'|'||t.tgenabled::text
  from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname not in ('pg_catalog','information_schema','pg_toast') and n.nspname not like 'pg\_temp\_%' and n.nspname not like 'pg\_toast\_temp\_%' and not t.tgisinternal
union all
select 'nsp', n.nspname, coalesce(n.nspacl::text,'')||'|'||n.nspowner::regrole::text from pg_namespace n where n.nspname not in ('pg_catalog','information_schema','pg_toast') and n.nspname not like 'pg\_temp\_%' and n.nspname not like 'pg\_toast\_temp\_%'),
 b as (select * from vf_i1_db2_before),
 added_rel as (select a.name from a where a.k = 'rel' and not exists (select 1 from b where b.k = a.k and b.name = a.name))
select
 coalesce((select array_agg(a.k||':'||a.name order by a.k||':'||a.name) from a
   where not exists (select 1 from b where b.k = a.k and b.name = a.name)
     and not (a.k = 'col' and split_part(a.name,'.',1)||'.'||split_part(a.name,'.',2) in (select name from added_rel))), '{}') added,
 coalesce((select array_agg(b.k||':'||b.name order by b.k||':'||b.name) from b
   where not exists (select 1 from a where a.k = b.k and a.name = b.name)), '{}') removed,
 coalesce((select array_agg(a.k||':'||a.name order by a.k||':'||a.name) from a join b on b.k = a.k and b.name = a.name
   where a.fp is distinct from b.fp), '{}') changed) d;
  select array_agg(x order by x) into v_unexpected from unnest(v_added) x
   where x <> all(exp_added) and not (x like 'con:%' and split_part(substr(x, 5), '.', 1) = 'public'
                                       and split_part(substr(x, 5), '.', 2) = any(con_tables));
  select array_agg(x order by x) into v_missing from unnest(exp_added) x where x <> all(v_added);
  -- 변경은 허용 목록의 부분집합이면 된다(되돌리기 뒤 재적용이면 helper 가 이미 강화돼 「변경 0」). 최종값은 아래에서 정확히 본다.
  if v_unexpected is not null or v_missing is not null or cardinality(v_removed) > 0
     or not (v_changed <@ exp_changed) then
    raise exception 'DEPLOY_BLOCKED[allowlist] 허용 목록과 다른 카탈로그 변화 — 추가(목록 밖)=% · 빠짐=% · 삭제=% · 변경=% (허용 변경=%)',
      v_unexpected, v_missing, v_removed, v_changed, exp_changed;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'factory_order_state_check' and pg_get_constraintdef(oid) like '%partial%') then
    raise exception 'DEPLOY_BLOCKED[verify] factory_order.state CHECK 에 partial 이 없다';
  end if;
  if has_function_privilege('anon', 'public.workspace_line_fulfillment(uuid)', 'EXECUTE') then
    raise exception 'DEPLOY_BLOCKED[verify] workspace_line_fulfillment anon 실행권';
  end if;
  perform set_config('vf.i1_deploy_done', txid_current()::text, true);
  raise notice 'VF_DEPLOY_OK stage=db2 added=% changed=%', cardinality(v_added), cardinality(v_changed);
end $vf$;
