-- supabase/migrations/20261017200000_factory_i1_db1_supply_foundation.sql
-- Factory I1 DB1 — 생성물(scripts/db/factory-i1/build.mjs). 손으로 고치지 않는다. 검증: node scripts/db/factory-i1/build.mjs --check
-- 대상 프로젝트 jajenrevcbmrpaliomxv · 이전 이력 최댓값 20261014091841 · 버전 20261017200000 (factory_i1_db1_supply_foundation)
-- 원본 세그먼트(바이트 그대로): C=_pending_workspace_supply_c_qualification.sql sha256=dd940568ef7170212bf23ac9f7fb89bb090e8f529eeb4c26bb9ccdbc1e503f66 · B=_pending_workspace_supply_b_orders.sql sha256=e3f929d06f20518495682a36e0d1f8f483988f2a39feabd3e5d490c02a5293b2 · S=_pending_workspace_supply_i1_safety.sql sha256=cc3d91001fc21800171c8210c3142ea9d6ef35facb7df877f88e4f0a97a3b6de
-- 원자 단위: 이 파일 전체가 한 트랜잭션이어야 한다. 프롤로그가 xid 를 표식하고 세그먼트 경계마다 같은 xid 인지 확인한다
--   (비원자 러너는 첫 DDL 전에 DEPLOY_BLOCKED[atomicity] 로 멈춘다). 에필로그가 카탈로그 diff 를 허용 목록과 비교한다.
-- 적용: node scripts/db/factory-i1/deploy.mjs apply --stage db1 …  (절차: docs/csat-learner/v62/FACTORY_I1_DEPLOY_PACKAGE.md)

-- ── VF 프롤로그: 차단 조건 검사 · 트랜잭션 표식 · 적용 전 카탈로그 지문 ────────────────
set local lock_timeout = '15s';
set local statement_timeout = '120s';
do $vf$
declare v_bad text[]; v_hist boolean := false;
begin
  perform set_config('vf.i1_deploy_xid', txid_current()::text, true);
  perform set_config('vf.i1_deploy_stage', 'db1', true);
  perform set_config('vf.i1_db1_sha', '', true);
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    execute 'select exists (select 1 from supabase_migrations.schema_migrations)' into v_hist;
  end if;
  if v_hist then
    if exists (select 1 from supabase_migrations.schema_migrations where version = '20261017200000') then
      raise exception 'DEPLOY_BLOCKED[history] 버전 20261017200000 이 이미 이력에 있다';
    end if;
    if exists (select 1 from supabase_migrations.schema_migrations where version = '20261017200100') then
      raise exception 'DEPLOY_BLOCKED[history] DB-2(20261017200100) 이력이 DB-1 보다 먼저 있다';
    end if;
  end if;
  select array_agg(x) into v_bad from unnest(array['auth.users', 'public.learner_workspace', 'public.learner_workspace_plan', 'public.csat_map_goal_version', 'public.csat_items', 'public.csat_dcp_items', 'public.csat_dx_response', 'public.csat_dx_session', 'public.learning_task_attempts', 'public.learning_sessions', 'public.csat_trap_attempts', 'public.csat_session_attempts', 'public.csat_review_queue', 'public.csat_item_attempts']::text[]) x where to_regclass(x) is null;
  if v_bad is not null then raise exception 'DEPLOY_BLOCKED[prereq] 전제 표가 없다: %', v_bad; end if;
  select array_agg(x) into v_bad from unnest(array['auth.uid()', 'public.is_admin()', 'public.is_admin_or_curator()', 'public.csat_source_is_eligible(uuid)', 'public.csat_ec_embargoed_items(text[])']::text[]) x where to_regprocedure(x) is null;
  if v_bad is not null then raise exception 'DEPLOY_BLOCKED[prereq] 전제 함수가 없다: %', v_bad; end if;
  select array_agg(n) into v_bad from unnest(array['content_qualification', 'content_release_approval', 'content_release_revocation', 'workspace_content_demand', 'workspace_content_demand_line', 'factory_order', 'factory_order_event', 'workspace_content_delivery', 'factory_product_order', 'factory_order_product_link']::text[]) n where to_regclass('public.'||n) is not null;
  if v_bad is not null then raise exception 'DEPLOY_BLOCKED[target] 이미 있는 대상 표: %', v_bad; end if;
  select array_agg(distinct proname::text) into v_bad from pg_proc where pronamespace = 'public'::regnamespace and proname = any(array['forbid_ledger_mutation', 'fq_axes_valid', 'fq_role_ok', 'content_qualification_record', 'content_release_approve', 'content_release_revoke', 'ledger_writer_guard', 'factory_order_state_guard', 'workspace_demand_record', 'factory_order_open', 'factory_order_transition', 'supply_artifact_revision', 'supply_learner_exposure', 'workspace_delivery_record', 'supply_writer_guard', 'supply_delivery_valid', 'workspace_line_fulfillment']::text[]);
  if v_bad is not null then raise exception 'DEPLOY_BLOCKED[target] 이미 있는 대상 함수: %', v_bad; end if;
  -- 기존 권한 helper 설정이 실측(또는 DB-1 뒤 값)과 다르면 누군가 승인 밖에서 바꾼 것이다
  select array_agg(h.f||'='||coalesce(p.proconfig::text, 'NULL')) into v_bad
  from (values
    ('is_admin', array['{search_path=public}', '{"search_path=public, pg_temp"}']),
    ('is_admin_or_curator', array['{"search_path=public, auth"}', '{"search_path=public, auth, pg_temp"}'])) h(f, ok)
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
create temp table vf_i1_db1_guard (x int) on commit drop;
create constraint trigger vf_i1_commit_guard after insert on pg_temp.vf_i1_db1_guard
  deferrable initially deferred for each row execute function pg_temp.vf_i1_commit_guard();
insert into pg_temp.vf_i1_db1_guard values (1);
create temp table vf_i1_db1_before on commit drop as
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
     or coalesce(current_setting('vf.i1_deploy_stage', true), '') <> 'db1' then
    raise exception 'DEPLOY_BLOCKED[atomicity] DB1 이 한 트랜잭션으로 실행되지 않았다(%). scripts/db/factory-i1/deploy.mjs apply 로만 적용한다(이력 행을 같은 트랜잭션에 쓴다)', 'prologue→C';
  end if;
end $vf$;
-- >>> VF-SEGMENT C _pending_workspace_supply_c_qualification.sql sha256=dd940568ef7170212bf23ac9f7fb89bb090e8f529eeb4c26bb9ccdbc1e503f66 bytes=14077
-- supabase/migrations/_pending_workspace_supply_c_qualification.sql
-- ⚠️ 보류(적용 안 함) — v6.2 P-F7c 승인안 C. **B 보다 먼저** 적용한다(B 의 공급 기록이 이 원장을 참조).
--
-- 무엇: 콘텐츠 자격 원장(FQ A~H) · 출시/평가 승인 기록 · 승인 철회 기록. 전부 **추가 전용**.
-- 원칙:
--   · 자격은 (산출물 종류, 참조, revision, TASK, 역할, 규칙 버전)에 묶인다. revision 이 바뀌면 이전 자격을 상속하지 않는다.
--   · A~H 각 축 = pass | fail | unknown | not_applicable. unknown · not_applicable 은 통과가 아니다.
--   · 연구자 입력의 public_qualified 같은 플래그는 저장하지 않는다 — 출시 승인은 **권한 있는 승인 행**이 있을 때만.
--   · 기존 csat_dcp_items 834,311행을 일괄 판정하지 않는다. 검수된 산출물에만 행이 생긴다.
--   · 고칠 때는 UPDATE 가 아니라 새 행(supersedes = 이전 행). 한 행은 한 번만 대체된다(선형 이력).
-- 되돌리기: B 를 먼저 drop 한 뒤 drop table content_release_revocation, content_release_approval, content_qualification;
--           drop function fq_axes_valid, fq_role_ok, forbid_ledger_mutation.

-- ── 공용: 추가 전용 강제 ───────────────────────────────────────────────
create or replace function public.forbid_ledger_mutation() returns trigger
language plpgsql set search_path to 'public' as $$
begin
  -- 계정 삭제 등 **부모 FK cascade** 로 오는 DELETE 만 허용(pg_trigger_depth > 1). 직접 UPDATE · DELETE 는 거부.
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then return old; end if;
  raise exception 'append-only ledger: % on % is not allowed', tg_op, tg_table_name using errcode = '42501';
end $$;

-- ── A~H 축 검증(불변 함수 — CHECK 에서 쓴다) ────────────────────────────
create or replace function public.fq_axes_valid(p jsonb) returns boolean
language sql immutable set search_path to 'public' as $$
  select jsonb_typeof(p) = 'object'
     and (select count(*) from jsonb_object_keys(p)) = 8
     and (select bool_and(k in ('A','B','C','D','E','F','G','H')
                          and jsonb_typeof(p -> k) = 'object'
                          and (p -> k ->> 'state') in ('pass','fail','unknown','not_applicable'))
          from jsonb_object_keys(p) k)
$$;

/** 역할별 필수 축이 모두 pass 인가 — G(학습자 노출)는 공급 시점에 따로 본다 */
create or replace function public.fq_role_ok(p jsonb, p_role text) returns boolean
language sql immutable set search_path to 'public' as $$
  select (p->'A'->>'state') = 'pass' and (p->'B'->>'state') = 'pass' and (p->'C'->>'state') = 'pass'
     and (p->'F'->>'state') = 'pass' and (p->'H'->>'state') = 'pass'
     and (p_role not in ('source_analysis','model_explanation','guided_practice') or (p->'D'->>'state') = 'pass')
     and (p_role not in ('independent_check','transfer','delayed_check') or (p->'E'->>'state') = 'pass')
$$;

-- ── C-1. 자격 원장 ────────────────────────────────────────────────────
create table public.content_qualification (
  id uuid primary key default gen_random_uuid(),
  rules_version text not null check (rules_version ~ '^FQ[0-9]+\.[0-9]+$'),
  artifact_kind text not null check (artifact_kind in ('dcp_item','csat_item','textbook_activity','workspace_bundle')),
  artifact_ref text not null check (length(artifact_ref) between 1 and 200),
  artifact_revision text not null check (length(artifact_revision) between 1 and 128),
  -- 원천 · 분석 · Gold 결속(없으면 null — 그 축은 unknown 이어야 한다)
  source_revision text, source_hash text check (source_hash is null or source_hash ~ '^[0-9a-f]{64}$'),
  analysis_revision text,
  gold_revision text, gold_hash text check (gold_hash is null or gold_hash ~ '^[0-9a-f]{64}$'),
  task_id text not null check (task_id ~ '^[a-z]\.[a-z_]{2,60}$'),
  role text not null check (role in ('source_analysis','model_explanation','guided_practice','independent_check','transfer','delayed_check')),
  axes jsonb not null check (public.fq_axes_valid(axes)),          -- {A:{state, defect?}, …, H:{…}}
  defects text[] not null default '{}',                            -- 결함 원인 코드(meaning_fail · answer_basis_fail · source_stale · source_unbound …)
  evidence_ids text[] not null default '{}',                       -- 실제 검수 근거 id(연구 원장 행 · 리뷰 파일 해시)
  method text not null check (length(method) between 1 and 200),   -- 검수 방법(자동 가드 · 2인 검수 · 사람 Gold …) — 경로 · 원문 금지
  supersedes uuid unique references public.content_qualification(id),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  -- 축 A 가 pass 면 원천 결속이 있어야 한다(원천 revision 미결속인 생성물은 A pass 불가 — FQ1.0 발견)
  check ((axes->'A'->>'state') <> 'pass' or (source_revision is not null and source_hash is not null)),
  -- 축 E 가 pass 면 Gold 결속이 있어야 한다
  check ((axes->'E'->>'state') <> 'pass' or (gold_revision is not null and gold_hash is not null)),
  -- 공급 기록이 (id, 정체성)으로 참조할 수 있게
  unique (id, artifact_kind, artifact_ref, artifact_revision, task_id, role)
);
create index content_qualification_identity on public.content_qualification (artifact_kind, artifact_ref, artifact_revision, task_id, role);
create trigger content_qualification_append_only before update or delete on public.content_qualification
  for each row execute function public.forbid_ledger_mutation();

-- ── C-2. 출시 · 평가 승인(권한 있는 사람 · 에이전트 승인자) ───────────────
create table public.content_release_approval (
  id uuid primary key default gen_random_uuid(),
  qualification_id uuid not null references public.content_qualification(id),
  scope text not null check (scope in ('public','assessment')),
  approver uuid not null references auth.users(id),
  approver_role text not null check (approver_role in ('admin','curator')),  -- 승인 시점 권한(RPC 가 is_admin_or_curator 로 확인해 기록)
  note text check (note is null or length(note) <= 500),
  created_at timestamptz not null default now(),
  unique (qualification_id, scope)
);
create trigger content_release_approval_append_only before update or delete on public.content_release_approval
  for each row execute function public.forbid_ledger_mutation();

create table public.content_release_revocation (
  approval_id uuid primary key references public.content_release_approval(id),
  revoked_by uuid not null references auth.users(id),
  reason text not null check (length(reason) between 1 and 500),
  created_at timestamptz not null default now()
);
create trigger content_release_revocation_append_only before update or delete on public.content_release_revocation
  for each row execute function public.forbid_ledger_mutation();

-- ── RLS — 학습자 직접 접근 없음. 관리자 읽기만. 쓰기는 아래 정의자 함수만 ──────────
alter table public.content_qualification enable row level security;
alter table public.content_release_approval enable row level security;
alter table public.content_release_revocation enable row level security;
create policy cq_admin_read on public.content_qualification for select using (public.is_admin_or_curator());
create policy cra_admin_read on public.content_release_approval for select using (public.is_admin_or_curator());
create policy crr_admin_read on public.content_release_revocation for select using (public.is_admin_or_curator());
revoke insert, update, delete on public.content_qualification, public.content_release_approval, public.content_release_revocation from anon, authenticated;

-- ── 쓰기 함수 ───────────────────────────────────────────────────────────
/** 자격 기록 — 관리자 · 큐레이터만. 이전 행을 대체하면 그 행의 정체성(종류 · 참조 · TASK · 역할)이 같아야 한다 */
create or replace function public.content_qualification_record(
  p_rules_version text, p_kind text, p_ref text, p_revision text, p_task text, p_role text, p_axes jsonb,
  p_source_revision text, p_source_hash text, p_analysis_revision text, p_gold_revision text, p_gold_hash text,
  p_defects text[], p_evidence_ids text[], p_method text, p_supersedes uuid default null)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid; prev record;
begin
  if auth.uid() is null or not public.is_admin_or_curator() then raise exception 'Forbidden' using errcode = '42501'; end if;
  perform set_config('vocaflow.supply_writer', 'rpc', true);
  if p_supersedes is not null then
    select * into prev from content_qualification where id = p_supersedes for update;
    if not found then raise exception 'supersedes: not found'; end if;
    if (prev.artifact_kind, prev.artifact_ref, prev.task_id, prev.role) is distinct from (p_kind, p_ref, p_task, p_role) then
      raise exception 'supersedes: identity mismatch';
    end if;
  end if;
  insert into content_qualification (rules_version, artifact_kind, artifact_ref, artifact_revision, task_id, role, axes,
    source_revision, source_hash, analysis_revision, gold_revision, gold_hash, defects, evidence_ids, method, supersedes, created_by)
  values (p_rules_version, p_kind, p_ref, p_revision, p_task, p_role, p_axes,
    p_source_revision, p_source_hash, p_analysis_revision, p_gold_revision, p_gold_hash,
    coalesce(p_defects, '{}'), coalesce(p_evidence_ids, '{}'), p_method, p_supersedes, auth.uid())
  returning id into v_id;     -- 같은 이전 행을 두 번 대체하면 unique(supersedes) 위반(동시 대체 1건만 성공)
  return v_id;
end $$;

/** 출시 · 평가 승인 — 그 자격이 현재 행(대체되지 않음)이고 역할 필수 축이 pass 일 때만 */
create or replace function public.content_release_approve(p_qualification uuid, p_scope text, p_note text default null)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare q record; v_id uuid;
begin
  if auth.uid() is null or not public.is_admin_or_curator() then raise exception 'Forbidden' using errcode = '42501'; end if;
  perform set_config('vocaflow.supply_writer', 'rpc', true);
  select * into q from content_qualification where id = p_qualification;
  if not found then raise exception 'qualification: not found'; end if;
  if exists (select 1 from content_qualification s where s.supersedes = q.id) then raise exception 'qualification: superseded'; end if;
  if not public.fq_role_ok(q.axes, q.role) then raise exception 'qualification: required axes not pass'; end if;
  if p_scope = 'assessment' and (q.axes->'E'->>'state') <> 'pass' then raise exception 'assessment: E not pass'; end if;
  insert into content_release_approval (qualification_id, scope, approver, approver_role, note)
  values (q.id, p_scope, auth.uid(), case when public.is_admin() then 'admin' else 'curator' end, p_note)
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public.content_qualification_record(text,text,text,text,text,text,jsonb,text,text,text,text,text,text[],text[],text,uuid) from public, anon;
revoke all on function public.content_release_approve(uuid, text, text) from public, anon;
grant execute on function public.content_qualification_record(text,text,text,text,text,text,jsonb,text,text,text,text,text,text[],text[],text,uuid) to authenticated;
grant execute on function public.content_release_approve(uuid, text, text) to authenticated;

/** 승인 철회 — 관리자 · 큐레이터만. 이유 필수. 철회는 되돌리지 않는다(다시 쓰려면 새 자격 · 새 승인) */
create or replace function public.content_release_revoke(p_approval uuid, p_reason text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null or not public.is_admin_or_curator() then raise exception 'Forbidden' using errcode = '42501'; end if;
  perform set_config('vocaflow.supply_writer', 'rpc', true);
  insert into content_release_revocation (approval_id, revoked_by, reason) values (p_approval, auth.uid(), p_reason)
  on conflict (approval_id) do nothing;   -- 이미 철회됨 = 같은 결과
end $$;
revoke all on function public.content_release_revoke(uuid, text) from public, anon;
grant execute on function public.content_release_revoke(uuid, text) to authenticated;

-- ── 직접 INSERT 차단(서비스 키 포함) — 위 함수가 검사한 뒤에만 행이 생긴다 ─────────────
-- 함수는 트랜잭션 범위 설정 vocaflow.supply_writer='rpc' 를 켜고 쓴다. 서비스 키가 일부러 켜는 것은 「의도된 수동 복구」뿐(문서 §B-5).
create or replace function public.ledger_writer_guard() returns trigger
language plpgsql set search_path to 'public' as $$
begin
  if coalesce(current_setting('vocaflow.supply_writer', true), '') <> 'rpc' then
    raise exception '%: insert only via ledger functions', tg_table_name using errcode = '42501';
  end if;
  return new;
end $$;
create trigger content_qualification_writer before insert on public.content_qualification for each row execute function public.ledger_writer_guard();
create trigger content_release_approval_writer before insert on public.content_release_approval for each row execute function public.ledger_writer_guard();
create trigger content_release_revocation_writer before insert on public.content_release_revocation for each row execute function public.ledger_writer_guard();
-- <<< VF-SEGMENT C
do $vf$ begin
  if coalesce(current_setting('vf.i1_deploy_xid', true), '') <> txid_current()::text
     or coalesce(current_setting('vf.i1_deploy_stage', true), '') <> 'db1' then
    raise exception 'DEPLOY_BLOCKED[atomicity] DB1 이 한 트랜잭션으로 실행되지 않았다(%). scripts/db/factory-i1/deploy.mjs apply 로만 적용한다(이력 행을 같은 트랜잭션에 쓴다)', 'C→B';
  end if;
end $vf$;
-- >>> VF-SEGMENT B _pending_workspace_supply_b_orders.sql sha256=e3f929d06f20518495682a36e0d1f8f483988f2a39feabd3e5d490c02a5293b2 bytes=32235
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
 * 수요 기록(멱등). 본문은 앱 `canonicalDemand()` 출력 그대로(text).
 * 본문 버전 v2(Factory Integration v1.1 — 표준 정규 JSON · 중첩 키 정렬 · 지원 TASK 포함). 다른 버전은 거절. DB 가 서명을 다시 계산하고,
 * 본문의 user 가 auth.uid() 와 같고 Workspace · 목표 · PLAN 이 그 사용자 것인지(복합 FK) 확인한다.
 * 같은 서명이 이미 있으면 본문 비교 — 같으면 그 id, 다르면 거절.
 */
create or replace function public.workspace_demand_record(p_canonical text)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); b jsonb; v_sig text; v_id uuid; v_stored text; l jsonb; i int := 0;
begin
  if v_uid is null then raise exception 'Forbidden' using errcode = '42501'; end if;
  perform set_config('vocaflow.supply_writer', 'rpc', true);
  b := p_canonical::jsonb;
  if (b->>'v') <> '2' or (b->>'user') is distinct from v_uid::text then raise exception 'demand: user mismatch' using errcode = '42501'; end if;
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

/**
 * 주문 전이 — 유일한 상태 변경 경로. 관리자 · 생산 작업자(정의자 호출)만.
 * 행 잠금 → 같은 요청 키면 멱등 반환 → 기대 상태 비교(낙관 동시성) → 허용 전이 · 근거 → 이벤트 삽입 → 주문 갱신. 한 트랜잭션.
 */
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

/**
 * 산출물 현재 revision — 종류별 **실제 행**에서 계산한다(없으면 null = 공급 불가).
 *   dcp_item : csat_dcp_items 행의 type · payload · answer_key 해시. 원천(ref_id)이 null 이거나 기사 원천이 아니면 null.
 *   csat_item: csat_items 행의 stem · passage · choices · answer 해시(R5 확인 · 전이 과제).
 *   그 외(textbook_activity · workspace_bundle): 제품 표가 아직 없다 → null(공급 불가 · 지원 공백으로 문서화).
 * 자격 행의 artifact_revision 이 이 값과 다르면 「검수 뒤 내용이 바뀐 것」 — 이전 검수를 상속하지 않는다.
 */
create or replace function public.supply_artifact_revision(p_kind text, p_ref text)
returns text language plpgsql stable security definer set search_path to 'public' as $$
declare v text;
begin
  if p_kind = 'dcp_item' then
    if p_ref !~ '^[0-9a-f-]{36}$' then return null; end if;
    select encode(sha256(convert_to(i.type || '|' || i.payload::text || '|' || coalesce(i.answer_key::text, ''), 'UTF8')), 'hex') into v
      from csat_dcp_items i where i.id = p_ref::uuid and i.kind = 'article' and i.ref_id is not null;
    return v;
  elsif p_kind = 'csat_item' then
    select encode(sha256(convert_to(coalesce(c.stem, '') || '|' || coalesce(c.passage, '') || '|' || coalesce(c.choices::text, '') || '|' || coalesce(c.answer::text, ''), 'UTF8')), 'hex') into v
      from csat_items c where c.id = p_ref;
    return v;
  end if;
  return null;
end $$;

/**
 * 학습자 노출(G) — 공급 시점에 학습자별로. 'none' 만 평가 역할 공급 가능. 판정 불가는 'unknown'(= 거절).
 *   csat_item(R5): 그 문항 응답 · **같은 시험 회차 응시**(전체 시험을 본 것) · **정규화 동일 지문**의 다른 문항 응답 → 노출.
 *                  해설은 P-M3b 규칙상 응답 뒤에만 열리므로 응답 검사에 포함된다. 힌트 기능은 없다.
 *   dcp_item     : 시도 기록은 있으나 해설 열람 · 힌트 · 같은 기사 다른 문항(공유 지문) 노출 기록이 없다 → 'unknown'.
 *                  ⇒ 새 DCP 직접 평가 공급은 HOLD(노출 기록 표가 생길 때까지).
 */
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

/**
 * 공급 기록 — 학습자 본인 호출. **공급 시점 재검증**(과거 자격이 있다는 사실만으로 공급하지 않는다):
 *   ① 같은 요청 키 = 같은 본문일 때만 이전 결과 ② 줄 소유 · Workspace active ③ 주문이 이 줄 것
 *   ④ 자격 정체성 = 줄 TASK · 역할 · 현재 행(대체 없음) · 역할 필수 축 pass
 *   ⑤ 산출물 **실제 행 존재** · 현재 revision = 자격 revision ⑥ 승인 존재 · 철회 없음 · 평가 역할은 assessment
 *   ⑦ 원천이 지금 적격(DCP: 기사 원천 · null 원천 거절) ⑧ G — 평가 역할은 노출 'none' 일 때만
 */
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

-- ── 6. 직접 쓰기 차단 — 위 함수 밖의 INSERT(서비스 키 포함)는 거부 ─────────────────
-- 함수는 트랜잭션 범위 설정 vocaflow.supply_writer='rpc' 를 켠 뒤 쓴다. 서비스 키가 이 설정을 일부러 켜면 우회되므로
-- 그 경우는 「의도된 수동 복구」로만 쓰고 사유를 운영 기록에 남긴다(문서 §B-5).
create or replace function public.supply_writer_guard() returns trigger
language plpgsql set search_path to 'public' as $$
begin
  if coalesce(current_setting('vocaflow.supply_writer', true), '') <> 'rpc' then
    raise exception '%: insert only via supply functions', tg_table_name using errcode = '42501';
  end if;
  -- plpgsql 은 AND 를 단락 평가하지 않는다 — 표마다 다른 열은 중첩 IF 안에서만 읽는다
  if tg_table_name = 'factory_order' then
    if new.state <> 'requested' or new.event_seq <> 0 then
      raise exception 'factory_order: new orders start at requested/0' using errcode = '42501';
    end if;
  elsif tg_table_name = 'factory_order_event' then
    if not exists (select 1 from factory_order o where o.id = new.order_id and o.event_seq + 1 = new.seq
                   and o.state is not distinct from new.from_state) then
      raise exception 'factory_order_event: seq/from_state must continue the order' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger workspace_content_demand_writer before insert on public.workspace_content_demand for each row execute function public.supply_writer_guard();
create trigger workspace_content_demand_line_writer before insert on public.workspace_content_demand_line for each row execute function public.supply_writer_guard();
create trigger factory_order_writer before insert on public.factory_order for each row execute function public.supply_writer_guard();
create trigger factory_order_event_writer before insert on public.factory_order_event for each row execute function public.supply_writer_guard();
create trigger workspace_content_delivery_writer before insert on public.workspace_content_delivery for each row execute function public.supply_writer_guard();
create trigger workspace_content_demand_no_update before update or delete on public.workspace_content_demand for each row execute function public.forbid_ledger_mutation();
create trigger workspace_content_demand_line_no_update before update or delete on public.workspace_content_demand_line for each row execute function public.forbid_ledger_mutation();

revoke all on function public.supply_artifact_revision(text, text) from public, anon, authenticated;
revoke all on function public.supply_learner_exposure(text, text, uuid) from public, anon, authenticated;

revoke all on function public.workspace_demand_record(text) from public, anon;
revoke all on function public.factory_order_open(uuid, text, smallint, uuid) from public, anon;
revoke all on function public.factory_order_transition(uuid, text, text, text, text, uuid, uuid) from public, anon;
revoke all on function public.workspace_delivery_record(uuid, uuid, uuid, uuid, uuid) from public, anon;
grant execute on function public.workspace_demand_record(text) to authenticated;
grant execute on function public.factory_order_open(uuid, text, smallint, uuid) to authenticated;
grant execute on function public.factory_order_transition(uuid, text, text, text, text, uuid, uuid) to authenticated;
grant execute on function public.workspace_delivery_record(uuid, uuid, uuid, uuid, uuid) to authenticated;
-- <<< VF-SEGMENT B
do $vf$ begin
  if coalesce(current_setting('vf.i1_deploy_xid', true), '') <> txid_current()::text
     or coalesce(current_setting('vf.i1_deploy_stage', true), '') <> 'db1' then
    raise exception 'DEPLOY_BLOCKED[atomicity] DB1 이 한 트랜잭션으로 실행되지 않았다(%). scripts/db/factory-i1/deploy.mjs apply 로만 적용한다(이력 행을 같은 트랜잭션에 쓴다)', 'B→S';
  end if;
end $vf$;
-- >>> VF-SEGMENT S _pending_workspace_supply_i1_safety.sql sha256=cc3d91001fc21800171c8210c3142ea9d6ef35facb7df877f88e4f0a97a3b6de bytes=28207
-- supabase/migrations/_pending_workspace_supply_i1_safety.sql
-- ⚠️ 보류(적용 안 함) — Factory I1 안전 delta(D1 노출 · D2 승인 범위). 적용 순서: C → B → **이 파일** → (선택) P → (선택) D3.
-- I0 의 `_pending_workspace_supply_b_delta_i0.sql`(PR #277) 의 D1 · D2 를 **대체**한다 — 둘을 함께 적용하지 않는다.
-- 승인 패키지 · 실측 근거: docs/csat-learner/v62/FACTORY_I1_APPROVAL_PACKAGE.md · FACTORY_I1_SECURITY_AUDIT.md
--
-- D1 노출(G) — 평가 역할(독립 확인 · 전이 · 지연 확인)은 학습자가 그 문항을 **어떤 경로로든 본 적이 없을 때만** 공급한다.
--    B 는 csat_dx_* 만 봤다. 개발 DB 2026-10-17 읽기 전용 실측(사용자×문항 쌍): G2 시도 123 · 학습 세션 176(그중 viewed_first 55)
--    · 함정 시도 13 · 세션 시도 1 · 복습 큐 1 이 B 에서 'none' 으로 보였다. I0 delta 도 함정 시도 11쌍 · 삭제된 세션 · viewed_first 만 있는 세션을 놓친다.
--    판정 불가(원장 없음 · 문항 없음 · 인자 없음)는 'unknown' = 거절. 조회 오류는 예외로 공급 트랜잭션 전체를 실패시킨다(fail-closed).
-- D2 승인 — 앱 계약(qualification.ts toSupplyQualification · supplyEligible)과 같게:
--    모든 역할 = 이 자격 행의 유효(철회 없는) public 승인 필수. 평가 역할 = 유효 assessment 승인도 필수.
--    p_approval(기록용)은 이 자격 행의 유효 승인이어야 하고, 평가 역할이면 assessment 범위여야 한다.
--    승인 행을 잠가(FOR SHARE) 철회 함수(FOR UPDATE)와 직렬화한다 — 철회 직전 공급 · 철회 직후 공급의 경계가 한 줄로 정해진다.
-- 같이 고치는 B 결함(같은 함수라 분리 불가):
--    · 공급 수량 상한 없음 → 줄 수량 · 주문 수량을 넘는 공급 거절(줄 잠금으로 직렬화). 닫힌 주문(delivered · failed · partial)에 공급 거절.
--      실제 PostgreSQL 17 기준선(B 만): 수량 3 줄에 동시 공급 20 → 20행. I1: 3행.
--    · 철회 경합 → B 는 철회 트랜잭션이 열린 사이 공급이 통과했다(철회 커밋 뒤 「철회된 승인」으로 공급 1행). I1: 공급이 기다린 뒤 거절.
--    · 같은 요청 키 재전송은 줄 잠금 뒤에 본다(B 기준선도 20/20 같은 id 였다 — 결함이 아니라 순서를 고정한 것).
--
-- 바뀌는 객체: supply_learner_exposure · workspace_delivery_record · content_release_revoke · fq_axes_valid · fq_role_ok, 아래 C/B 정의자 함수 search_path.
-- 새 객체: function supply_delivery_valid(uuid)(실행권: 정의자 함수 안에서만 — public · anon · authenticated 회수)
-- 표 · 열 · RLS 변경 없음 · 데이터 변경 없음.
-- 되돌리기: 세 함수를 B · C 원본 정의로 다시 create or replace, drop function supply_delivery_valid(uuid)(원본 sha256 은 승인 패키지 §2).
--           이 파일은 데이터를 만들지 않으므로 손실 없음.

-- C의 SQL NULL은 CHECK/IF NOT에서 거절되지 않는다. 빠진 state는 pass가 아니다.
create or replace function public.fq_axes_valid(p jsonb) returns boolean
language sql immutable set search_path to 'public', 'pg_temp' as $$
  select coalesce(jsonb_typeof(p) = 'object'
     and (select count(*) from jsonb_object_keys(p)) = 8
     and (select bool_and(coalesce(k in ('A','B','C','D','E','F','G','H')
                          and jsonb_typeof(p -> k) = 'object'
                          and (p -> k ->> 'state') in ('pass','fail','unknown','not_applicable'), false))
          from jsonb_object_keys(p) k), false)
$$;
create or replace function public.fq_role_ok(p jsonb, p_role text) returns boolean
language sql immutable set search_path to 'public', 'pg_temp' as $$
  select coalesce((p->'A'->>'state') = 'pass' and (p->'B'->>'state') = 'pass' and (p->'C'->>'state') = 'pass'
     and (p->'F'->>'state') = 'pass' and (p->'H'->>'state') = 'pass'
     and (p_role not in ('source_analysis','model_explanation','guided_practice') or (p->'D'->>'state') = 'pass')
     and (p_role not in ('independent_check','transfer','delayed_check') or (p->'E'->>'state') = 'pass'), false)
$$;

-- ── D1. 노출 ───────────────────────────────────────────────────────────────
-- NULL in the existing admin helper must deny all administrator writes.
create or replace function public.content_qualification_record(
  p_rules_version text, p_kind text, p_ref text, p_revision text, p_task text, p_role text, p_axes jsonb,
  p_source_revision text, p_source_hash text, p_analysis_revision text, p_gold_revision text, p_gold_hash text,
  p_defects text[], p_evidence_ids text[], p_method text, p_supersedes uuid default null)
returns uuid language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare v_id uuid; prev record;
begin
  if auth.uid() is null or public.is_admin_or_curator() is not true then raise exception 'Forbidden' using errcode = '42501'; end if;
  perform set_config('vocaflow.supply_writer', 'rpc', true);
  if p_supersedes is not null then
    select * into prev from content_qualification where id = p_supersedes for update;
    if not found then raise exception 'supersedes: not found'; end if;
    if (prev.artifact_kind, prev.artifact_ref, prev.task_id, prev.role) is distinct from (p_kind, p_ref, p_task, p_role) then
      raise exception 'supersedes: identity mismatch';
    end if;
  end if;
  insert into content_qualification (rules_version, artifact_kind, artifact_ref, artifact_revision, task_id, role, axes,
    source_revision, source_hash, analysis_revision, gold_revision, gold_hash, defects, evidence_ids, method, supersedes, created_by)
  values (p_rules_version, p_kind, p_ref, p_revision, p_task, p_role, p_axes,
    p_source_revision, p_source_hash, p_analysis_revision, p_gold_revision, p_gold_hash,
    coalesce(p_defects, '{}'), coalesce(p_evidence_ids, '{}'), p_method, p_supersedes, auth.uid())
  returning id into v_id;     -- 같은 이전 행을 두 번 대체하면 unique(supersedes) 위반(동시 대체 1건만 성공)
  return v_id;
end $$;

create or replace function public.content_release_approve(p_qualification uuid, p_scope text, p_note text default null)
returns uuid language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare q record; v_id uuid;
begin
  if auth.uid() is null or public.is_admin_or_curator() is not true then raise exception 'Forbidden' using errcode = '42501'; end if;
  perform set_config('vocaflow.supply_writer', 'rpc', true);
  select * into q from content_qualification where id = p_qualification for share;
  if not found then raise exception 'qualification: not found'; end if;
  if exists (select 1 from content_qualification s where s.supersedes = q.id) then raise exception 'qualification: superseded'; end if;
  if not public.fq_role_ok(q.axes, q.role) then raise exception 'qualification: required axes not pass'; end if;
  if p_scope = 'assessment' and (q.axes->'E'->>'state') <> 'pass' then raise exception 'assessment: E not pass'; end if;
  insert into content_release_approval (qualification_id, scope, approver, approver_role, note)
  values (q.id, p_scope, auth.uid(), case when public.is_admin() then 'admin' else 'curator' end, p_note)
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

create or replace function public.supply_learner_exposure(p_kind text, p_ref text, p_uid uuid)
returns text language plpgsql stable security definer set search_path to 'public' as $$
declare
  c record;
  v_norm text;
begin
  if p_kind is null or p_ref is null or p_uid is null then return 'unknown'; end if;

  if p_kind = 'csat_item' then
    -- 노출 원장 중 하나라도 없으면 판정할 수 없다(설치 누락 · 이름 변경) — 「본 적 없음」으로 치지 않는다
    if to_regclass('public.csat_dx_response') is null or to_regclass('public.csat_dx_session') is null
       or to_regclass('public.learning_task_attempts') is null or to_regclass('public.learning_sessions') is null
       or to_regclass('public.csat_trap_attempts') is null or to_regclass('public.csat_session_attempts') is null
       or to_regclass('public.csat_review_queue') is null then
      return 'unknown';
    end if;
    select id, exam_id, passage into c from csat_items where id = p_ref;
    if not found then return 'unknown'; end if;

    -- ① 이 문항을 풀었다(어느 경로든) — 합성(synthetic) 행도 센다: 실제 학습자 원장에 섞인 시험 행이라도 보수적으로 노출
    if exists (select 1 from csat_dx_response r join csat_dx_session s on s.id = r.session_id where s.user_id = p_uid and r.item_id = p_ref)
       or exists (select 1 from learning_task_attempts t where t.user_id = p_uid and t.item_ref = p_ref)
       or exists (select 1 from learning_task_attempts t join learning_sessions s on s.id = t.session_id
                  where t.user_id = p_uid and t.item_ref is null and s.user_id = p_uid and s.item_ref = p_ref)
       or exists (select 1 from csat_trap_attempts t where t.user_id = p_uid and t.item_id = p_ref)
       or exists (select 1 from csat_session_attempts t where t.user_id = p_uid and t.item_id = p_ref)
       or exists (select 1 from csat_review_queue q where q.user_id = p_uid and q.item_id = p_ref) then
      return 'attempted';
    end if;
    -- ② 해설 · 정답 공개 · 「먼저 보기」 도움 — **삭제된 세션도 센다**(세션을 지워도 본 사실은 지워지지 않는다)
    if exists (select 1 from learning_sessions s where s.user_id = p_uid and s.item_ref = p_ref
               and (s.explanation_viewed_at is not null or s.explanation_server_at is not null or s.revealed_at is not null
                    or s.help_level = 'viewed_first' or s.help_received_at is not null or s.help_server_at is not null)) then
      return 'explanation_seen';
    end if;
    -- ③ 문항 화면을 연 적이 있다(시도 · 해설 없이) — 문제를 읽었으므로 첫 독립 시도가 아니다
    if exists (select 1 from learning_sessions s where s.user_id = p_uid and s.item_ref = p_ref) then
      return 'item_seen';
    end if;
    -- ④ 같은 시험 회차를 응시했다(문항 번호를 모르는 응답 포함 — 실측: item_id 없는 응답 51행은 모두 회차가 있다)
    if exists (select 1 from csat_dx_session s where s.user_id = p_uid and s.exam_id = c.exam_id) then
      return 'exam_seen';
    end if;
    -- ⑤ 정규화 동일 지문의 다른 문항을 위 어느 경로로든 봤다(41–42 · 43–45 공유 지문, 회차 간 재사용)
    if c.passage is not null then
      v_norm := md5(regexp_replace(lower(c.passage), '\s+', ' ', 'g'));
      if exists (
        select 1 from csat_items j
        where j.id <> c.id and j.passage is not null
          and md5(regexp_replace(lower(j.passage), '\s+', ' ', 'g')) = v_norm
          and (exists (select 1 from csat_dx_session s where s.user_id = p_uid and s.exam_id = j.exam_id)
            or exists (select 1 from csat_dx_response r join csat_dx_session s on s.id = r.session_id
                       where s.user_id = p_uid and r.item_id = j.id)
            or exists (select 1 from learning_task_attempts t where t.user_id = p_uid and t.item_ref = j.id)
            or exists (select 1 from learning_sessions s where s.user_id = p_uid and s.item_ref = j.id)
            or exists (select 1 from csat_trap_attempts t where t.user_id = p_uid and t.item_id = j.id)
            or exists (select 1 from csat_session_attempts t where t.user_id = p_uid and t.item_id = j.id)
            or exists (select 1 from csat_review_queue q where q.user_id = p_uid and q.item_id = j.id))) then
        return 'shared_passage_seen';
      end if;
    end if;
    return 'none';

  elsif p_kind = 'dcp_item' then
    -- DCP 는 해설 열람 · 힌트 · 같은 기사 다른 문항 노출 원장이 없다 → 시도가 없어도 'unknown'(B 와 같음: 평가 공급 HOLD)
    if p_ref !~ '^[0-9a-f-]{36}$' then return 'unknown'; end if;
    if to_regclass('public.csat_item_attempts') is null then return 'unknown'; end if;
    if exists (select 1 from csat_item_attempts t where t.user_id = p_uid and t.dcp_item_id = p_ref::uuid) then return 'attempted'; end if;
    return 'unknown';
  end if;
  return 'unknown';
end $$;
revoke all on function public.supply_learner_exposure(text, text, uuid) from public, anon, authenticated;

-- ── D2 보조. 공급 행이 **지금도** 유효한가 — 승인 철회 · 산출물 변경 뒤에는 부족분으로 다시 센다 ─────────────
-- 유효 = 현재 자격/필수 축 · 유효 public/(평가)assessment 승인 · 기록 승인 철회 없음 · 현재 revision · 현재 원천/Reveal Gate 적격.
-- 자격 대체(supersede)는 과거 이력을 보존하되 현재 공급으로 세지 않는다. 새 자격/승인은 자동 상속하지 않는다.
create or replace function public.supply_delivery_valid(p_delivery uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (
    select 1 from workspace_content_delivery d join content_qualification q on q.id = d.qualification_id
    where d.id = p_delivery
      and not exists (select 1 from content_qualification s where s.supersedes = q.id)
      and public.fq_role_ok(q.axes, q.role) is true
      and not exists (select 1 from content_release_revocation r where r.approval_id = d.approval_id)
      and exists (select 1 from content_release_approval x where x.qualification_id = d.qualification_id and x.scope = 'public'
                  and not exists (select 1 from content_release_revocation r where r.approval_id = x.id))
      and (d.role not in ('independent_check','transfer','delayed_check')
           or exists (select 1 from content_release_approval x where x.qualification_id = d.qualification_id and x.scope = 'assessment'
                      and not exists (select 1 from content_release_revocation r where r.approval_id = x.id)))
      and public.supply_artifact_revision(d.artifact_kind, d.artifact_ref) = d.artifact_revision
      and (d.artifact_kind <> 'csat_item' or public.csat_ec_embargoed_items(array[d.artifact_ref]) = '{}'::text[])
      and (d.artifact_kind <> 'dcp_item' or exists (
        select 1 from csat_dcp_items i where i.id = d.artifact_ref::uuid and i.kind = 'article'
          and i.ref_id is not null and public.csat_source_is_eligible(i.ref_id) is true)))
$$;
revoke all on function public.supply_delivery_valid(uuid) from public, anon, authenticated;

-- ── D2. 공급 기록 — 승인 범위 · 철회 직렬화 · 멱등 경합 · 수량 상한 ─────────────────────
-- B 원본과 같은 서명 · 같은 검사 순서 ①~⑧ 을 유지하고 ⑥(승인)을 앱 계약으로 바꾼다. 바뀐 곳은 「(I1)」 표시.
create or replace function public.workspace_delivery_record(p_line uuid, p_order uuid, p_qualification uuid, p_approval uuid, p_request_key uuid)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare
  v_uid uuid := auth.uid();
  ln record; q record; a record; d record; o record;
  v_id uuid; v_src uuid; v_rev text; v_exp text;
  v_assess boolean;
  v_line_n int; v_order_n int;
begin
  if v_uid is null then raise exception 'Forbidden' using errcode = '42501'; end if;
  if p_request_key is null then raise exception 'delivery: request_key required'; end if;
  perform set_config('vocaflow.supply_writer', 'rpc', true);

  -- (I1) 줄을 먼저 잠근다 — 같은 줄의 공급(수량 상한 · 같은 키 재전송)을 직렬화. 소유 확인을 겸한다
  select * into ln from workspace_content_demand_line where id = p_line and user_id = v_uid for update;

  -- ① 같은 요청 키 = 같은 본문일 때만 이전 결과(잠근 뒤에 본다 — 동시 재전송이 먼저 커밋된 행을 본다)
  select * into d from workspace_content_delivery where user_id = v_uid and request_key = p_request_key;
  if found then
    if (d.line_id, d.order_id, d.qualification_id, d.approval_id) is distinct from (p_line, p_order, p_qualification, p_approval) then
      raise exception 'delivery: request_key reused with a different body' using errcode = '23505';
    end if;
    return d.id;
  end if;

  -- ② 줄 소유 · Workspace active
  if ln.id is null then raise exception 'delivery: line not found or not owned' using errcode = '42501'; end if;
  if not exists (select 1 from learner_workspace w where w.id = ln.workspace_id and w.user_id = v_uid and w.status = 'active') then
    raise exception 'delivery: workspace not active';
  end if;

  -- ③ 주문이 이 줄 것 · (I1) 열린 주문일 것
  if p_order is not null then
    select * into o from factory_order where id = p_order and line_id = p_line for update;
    if not found then raise exception 'delivery: order not on this line'; end if;
    if o.state in ('delivered','failed','partial') then raise exception 'delivery: order closed (%)', o.state; end if;
  end if;

  -- ④ 자격 정체성 · 현재 행 · 역할 필수 축
  select * into q from content_qualification where id = p_qualification for share;
  if not found or q.task_id <> ln.task_id or q.role <> ln.role then raise exception 'delivery: qualification identity mismatch'; end if;
  if exists (select 1 from content_qualification s where s.supersedes = q.id) then raise exception 'delivery: qualification superseded'; end if;
  if public.fq_role_ok(q.axes, q.role) is not true then raise exception 'delivery: required axes not pass'; end if;

  -- ⑤ 산출물 실제 행 · 현재 revision
  v_rev := public.supply_artifact_revision(q.artifact_kind, q.artifact_ref);
  if v_rev is null then raise exception 'delivery: artifact not found or kind unsupported (%)', q.artifact_kind; end if;
  if v_rev <> q.artifact_revision then raise exception 'delivery: artifact changed since qualification'; end if;

  -- ⑥ (I1) 승인 — 이 자격의 승인 행을 모두 잠가 철회와 직렬화(철회 함수가 같은 행을 FOR UPDATE 로 잡는다)
  v_assess := q.role in ('independent_check','transfer','delayed_check');
  perform 1 from content_release_approval x where x.qualification_id = q.id order by x.id for share;
  select * into a from content_release_approval where id = p_approval and qualification_id = q.id;
  if not found then raise exception 'delivery: approval missing'; end if;
  if exists (select 1 from content_release_revocation r where r.approval_id = a.id) then raise exception 'delivery: approval revoked'; end if;
  if not exists (select 1 from content_release_approval x where x.qualification_id = q.id and x.scope = 'public'
                 and not exists (select 1 from content_release_revocation r where r.approval_id = x.id)) then
    raise exception 'delivery: public approval required';
  end if;
  if v_assess then
    if not exists (select 1 from content_release_approval x where x.qualification_id = q.id and x.scope = 'assessment'
                   and not exists (select 1 from content_release_revocation r where r.approval_id = x.id)) then
      raise exception 'delivery: assessment approval required';
    end if;
    if a.scope <> 'assessment' then raise exception 'delivery: assessment role must record the assessment approval'; end if;
  end if;

  -- ⑦ 원천 지금 적격(DCP)
  if q.artifact_kind = 'dcp_item' then
    select i.ref_id into v_src from csat_dcp_items i where i.id = q.artifact_ref::uuid;
    if v_src is null or public.csat_source_is_eligible(v_src) is not true then raise exception 'delivery: source not eligible'; end if;
  elsif q.artifact_kind = 'csat_item' then
    if public.csat_ec_embargoed_items(array[q.artifact_ref]) is distinct from '{}'::text[] then
      raise exception 'delivery: source not eligible (Reveal Gate)';
    end if;
  end if;

  -- ⑧ G — 평가 역할은 노출 'none' 일 때만(D1 판정기)
  if v_assess then
    v_exp := public.supply_learner_exposure(q.artifact_kind, q.artifact_ref, v_uid);
    if v_exp is distinct from 'none' then raise exception 'delivery: G — exposure %', coalesce(v_exp, 'unknown'); end if;
  end if;

  -- ⑨ (I1) 수량 상한 — 줄은 **지금 유효한** 공급 수로, 주문은 그 주문의 공급 행 수로 센다.
  --    철회 · 변경으로 무효가 된 공급은 자리를 비워 대체 공급을 받을 수 있다(같은 산출물 재공급은 B 의 unique 가 막는다)
  select count(*) into v_line_n from workspace_content_delivery x where x.line_id = p_line and public.supply_delivery_valid(x.id);
  if v_line_n >= ln.quantity then raise exception 'delivery: line quantity reached (% of %)', v_line_n, ln.quantity; end if;
  if p_order is not null then
    select count(*) into v_order_n from workspace_content_delivery where order_id = p_order;
    if v_order_n >= o.quantity then raise exception 'delivery: order quantity reached (% of %)', v_order_n, o.quantity; end if;
  end if;

  insert into workspace_content_delivery (line_id, user_id, workspace_id, role, task_id, order_id, artifact_kind, artifact_ref,
    artifact_revision, qualification_id, approval_id, request_key)
  values (p_line, v_uid, ln.workspace_id, ln.role, ln.task_id, p_order, q.artifact_kind, q.artifact_ref, q.artifact_revision, q.id, a.id, p_request_key)
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.workspace_delivery_record(uuid, uuid, uuid, uuid, uuid) from public, anon;
grant execute on function public.workspace_delivery_record(uuid, uuid, uuid, uuid, uuid) to authenticated;

-- ── D2'. 철회 — 승인 행을 FOR UPDATE 로 잡아 진행 중 공급(FOR SHARE)과 직렬화. 그 밖은 C 원본과 같다 ───────
create or replace function public.content_release_revoke(p_approval uuid, p_reason text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null or public.is_admin_or_curator() is not true then raise exception 'Forbidden' using errcode = '42501'; end if;
  perform set_config('vocaflow.supply_writer', 'rpc', true);
  perform 1 from content_release_approval where id = p_approval for update;
  if not found then raise exception 'revoke: approval not found'; end if;
  insert into content_release_revocation (approval_id, revoked_by, reason) values (p_approval, auth.uid(), p_reason)
  on conflict (approval_id) do nothing;   -- 이미 철회됨 = 같은 결과
end $$;
revoke all on function public.content_release_revoke(uuid, text) from public, anon;
grant execute on function public.content_release_revoke(uuid, text) to authenticated;

-- public의 CREATE 권한은 적용 전 확인한다. pg_temp를 명시적으로 마지막에 둬 임시 표의 정의자 권한 사칭을 막는다.
alter function public.content_qualification_record(text,text,text,text,text,text,jsonb,text,text,text,text,text,text[],text[],text,uuid) set search_path to 'public', 'pg_temp';
alter function public.content_release_approve(uuid,text,text) set search_path to 'public', 'pg_temp';
alter function public.content_release_revoke(uuid,text) set search_path to 'public', 'pg_temp';
alter function public.workspace_demand_record(text) set search_path to 'public', 'pg_temp';
alter function public.factory_order_open(uuid,text,smallint,uuid) set search_path to 'public', 'pg_temp';
alter function public.factory_order_transition(uuid,text,text,text,text,uuid,uuid) set search_path to 'public', 'pg_temp';
alter function public.supply_artifact_revision(text,text) set search_path to 'public', 'pg_temp';
alter function public.supply_learner_exposure(text,text,uuid) set search_path to 'public', 'pg_temp';
alter function public.supply_delivery_valid(uuid) set search_path to 'public', 'pg_temp';
alter function public.workspace_delivery_record(uuid,uuid,uuid,uuid,uuid) set search_path to 'public', 'pg_temp';
-- 기존 권한 helper도 자체 search_path가 바깥 정의자의 설정을 덮는다. 임시 user_profiles 사칭을 막는다.
-- 실제 함수 본문·ACL은 그대로이며, DB-1 승인 범위에 이 기존 두 함수의 설정 변경을 명시한다.
alter function public.is_admin_or_curator() set search_path to 'public', 'auth', 'pg_temp';
alter function public.is_admin() set search_path to 'public', 'pg_temp';

-- Supabase 기본 ACL은 ALL(TRUNCATE/REFERENCES/TRIGGER 포함)이다. RLS와 행 트리거는 TRUNCATE를 막지 않는다.
-- 학습자/익명은 SELECT 이외의 표 권한을 모두 제거한다. 서비스 역할은 신뢰된 운영 경계다.
revoke all on table public.content_qualification, public.content_release_approval, public.content_release_revocation,
  public.workspace_content_demand, public.workspace_content_demand_line, public.factory_order,
  public.factory_order_event, public.workspace_content_delivery from public, anon, authenticated;
grant select on table public.content_qualification, public.content_release_approval, public.content_release_revocation,
  public.workspace_content_demand, public.workspace_content_demand_line, public.factory_order,
  public.factory_order_event, public.workspace_content_delivery to authenticated;
-- <<< VF-SEGMENT S
do $vf$ begin
  if coalesce(current_setting('vf.i1_deploy_xid', true), '') <> txid_current()::text
     or coalesce(current_setting('vf.i1_deploy_stage', true), '') <> 'db1' then
    raise exception 'DEPLOY_BLOCKED[atomicity] DB1 이 한 트랜잭션으로 실행되지 않았다(%). scripts/db/factory-i1/deploy.mjs apply 로만 적용한다(이력 행을 같은 트랜잭션에 쓴다)', 'S→epilogue';
  end if;
end $vf$;
-- ── VF 에필로그: 카탈로그 diff = 허용 목록(정확히) · 보안 속성 검증 — 하나라도 어긋나면 전체 롤백 ──────────
do $vf$
declare v_added text[]; v_removed text[]; v_changed text[]; v_bad text[];
  exp_added text[] := array['con:public.csat_map_goal_version.csat_map_goal_version_id_user_key', 'rel:public.csat_map_goal_version_id_user_key', 'con:public.learner_workspace.learner_workspace_id_user_key', 'rel:public.learner_workspace_id_user_key', 'con:public.learner_workspace_plan.learner_workspace_plan_ws_ver_user_key', 'rel:public.learner_workspace_plan_ws_ver_user_key', 'rel:public.content_qualification', 'rel:public.content_release_approval', 'rel:public.content_release_revocation', 'rel:public.workspace_content_demand', 'rel:public.workspace_content_demand_line', 'rel:public.factory_order', 'rel:public.factory_order_event', 'rel:public.workspace_content_delivery', 'rel:public.content_qualification_id_artifact_kind_artifact_ref_artifac_key', 'rel:public.content_qualification_identity', 'rel:public.content_qualification_pkey', 'rel:public.content_qualification_supersedes_key', 'rel:public.content_release_approval_pkey', 'rel:public.content_release_approval_qualification_id_scope_key', 'rel:public.content_release_revocation_pkey', 'rel:public.factory_order_event_id_seq', 'rel:public.factory_order_event_order_id_request_key_key', 'rel:public.factory_order_event_order_id_seq_key', 'rel:public.factory_order_event_pkey', 'rel:public.factory_order_line_id_order_seq_key', 'rel:public.factory_order_one_open_per_line', 'rel:public.factory_order_pkey', 'rel:public.factory_order_user_id_request_key_key', 'rel:public.workspace_content_delivery_line_id_artifact_kind_artifact_r_key', 'rel:public.workspace_content_delivery_pkey', 'rel:public.workspace_content_delivery_user_id_request_key_key', 'rel:public.workspace_content_demand_id_user_id_workspace_id_key', 'rel:public.workspace_content_demand_line_demand_id_line_no_key', 'rel:public.workspace_content_demand_line_demand_id_role_task_id_key', 'rel:public.workspace_content_demand_line_id_user_id_workspace_id_role__key', 'rel:public.workspace_content_demand_line_pkey', 'rel:public.workspace_content_demand_pkey', 'rel:public.workspace_content_demand_user_id_signature_key', 'fn:public.content_qualification_record(p_rules_version text, p_kind text, p_ref text, p_revision text, p_task text, p_role text, p_axes jsonb, p_source_revision text, p_source_hash text, p_analysis_revision text, p_gold_revision text, p_gold_hash text, p_defects text[], p_evidence_ids text[], p_method text, p_supersedes uuid)', 'fn:public.content_release_approve(p_qualification uuid, p_scope text, p_note text)', 'fn:public.content_release_revoke(p_approval uuid, p_reason text)', 'fn:public.factory_order_open(p_line uuid, p_reason text, p_quantity smallint, p_request_key uuid)', 'fn:public.factory_order_state_guard()', 'fn:public.factory_order_transition(p_order uuid, p_expected text, p_to text, p_reason text, p_run_id text, p_qualification uuid, p_request_key uuid)', 'fn:public.forbid_ledger_mutation()', 'fn:public.fq_axes_valid(p jsonb)', 'fn:public.fq_role_ok(p jsonb, p_role text)', 'fn:public.ledger_writer_guard()', 'fn:public.supply_artifact_revision(p_kind text, p_ref text)', 'fn:public.supply_delivery_valid(p_delivery uuid)', 'fn:public.supply_learner_exposure(p_kind text, p_ref text, p_uid uuid)', 'fn:public.supply_writer_guard()', 'fn:public.workspace_delivery_record(p_line uuid, p_order uuid, p_qualification uuid, p_approval uuid, p_request_key uuid)', 'fn:public.workspace_demand_record(p_canonical text)', 'pol:public.content_qualification.cq_admin_read', 'pol:public.content_release_approval.cra_admin_read', 'pol:public.content_release_revocation.crr_admin_read', 'pol:public.factory_order.fo_owner_read', 'pol:public.factory_order_event.foe_owner_read', 'pol:public.workspace_content_delivery.wcdel_owner_read', 'pol:public.workspace_content_demand.wcd_owner_read', 'pol:public.workspace_content_demand_line.wcdl_owner_read', 'trg:public.content_qualification.content_qualification_append_only', 'trg:public.content_qualification.content_qualification_writer', 'trg:public.content_release_approval.content_release_approval_append_only', 'trg:public.content_release_approval.content_release_approval_writer', 'trg:public.content_release_revocation.content_release_revocation_append_only', 'trg:public.content_release_revocation.content_release_revocation_writer', 'trg:public.factory_order.factory_order_no_delete', 'trg:public.factory_order.factory_order_state_guard', 'trg:public.factory_order.factory_order_writer', 'trg:public.factory_order_event.factory_order_event_append_only', 'trg:public.factory_order_event.factory_order_event_writer', 'trg:public.workspace_content_delivery.workspace_content_delivery_append_only', 'trg:public.workspace_content_delivery.workspace_content_delivery_writer', 'trg:public.workspace_content_demand.workspace_content_demand_no_update', 'trg:public.workspace_content_demand.workspace_content_demand_writer', 'trg:public.workspace_content_demand_line.workspace_content_demand_line_no_update', 'trg:public.workspace_content_demand_line.workspace_content_demand_line_writer']::text[];
  exp_changed text[] := array['fn:public.is_admin()', 'fn:public.is_admin_or_curator()']::text[];
  con_tables text[] := array['content_qualification', 'content_release_approval', 'content_release_revocation', 'workspace_content_demand', 'workspace_content_demand_line', 'factory_order', 'factory_order_event', 'workspace_content_delivery']::text[];
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
 b as (select * from vf_i1_db1_before),
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
  -- 권한 helper: 정확히 강화된 값
  select array_agg(h.f||'='||coalesce(p.proconfig::text, 'NULL')) into v_bad
  from (values ('is_admin', '{"search_path=public, pg_temp"}'), ('is_admin_or_curator', '{"search_path=public, auth, pg_temp"}')) h(f, want)
  left join pg_proc p on p.pronamespace = 'public'::regnamespace and p.proname = h.f and p.pronargs = 0
  where coalesce(p.proconfig::text, 'NULL') <> h.want;
  if v_bad is not null then raise exception 'DEPLOY_BLOCKED[verify] helper search_path: %', v_bad; end if;
  -- 새 표 8: RLS on · anon 권한 0 · authenticated 는 SELECT 만
  select array_agg(t) into v_bad from unnest(array['content_qualification', 'content_release_approval', 'content_release_revocation', 'workspace_content_demand', 'workspace_content_demand_line', 'factory_order', 'factory_order_event', 'workspace_content_delivery']::text[]) t
  where not (select relrowsecurity from pg_class where oid = to_regclass('public.'||t))
     or has_table_privilege('anon', 'public.'||t, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     or has_table_privilege('authenticated', 'public.'||t, 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     or not has_table_privilege('authenticated', 'public.'||t, 'SELECT');
  if v_bad is not null then raise exception 'DEPLOY_BLOCKED[verify] 표 RLS/권한: %', v_bad; end if;
  -- 내부 판정기는 정의자 함수 안에서만(anon · authenticated · public 실행권 없음)
  select array_agg(p.proname::text) into v_bad from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname in ('supply_learner_exposure','supply_delivery_valid','supply_artifact_revision')
    and (has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('authenticated', p.oid, 'EXECUTE'));
  if v_bad is not null then raise exception 'DEPLOY_BLOCKED[verify] 내부 판정기 실행권: %', v_bad; end if;
  -- 쓰기 RPC 는 anon 실행권 없음
  select array_agg(p.proname::text) into v_bad from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname = any(array['workspace_demand_record', 'factory_order_open', 'factory_order_transition', 'workspace_delivery_record', 'content_qualification_record', 'content_release_approve', 'content_release_revoke']::text[])
    and has_function_privilege('anon', p.oid, 'EXECUTE');
  if v_bad is not null then raise exception 'DEPLOY_BLOCKED[verify] anon 실행권: %', v_bad; end if;
  -- 정의자 함수는 모두 search_path 끝이 pg_temp
  select array_agg(p.proname::text) into v_bad from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname = any(array['forbid_ledger_mutation', 'fq_axes_valid', 'fq_role_ok', 'content_qualification_record', 'content_release_approve', 'content_release_revoke', 'ledger_writer_guard', 'factory_order_state_guard', 'workspace_demand_record', 'factory_order_open', 'factory_order_transition', 'supply_artifact_revision', 'supply_learner_exposure', 'workspace_delivery_record', 'supply_writer_guard', 'supply_delivery_valid']::text[]) and p.prosecdef
    and not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%pg_temp');
  if v_bad is not null then raise exception 'DEPLOY_BLOCKED[verify] 정의자 search_path: %', v_bad; end if;
  perform set_config('vf.i1_deploy_done', txid_current()::text, true);
  raise notice 'VF_DEPLOY_OK stage=db1 added=% changed=%', cardinality(v_added), cardinality(v_changed);
end $vf$;
