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
