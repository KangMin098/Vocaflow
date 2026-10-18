-- supabase/migrations/_pending_authored_supply.sql
-- ⚠️ 보류(적용 안 함) — FINAL MISSION §4.2 「창작 콘텐츠의 정식 등록」 + 권리 · Gold 사람 결정 결속.
-- 적용 순서: DB-1(20261017200000) → DB-2(20261017200100) → I2(20261018120000) → G2(20261018120100) → **이 파일**. 한 트랜잭션.
-- 승인 패키지: docs/final/APPROVAL_PACKAGE.md — 사용자가 SQL · SHA 를 보고 승인하기 전 개발 DB 에 적용하지 않는다.
--
-- 왜: 두 AI 권리 검토가 기출 전체를 INSUFFICIENT 로 판정했다(docs/research/r5-2020-24-review-packet-20261018/AI-VERIFICATION.md).
--   첫 적격 공급은 우리가 쓴 지문 · 문항(자체 창작)으로 연다. 기출 csat_item 으로 위장 등록하지 않는다 — 새 산출물 종류 `authored_item`.
--
-- 무엇:
--   1. authored_item — 창작 산출물 원장(추가 전용 · 행 불변). 본문(body) · Gold(gold) · 지문 묶음 · TASK · 역할군 · 제작 이력.
--      revision = sha256(body || gold), 주석(Gold) hash = sha256(gold) — 둘 다 DB 가 계산한다(클라이언트 hash 를 믿지 않는다).
--      교수 · 연습(instruction)과 평가(assessment) 산출물은 **같은 지문 묶음을 공유할 수 없다**(등록 함수가 거절) — 독립 확인 지문이 연습에서 새지 않게.
--   2. content_human_decision(+ 철회) — 권리(rights) · Gold(gold) **사람 결정** 원장. 결정 근거(basis) · 범위(scope) · 근거 ref 를 남긴다.
--      AI 검토는 이 표에 쓰지 않는다(evidence 로만 붙는다). 기록 함수는 관리자 로그인 세션(auth.uid)만 — service_role 은 호출할 수 없다.
--   3. 공급 판정 확장(래퍼 — 기존 검사 본문은 그대로 두고 앞에 검사를 더한다):
--      · 모든 신규 공급: 철회되지 않은 권리 결정(revision 일치 · scope ⊇ {display, transmit})이 있어야 한다(기출 포함 — 권리 결속 없는 공급 금지).
--      · authored_item: 현재 행의 Gold hash = 자격 annotation_hash = 자격 gold_hash. 평가 역할은 같은 hash 의 사람 Gold 결정 필수.
--      · 현재 유효성(supply_delivery_valid)도 같은 조건으로 — 결정 철회 뒤에는 부족분으로 다시 센다(과거 공급 이력은 보존).
--   4. 노출(G) · G2 결속에 authored_item 경로를 더한다(지문 묶음 = 노출 키). 결속 RPC 는 G2 원본 본문을 보존하고 산출물 종류 분기만 더한다.
--
-- 기존 행: 없음(content_qualification 0행 · 2026-10-18 실측) — 백필 없음. 기존 표 열 삭제 없음.
-- 중단: 창작 공급만 멈추려면 authored_item_register · content_human_decision_record 실행권 회수. 권리 결정 철회 = 그 산출물 현재 공급 무효.
-- 되돌리기(이력 0행일 때만 · 별도 승인): docs/final/APPROVAL_PACKAGE.md §되돌리기. 행이 생긴 뒤에는 DROP 하지 않는다.

do $$
declare v_missing text[];
begin
  select array_agg(x) into v_missing from unnest(array[
    'public.supply_artifact_revision(text,text)', 'public.supply_learner_exposure(text,text,uuid)',
    'public.supply_annotation_matches(uuid)', 'public.supply_delivery_valid(uuid)', 'public.supply_delivery_valid_i1(uuid)',
    'public.workspace_delivery_record(uuid,uuid,uuid,uuid,uuid)', 'public.workspace_delivery_record_i1(uuid,uuid,uuid,uuid,uuid)',
    'public.workspace_delivery_attempt_record(uuid,bigint,uuid)', 'public.r5_exposure_key(text,text)',
    'public.forbid_ledger_mutation()', 'public.supply_writer_guard()', 'public.is_admin_or_curator()']::text[]) x
  where to_regprocedure(x) is null;
  if v_missing is not null then raise exception 'authored supply requires DB-1 + I2 + G2 first — missing: %', v_missing; end if;
  if to_regclass('public.workspace_delivery_attempt') is null then raise exception 'authored supply requires G2 binding first'; end if;
  if to_regclass('public.authored_item') is not null then raise exception 'authored supply: already installed'; end if;
end $$;

-- ── 1. 창작 산출물 원장 ─────────────────────────────────────────────────
create table public.authored_item (
  ref text primary key check (ref ~ '^authored:[a-z0-9][a-z0-9.-]{2,80}$'),       -- 학습 기록 item_ref 와 같은 값
  task_id text not null check (task_id ~ '^[a-z]\.[a-z_]{2,60}$'),
  task_key text not null check (task_key ~ '^[a-z][a-z0-9-]{2,60}$'),               -- 채점 과제 키(G2 시도 task_key)
  role_class text not null check (role_class in ('instruction', 'assessment')),
  intended_role text not null check (intended_role in ('source_analysis','model_explanation','guided_practice','independent_check','transfer','delayed_check')),
  passage_group text not null check (passage_group ~ '^[a-z0-9][a-z0-9.-]{2,80}$'),
  body jsonb not null check (jsonb_typeof(body) = 'object' and jsonb_typeof(body->'sentences') = 'array'
                             and jsonb_array_length(body->'sentences') between 2 and 30),
  gold jsonb not null check (jsonb_typeof(gold) = 'object'),
  annotation_ref text not null unique check (annotation_ref ~ '^[a-z][a-z0-9-]{2,60}-[a-z0-9.-]{3,100}$'),
  provenance jsonb not null check (jsonb_typeof(provenance) = 'object' and provenance ? 'author' and provenance ? 'method'
                                   and provenance ? 'derivedFrom'),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  -- 역할군과 의도 역할이 맞아야 한다(평가 역할 = assessment)
  check ((role_class = 'assessment') = (intended_role in ('independent_check','transfer','delayed_check'))),
  -- 채점 주석 ref 는 과제 키로 시작한다(G2 결속의 과제 키 → TASK 대응 규칙과 같다)
  check (left(annotation_ref, length(task_key) + 1) = task_key || '-')
);
create index authored_item_group on public.authored_item (passage_group);
create trigger authored_item_append_only before update or delete on public.authored_item
  for each row execute function public.forbid_ledger_mutation();
create trigger authored_item_writer before insert on public.authored_item
  for each row execute function public.supply_writer_guard();
alter table public.authored_item enable row level security;
create policy ai_admin_read on public.authored_item for select using (public.is_admin_or_curator());
revoke all on table public.authored_item from public, anon, authenticated;
grant select on table public.authored_item to authenticated;   -- RLS: 관리자만 행이 보인다. 학습자 본문은 서버(service_role)가 납품 확인 뒤 내보낸다

/** Gold(채점 주석) hash — 시도 행 content_hash · 자격 annotation_hash/gold_hash 와 같은 값 */
create function public.authored_item_gold_hash(p_ref text)
returns text language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select encode(sha256(convert_to(a.gold::text, 'UTF8')), 'hex') from public.authored_item a where a.ref = p_ref
$$;
/** 산출물 revision — 본문 + Gold. 둘 중 하나라도 바뀌면 새 ref 로 등록해야 한다(행 불변) */
create function public.authored_item_revision(p_ref text)
returns text language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select encode(sha256(convert_to(a.body::text || '|' || a.gold::text, 'UTF8')), 'hex') from public.authored_item a where a.ref = p_ref
$$;
revoke all on function public.authored_item_gold_hash(text) from public, anon, authenticated;
revoke all on function public.authored_item_revision(text) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    -- 서버가 시도 행 content_hash 를 DB 값으로 쓰기 위해 읽는다(쓰기 권한 아님)
    execute 'grant execute on function public.authored_item_gold_hash(text) to service_role';
    execute 'grant execute on function public.authored_item_revision(text) to service_role';
    execute 'revoke insert, update, delete, truncate, references, trigger on table public.authored_item from service_role';
  end if;
end $$;

/** 등록(관리자 · 큐레이터). 같은 ref 재등록은 같은 본문일 때만 같은 결과. 지문 묶음의 역할군 혼합 금지 */
create function public.authored_item_register(
  p_ref text, p_task text, p_task_key text, p_role_class text, p_intended_role text, p_group text,
  p_body jsonb, p_gold jsonb, p_annotation_ref text, p_provenance jsonb)
returns text language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare prev record;
begin
  if auth.uid() is null or public.is_admin_or_curator() is not true then raise exception 'Forbidden' using errcode = '42501'; end if;
  perform set_config('vocaflow.supply_writer', 'rpc', true);
  -- 같은 지문 묶음 등록을 직렬화(역할군 혼합 검사의 경합 방지)
  perform pg_advisory_xact_lock(hashtextextended('authored-group|' || coalesce(p_group, ''), 0));
  select * into prev from authored_item where ref = p_ref;
  if found then
    if (prev.task_id, prev.task_key, prev.role_class, prev.intended_role, prev.passage_group, prev.body, prev.gold, prev.annotation_ref)
       is distinct from (p_task, p_task_key, p_role_class, p_intended_role, p_group, p_body, p_gold, p_annotation_ref) then
      raise exception 'authored: ref exists with a different body — register a new ref' using errcode = '23505';
    end if;
    return prev.ref;
  end if;
  if exists (select 1 from authored_item a where a.passage_group = p_group and a.role_class <> p_role_class) then
    raise exception 'authored: passage group % mixes instruction and assessment', p_group;
  end if;
  insert into authored_item (ref, task_id, task_key, role_class, intended_role, passage_group, body, gold, annotation_ref, provenance, created_by)
  values (p_ref, p_task, p_task_key, p_role_class, p_intended_role, p_group, p_body, p_gold, p_annotation_ref, p_provenance, auth.uid());
  return p_ref;
end $$;
revoke all on function public.authored_item_register(text,text,text,text,text,text,jsonb,jsonb,text,jsonb) from public, anon;
grant execute on function public.authored_item_register(text,text,text,text,text,text,jsonb,jsonb,text,jsonb) to authenticated;

-- ── 2. 권리 · Gold 사람 결정 원장 ───────────────────────────────────────
create table public.content_human_decision (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('rights', 'gold')),
  artifact_kind text not null check (artifact_kind in ('dcp_item','csat_item','textbook_activity','workspace_bundle','authored_item')),
  artifact_ref text not null check (length(artifact_ref) between 1 and 200),
  artifact_revision text not null check (length(artifact_revision) between 1 and 128),
  subject_hash text not null check (subject_hash ~ '^[0-9a-f]{64}$'),       -- rights: 산출물 revision(64자) · gold: Gold hash
  basis text not null check (basis in ('self_authored_original', 'licensed', 'written_permission', 'legal_opinion', 'human_gold_review')),
  scope text[] not null check (scope <@ array['store','display','transmit','assess']::text[] and cardinality(scope) > 0),
  evidence_ref text not null check (length(evidence_ref) between 1 and 300),   -- 허락서 · 라이선스 · 검수 패킷 경로/해시(원문 금지)
  decided_by uuid not null references auth.users(id),
  decider_role text not null check (decider_role in ('admin', 'curator')),
  note text check (note is null or length(note) <= 500),
  created_at timestamptz not null default now(),
  check ((kind = 'gold') = (basis = 'human_gold_review')),
  check (kind <> 'gold' or 'assess' = any(scope)),
  unique (kind, artifact_kind, artifact_ref, artifact_revision, subject_hash)
);
create table public.content_human_decision_revocation (
  decision_id uuid primary key references public.content_human_decision(id),
  revoked_by uuid not null references auth.users(id),
  reason text not null check (length(reason) between 1 and 500),
  created_at timestamptz not null default now()
);
create trigger content_human_decision_append_only before update or delete on public.content_human_decision
  for each row execute function public.forbid_ledger_mutation();
create trigger content_human_decision_writer before insert on public.content_human_decision
  for each row execute function public.supply_writer_guard();
create trigger content_human_decision_revocation_append_only before update or delete on public.content_human_decision_revocation
  for each row execute function public.forbid_ledger_mutation();
create trigger content_human_decision_revocation_writer before insert on public.content_human_decision_revocation
  for each row execute function public.supply_writer_guard();
alter table public.content_human_decision enable row level security;
alter table public.content_human_decision_revocation enable row level security;
create policy chd_admin_read on public.content_human_decision for select using (public.is_admin_or_curator());
create policy chdr_admin_read on public.content_human_decision_revocation for select using (public.is_admin_or_curator());
revoke all on table public.content_human_decision, public.content_human_decision_revocation from public, anon, authenticated;
grant select on table public.content_human_decision, public.content_human_decision_revocation to authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'revoke insert, update, delete, truncate, references, trigger on table public.content_human_decision, public.content_human_decision_revocation from service_role';
  end if;
end $$;

/**
 * 사람 결정 기록 — 관리자 · 큐레이터 **로그인 세션**만(auth.uid 필수 · service_role 불가).
 * p_attest 는 정확히 'human-reviewed' — 사람이 직접 검토했다는 진술을 호출에 남긴다(AI 검토 결과를 옮겨 적는 경로가 아님을 명시).
 * revision · hash 는 호출자 값이 아니라 **현재 산출물에서** 다시 계산해 대조한다(다른 revision 에 대한 결정 기록 금지).
 */
create function public.content_human_decision_record(
  p_kind text, p_artifact_kind text, p_ref text, p_revision text, p_subject_hash text,
  p_basis text, p_scope text[], p_evidence_ref text, p_attest text, p_note text default null)
returns uuid language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare v_id uuid; v_rev text; v_role text;
begin
  if auth.uid() is null or public.is_admin_or_curator() is not true then raise exception 'Forbidden' using errcode = '42501'; end if;
  if p_attest is distinct from 'human-reviewed' then raise exception 'decision: human attestation required'; end if;
  perform set_config('vocaflow.supply_writer', 'rpc', true);
  v_rev := public.supply_artifact_revision(p_artifact_kind, p_ref);
  if v_rev is null or v_rev <> p_revision then raise exception 'decision: artifact revision is not current'; end if;
  if p_kind = 'rights' and p_subject_hash is distinct from v_rev then raise exception 'decision: rights subject must be the artifact revision'; end if;
  if p_kind = 'gold' and p_artifact_kind = 'authored_item' and p_subject_hash is distinct from public.authored_item_gold_hash(p_ref) then
    raise exception 'decision: gold subject must be the current gold hash';
  end if;
  if p_basis = 'self_authored_original' and p_artifact_kind <> 'authored_item' then
    raise exception 'decision: self_authored_original applies to authored_item only';
  end if;
  v_role := case when public.is_admin() then 'admin' else 'curator' end;
  select id into v_id from content_human_decision
   where kind = p_kind and artifact_kind = p_artifact_kind and artifact_ref = p_ref and artifact_revision = p_revision and subject_hash = p_subject_hash;
  if found then return v_id; end if;
  insert into content_human_decision (kind, artifact_kind, artifact_ref, artifact_revision, subject_hash, basis, scope, evidence_ref,
    decided_by, decider_role, note)
  values (p_kind, p_artifact_kind, p_ref, p_revision, p_subject_hash, p_basis, p_scope, p_evidence_ref, auth.uid(), v_role, p_note)
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.content_human_decision_record(text,text,text,text,text,text,text[],text,text,text) from public, anon;
grant execute on function public.content_human_decision_record(text,text,text,text,text,text,text[],text,text,text) to authenticated;

create function public.content_human_decision_revoke(p_decision uuid, p_reason text)
returns void language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
begin
  if auth.uid() is null or public.is_admin_or_curator() is not true then raise exception 'Forbidden' using errcode = '42501'; end if;
  perform set_config('vocaflow.supply_writer', 'rpc', true);
  -- 진행 중 공급(FOR SHARE)과 직렬화
  perform 1 from content_human_decision where id = p_decision for update;
  if not found then raise exception 'revoke: decision not found'; end if;
  insert into content_human_decision_revocation (decision_id, revoked_by, reason) values (p_decision, auth.uid(), p_reason)
  on conflict (decision_id) do nothing;
end $$;
revoke all on function public.content_human_decision_revoke(uuid, text) from public, anon;
grant execute on function public.content_human_decision_revoke(uuid, text) to authenticated;

/** 지금 유효한 사람 결정이 있는가(철회 없음 · 범위 포함). p_lock 이면 결정 행을 FOR SHARE 로 잠가 철회와 직렬화 */
create function public.content_human_decision_ok(p_kind text, p_artifact_kind text, p_ref text, p_revision text, p_subject_hash text, p_scope text[])
returns boolean language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select exists (
    select 1 from public.content_human_decision h
    where h.kind = p_kind and h.artifact_kind = p_artifact_kind and h.artifact_ref = p_ref
      and h.artifact_revision = p_revision and h.subject_hash = p_subject_hash and h.scope @> p_scope
      and not exists (select 1 from public.content_human_decision_revocation r where r.decision_id = h.id))
$$;
revoke all on function public.content_human_decision_ok(text,text,text,text,text,text[]) from public, anon, authenticated;

-- ── 3. 자격 원장: 산출물 종류에 authored_item 추가 · 주석 결속 의무 확장 ─────────────
alter table public.content_qualification drop constraint content_qualification_artifact_kind_check;
alter table public.content_qualification add constraint content_qualification_artifact_kind_check
  check (artifact_kind in ('dcp_item','csat_item','textbook_activity','workspace_bundle','authored_item'));
-- authored_item 은 축과 무관하게 주석(Gold) 결속이 항상 있어야 한다(본문과 채점이 한 행에 있다)
alter table public.content_qualification add constraint content_qualification_authored_bound check (
  artifact_kind <> 'authored_item' or (annotation_ref is not null and annotation_hash is not null)
);

-- ── 4. 판정기 래퍼(기존 본문 보존 — 이름을 바꿔 두고 앞에서 authored_item 만 처리) ─────────
alter function public.supply_artifact_revision(text, text) rename to supply_artifact_revision_i1;
revoke all on function public.supply_artifact_revision_i1(text, text) from public, anon, authenticated;
create function public.supply_artifact_revision(p_kind text, p_ref text)
returns text language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $$
begin
  if p_kind = 'authored_item' then return public.authored_item_revision(p_ref); end if;
  return public.supply_artifact_revision_i1(p_kind, p_ref);
end $$;
revoke all on function public.supply_artifact_revision(text, text) from public, anon, authenticated;

/** 창작 산출물의 지문 묶음 ref 전부(노출은 묶음 단위) */
create function public.authored_group_refs(p_ref text)
returns text[] language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select coalesce(array_agg(b.ref order by b.ref), array[p_ref])
  from public.authored_item a join public.authored_item b on b.passage_group = a.passage_group
  where a.ref = p_ref
$$;
revoke all on function public.authored_group_refs(text) from public, anon, authenticated;

alter function public.supply_learner_exposure(text, text, uuid) rename to supply_learner_exposure_i1;
revoke all on function public.supply_learner_exposure_i1(text, text, uuid) from public, anon, authenticated;
create function public.supply_learner_exposure(p_kind text, p_ref text, p_uid uuid)
returns text language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $$
declare v_refs text[];
begin
  if p_kind is distinct from 'authored_item' then return public.supply_learner_exposure_i1(p_kind, p_ref, p_uid); end if;
  if p_ref is null or p_uid is null then return 'unknown'; end if;
  if to_regclass('public.learning_task_attempts') is null or to_regclass('public.learning_sessions') is null then return 'unknown'; end if;
  if not exists (select 1 from authored_item where ref = p_ref) then return 'unknown'; end if;
  -- 이 산출물을 풀었다 / 화면을 열었다(해설 · 도움 포함)
  if exists (select 1 from learning_task_attempts t where t.user_id = p_uid and t.item_ref = p_ref) then return 'attempted'; end if;
  if exists (select 1 from learning_sessions s where s.user_id = p_uid and s.item_ref = p_ref
             and (s.explanation_viewed_at is not null or s.explanation_server_at is not null
                  or s.help_level = 'viewed_first' or s.help_received_at is not null or s.help_server_at is not null)) then
    return 'explanation_seen';
  end if;
  if exists (select 1 from learning_sessions s where s.user_id = p_uid and s.item_ref = p_ref) then return 'item_seen'; end if;
  -- 같은 지문 묶음의 다른 산출물을 풀었거나 열었다 · 이미 납품받았다(본문이 나간다)
  v_refs := public.authored_group_refs(p_ref);
  if exists (select 1 from learning_task_attempts t where t.user_id = p_uid and t.item_ref = any(v_refs) and t.item_ref <> p_ref)
     or exists (select 1 from learning_sessions s where s.user_id = p_uid and s.item_ref = any(v_refs) and s.item_ref <> p_ref)
     or exists (select 1 from workspace_content_delivery d where d.user_id = p_uid and d.artifact_kind = 'authored_item'
                and d.artifact_ref = any(v_refs) and d.artifact_ref <> p_ref) then
    return 'shared_passage_seen';
  end if;
  return 'none';
end $$;
revoke all on function public.supply_learner_exposure(text, text, uuid) from public, anon, authenticated;

alter function public.supply_annotation_matches(uuid) rename to supply_annotation_matches_i2;
revoke all on function public.supply_annotation_matches_i2(uuid) from public, anon, authenticated;
create function public.supply_annotation_matches(p_qualification uuid)
returns boolean language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select case
    when q.artifact_kind = 'authored_item' then exists (
      select 1 from public.authored_item a where a.ref = q.artifact_ref
        and a.annotation_ref = q.annotation_ref
        and public.authored_item_gold_hash(a.ref) = q.annotation_hash
        and (q.gold_hash is null or q.gold_hash = q.annotation_hash))
    else public.supply_annotation_matches_i2(q.id) end
  from public.content_qualification q where q.id = p_qualification
$$;
revoke all on function public.supply_annotation_matches(uuid) from public, anon, authenticated;

/** 사람 결정 조건 — 권리(모든 종류 · display+transmit) · 평가 역할 authored_item 은 사람 Gold(assess) */
create function public.supply_human_decisions_ok(p_qualification uuid)
returns boolean language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select exists (
    select 1 from public.content_qualification q where q.id = p_qualification
      and public.content_human_decision_ok('rights', q.artifact_kind, q.artifact_ref, q.artifact_revision, q.artifact_revision, array['display','transmit'])
      and (q.artifact_kind <> 'authored_item' or q.role not in ('independent_check','transfer','delayed_check')
           or (q.gold_hash is not null
               and public.content_human_decision_ok('gold', q.artifact_kind, q.artifact_ref, q.artifact_revision, q.gold_hash, array['assess']))))
$$;
revoke all on function public.supply_human_decisions_ok(uuid) from public, anon, authenticated;

-- 공급 기록: I2 래퍼를 보존하고 앞에 창작 주석 · 사람 결정 검사를 더한다
alter function public.workspace_delivery_record(uuid,uuid,uuid,uuid,uuid) rename to workspace_delivery_record_i2;
revoke all on function public.workspace_delivery_record_i2(uuid,uuid,uuid,uuid,uuid) from public, anon, authenticated;
create function public.workspace_delivery_record(p_line uuid, p_order uuid, p_qualification uuid, p_approval uuid, p_request_key uuid)
returns uuid language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare q record;
begin
  if auth.uid() is null then raise exception 'Forbidden' using errcode = '42501'; end if;
  perform 1 from public.workspace_content_demand_line where id = p_line and user_id = auth.uid() for update;
  -- 재전송은 역사 사실 반환(현재 조건 재판정 아님) — 아래 검사보다 먼저
  if exists (select 1 from public.workspace_content_delivery where user_id = auth.uid() and request_key = p_request_key) then
    return public.workspace_delivery_record_i2(p_line,p_order,p_qualification,p_approval,p_request_key);
  end if;
  select * into q from public.content_qualification where id = p_qualification for share;
  if not found then raise exception 'delivery: qualification identity mismatch'; end if;
  if q.artifact_kind = 'authored_item' then
    perform 1 from public.authored_item where ref = q.artifact_ref for share;
    if public.supply_annotation_matches(q.id) is not true then raise exception 'delivery: authored gold differs from qualification'; end if;
  end if;
  -- 사람 결정 행을 잠가 철회와 직렬화한 뒤 판정
  perform 1 from public.content_human_decision h where h.artifact_kind = q.artifact_kind and h.artifact_ref = q.artifact_ref
    and h.artifact_revision = q.artifact_revision order by h.id for share;
  if public.supply_human_decisions_ok(q.id) is not true then
    raise exception 'delivery: human rights/gold decision missing or revoked';
  end if;
  return public.workspace_delivery_record_i2(p_line,p_order,p_qualification,p_approval,p_request_key);
end $$;
revoke all on function public.workspace_delivery_record(uuid,uuid,uuid,uuid,uuid) from public, anon;
grant execute on function public.workspace_delivery_record(uuid,uuid,uuid,uuid,uuid) to authenticated;

-- 현재 유효성: I2 판정(+ I1) 위에 사람 결정 · 창작 주석
alter function public.supply_delivery_valid(uuid) rename to supply_delivery_valid_i2;
revoke all on function public.supply_delivery_valid_i2(uuid) from public, anon, authenticated;
create function public.supply_delivery_valid(p_delivery uuid)
returns boolean language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select public.supply_delivery_valid_i2(p_delivery) and exists (
    select 1 from public.workspace_content_delivery d where d.id = p_delivery
      and public.supply_human_decisions_ok(d.qualification_id) is true)
$$;
revoke all on function public.supply_delivery_valid(uuid) from public, anon, authenticated;

-- ── 5. 노출 키 · G2 결속에 창작 경로 ────────────────────────────────────
create or replace function public.r5_exposure_key(p_kind text, p_ref text)
returns text language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select coalesce(
    (select 'passage:' || md5(btrim(regexp_replace(lower(c.passage), '\s+', ' ', 'g')))
       from public.csat_items c where p_kind = 'csat_item' and c.id = p_ref and c.passage is not null),
    (select 'passage:authored:' || a.passage_group from public.authored_item a where p_kind = 'authored_item' and a.ref = p_ref),
    'item:' || p_kind || ':' || p_ref)
$$;
revoke all on function public.r5_exposure_key(text, text) from public, anon, authenticated;

-- G2 원본(20261018120100) 본문 그대로 + 「(A)」 표시 줄만 다르다: ⑤ 과제 대응의 authored_item 분기 · ⑥ 노출 대상 문항 집합.
create or replace function public.workspace_delivery_attempt_record(p_delivery uuid, p_attempt bigint, p_request_key uuid)
returns uuid language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare v_uid uuid := auth.uid(); d record; q record; t record; c record; ln record; dem record; prev record; ai record;
  v_help text; v_key text; v_first boolean; v_unverifiable boolean := false; v_items text[]; v_at timestamptz; v_reason text; v_id uuid;
begin
  if v_uid is null then raise exception 'Forbidden' using errcode = '42501'; end if;
  if p_delivery is null or p_attempt is null or p_request_key is null then raise exception 'attempt binding: arguments required'; end if;
  perform set_config('vocaflow.supply_writer', 'rpc', true);

  perform pg_advisory_xact_lock(hashtextextended('r5-attempt-req|' || v_uid::text || '|' || p_request_key::text, 0));
  select * into prev from workspace_delivery_attempt where user_id = v_uid and request_key = p_request_key;
  if found then
    if (prev.delivery_id, prev.attempt_id) is distinct from (p_delivery, p_attempt) then
      raise exception 'attempt binding: request_key reused with a different body' using errcode = '23505';
    end if;
    return prev.id;
  end if;

  select * into d from workspace_content_delivery where id = p_delivery and user_id = v_uid;
  if not found then raise exception 'attempt binding: delivery not found or not owned' using errcode = '42501'; end if;
  if not exists (select 1 from learner_workspace w where w.id = d.workspace_id and w.user_id = v_uid and w.status = 'active') then
    raise exception 'attempt binding: workspace not active';
  end if;
  select * into ln from workspace_content_demand_line where id = d.line_id;
  select * into dem from workspace_content_demand where id = ln.demand_id;

  select * into t from learning_task_attempts where id = p_attempt for share;
  if not found or t.user_id is distinct from v_uid then raise exception 'attempt binding: attempt not found or not owned' using errcode = '42501'; end if;
  if t.item_ref is distinct from d.artifact_ref or t.task_key is null then
    raise exception 'attempt binding: attempt item/task differs from delivery';
  end if;
  if t.received_at is null or t.received_at < d.delivered_at then raise exception 'attempt binding: attempt predates delivery'; end if;
  if exists (select 1 from workspace_delivery_attempt x where x.attempt_id = p_attempt) then
    raise exception 'attempt binding: attempt already bound' using errcode = '23505';
  end if;

  if t.activity is null or t.phase is null or t.session_id is null or t.content_hash is null then
    raise exception 'attempt binding: attempt unbound (activity/phase/session/content hash missing)';
  end if;
  if t.activity = 'practice' then v_help := 'practice';
  elsif t.help_level is distinct from 'independent' then v_help := 'helped';
  elsif t.activity = 'theater' and t.phase = 'practice' then v_help := 'independent';
  elsif t.activity = 'theater' and t.phase = 'transfer' then v_help := 'transfer';
  else raise exception 'attempt binding: attempt unbound (activity %, phase %)', t.activity, t.phase;
  end if;

  select * into q from content_qualification where id = d.qualification_id for share;
  if q.annotation_hash is null or q.annotation_ref is null then raise exception 'attempt binding: qualification has no annotation binding'; end if;
  if t.content_hash <> q.annotation_hash then raise exception 'attempt binding: attempt annotation differs from delivered annotation'; end if;
  if public.supply_artifact_revision(d.artifact_kind, d.artifact_ref) is distinct from d.artifact_revision then
    raise exception 'attempt binding: artifact revision changed since delivery';
  end if;
  if d.artifact_kind = 'csat_item' then
    select * into c from supply_current_annotation where artifact_ref = d.artifact_ref and task_id = d.task_id for share;
    if not found or (c.artifact_revision, c.annotation_ref, c.annotation_hash) is distinct from (d.artifact_revision, q.annotation_ref, q.annotation_hash) then
      raise exception 'attempt binding: current annotation differs from delivery';
    end if;
    if (t.response->>'annotation') is distinct from c.annotation_ref
       or left(c.annotation_ref, length(t.task_key) + 1) <> t.task_key || '-' then
      raise exception 'attempt binding: attempt task key does not map to delivery TASK';
    end if;
  elsif d.artifact_kind = 'authored_item' then                                                          -- (A)
    -- 산출물 행 자체가 신뢰 등록부다(행 불변 · DB 가 hash 계산): 과제 키 · TASK · 주석 ref · Gold hash 가 모두 같아야 한다  -- (A)
    select * into ai from authored_item where ref = d.artifact_ref for share;                           -- (A)
    if not found or ai.task_id is distinct from d.task_id or ai.task_key is distinct from t.task_key     -- (A)
       or ai.annotation_ref is distinct from q.annotation_ref                                            -- (A)
       or (t.response->>'annotation') is distinct from ai.annotation_ref                                 -- (A)
       or public.authored_item_gold_hash(ai.ref) is distinct from q.annotation_hash then                 -- (A)
      raise exception 'attempt binding: attempt task key does not map to delivery TASK';                -- (A)
    end if;                                                                                              -- (A)
  else
    raise exception 'attempt binding: task mapping unavailable for %', d.artifact_kind;
  end if;

  v_key := public.r5_exposure_key(d.artifact_kind, d.artifact_ref);
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || '|' || v_key, 0));
  if d.artifact_kind = 'authored_item' then                                                             -- (A)
    v_items := public.authored_group_refs(d.artifact_ref);                                               -- (A)
  else                                                                                                   -- (A)
    v_items := array(select j.id from csat_items j where j.id = d.artifact_ref
      or (v_key like 'passage:%' and j.passage is not null and 'passage:' || md5(btrim(regexp_replace(lower(j.passage), '\s+', ' ', 'g'))) = v_key));
  end if;                                                                                                -- (A)
  if not (d.artifact_ref = any(v_items)) then v_items := v_items || d.artifact_ref; end if;
  if to_regclass('public.csat_trap_attempts') is null or to_regclass('public.csat_session_attempts') is null
     or to_regclass('public.csat_review_queue') is null or to_regclass('public.csat_dx_response') is null
     or to_regclass('public.csat_dx_session') is null then
    v_first := false; v_unverifiable := true;
  else
    v_first := not exists (select 1 from workspace_delivery_attempt x where x.user_id = v_uid and x.exposure_key = v_key)
      and not exists (select 1 from learning_task_attempts o
        where o.user_id = v_uid and o.id <> t.id and o.item_ref = any(v_items) and (o.received_at is null or o.received_at <= t.received_at))
      and not exists (select 1 from learning_sessions s
        where s.user_id = v_uid and s.id <> t.session_id and s.item_ref = any(v_items)
          and coalesce(least(s.revealed_at, s.explanation_viewed_at, s.explanation_server_at, s.help_received_at, s.help_server_at), '-infinity') <= t.received_at)
      and not exists (select 1 from learning_sessions s
        where s.id = t.session_id and least(s.explanation_viewed_at, s.explanation_server_at, s.help_received_at, s.help_server_at) <= t.received_at)
      and not exists (select 1 from csat_trap_attempts x where x.user_id = v_uid and x.item_id = any(v_items) and x.answered_at <= t.received_at)
      and not exists (select 1 from csat_session_attempts x where x.user_id = v_uid and x.item_id = any(v_items) and x.answered_at <= t.received_at)
      and not exists (select 1 from csat_review_queue x where x.user_id = v_uid and x.item_id = any(v_items))
      and not exists (select 1 from csat_dx_response r join csat_dx_session ds on ds.id = r.session_id
        where ds.user_id = v_uid and r.item_id = any(v_items))
      and not exists (select 1 from csat_dx_session ds join csat_items ci on ci.exam_id = ds.exam_id
        where ds.user_id = v_uid and ci.id = any(v_items));
  end if;
  v_at := case when v_first then coalesce((select s.revealed_at from learning_sessions s where s.id = t.session_id), t.received_at) end;

  if exists (select 1 from content_qualification s where s.supersedes = q.id) then v_reason := 'qualification_superseded';
  elsif exists (select 1 from content_release_revocation r join content_release_approval a on a.id = r.approval_id
                where a.qualification_id = q.id) then v_reason := 'approval_revoked';
  elsif public.supply_delivery_valid(d.id) is not true then v_reason := 'delivery_invalid';
  elsif v_unverifiable then v_reason := 'exposure_unverifiable';
  elsif not v_first then v_reason := 'not_first_exposure';
  elsif d.role in ('independent_check', 'delayed_check') then
    if v_help <> 'independent' then v_reason := 'help_state_mismatch'; end if;
  elsif d.role = 'transfer' then
    if v_help <> 'transfer' then v_reason := 'help_state_mismatch'; end if;
  else v_reason := 'role_not_evidence';
  end if;

  insert into workspace_delivery_attempt (user_id, workspace_id, plan_version, demand_id, line_id, order_id, delivery_id,
    qualification_id, approval_id, artifact_kind, artifact_ref, task_id, role, artifact_revision, annotation_ref, annotation_hash,
    attempt_id, session_id, help_state, exposure_key, first_exposure, first_exposed_at, evidence, non_evidence_reason, request_key)
  values (v_uid, d.workspace_id, dem.plan_version, dem.id, d.line_id, d.order_id, d.id,
    q.id, d.approval_id, d.artifact_kind, d.artifact_ref, d.task_id, d.role, d.artifact_revision, q.annotation_ref, q.annotation_hash,
    t.id, t.session_id, v_help, v_key, v_first, v_at, v_reason is null, v_reason, p_request_key)
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.workspace_delivery_attempt_record(uuid, bigint, uuid) from public, anon;
grant execute on function public.workspace_delivery_attempt_record(uuid, bigint, uuid) to authenticated;

-- ── 6. 적용 뒤 검증(하나라도 어긋나면 전체 롤백) ───────────────────────────
do $$
declare v_bad text[];
begin
  select array_agg(t) into v_bad from unnest(array['authored_item','content_human_decision','content_human_decision_revocation']) t
  where not (select relrowsecurity from pg_class where oid = to_regclass('public.'||t))
     or has_table_privilege('anon', 'public.'||t, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     or has_table_privilege('authenticated', 'public.'||t, 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER');
  if v_bad is not null then raise exception 'authored supply verify: table RLS/privileges %', v_bad; end if;
  select array_agg(p.proname::text) into v_bad from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname in ('authored_item_gold_hash','authored_item_revision','authored_group_refs',
    'content_human_decision_ok','supply_human_decisions_ok','supply_artifact_revision','supply_artifact_revision_i1','supply_learner_exposure',
    'supply_learner_exposure_i1','supply_annotation_matches','supply_annotation_matches_i2','supply_delivery_valid','supply_delivery_valid_i2',
    'workspace_delivery_record_i2','r5_exposure_key')
    and (has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('authenticated', p.oid, 'EXECUTE'));
  if v_bad is not null then raise exception 'authored supply verify: internal function exposed %', v_bad; end if;
  select array_agg(p.proname::text) into v_bad from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname in ('authored_item_register','content_human_decision_record','content_human_decision_revoke',
    'workspace_delivery_record','workspace_delivery_attempt_record')
    and has_function_privilege('anon', p.oid, 'EXECUTE');
  if v_bad is not null then raise exception 'authored supply verify: anon can execute %', v_bad; end if;
end $$;
