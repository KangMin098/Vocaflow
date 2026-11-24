-- REVIEW ONLY; conversational approval required. Execute as one atomic apply_migration transaction.
SET LOCAL lock_timeout = '15s';
SET LOCAL statement_timeout = '120s';
DO $preflight$
DECLARE r record; v_sha text; v_count integer;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('csat_source_is_eligible', '25b66dcd32ad783fabd4a0a48690f5c589cefeef8c1cb562b783485bcc8c72e4'),
    ('factory_lineage_personal_current', '5c8f195da8f91446cd7d7b139f4509bace5120ecba48b5a6b9a66d66c85fb8f1'),
    ('learner_workspace_plan_commit', 'ab825ba7c816c80169306a7d0b5071d0dd320a2c58eaf05148efdcb3934c803b'),
    ('supply_artifact_revision', '3bf007e893ee7a3b5b85e3bece0547e7caa0d2be376de61667bce1170f0c8501'),
    ('workspace_delivery_attempt_record', '48f45877db328d9fd4a6c9f0b02d924d0b0ef76962bb0232b7ab7f4b24b8aa70'),
    ('workspace_delivery_record', '57f7794aa426ce17c63f2a46482232979deae8cbb27d7c5ec62b0c04ace7d1aa')
  ) expected(name, sha) LOOP
    SELECT count(*), min(encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')) INTO v_count, v_sha
      FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname=r.name;
    IF v_count <> 1 OR v_sha IS DISTINCT FROM r.sha THEN RAISE EXCEPTION 'approval baseline changed: %', r.name; END IF;
  END LOOP;
  IF to_regclass('public.authored_item') IS NOT NULL THEN RAISE EXCEPTION 'already installed or conflicting table: authored_item'; END IF;
  IF to_regclass('public.content_human_decision') IS NOT NULL THEN RAISE EXCEPTION 'already installed or conflicting table: content_human_decision'; END IF;
  IF to_regclass('public.content_human_decision_revocation') IS NOT NULL THEN RAISE EXCEPTION 'already installed or conflicting table: content_human_decision_revocation'; END IF;
  IF to_regclass('public.content_ai_decision') IS NOT NULL THEN RAISE EXCEPTION 'already installed or conflicting table: content_ai_decision'; END IF;
  IF to_regclass('public.content_ai_decision_revocation') IS NOT NULL THEN RAISE EXCEPTION 'already installed or conflicting table: content_ai_decision_revocation'; END IF;
  IF to_regclass('public.factory_dcp_admission') IS NOT NULL THEN RAISE EXCEPTION 'already installed or conflicting table: factory_dcp_admission'; END IF;
  IF to_regclass('public.factory_dcp_qualification') IS NOT NULL THEN RAISE EXCEPTION 'already installed or conflicting table: factory_dcp_qualification'; END IF;
  IF to_regclass('public.factory_dcp_attempt') IS NOT NULL THEN RAISE EXCEPTION 'already installed or conflicting table: factory_dcp_attempt'; END IF;
  IF to_regclass('public.source_lesson_reflection') IS NOT NULL THEN RAISE EXCEPTION 'already installed or conflicting table: source_lesson_reflection'; END IF;
END $preflight$;
CREATE TEMP TABLE learning_outcomes_before_counts(table_name text PRIMARY KEY, rows bigint) ON COMMIT DROP;
INSERT INTO learning_outcomes_before_counts SELECT 'factory_order', count(*) FROM public.factory_order;
INSERT INTO learning_outcomes_before_counts SELECT 'content_qualification', count(*) FROM public.content_qualification;
INSERT INTO learning_outcomes_before_counts SELECT 'factory_product_order', count(*) FROM public.factory_product_order;
INSERT INTO learning_outcomes_before_counts SELECT 'content_release_approval', count(*) FROM public.content_release_approval;
INSERT INTO learning_outcomes_before_counts SELECT 'workspace_content_demand', count(*) FROM public.workspace_content_demand;
INSERT INTO learning_outcomes_before_counts SELECT 'factory_order_product_link', count(*) FROM public.factory_order_product_link;
INSERT INTO learning_outcomes_before_counts SELECT 'workspace_content_delivery', count(*) FROM public.workspace_content_delivery;
INSERT INTO learning_outcomes_before_counts SELECT 'workspace_delivery_attempt', count(*) FROM public.workspace_delivery_attempt;

-- BEGIN EXACT STAGE authored_supply dfb29f2dc3c3c0ecf516bdf47efa1d50f2f203ef7d399a60f3072d57c93ac229
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
-- 독립 검증 반영(2026-10-18 · #294~#299): 등록 TASK·역할 결속(FI-002) · 지문 정체성 = 정규화 본문 해시(FI-003) ·
--   평가 역할 권리 assess 범위(FI-004) · 학습자 × 지문 정체성 동시 공급 직렬화(FI-006) · 학습자 본인 납품 현재 유효성 조회(FI-007).
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
  -- 지문 정체성(FI-003) — 그룹 이름이 아니라 정규화한 본문 문장의 해시. 등록 함수가 계산한다(호출자 값 불신)
  passage_key text not null check (passage_key ~ '^[0-9a-f]{32}$'),
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
create index authored_item_passage_key on public.authored_item (passage_key);
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
declare prev record; v_key text;
begin
  if auth.uid() is null or public.is_admin_or_curator() is not true then raise exception 'Forbidden' using errcode = '42501'; end if;
  perform set_config('vocaflow.supply_writer', 'rpc', true);
  -- FI-003 — 지문 정체성: 문장을 이어 소문자 · 공백 정규화한 본문의 md5. 그룹 이름만 바꿔 같은 본문을 새 지문으로 둘 수 없다
  v_key := md5(btrim(regexp_replace(lower(array_to_string(array(select jsonb_array_elements_text(p_body->'sentences')), ' ')), '\s+', ' ', 'g')));
  -- 같은 지문 묶음 · 같은 본문 등록을 직렬화(역할군 혼합 검사의 경합 방지)
  perform pg_advisory_xact_lock(hashtextextended('authored-group|' || coalesce(p_group, ''), 0));
  perform pg_advisory_xact_lock(hashtextextended('authored-passage|' || v_key, 0));
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
  if exists (select 1 from authored_item a where a.passage_key = v_key and a.role_class <> p_role_class) then
    raise exception 'authored: same passage body already registered with a different role class (instruction/assessment)';
  end if;
  insert into authored_item (ref, task_id, task_key, role_class, intended_role, passage_group, passage_key, body, gold, annotation_ref, provenance, created_by)
  values (p_ref, p_task, p_task_key, p_role_class, p_intended_role, p_group, v_key, p_body, p_gold, p_annotation_ref, p_provenance, auth.uid());
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
  from public.authored_item a join public.authored_item b on (b.passage_group = a.passage_group or b.passage_key = a.passage_key)
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
        -- FI-002 — 자격 · 공급의 TASK · 역할은 불변 등록의 TASK · 의도 역할과 같아야 한다(교수 자료의 평가 재자격화 · 다른 TASK 혼입 금지)
        and a.task_id = q.task_id and a.intended_role = q.role
        and a.annotation_ref = q.annotation_ref
        and public.authored_item_gold_hash(a.ref) = q.annotation_hash
        and (q.gold_hash is null or q.gold_hash = q.annotation_hash))
    else public.supply_annotation_matches_i2(q.id) end
  from public.content_qualification q where q.id = p_qualification
$$;
revoke all on function public.supply_annotation_matches(uuid) from public, anon, authenticated;

/** 사람 결정 조건 — 권리(모든 종류 · display+transmit, 평가 역할은 + assess) · 평가 역할 authored_item 은 사람 Gold(assess) */
create function public.supply_human_decisions_ok(p_qualification uuid)
returns boolean language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select exists (
    select 1 from public.content_qualification q where q.id = p_qualification
      -- FI-004 — 평가 역할은 저작물의 평가 이용 권한(assess)까지. Gold 의 평가 타당성 승인과 별개다
      and public.content_human_decision_ok('rights', q.artifact_kind, q.artifact_ref, q.artifact_revision, q.artifact_revision,
            case when q.role in ('independent_check','transfer','delayed_check') then array['display','transmit','assess'] else array['display','transmit'] end)
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
  -- FI-006 — 같은 학습자 · 같은 지문 정체성의 공급을 직렬화한다. 앞선 공급이 커밋된 뒤에 노출(G)을 다시 판정해야
  --   서로 다른 Workspace · 수요 줄로 동시에 들어온 두 공급이 모두 「미노출」로 통과하지 않는다(수요 줄 잠금만으로는 부족)
  --   창작은 노출 동치가 「같은 지문 묶음(passage_group) 또는 같은 본문 key」라 key 하나로 잠그면 그룹 동치와 어긋난다(#298 잔여) →
  --   학습자 단위로 직렬화한다(창작 공급끼리만 · 기출 공급은 기존 지문 key 잠금 그대로). 다른 학습자 · 기출 공급은 기다리지 않는다
  if q.artifact_kind = 'authored_item' then
    perform pg_advisory_xact_lock(hashtextextended('supply-exposure|authored|' || auth.uid()::text, 0));
  else
    perform pg_advisory_xact_lock(hashtextextended('supply-exposure|' || auth.uid()::text || '|' || public.r5_exposure_key(q.artifact_kind, q.artifact_ref), 0));
  end if;
  if q.artifact_kind = 'authored_item' then
    perform 1 from public.authored_item where ref = q.artifact_ref for share;
    -- FI-006(#298) 잔여 — 노출 함수는 G2 결속 때 자기 납품을 빼려고 같은 ref 납품을 제외한다. 그래서 공급 시점에는 여기서 따로 막는다:
    --   평가 역할 자료를 이 학습자가 이미 받았으면(다른 수요 줄 · 다른 Workspace · 지금 유효하지 않아도 — 본문이 이미 나갔다) 새 요청은 거절.
    --   같은 요청의 재전송은 위에서 영수증으로 반환된다. 교수 · 안내 연습 자료의 재공급은 노출 판정 대상이 아니라 허용한다
    if q.role in ('independent_check','transfer','delayed_check') and exists (
         select 1 from public.workspace_content_delivery d where d.user_id = auth.uid() and d.artifact_kind = 'authored_item'
           and d.artifact_ref = any(public.authored_group_refs(q.artifact_ref))) then
      raise exception 'delivery: learner already received this passage group';
    end if;
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
-- FI-007 · FI-011 — 서버(service_role)가 지도 · 공급 계산에서 납품의 **지금** 유효성을 읽는다(읽기 전용 판정 · 학습자 실행권은 계속 없음)
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.supply_delivery_valid(uuid) to service_role';
  end if;
end $$;

/**
 * FI-007 — 학습자 본인 납품의 **지금** 유효성(권리 · Gold 철회 · 자격 대체 · 승인 철회 · revision 변경 반영).
 * 과거 납품 · 수행 원장은 그대로 두고, 앱은 이 값으로 본문 제공 · 현재 수요 충족량 · 목록 상태를 정한다. 남의 납품은 null.
 */
create function public.workspace_delivery_current(p_delivery uuid)
returns boolean language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select case when exists (select 1 from public.workspace_content_delivery d where d.id = p_delivery and d.user_id = auth.uid())
              then public.supply_delivery_valid(p_delivery) is true end
$$;
revoke all on function public.workspace_delivery_current(uuid) from public, anon;
grant execute on function public.workspace_delivery_current(uuid) to authenticated;

-- ── 5. 노출 키 · G2 결속에 창작 경로 ────────────────────────────────────
create or replace function public.r5_exposure_key(p_kind text, p_ref text)
returns text language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select coalesce(
    (select 'passage:' || md5(btrim(regexp_replace(lower(c.passage), '\s+', ' ', 'g')))
       from public.csat_items c where p_kind = 'csat_item' and c.id = p_ref and c.passage is not null),
    (select 'passage:authored:' || a.passage_key from public.authored_item a where p_kind = 'authored_item' and a.ref = p_ref),
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
    'workspace_delivery_record','workspace_delivery_attempt_record','workspace_delivery_current')
    and has_function_privilege('anon', p.oid, 'EXECUTE');
  if v_bad is not null then raise exception 'authored supply verify: anon can execute %', v_bad; end if;
end $$;

-- END EXACT STAGE authored_supply

-- BEGIN EXACT STAGE authored_ai_review 050a6fa2508744c1ba69b82d1652c83ed24a5fab39a8e9c20641a410ceb883bb
-- supabase/migrations/_pending_authored_ai_review.sql
-- ⚠️ 보류(적용 안 함) — 단계 2A. 공유 DB 적용은 별도 사용자 승인(L4). 격리 PGlite 시험에서만 적용한다.
--
-- 왜: 사람 검토 역할을 Claude Code · Codex 두 AI 검토로 대체한다(사용자 지침 2026-10-21). 사람 결정 원장
--   (content_human_decision · 'human-reviewed' 진술)은 그대로 보존하고, 이 파일은 **별도 AI 결정 원장**을 더한다.
--   AI 결정은 사람 결정이 아니며 외부 권리의 부여도 아니다 — 자체 창작 선언(provenance.derivedFrom = [])에 대한 검토와
--   본문 · Gold 내용 검토를 두 모델 세션 · 입력 · 응답 해시에 결속해 기록할 뿐이다.
--
-- 무엇:
--   1. js_canonical_json(jsonb) — 검토 영수증의 JS canonical(키 정렬 JSON.stringify) 해시를 DB 행에서 다시 계산한다.
--      DB 의 revision 은 jsonb::text 해시라 JS 해시와 다르다 — 둘을 같다고 가정하지 않고, 등록 행(id · role · passageGroup ·
--      body · gold)을 JS 모양으로 재구성해 영수증의 item/body/gold 해시와 대조한 뒤 DB revision 에 결속한다.
--   2. content_ai_decision(+ 철회) — 추가 전용 · writer trigger · RLS · service_role 쓰기 권한 회수.
--      기록 · 철회는 관리자 · 큐레이터 **로그인 세션**만. 같은 영수증 재요청 = 같은 id, 다른 영수증 = 23505.
--   3. supply_human_decisions_ok 호환 래퍼 — 기존(사람) 판정을 이름을 바꿔 보존하고 앞에 두 경로를 더한다:
--      · authored_item: 철회되지 않은 AI 결정(revision · 현재 Gold hash · 평가 역할은 자격 gold_hash 일치) + 자체 창작 선언.
--      · dcp_item(1C 등록 후보 · 안내 연습만): 등록 영수증 + 현재 원천 정책(csat_source_is_eligible) — 기출 · 창작으로 위장하지 않는다.
--   4. workspace_delivery_record 래퍼 — AI 결정 행을 FOR SHARE 로 잠가 철회와 직렬화한 뒤 기존 함수로 넘긴다.
--   5. authored_supply_decision_state(자격) — 서버 재고 선택용 읽기('human' | 'ai' | 'source_policy' | 'none').
--
-- 적용 순서(결합): C → B → I1-S → I1-P → I2 → G2 → D3(20261020063000) → _pending_authored_supply →
--   **이 파일** → _pending_factory_dcp_admission → _pending_factory_dcp_learning. 한 트랜잭션.
-- 하지 않는 것: 사람 결정 행 생성 · content_human_decision_record 호출 · qualification axes 값 생성 · 학습자에게 원장 노출.
-- 되돌리기(이력 0행일 때만 · 별도 승인): drop function workspace_delivery_record(uuid,uuid,uuid,uuid,uuid);
--   alter function workspace_delivery_record_pre_ai_review(...) rename to workspace_delivery_record; (authenticated 실행 권한 복원)
--   drop function supply_human_decisions_ok(uuid); alter function supply_human_decisions_ok_human(uuid) rename to supply_human_decisions_ok;
--   drop function authored_supply_decision_state(uuid), content_ai_decision_ok(text,text,text), content_ai_decision_record(text,jsonb),
--   content_ai_decision_revoke(uuid,text), js_canonical_json(jsonb); drop table content_ai_decision_revocation, content_ai_decision.

do $$
declare v_missing text[];
begin
  select array_agg(x) into v_missing from unnest(array[
    'public.supply_human_decisions_ok(uuid)', 'public.authored_item_revision(text)', 'public.authored_item_gold_hash(text)',
    'public.workspace_delivery_record(uuid,uuid,uuid,uuid,uuid)', 'public.forbid_ledger_mutation()', 'public.supply_writer_guard()',
    'public.is_admin_or_curator()']::text[]) x
  where to_regprocedure(x) is null;
  if v_missing is not null then raise exception 'authored AI review requires authored supply first — missing: %', v_missing; end if;
  if to_regclass('public.content_ai_decision') is not null then raise exception 'authored AI review: already installed'; end if;
  -- 1C 뒤에 설치하면 1C 래퍼 안쪽에 들어가 잠금 순서가 바뀐다 — 정해진 순서만 허용
  if to_regclass('public.factory_dcp_admission') is not null then raise exception 'authored AI review must be installed before dcp admission'; end if;
end $$;

-- ── 1. JS canonical JSON ────────────────────────────────────────────────
/** JSON.stringify(키 정렬) 와 같은 문자열. 키는 C 정렬(ASCII 키 = JS 기본 정렬). 숫자는 jsonb 표기 그대로(정수 · 단순 소수) */
create function public.js_canonical_json(p jsonb)
returns text language plpgsql immutable set search_path to 'public', 'pg_temp' as $$
declare v text;
begin
  case jsonb_typeof(p)
    when 'object' then
      select '{' || coalesce(string_agg(to_json(k)::text || ':' || public.js_canonical_json(v2), ',' order by k collate "C"), '') || '}'
        into v from jsonb_each(p) as e(k, v2);
    when 'array' then
      select '[' || coalesce(string_agg(public.js_canonical_json(e), ',' order by o), '') || ']'
        into v from jsonb_array_elements(p) with ordinality as a(e, o);
    when 'string' then v := to_json(p #>> '{}')::text;
    else v := p::text;
  end case;
  return v;
end $$;
revoke all on function public.js_canonical_json(jsonb) from public, anon, authenticated;

-- ── 2. AI 결정 원장 ─────────────────────────────────────────────────────
create table public.content_ai_decision (
  id uuid primary key default gen_random_uuid(),
  artifact_kind text not null check (artifact_kind = 'authored_item'),
  artifact_ref text not null check (length(artifact_ref) between 1 and 200),
  artifact_revision text not null check (artifact_revision ~ '^[0-9a-f]{64}$'),     -- DB revision(jsonb 텍스트 해시)
  gold_hash text not null check (gold_hash ~ '^[0-9a-f]{64}$'),                     -- DB Gold hash
  js_item_sha256 text not null check (js_item_sha256 ~ '^[0-9a-f]{64}$'),           -- 영수증의 JS canonical 해시(DB 가 재계산해 일치 확인)
  js_body_sha256 text not null check (js_body_sha256 ~ '^[0-9a-f]{64}$'),
  js_gold_sha256 text not null check (js_gold_sha256 ~ '^[0-9a-f]{64}$'),
  set_name text not null,
  source_file_sha256 text not null check (source_file_sha256 ~ '^[0-9a-f]{64}$'),
  receipt_sha256 text not null check (receipt_sha256 ~ '^[0-9a-f]{64}$'),
  reviews jsonb not null check (jsonb_typeof(reviews) = 'array' and jsonb_array_length(reviews) = 2),
  -- 권리: 자체 창작 선언에 대한 AI 검토일 뿐 — 외부 권리 부여 아님(rights_grant = false 고정)
  rights_basis text not null check (rights_basis = 'first_party_original_declaration'),
  rights_grant boolean not null default false check (rights_grant = false),
  human_review boolean not null default false check (human_review = false),
  scope text[] not null check (scope <@ array['store','display','transmit','assess']::text[] and cardinality(scope) > 0),
  decided_by uuid not null references auth.users(id),
  decider_role text not null check (decider_role in ('admin', 'curator')),
  created_at timestamptz not null default now(),
  unique (artifact_kind, artifact_ref, artifact_revision)
);
create table public.content_ai_decision_revocation (
  decision_id uuid primary key references public.content_ai_decision(id),
  revoked_by uuid not null references auth.users(id),
  reason text not null check (length(reason) between 1 and 500),
  created_at timestamptz not null default now()
);
create trigger content_ai_decision_append_only before update or delete on public.content_ai_decision
  for each row execute function public.forbid_ledger_mutation();
create trigger content_ai_decision_writer before insert on public.content_ai_decision
  for each row execute function public.supply_writer_guard();
create trigger content_ai_decision_revocation_append_only before update or delete on public.content_ai_decision_revocation
  for each row execute function public.forbid_ledger_mutation();
create trigger content_ai_decision_revocation_writer before insert on public.content_ai_decision_revocation
  for each row execute function public.supply_writer_guard();
alter table public.content_ai_decision enable row level security;
alter table public.content_ai_decision_revocation enable row level security;
create policy cad_admin_read on public.content_ai_decision for select using (public.is_admin_or_curator());
create policy cadr_admin_read on public.content_ai_decision_revocation for select using (public.is_admin_or_curator());
revoke all on table public.content_ai_decision, public.content_ai_decision_revocation from public, anon, authenticated;
grant select on table public.content_ai_decision, public.content_ai_decision_revocation to authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    -- Supabase 기본 권한(default privileges)이 service_role 에 ALL 을 준다 — 쓰기는 RPC 로만
    execute 'revoke all on table public.content_ai_decision, public.content_ai_decision_revocation from service_role';
    execute 'grant select on table public.content_ai_decision, public.content_ai_decision_revocation to service_role';
    execute 'revoke all on function public.js_canonical_json(jsonb) from service_role';
  end if;
end $$;

/**
 * AI 결정 기록 — 관리자 · 큐레이터 로그인 세션만. 영수증(vocaflow.ai-authored-review-receipt/1)을 받아 DB 가 직접 대조한다:
 *   이 ref 가 수락 범위 안 · 역할 = 등록 역할 · JS item/body/Gold 해시 = 등록 행 재구성 해시 · 두 리뷰 = claude + codex ·
 *   서로 다른 세션 · 같은 입력 해시 · 같은 원본 파일 해시 · 문항 accept · 정답 = 등록 Gold · gold_issues 없음 ·
 *   사람 검토 · 권리 부여 주장 없음 · 등록 provenance 가 자체 창작(derivedFrom = []) · 같은 세트.
 */
create function public.content_ai_decision_record(p_ref text, p_receipt jsonb)
returns uuid language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare a record; e jsonb; r jsonb; ri jsonb; prev record; v_id text; v_rev text; v_gh text; v_sha text; v_n int := 0;
  v_agents text[] := '{}'; v_sessions text[] := '{}'; v_prompts text[] := '{}';
begin
  if auth.uid() is null or public.is_admin_or_curator() is not true then raise exception 'Forbidden' using errcode = '42501'; end if;
  if p_ref is null or p_receipt is null or jsonb_typeof(p_receipt) <> 'object' then raise exception 'ai decision: arguments required'; end if;
  perform set_config('vocaflow.supply_writer', 'rpc', true);
  select * into a from authored_item where ref = p_ref for share;
  if not found then raise exception 'ai decision: authored item not registered'; end if;
  v_id := substr(p_ref, length('authored:') + 1);
  if p_receipt->>'schema' is distinct from 'vocaflow.ai-authored-review-receipt/1'
     or p_receipt->>'judgment' is distinct from 'accepted_candidate_content_and_gold'
     or p_receipt->>'rights_basis' is distinct from 'first_party_original_declaration_only'
     or p_receipt->'rights_grant' is distinct from 'false'::jsonb or p_receipt->'human_review_claimed' is distinct from 'false'::jsonb
     or coalesce(p_receipt->>'source_file_sha256', '') !~ '^[0-9a-f]{64}$' then
    raise exception 'ai decision: receipt is not an accepted two-model AI content/gold receipt';
  end if;
  if a.provenance->>'set' is distinct from p_receipt->>'set' or a.provenance->'derivedFrom' is distinct from '[]'::jsonb then
    raise exception 'ai decision: registered provenance is not the reviewed first-party set';
  end if;
  if jsonb_typeof(p_receipt->'scope') <> 'array' or not (p_receipt->'scope' ? v_id) or (p_receipt->'not_reviewed') ? v_id then
    raise exception 'ai decision: item outside the accepted review scope';
  end if;
  select x into e from jsonb_array_elements(p_receipt->'items') x where x->>'id' = v_id;
  if e is null or e->>'role' is distinct from a.intended_role then raise exception 'ai decision: receipt item/role differs from registration'; end if;
  -- JS canonical 해시 결속(DB 행을 영수증과 같은 모양으로 재구성)
  if e->>'body_canonical_sha256' is distinct from encode(sha256(convert_to(js_canonical_json(a.body), 'UTF8')), 'hex')
     or e->>'gold_canonical_sha256' is distinct from encode(sha256(convert_to(js_canonical_json(a.gold), 'UTF8')), 'hex')
     or e->>'item_canonical_sha256' is distinct from encode(sha256(convert_to(js_canonical_json(jsonb_build_object(
          'id', v_id, 'role', a.intended_role, 'passageGroup', a.passage_group, 'body', a.body, 'gold', a.gold)), 'UTF8')), 'hex') then
    raise exception 'ai decision: reviewed body/gold differs from registered row';
  end if;
  if jsonb_typeof(p_receipt->'reviews') <> 'array' or jsonb_array_length(p_receipt->'reviews') <> 2 then
    raise exception 'ai decision: exactly two model reviews required';
  end if;
  for r in select x from jsonb_array_elements(p_receipt->'reviews') x loop
    if coalesce(r->>'session_id', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or coalesce(r->>'prompt_sha256', '') !~ '^[0-9a-f]{64}$' or coalesce(r->>'response_sha256', '') !~ '^[0-9a-f]{64}$'
       or r->>'source_file_sha256' is distinct from p_receipt->>'source_file_sha256' or r->>'verdict' is distinct from 'accept' then
      raise exception 'ai decision: review identity/hash/verdict invalid';
    end if;
    select x into ri from jsonb_array_elements(r->'items') x where x->>'id' = v_id;
    if ri is null or ri->>'verdict' is distinct from 'accept' or ri->'choice_0based' is distinct from a.gold->'answer'
       or coalesce(jsonb_array_length(ri->'gold_issues'), -1) <> 0 then
      raise exception 'ai decision: review does not accept this item and gold';
    end if;
    v_agents := v_agents || (r->>'agent'); v_sessions := v_sessions || (r->>'session_id'); v_prompts := v_prompts || (r->>'prompt_sha256');
    v_n := v_n + 1;
  end loop;
  if not (v_agents @> array['claude','codex'] and v_agents <@ array['claude','codex']) or v_sessions[1] = v_sessions[2] or v_prompts[1] <> v_prompts[2] then
    raise exception 'ai decision: claude and codex must review the same input in distinct sessions';
  end if;
  v_rev := public.authored_item_revision(p_ref);
  v_gh := public.authored_item_gold_hash(p_ref);
  v_sha := encode(sha256(convert_to(js_canonical_json(p_receipt), 'UTF8')), 'hex');
  perform pg_advisory_xact_lock(hashtextextended('ai-decision|' || p_ref || '|' || v_rev, 0));
  select * into prev from content_ai_decision where artifact_kind = 'authored_item' and artifact_ref = p_ref and artifact_revision = v_rev;
  if found then
    if prev.receipt_sha256 <> v_sha then raise exception 'ai decision: revision already decided with a different receipt' using errcode = '23505'; end if;
    return prev.id;
  end if;
  insert into content_ai_decision (artifact_kind, artifact_ref, artifact_revision, gold_hash, js_item_sha256, js_body_sha256, js_gold_sha256,
    set_name, source_file_sha256, receipt_sha256, reviews, rights_basis, scope, decided_by, decider_role)
  values ('authored_item', p_ref, v_rev, v_gh, e->>'item_canonical_sha256', e->>'body_canonical_sha256', e->>'gold_canonical_sha256',
    p_receipt->>'set', p_receipt->>'source_file_sha256', v_sha,
    (select jsonb_agg(jsonb_build_object('agent', x->>'agent', 'session_id', x->>'session_id', 'request_id', x->>'request_id',
       'prompt_sha256', x->>'prompt_sha256', 'response_sha256', x->>'response_sha256') order by x->>'agent') from jsonb_array_elements(p_receipt->'reviews') x),
    'first_party_original_declaration', array['store','display','transmit','assess'], auth.uid(),
    case when public.is_admin() then 'admin' else 'curator' end)
  returning id into prev;
  return (select id from content_ai_decision where artifact_ref = p_ref and artifact_revision = v_rev);
end $$;

create function public.content_ai_decision_revoke(p_decision uuid, p_reason text)
returns void language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
begin
  if auth.uid() is null or public.is_admin_or_curator() is not true then raise exception 'Forbidden' using errcode = '42501'; end if;
  perform set_config('vocaflow.supply_writer', 'rpc', true);
  perform 1 from content_ai_decision where id = p_decision for update;   -- 진행 중 공급(FOR SHARE)과 직렬화
  if not found then raise exception 'revoke: decision not found'; end if;
  insert into content_ai_decision_revocation (decision_id, revoked_by, reason) values (p_decision, auth.uid(), p_reason)
  on conflict (decision_id) do nothing;
end $$;

/** 지금 유효한 AI 결정(철회 없음 · revision · 현재 Gold hash 일치) */
create function public.content_ai_decision_ok(p_ref text, p_revision text, p_gold_hash text)
returns boolean language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select exists (
    select 1 from public.content_ai_decision d
    where d.artifact_kind = 'authored_item' and d.artifact_ref = p_ref and d.artifact_revision = p_revision and d.gold_hash = p_gold_hash
      and d.artifact_revision = public.authored_item_revision(p_ref) and d.gold_hash = public.authored_item_gold_hash(p_ref)
      and not exists (select 1 from public.content_ai_decision_revocation r where r.decision_id = d.id))
$$;

/**
 * AI 결정에 결속된 자격 기록(관리자 세션). revision · Gold hash · TASK · 주석 ref 는 등록 행에서 DB 가 정한다(호출자 값 불신).
 * 축: A · B · C · F 의 pass 는 지금 유효한 AI 결정이 있을 때만 · E pass 는 평가 역할만 · D pass 는 안내 연습만 · 그 밖은 호출자 값(근거 없으면 unknown).
 * 같은 판본의 대체되지 않은 자격이 있으면 그 id(재실행 안전).
 */
create function public.authored_ai_qualify(p_ref text, p_role text, p_axes jsonb, p_annotation_ref text, p_evidence_ids text[])
returns uuid language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare a record; v_rev text; v_gh text; v_id uuid;
begin
  if auth.uid() is null or public.is_admin_or_curator() is not true then raise exception 'Forbidden' using errcode = '42501'; end if;
  select * into a from authored_item where ref = p_ref;
  if not found or a.intended_role is distinct from p_role or a.annotation_ref is distinct from p_annotation_ref then
    raise exception 'ai qualify: registration/role/annotation mismatch';
  end if;
  v_rev := public.authored_item_revision(p_ref); v_gh := public.authored_item_gold_hash(p_ref);
  if not public.content_ai_decision_ok(p_ref, v_rev, v_gh) then raise exception 'ai qualify: no current AI decision'; end if;
  if (p_axes->'E'->>'state') = 'pass' and p_role not in ('independent_check','transfer','delayed_check') then raise exception 'ai qualify: E pass outside assessment'; end if;
  if (p_axes->'D'->>'state') = 'pass' and p_role <> 'guided_practice' then raise exception 'ai qualify: D pass outside guided practice'; end if;
  select q.id into v_id from content_qualification q
   where q.artifact_kind = 'authored_item' and q.artifact_ref = p_ref and q.artifact_revision = v_rev and q.role = p_role
     and q.annotation_hash = v_gh and not exists (select 1 from content_qualification s where s.supersedes = q.id)
   order by q.created_at limit 1;
  if found then return v_id; end if;
  return public.content_qualification_record('FQ1.1', 'authored_item', p_ref, v_rev, a.task_id, p_role, p_axes,
    'first_party', v_rev, null, 'ai-two-model', v_gh, a.annotation_ref, v_gh, '{}'::text[], p_evidence_ids,
    'AI 두 모델 검토(Claude Code + Codex) — 사람 검수 아님 · 권리 부여 아님', null);
end $$;
revoke all on function public.authored_ai_qualify(text, text, jsonb, text, text[]) from public, anon;
grant execute on function public.authored_ai_qualify(text, text, jsonb, text, text[]) to authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'revoke all on function public.authored_ai_qualify(text, text, jsonb, text, text[]) from service_role';
  end if;
end $$;

-- ── 3. 공급 판정 호환 래퍼(사람 판정 보존) ────────────────────────────────
alter function public.supply_human_decisions_ok(uuid) rename to supply_human_decisions_ok_human;
revoke all on function public.supply_human_decisions_ok_human(uuid) from public, anon, authenticated;

/** 1C 등록 DCP 후보의 원천 정책 경로(안내 연습 · display/transmit 만). 1C 미설치면 false — plpgsql 이라 표가 나중에 생겨도 된다 */
create function public.supply_dcp_source_policy_ok(p_qualification uuid)
returns boolean language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $$
declare q record; a record;
begin
  if to_regclass('public.factory_dcp_admission') is null or to_regprocedure('public.csat_source_is_eligible(uuid)') is null then return false; end if;
  select * into q from content_qualification where id = p_qualification;
  -- 권리 축 F 는 1C 가 등록된 권리 기록이 있을 때만 pass 로 남긴다(AI 는 권리를 줄 수 없다)
  if not found or q.artifact_kind <> 'dcp_item' or q.role <> 'guided_practice' or (q.axes->'F'->>'state') is distinct from 'pass' then return false; end if;
  execute 'select source_id, artifact_revision, source_content_sha256 from public.factory_dcp_admission where dcp_item_id::text = $1' into a using q.artifact_ref;
  if a is null or a.artifact_revision is distinct from q.artifact_revision then return false; end if;
  -- 원문이 바뀌면 1C revision 래퍼가 null 을 돌려준다 · 현재 원천 정책(적격)을 다시 묻는다
  if public.supply_artifact_revision('dcp_item', q.artifact_ref) is distinct from q.artifact_revision then return false; end if;
  return coalesce(public.csat_source_is_eligible(a.source_id), false);
end $$;

create function public.supply_human_decisions_ok(p_qualification uuid)
returns boolean language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select coalesce(public.supply_human_decisions_ok_human(p_qualification), false)
    or exists (
      select 1 from public.content_qualification q
      where q.id = p_qualification and q.artifact_kind = 'authored_item'
        and public.content_ai_decision_ok(q.artifact_ref, q.artifact_revision, public.authored_item_gold_hash(q.artifact_ref))
        and exists (select 1 from public.authored_item a where a.ref = q.artifact_ref and a.provenance->'derivedFrom' = '[]'::jsonb)
        and (q.role not in ('independent_check','transfer','delayed_check') or q.gold_hash = public.authored_item_gold_hash(q.artifact_ref)))
    or public.supply_dcp_source_policy_ok(p_qualification)
$$;

/** 서버 재고 선택 — 어느 경로로 지금 공급 가능한가(최종 판정은 공급 함수). service_role 또는 관리자만 */
create function public.authored_supply_decision_state(p_qualification uuid)
returns text language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $$
begin
  if auth.uid() is not null and public.is_admin_or_curator() is not true then raise exception 'Forbidden' using errcode = '42501'; end if;
  if coalesce(public.supply_human_decisions_ok_human(p_qualification), false) then return 'human'; end if;
  if public.supply_dcp_source_policy_ok(p_qualification) then return 'source_policy'; end if;
  if public.supply_human_decisions_ok(p_qualification) then return 'ai'; end if;
  return 'none';
end $$;

-- ── 4. 공급 기록 래퍼 — AI 결정 행을 잠가 철회와 직렬화 ───────────────────────
alter function public.workspace_delivery_record(uuid,uuid,uuid,uuid,uuid) rename to workspace_delivery_record_pre_ai_review;
revoke all on function public.workspace_delivery_record_pre_ai_review(uuid,uuid,uuid,uuid,uuid) from public, anon, authenticated;
create function public.workspace_delivery_record(p_line uuid, p_order uuid, p_qualification uuid, p_approval uuid, p_request_key uuid)
returns uuid language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
begin
  if auth.uid() is null then raise exception 'Forbidden' using errcode = '42501'; end if;
  perform 1 from public.content_ai_decision d join public.content_qualification q
    on q.artifact_kind = d.artifact_kind and q.artifact_ref = d.artifact_ref and q.artifact_revision = d.artifact_revision
   where q.id = p_qualification order by d.id for share of d;
  return public.workspace_delivery_record_pre_ai_review(p_line, p_order, p_qualification, p_approval, p_request_key);
end $$;

-- ── 권한 — 기본 권한(anon · authenticated · service_role EXECUTE)을 명시적으로 회수 ──────────
revoke all on function public.content_ai_decision_record(text, jsonb) from public, anon;
revoke all on function public.content_ai_decision_revoke(uuid, text) from public, anon;
grant execute on function public.content_ai_decision_record(text, jsonb) to authenticated;
grant execute on function public.content_ai_decision_revoke(uuid, text) to authenticated;
revoke all on function public.content_ai_decision_ok(text, text, text) from public, anon, authenticated;
revoke all on function public.supply_dcp_source_policy_ok(uuid) from public, anon, authenticated;
revoke all on function public.supply_human_decisions_ok(uuid) from public, anon, authenticated;
revoke all on function public.authored_supply_decision_state(uuid) from public, anon;
grant execute on function public.authored_supply_decision_state(uuid) to authenticated;
revoke all on function public.workspace_delivery_record(uuid,uuid,uuid,uuid,uuid) from public, anon;
grant execute on function public.workspace_delivery_record(uuid,uuid,uuid,uuid,uuid) to authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'revoke all on function public.content_ai_decision_record(text, jsonb) from service_role';
    execute 'revoke all on function public.content_ai_decision_revoke(uuid, text) from service_role';
    execute 'revoke all on function public.content_ai_decision_ok(text, text, text) from service_role';
    execute 'revoke all on function public.supply_dcp_source_policy_ok(uuid) from service_role';
    execute 'revoke all on function public.supply_human_decisions_ok_human(uuid) from service_role';
    execute 'grant execute on function public.authored_supply_decision_state(uuid) to service_role';
  end if;
end $$;

-- ── 적용 뒤 검증(하나라도 어긋나면 전체 롤백) ───────────────────────────
do $$
declare v_bad text[];
begin
  select array_agg(t) into v_bad from unnest(array['content_ai_decision','content_ai_decision_revocation']) t
  where not (select relrowsecurity from pg_class where oid = to_regclass('public.'||t))
     or has_table_privilege('anon', 'public.'||t, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     or has_table_privilege('authenticated', 'public.'||t, 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     or (exists (select 1 from pg_roles where rolname = 'service_role')
         and has_table_privilege('service_role', 'public.'||t, 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'));
  if v_bad is not null then raise exception 'authored AI review verify: table RLS/privileges %', v_bad; end if;
  select array_agg(p.proname::text) into v_bad from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname in ('js_canonical_json','content_ai_decision_ok','supply_dcp_source_policy_ok',
    'supply_human_decisions_ok','supply_human_decisions_ok_human','workspace_delivery_record_pre_ai_review')
    and (has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('authenticated', p.oid, 'EXECUTE'));
  if v_bad is not null then raise exception 'authored AI review verify: internal function exposed %', v_bad; end if;
  select array_agg(p.proname::text) into v_bad from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname in ('content_ai_decision_record','content_ai_decision_revoke')
    and (has_function_privilege('anon', p.oid, 'EXECUTE')
         or (exists (select 1 from pg_roles where rolname = 'service_role') and has_function_privilege('service_role', p.oid, 'EXECUTE')));
  if v_bad is not null then raise exception 'authored AI review verify: writer callable outside admin session %', v_bad; end if;
end $$;

-- END EXACT STAGE authored_ai_review

-- BEGIN EXACT STAGE factory_dcp_admission e081cfac2ef5e6127a739cfc3af63f5b276ca6b4f25cecb9015f36d44e549ac1
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

-- END EXACT STAGE factory_dcp_admission

-- BEGIN EXACT STAGE factory_dcp_learning a0177e78b80258549192297013845a162293d04991fb076f0ac9170d2a23e49f
-- supabase/migrations/_pending_factory_dcp_learning.sql
-- ⚠️ 보류(적용 안 함) — 단계 1D. 공유 DB 적용은 별도 사용자 승인(L4). 격리 PGlite 시험에서만 적용한다.
--
-- 무엇: 1C 로 납품된 공장 DCP 지도 연습(guided_practice · r.central_meaning · topic/title/main_point)을 학습자 본인이
--   목록 · 열기 · 제출한다. 세 함수 모두 학습자 세션(auth.uid())만 — 관리자 · service_role 이 학습자를 흉내내지 않는다.
--   · 열기는 답변 전 payload 의 passage · stem_ko · choices 만 돌려준다(answer_key · 해설 · 검수 기록 없음).
--   · 제출은 기존 **실제** grade_dcp_item(uuid,jsonb) 을 호출해 정오와 csat_item_attempts id 를 얻고, 같은 트랜잭션에서
--     납품 결속 영수증을 남긴다. 영수증 insert 가 실패하면 채점 시도 행도 함께 되돌아간다(원자적).
--   · 같은 (학습자, mutation 키) + 같은 납품 · 같은 응답 = 저장된 같은 결과(응답 유실 복구). 다른 응답 · 다른 납품 = 거절.
--   · 정오가 boolean 이 아니면(빈 값 · 미상) 거절한다 — false 로 바꾸지 않는다.
--   · 연습은 근거가 아니다: evidence = false · non_evidence_reason = 'role_not_evidence' 를 CHECK 로 고정.
--
-- 왜 새 원장인가(기존 G2 를 재사용하지 않은 이유):
--   workspace_delivery_attempt 는 annotation_ref/annotation_hash 가 NOT NULL 이고 G2 기록기는 DCP 산출물을 지원하지 않는다.
--   그 칸을 가짜 Gold 로 채우지 않기 위해, 실제 채점 판본(grade_dcp_item@20260920120000) · 정답키 판본(artifact_revision)에
--   결속한 연습 전용 영수증을 둔다. E 축 · 독립 자격으로 승격하지 않는다. G2 결합(DCP×guided 분기)은 단계 2 범위.
--
-- 전제: _pending_factory_dcp_admission.sql(1C) 뒤 · grade_dcp_item(uuid,jsonb) 존재.
-- 되돌리기: drop function factory_dcp_attempt(uuid,jsonb,uuid); drop function factory_dcp_open(uuid);
--           drop function factory_dcp_deliveries(text); drop function factory_dcp_delivery_state(uuid);
--           drop function factory_dcp_learning_current(uuid); drop table factory_dcp_attempt;

do $$
declare v_missing text[];
begin
  select array_agg(x) into v_missing from unnest(array[
    'public.grade_dcp_item(uuid,jsonb)', 'public.supply_delivery_valid(uuid)', 'public.factory_lineage_personal_current(uuid)',
    'public.factory_product_order_is_current(text,integer)', 'public.forbid_ledger_mutation()', 'public.supply_writer_guard()']) x where to_regprocedure(x) is null;
  if v_missing is not null or to_regclass('public.factory_dcp_admission') is null then
    raise exception 'dcp learning requires 1C dcp admission + grade_dcp_item first (missing %)', v_missing;
  end if;
  if to_regclass('public.factory_dcp_attempt') is not null then raise exception 'dcp learning already installed'; end if;
end $$;

-- ── 연습 수행 영수증(추가 전용) ───────────────────────────────────────────
create table public.factory_dcp_attempt (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  mutation_id uuid not null,
  delivery_id uuid not null references public.workspace_content_delivery(id),
  workspace_id uuid not null,
  dcp_item_id uuid not null references public.factory_dcp_admission(dcp_item_id),
  artifact_revision text not null,
  answer jsonb not null,
  answer_hash text not null check (answer_hash ~ '^[0-9a-f]{64}$'),
  -- 실제 채점 시도 행에 FK 로 묶는다 — 가짜 id 는 저장되지 않는다(소유자 · 문항 · 정오 일치는 제출 함수가 확인)
  csat_attempt_id uuid not null references public.csat_item_attempts(id),
  is_correct boolean not null,
  result jsonb not null,
  grader text not null check (grader = 'grade_dcp_item@20260920120000'),
  role text not null check (role = 'guided_practice'),
  task_id text not null check (task_id = 'r.central_meaning'),
  evidence boolean not null default false check (evidence = false),
  non_evidence_reason text not null default 'role_not_evidence' check (non_evidence_reason = 'role_not_evidence'),
  received_at timestamptz not null default now(),
  unique (user_id, mutation_id)
);
create index factory_dcp_attempt_delivery on public.factory_dcp_attempt (delivery_id, received_at desc);
create trigger factory_dcp_attempt_append_only before update or delete on public.factory_dcp_attempt
  for each row execute function public.forbid_ledger_mutation();
-- 직접 쓰기 차단 — 1C 와 같은 기존 가드. 제출 함수만 vocaflow.supply_writer='rpc' 를 켜고 쓴다
create trigger factory_dcp_attempt_writer before insert on public.factory_dcp_attempt
  for each row execute function public.supply_writer_guard();
alter table public.factory_dcp_attempt enable row level security;
create policy fdat_own_read on public.factory_dcp_attempt for select using (user_id = auth.uid());
revoke all on public.factory_dcp_attempt from public, anon, authenticated;
grant select on public.factory_dcp_attempt to authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'revoke all on table public.factory_dcp_attempt from service_role';
    execute 'grant select on table public.factory_dcp_attempt to service_role';
  end if;
end $$;

-- ── 학습용 개인 계보 현재성 ─────────────────────────────────────────────
-- factory_lineage_personal_current 는 「아직 생산 중인 주문」만 true 다 — 새 납품 · 링크를 막는 생산 안전 계약이라 그대로 둔다.
-- 이미 받은 자료를 여는 판정은 그 계약을 빌리지 않고, 같은 Workspace(active) · 최신 goal/plan · 수요 계획 결속은 그대로 요구하되
-- 주문 상태는 정상 납품(delivered · partial)과 진행 중을 허용하고 failed 만 막는다. 철회는 supply_delivery_valid, 구 판본은 revision 비교가 막는다.
create function public.factory_dcp_learning_current(p_order uuid)
returns boolean language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select exists(select 1 from public.factory_order o join public.workspace_content_demand_line l on l.id=o.line_id
    join public.workspace_content_demand d on d.id=l.demand_id join public.learner_workspace w on w.id=o.workspace_id and w.user_id=o.user_id
    join lateral(select p.plan_version,p.goal_version_id from public.learner_workspace_plan p where p.workspace_id=w.id and p.user_id=w.user_id order by p.plan_version desc limit 1) p on true
    where o.id=p_order and w.status='active' and o.state <> 'failed'
      and d.plan_version=p.plan_version and d.goal_version_id is not distinct from p.goal_version_id
      and d.goal_version_id is not distinct from (select max(g.id) from public.csat_map_goal_version g where g.user_id=o.user_id))
$$;
revoke all on function public.factory_dcp_learning_current(uuid) from public, anon, authenticated;

-- ── 납품 판정 — 본인 · 등록 후보 · 역할/TASK · Workspace 열림 · 현재 유효 · 개인 계보 · 제품주문 링크/현재성 ─────────
-- 반환: 'ok' 또는 닫힌 거절 코드. 소유가 아니면 'not_found'(남의 납품 존재를 알리지 않는다).
create function public.factory_dcp_delivery_state(p_delivery uuid)
returns text language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $$
declare d record; a record; v_ws text;
begin
  select * into d from workspace_content_delivery w where w.id = p_delivery and w.user_id = auth.uid();
  if not found then return 'not_found'; end if;
  if d.artifact_kind <> 'dcp_item' then return 'not_factory_dcp'; end if;
  select * into a from factory_dcp_admission x where x.dcp_item_id::text = d.artifact_ref;
  if not found then return 'not_factory_dcp'; end if;
  if d.role <> 'guided_practice' or d.task_id <> 'r.central_meaning' or a.role <> d.role or a.task_id <> d.task_id then return 'wrong_role_task'; end if;
  select w.status into v_ws from learner_workspace w where w.id = d.workspace_id and w.user_id = d.user_id;
  if v_ws is distinct from 'active' then return 'workspace_closed'; end if;
  if d.artifact_revision is distinct from a.artifact_revision then return 'stale_revision'; end if;
  if public.supply_delivery_valid(d.id) is not true then return 'not_current'; end if;
  if d.order_id is null or public.factory_dcp_learning_current(d.order_id) is not true then return 'lineage_not_current'; end if;
  if not exists (select 1 from factory_order_product_link k where k.order_id = d.order_id and k.product_order_id = a.product_order_id
                 and k.order_revision = a.order_revision and k.order_hash = a.order_hash) then return 'product_link_mismatch'; end if;
  if public.factory_product_order_is_current(a.product_order_id, a.order_revision) is not true then return 'product_not_current'; end if;
  return 'ok';
end $$;
revoke all on function public.factory_dcp_delivery_state(uuid) from public, anon, authenticated;

-- ── 목록 — 이 Workspace(템플릿)의 공장 DCP 납품. 지문(source) 수와 문항 수를 따로 센다 ─────────────
create function public.factory_dcp_deliveries(p_template text)
returns jsonb language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $$
declare v_uid uuid := auth.uid(); v_ws uuid; v_rows jsonb;
begin
  if v_uid is null then raise exception 'Forbidden' using errcode = '42501'; end if;
  select w.id into v_ws from learner_workspace w where w.user_id = v_uid and w.template_id = p_template and w.status <> 'closed';
  if v_ws is null then return jsonb_build_object('workspace_id', null, 'rows', '[]'::jsonb); end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'delivery_id', d.id, 'dcp_item_id', x.dcp_item_id, 'source_id', x.source_id, 'type', i.type,
      'delivered_at', d.delivered_at, 'state', public.factory_dcp_delivery_state(d.id),
      'attempts', (select count(*) from factory_dcp_attempt t where t.delivery_id = d.id),
      'last_correct', (select t.is_correct from factory_dcp_attempt t where t.delivery_id = d.id order by t.received_at desc limit 1))
      order by d.delivered_at, i.type), '[]'::jsonb)
    into v_rows
    from workspace_content_delivery d
    join factory_dcp_admission x on x.dcp_item_id::text = d.artifact_ref
    join csat_dcp_items i on i.id = x.dcp_item_id
   where d.user_id = v_uid and d.workspace_id = v_ws and d.artifact_kind = 'dcp_item';
  return jsonb_build_object('workspace_id', v_ws, 'rows', v_rows);
end $$;
revoke all on function public.factory_dcp_deliveries(text) from public, anon;
grant execute on function public.factory_dcp_deliveries(text) to authenticated;

-- ── 열기 — 답변 전 문항(passage · stem_ko · choices 만) ────────────────────────────
create function public.factory_dcp_open(p_delivery uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $$
declare v_state text; d record; i record;
begin
  if auth.uid() is null then raise exception 'Forbidden' using errcode = '42501'; end if;
  v_state := public.factory_dcp_delivery_state(p_delivery);
  if v_state <> 'ok' then return jsonb_build_object('state', v_state); end if;
  select * into d from workspace_content_delivery w where w.id = p_delivery;
  select it.id, it.type, it.paragraph_idx, it.ref_id, it.payload into i from csat_dcp_items it where it.id = d.artifact_ref::uuid;
  return jsonb_build_object('state', 'ok', 'delivery_id', d.id, 'workspace_id', d.workspace_id, 'source_id', i.ref_id,
    'item', jsonb_build_object('id', i.id, 'type', i.type, 'paragraph_idx', i.paragraph_idx,
      'payload', jsonb_build_object('passage', i.payload->'passage', 'stem_ko', i.payload->'stem_ko', 'choices', i.payload->'choices')),
    'attempts', (select count(*) from factory_dcp_attempt t where t.delivery_id = d.id));
end $$;
revoke all on function public.factory_dcp_open(uuid) from public, anon;
grant execute on function public.factory_dcp_open(uuid) to authenticated;

-- ── 제출 — 실제 grade_dcp_item + 납품 결속 영수증(원자적 · 멱등) ─────────────────────────
create function public.factory_dcp_attempt(p_delivery uuid, p_answer jsonb, p_mutation uuid)
returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare
  v_uid uuid := auth.uid(); v_hash text; prev record; d record; a record; v_state text; g jsonb; v_id uuid; v_ws uuid; v_template text;
begin
  if v_uid is null then raise exception 'Forbidden' using errcode = '42501'; end if;
  if p_delivery is null or p_mutation is null or p_answer is null or jsonb_typeof(p_answer) <> 'object'
     or (select array_agg(k) from jsonb_object_keys(p_answer) k) is distinct from array['choice']
     or jsonb_typeof(p_answer->'choice') <> 'number' or (p_answer->>'choice') !~ '^[1-5]$' then
    raise exception 'attempt: answer must be {choice:1..5}' using errcode = '22023';
  end if;
  v_hash := encode(sha256(convert_to(p_answer::text, 'UTF8')), 'hex');
  perform pg_advisory_xact_lock(hashtextextended('factory_dcp_attempt:' || v_uid::text || ':' || p_mutation::text, 0));

  -- ① 같은 키 재전송 — 같은 납품 · 같은 응답일 때만 저장된 결과(납품이 그 뒤 철회돼도 같은 결과)
  select * into prev from factory_dcp_attempt t where t.user_id = v_uid and t.mutation_id = p_mutation;
  if found then
    if prev.delivery_id <> p_delivery or prev.answer_hash <> v_hash then
      raise exception 'attempt: mutation key reused with a different body' using errcode = '23505';
    end if;
    return prev.result || jsonb_build_object('replayed', true);
  end if;

  -- ② 잠금(현재성 조회 전) — 1C workspace_delivery_record 와 같은 순서 · 같은 키:
  --   map_goal 자문 → map_plan 자문 → learner_workspace 행 → factory_order 행 → 납품 행 → 승인 행 → 등록 후보 행.
  --   목표 · 계획 writer, Workspace 닫기, 주문 전이, 승인 철회, 등록 철회가 이 판정과 직렬화된다. 사용자 · 템플릿은 인자가 아니라
  --   auth.uid() 소유 납품 → 그 Workspace 에서 유도한다(남의 납품이면 존재를 알리지 않고 not_found).
  select w.workspace_id into v_ws from workspace_content_delivery w where w.id = p_delivery and w.user_id = v_uid;
  if not found then raise exception 'attempt: delivery not_found' using errcode = 'P0001'; end if;
  select w.template_id into v_template from learner_workspace w where w.id = v_ws and w.user_id = v_uid;
  if not found then raise exception 'attempt: delivery workspace_closed' using errcode = 'P0001'; end if;
  perform pg_advisory_xact_lock(hashtext('map_goal:' || v_uid::text));
  perform pg_advisory_xact_lock(hashtext('map_plan:' || v_uid::text || ':' || v_template));
  perform 1 from learner_workspace w where w.id = v_ws and w.user_id = v_uid for share;
  select * into d from workspace_content_delivery w where w.id = p_delivery and w.user_id = v_uid;
  if d.order_id is not null then perform 1 from factory_order o where o.id = d.order_id for share; end if;
  perform 1 from workspace_content_delivery w where w.id = p_delivery for share;
  perform 1 from content_release_approval r where r.id = d.approval_id for share;
  perform 1 from factory_dcp_admission x where x.dcp_item_id::text = d.artifact_ref for share;

  -- ③ 납품 판정(소유 · 등록 후보 · 역할 · Workspace · 현재성 · 학습용 계보 · 제품 링크) — 잠근 뒤에 본다
  v_state := public.factory_dcp_delivery_state(p_delivery);
  if v_state <> 'ok' then raise exception 'attempt: delivery %', v_state using errcode = 'P0001'; end if;
  select * into a from factory_dcp_admission x where x.dcp_item_id::text = d.artifact_ref;

  -- ④ 실제 채점기 — 정오가 boolean 이 아니거나, 시도 id 가 UUID 가 아니거나, 그 시도 행이 이 학습자 · 이 DCP 문항 · 반환 정오와
  --    맞지 않으면 예외로 트랜잭션 전체(채점 시도 행 포함)를 되돌린다. 미상을 false 로 바꾸지 않는다
  g := public.grade_dcp_item(a.dcp_item_id, p_answer);
  if g is null or jsonb_typeof(g->'correct') <> 'boolean'
     or coalesce(g->>'attempt_id', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'attempt: grader returned no verdict';
  end if;
  if not exists (select 1 from csat_item_attempts c where c.id = (g->>'attempt_id')::uuid and c.user_id = v_uid
                 and c.dcp_item_id = a.dcp_item_id and c.is_correct is not distinct from (g->>'correct')::boolean) then
    raise exception 'attempt: grader attempt does not match learner/item/verdict';
  end if;

  -- 추가 전용이라 update 할 수 없다 — id 를 먼저 정하고 재전송이 돌려줄 완성본 결과를 처음부터 넣는다
  v_id := gen_random_uuid();
  g := jsonb_build_object('receipt_id', v_id, 'delivery_id', d.id, 'correct', (g->>'correct')::boolean,
    'csat_attempt_id', g->>'attempt_id', 'answer_key', g->'answer_key', 'evidence', false, 'non_evidence_reason', 'role_not_evidence');
  perform set_config('vocaflow.supply_writer', 'rpc', true);
  insert into factory_dcp_attempt (id, user_id, mutation_id, delivery_id, workspace_id, dcp_item_id, artifact_revision, answer, answer_hash,
    csat_attempt_id, is_correct, result, grader, role, task_id)
  values (v_id, v_uid, p_mutation, d.id, d.workspace_id, a.dcp_item_id, a.artifact_revision, p_answer, v_hash,
    (g->>'csat_attempt_id')::uuid, (g->>'correct')::boolean, g, 'grade_dcp_item@20260920120000', 'guided_practice', 'r.central_meaning');
  return g || jsonb_build_object('replayed', false);
end $$;
revoke all on function public.factory_dcp_attempt(uuid, jsonb, uuid) from public, anon;
grant execute on function public.factory_dcp_attempt(uuid, jsonb, uuid) to authenticated;

-- ── 계측 허용 목록(funnel_events CHECK) — 1D 이벤트 3종 ──────────────────────────────
-- csat_factory_dcp_opened · csat_factory_dcp_submitted · csat_factory_dcp_returned · 2F csat_factory_dcp_requested(lib/analytics/events.ts · 속성은 숫자/불리언/닫힌 열거형).
-- 목록을 손으로 옮기지 않는다 — 적용 시점의 실제 제약에서 기존 이름을 읽어 세 이름만 더한다(다른 세션이 그 사이 늘린 값을 잃지 않는다).
-- 제약이 없거나 모양이 다르면(이름 0개) 실패한다. 되돌리기: 같은 방식으로 세 이름을 뺀 배열로 다시 만든다. 데이터는 지우지 않는다.
do $$
declare v_names text[]; v_new constant text[] := array['csat_factory_dcp_opened', 'csat_factory_dcp_submitted', 'csat_factory_dcp_returned', 'csat_factory_dcp_requested'];
begin
  select array_agg(m[1]) into v_names
    from pg_constraint c, regexp_matches(pg_get_constraintdef(c.oid), '''([a-z0-9_]+)''', 'g') m
   where c.conrelid = 'public.funnel_events'::regclass and c.conname = 'funnel_events_event_check';
  if v_names is null or cardinality(v_names) = 0 then raise exception 'funnel_events_event_check not found or unreadable'; end if;
  v_names := array(select distinct x from unnest(v_names || v_new) x order by x);
  alter table public.funnel_events drop constraint funnel_events_event_check;
  execute format('alter table public.funnel_events add constraint funnel_events_event_check check (event = any (%L::text[]))', v_names);
end $$;

-- END EXACT STAGE factory_dcp_learning

-- BEGIN EXACT STAGE source_lesson_reflection 2dac4416f17e2a8ecd679c15ec49d87b4d4c70ab6ec09627e7d6caaaf27dbdf1
-- supabase/migrations/_pending_source_lesson_reflection.sql
-- ⚠️ 보류(적용 안 함) — 단계 2B. 공유 DB 적용은 별도 사용자 승인(L4). 격리 PGlite 시험에서만 적용한다.
--
-- 무엇: 1D 로 납품된 한 원문(003946dd…)의 요지 → 제목 → 주제 3단계 안내 연습에서, 학습자가 **실제로 저장된 풀이 영수증**
--   (factory_dcp_attempt) 뒤에 쓴 자기 설명(주장 문장 · 근거 문장 · 관계 · 시범과의 비교 · 자기 절차)을 추가 전용으로 남긴다.
--   · 교수 자료 = source-lesson v3 정확한 바이트(SHA 0b653454…c7f0). 원천 파생 자료라 authored 로 등록하지 않는다.
--     원문 id 와 원문 content SHA(33dc4880…2b0f)는 등록 후보(factory_dcp_admission)의 값과 같아야 한다 — 다른 지문에 일괄 적용 안 함.
--   · 학습자 세션(auth.uid())만. 관리자 · service_role 이 학습자를 흉내내지 않는다. 직접 insert/update/delete 는 막는다.
--   · 같은 (학습자, mutation 키) + 같은 영수증 · 같은 본문 = 저장된 같은 결과(응답 유실 복구). 다른 본문 = 거절(23505).
--   · 한 단계(납품)당 설명 하나. 순서: 요지 설명 저장 → 제목 → 주제. 앞 단계 저장 없이는 다음 단계를 저장하지 않는다.
--   · 같은 원문 3문항은 지문 하나다 — 세 단계는 같은 Workspace · 같은 개인 주문(order_id)의 납품만 묶는다.
--   · 근거가 아니다: evidence = false · non_evidence_reason = 'guided_reflection' CHECK 고정. Gold 해시 · G2 결속을 만들지 않는다.
--   · 자유 설명의 정오는 판정하지 않는다(어휘 일치로 채점하지 않는다). 근거 집합 충분성은 화면의 형성 피드백일 뿐 저장 판정이 아니다.
--
-- 전제: _pending_factory_dcp_learning.sql(1D) 뒤.
-- 되돌리기(행 0 일 때만 · 별도 승인): drop function source_lesson_reflect(uuid,text,jsonb,uuid,uuid); drop function source_lesson_progress(uuid,text);
--   drop function source_lesson_check(uuid); drop table source_lesson_reflection; 이벤트 허용 목록에서 csat_source_lesson_reflected 를 뺀다.

do $$
begin
  if to_regclass('public.factory_dcp_attempt') is null or to_regprocedure('public.factory_dcp_delivery_state(uuid)') is null then
    raise exception 'source lesson reflection requires 1D factory dcp learning first';
  end if;
  if to_regclass('public.source_lesson_reflection') is not null then raise exception 'source lesson reflection already installed'; end if;
end $$;

create table public.source_lesson_reflection (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  mutation_id uuid not null,
  lesson_id text not null check (lesson_id = 'title-route-central-meaning.v3'),
  lesson_sha256 text not null check (lesson_sha256 = '0b653454bfea053f0523cee1647de1eb97ad5038661bd2fac49162336db0c7f0'),
  source_id uuid not null,
  source_content_sha256 text not null,
  attempt_id uuid not null references public.factory_dcp_attempt(id),
  delivery_id uuid not null references public.workspace_content_delivery(id),
  workspace_id uuid not null,
  order_id uuid not null,
  artifact_revision text not null,
  step text not null check (step in ('main_point', 'title', 'topic')),
  body jsonb not null,
  body_hash text not null check (body_hash ~ '^[0-9a-f]{64}$'),
  result jsonb not null,
  evidence boolean not null default false check (evidence = false),
  non_evidence_reason text not null default 'guided_reflection' check (non_evidence_reason = 'guided_reflection'),
  received_at timestamptz not null default now(),
  unique (user_id, mutation_id),
  unique (user_id, delivery_id, lesson_sha256)
);
create index source_lesson_reflection_scope on public.source_lesson_reflection (user_id, workspace_id, order_id, step);
create trigger source_lesson_reflection_append_only before update or delete on public.source_lesson_reflection
  for each row execute function public.forbid_ledger_mutation();
create trigger source_lesson_reflection_writer before insert on public.source_lesson_reflection
  for each row execute function public.supply_writer_guard();
alter table public.source_lesson_reflection enable row level security;
create policy slr_own_read on public.source_lesson_reflection for select using (user_id = auth.uid());
revoke all on public.source_lesson_reflection from public, anon, authenticated;
grant select on public.source_lesson_reflection to authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'revoke all on table public.source_lesson_reflection from service_role';
    execute 'grant select on table public.source_lesson_reflection to service_role';
  end if;
end $$;

-- ── 이 납품이 교수 자료의 원문인가 — 'ok' · 'lesson_mismatch' 또는 1D 의 닫힌 납품 코드 ─────────────
create function public.source_lesson_check(p_delivery uuid)
returns text language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $$
declare v_state text;
begin
  v_state := public.factory_dcp_delivery_state(p_delivery);
  if v_state <> 'ok' then return v_state; end if;
  if not exists (select 1 from workspace_content_delivery d join factory_dcp_admission x on x.dcp_item_id::text = d.artifact_ref
                 where d.id = p_delivery and x.source_id = '003946dd-f5e6-4efe-9254-b7a69ca39e61'
                   and x.source_content_sha256 = '33dc4880f42b6b5815b93da059beb2dae640b138371e0cb1992ad46ba6452b0f') then
    return 'lesson_mismatch';
  end if;
  return 'ok';
end $$;
revoke all on function public.source_lesson_check(uuid) from public, anon, authenticated;

-- ── 진행 — 같은 Workspace · 같은 개인 주문의 세 단계(요지 · 제목 · 주제)와 풀이/설명 저장 여부 ───────────
create function public.source_lesson_progress(p_delivery uuid, p_lesson_sha text)
returns jsonb language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $$
declare v_uid uuid := auth.uid(); v_state text; d record; v_steps jsonb;
begin
  if v_uid is null then raise exception 'Forbidden' using errcode = '42501'; end if;
  if p_lesson_sha is distinct from '0b653454bfea053f0523cee1647de1eb97ad5038661bd2fac49162336db0c7f0' then
    return jsonb_build_object('state', 'lesson_mismatch');
  end if;
  v_state := public.source_lesson_check(p_delivery);
  if v_state <> 'ok' then return jsonb_build_object('state', v_state); end if;
  select * into d from workspace_content_delivery w where w.id = p_delivery and w.user_id = v_uid;
  select coalesce(jsonb_agg(s order by s->>'ord'), '[]'::jsonb) into v_steps from (
    select jsonb_build_object('ord', array_position(array['main_point','title','topic'], i.type), 'type', i.type, 'delivery_id', i.id,
      'state', public.source_lesson_check(i.id),
      'attempted', exists(select 1 from factory_dcp_attempt t where t.delivery_id = i.id and t.user_id = v_uid),
      'reflected', exists(select 1 from source_lesson_reflection r where r.delivery_id = i.id and r.user_id = v_uid and r.lesson_sha256 = p_lesson_sha)) s
    from (select distinct on (i2.type) w2.id, i2.type from workspace_content_delivery w2
            join factory_dcp_admission x on x.dcp_item_id::text = w2.artifact_ref join csat_dcp_items i2 on i2.id = x.dcp_item_id
           where w2.user_id = v_uid and w2.workspace_id = d.workspace_id and w2.order_id = d.order_id and w2.artifact_kind = 'dcp_item'
             and x.source_id = '003946dd-f5e6-4efe-9254-b7a69ca39e61' and i2.type in ('main_point','title','topic')
           order by i2.type, w2.delivered_at desc) i
  ) q(s);
  return jsonb_build_object('state', 'ok', 'delivery_id', d.id, 'workspace_id', d.workspace_id, 'steps', v_steps);
end $$;
revoke all on function public.source_lesson_progress(uuid, text) from public, anon;
grant execute on function public.source_lesson_progress(uuid, text) to authenticated;

-- ── 설명 저장 — 실제 풀이 영수증 뒤 · 순서 · 원자적 · 멱등 ─────────────────────────
-- 본문(닫힌 키): { step, claim: 0..8|null, support: [0..8 서로 다른 1~4개], relation: 2~600자,
--   comparison: 요지만 필수(2~600자) · 다른 단계 null, procedure: 주제만 필수(2~600자) · 다른 단계 null }
create function public.source_lesson_reflect(p_attempt uuid, p_lesson_sha text, p_body jsonb, p_mutation uuid, p_delivery uuid default null)
returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare
  v_uid uuid := auth.uid(); v_hash text; prev record; t record; d record; x record; v_step text; v_template text; v_state text;
  v_prev_step text; v_id uuid; g jsonb; v_sup jsonb; v_len int;
begin
  if v_uid is null then raise exception 'Forbidden' using errcode = '42501'; end if;
  -- HTTP 경로가 지정한 납품은 저장/멱등 응답 전에 영수증과 결속한다.
  -- 직접 RPC는 영수증 자체를 대상으로 삼을 수 있으나, 경로를 받은 서버는 반드시 p_delivery를 전달한다.
  if p_delivery is not null and not exists (
    select 1 from factory_dcp_attempt a where a.id = p_attempt and a.user_id = v_uid and a.delivery_id = p_delivery
  ) then raise exception 'reflect: attempt not_found' using errcode = 'P0001'; end if;
  if p_lesson_sha is distinct from '0b653454bfea053f0523cee1647de1eb97ad5038661bd2fac49162336db0c7f0' then
    raise exception 'reflect: lesson lesson_mismatch' using errcode = 'P0001';
  end if;
  if p_attempt is null or p_mutation is null or p_body is null or jsonb_typeof(p_body) <> 'object'
     or (select array_agg(k order by k) from jsonb_object_keys(p_body) k) is distinct from array['claim','comparison','procedure','relation','step','support']
     or coalesce(p_body->>'step', '') not in ('main_point', 'title', 'topic') then
    raise exception 'reflect: body must be closed {step,claim,support,relation,comparison,procedure}' using errcode = '22023';
  end if;
  v_step := p_body->>'step';
  -- 주장 문장: 요지 · 주제는 필수(0..8), 제목은 null 허용
  if jsonb_typeof(p_body->'claim') = 'null' then
    if v_step <> 'title' then raise exception 'reflect: claim required' using errcode = '22023'; end if;
  elsif jsonb_typeof(p_body->'claim') <> 'number' or (p_body->>'claim') !~ '^[0-8]$' then
    raise exception 'reflect: claim must be 0..8' using errcode = '22023';
  end if;
  v_sup := p_body->'support';
  if jsonb_typeof(v_sup) <> 'array' or jsonb_array_length(v_sup) not between 1 and 4
     or exists (select 1 from jsonb_array_elements(v_sup) e where jsonb_typeof(e) <> 'number' or e::text !~ '^[0-8]$')
     or (select count(distinct e::text) from jsonb_array_elements(v_sup) e) <> jsonb_array_length(v_sup) then
    raise exception 'reflect: support must be 1..4 distinct 0..8' using errcode = '22023';
  end if;
  if jsonb_typeof(p_body->'relation') <> 'string' or char_length(btrim(p_body->>'relation')) not between 2 and 600 then
    raise exception 'reflect: relation must be 2..600 chars' using errcode = '22023';
  end if;
  if v_step = 'main_point' then
    if jsonb_typeof(p_body->'comparison') <> 'string' or char_length(btrim(p_body->>'comparison')) not between 2 and 600 then
      raise exception 'reflect: comparison must be 2..600 chars' using errcode = '22023';
    end if;
  elsif jsonb_typeof(p_body->'comparison') <> 'null' then raise exception 'reflect: comparison only on main_point' using errcode = '22023';
  end if;
  if v_step = 'topic' then
    if jsonb_typeof(p_body->'procedure') <> 'string' or char_length(btrim(p_body->>'procedure')) not between 2 and 600 then
      raise exception 'reflect: procedure must be 2..600 chars' using errcode = '22023';
    end if;
  elsif jsonb_typeof(p_body->'procedure') <> 'null' then raise exception 'reflect: procedure only on topic' using errcode = '22023';
  end if;
  v_hash := encode(sha256(convert_to(p_body::text, 'UTF8')), 'hex');
  perform pg_advisory_xact_lock(hashtextextended('source_lesson_reflect:' || v_uid::text || ':' || p_mutation::text, 0));

  -- ① 같은 키 재전송 — 같은 영수증 · 같은 본문일 때만 저장된 결과
  select * into prev from source_lesson_reflection r where r.user_id = v_uid and r.mutation_id = p_mutation;
  if found then
    if prev.attempt_id <> p_attempt or prev.body_hash <> v_hash then
      raise exception 'reflect: mutation key reused with a different body' using errcode = '23505';
    end if;
    return prev.result || jsonb_build_object('replayed', true);
  end if;

  -- ② 본인의 실제 풀이 영수증 — 남의 영수증은 존재를 알리지 않는다
  select * into t from factory_dcp_attempt a where a.id = p_attempt and a.user_id = v_uid;
  if not found then raise exception 'reflect: attempt not_found' using errcode = 'P0001'; end if;
  select w.template_id into v_template from learner_workspace w where w.id = t.workspace_id and w.user_id = v_uid;
  if not found then raise exception 'reflect: delivery workspace_closed' using errcode = 'P0001'; end if;
  -- 잠금 순서는 1D 제출과 같다: map_goal → map_plan → Workspace → 주문 → 납품 → 승인 → 등록 후보
  perform pg_advisory_xact_lock(hashtext('map_goal:' || v_uid::text));
  perform pg_advisory_xact_lock(hashtext('map_plan:' || v_uid::text || ':' || v_template));
  perform 1 from learner_workspace w where w.id = t.workspace_id and w.user_id = v_uid for share;
  select * into d from workspace_content_delivery w where w.id = t.delivery_id and w.user_id = v_uid;
  if d.order_id is not null then perform 1 from factory_order o where o.id = d.order_id for share; end if;
  perform 1 from workspace_content_delivery w where w.id = d.id for share;
  perform 1 from content_release_approval r where r.id = d.approval_id for share;
  perform 1 from factory_dcp_admission a where a.dcp_item_id::text = d.artifact_ref for share;

  -- ③ 지금도 유효한 납품 · 교수 자료의 원문 · 같은 판본 · 단계 일치
  v_state := public.source_lesson_check(d.id);
  if v_state <> 'ok' then raise exception 'reflect: delivery %', v_state using errcode = 'P0001'; end if;
  select a.*, i.type into x from factory_dcp_admission a join csat_dcp_items i on i.id = a.dcp_item_id where a.dcp_item_id::text = d.artifact_ref;
  if x.artifact_revision <> t.artifact_revision or x.dcp_item_id <> t.dcp_item_id then raise exception 'reflect: delivery stale_revision' using errcode = 'P0001'; end if;
  if x.type <> v_step then raise exception 'reflect: step does not match the attempted item' using errcode = '22023'; end if;

  -- ④ 순서 — 앞 단계 설명이 같은 Workspace · 같은 주문에 저장돼 있어야 한다
  v_prev_step := case v_step when 'title' then 'main_point' when 'topic' then 'title' end;
  if v_prev_step is not null and not exists (select 1 from source_lesson_reflection r where r.user_id = v_uid and r.workspace_id = d.workspace_id
       and r.order_id = d.order_id and r.step = v_prev_step and r.lesson_sha256 = p_lesson_sha) then
    raise exception 'reflect: step out_of_order' using errcode = 'P0001';
  end if;
  if exists (select 1 from source_lesson_reflection r where r.user_id = v_uid and r.delivery_id = d.id and r.lesson_sha256 = p_lesson_sha) then
    raise exception 'reflect: already reflected for this step' using errcode = '23505';
  end if;

  v_id := gen_random_uuid();
  g := jsonb_build_object('reflection_id', v_id, 'attempt_id', t.id, 'delivery_id', d.id, 'step', v_step, 'recorded', true,
    'evidence', false, 'non_evidence_reason', 'guided_reflection');
  perform set_config('vocaflow.supply_writer', 'rpc', true);
  insert into source_lesson_reflection (id, user_id, mutation_id, lesson_id, lesson_sha256, source_id, source_content_sha256, attempt_id, delivery_id,
    workspace_id, order_id, artifact_revision, step, body, body_hash, result)
  values (v_id, v_uid, p_mutation, 'title-route-central-meaning.v3', p_lesson_sha, x.source_id, x.source_content_sha256, t.id, d.id,
    d.workspace_id, d.order_id, x.artifact_revision, v_step, p_body, v_hash, g);
  return g || jsonb_build_object('replayed', false);
end $$;
revoke all on function public.source_lesson_reflect(uuid, text, jsonb, uuid, uuid) from public, anon;
grant execute on function public.source_lesson_reflect(uuid, text, jsonb, uuid, uuid) to authenticated;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    revoke all on function public.source_lesson_check(uuid) from service_role;
    revoke all on function public.source_lesson_progress(uuid,text) from service_role;
    revoke all on function public.source_lesson_reflect(uuid,text,jsonb,uuid,uuid) from service_role;
  end if;
end $$;

-- ── 계측 허용 목록 — csat_source_lesson_reflected 하나(1D 와 같은 방식: 실제 제약에서 읽어 더한다) ─────────
do $$
declare v_names text[]; v_def text; v_new constant text[] := array['csat_source_lesson_reflected'];
begin
  -- 제약은 두 모양 중 하나다: array['a','b'] (원래) · '{a,b}'::text[] (1D 처럼 format(%L) 로 다시 만든 뒤). 둘 다 읽는다
  select pg_get_constraintdef(c.oid) into v_def from pg_constraint c
   where c.conrelid = 'public.funnel_events'::regclass and c.conname = 'funnel_events_event_check';
  select array_agg(distinct n) into v_names from (
    select m[1] n from regexp_matches(coalesce(v_def, ''), '''([a-z0-9_]+)''', 'g') m
    union select unnest(string_to_array(b[1], ',')) from regexp_matches(coalesce(v_def, ''), '''[{]([a-z0-9_,]+)[}]''', 'g') b) z;
  if v_names is null or cardinality(v_names) = 0 then raise exception 'funnel_events_event_check not found or unreadable'; end if;
  v_names := array(select distinct x from unnest(v_names || v_new) x order by x);
  alter table public.funnel_events drop constraint funnel_events_event_check;
  execute format('alter table public.funnel_events add constraint funnel_events_event_check check (event = any (%L::text[]))', v_names);
end $$;

-- END EXACT STAGE source_lesson_reflection

-- BEGIN EXACT STAGE source_lesson_repair_receipt 9951a0ae30f626dd20f5c60b0c64dbd7c996b2350e07034e2de5fce4e14ab011
-- supabase/migrations/_pending_source_lesson_repair_receipt.sql
-- ⚠️ 보류(적용 안 함) — 단계 2D · 2E. 공유 DB 적용은 별도 사용자 승인(L4). 격리 PGlite 시험에서만 적용한다.
--
-- 무엇: 원문 안내 연습(source-lesson v3 · 요지 → 제목 → 주제)의 **수행 사실 영수증**을 지도 loader 가 읽는 읽기 전용 투영.
--   · 새 표 · 새 행 · 새 시각을 만들지 않는다. factory_dcp_attempt(실제 채점 영수증)와 source_lesson_reflection(설명 저장)의
--     기존 received_at 을 그대로 돌려준다. completed_at = 세 단계 설명 저장 중 마지막 서버 수신 시각(= 교수 활동 완료 시각).
--   · 근거가 아니다: Gold · G2(learning_task_attempts / workspace_delivery_attempt)를 만들지 않는다.
--   · 계보: 검증된 사용자(p_user) · 등록 후보 원문 003946dd…/33dc4880… · 역할 guided_practice · TASK r.central_meaning · 판본 일치 ·
--     납품 유효(supply_delivery_valid — 권리 · 승인 철회 · 자격 대체) · 제품주문 링크/현재성 · Workspace 열림 ·
--     수요의 goal_version_id = 학습자의 **현재 목표**(다른 목표 회차의 사실은 넘어오지 않는다).
--   · 1D factory_dcp_delivery_state 와 다른 점은 하나 — 개인 계보 현재성(factory_dcp_learning_current: 최신 plan 버전)을 요구하지 않는다.
--     같은 목표의 다음 계획이 저장돼도 **이미 끝난** 바로잡기 사실이 사라져 repair 로 되돌아가지 않게 하기 위해서다.
--     구계획 자료를 새로 여는 것은 여전히 factory_dcp_delivery_state(lineage_not_current)가 막는다 — current 칸으로 구분해 돌려준다.
--   · p_as_of: 이 시각 뒤에 받은 시도 · 설명은 세지 않는다(과거 asOf 판정에 미래 완료가 유입되지 않게). 서버가 넣는다.
--   · 2E 호출자: (가) 학습자 본인 세션 — auth.uid() = p_user 만. (나) 진짜 service_role(JWT role 클레임 · 서버가 인증한 userId 를 넘김 ·
--     /csat 홈 loadMapPage). 다른 사용자의 p_user 를 넘긴 authenticated 호출 · anon · 역할 없는 호출 = 42501.
--     사용자를 가장하지 않는다(auth.uid 를 바꾸지 않는다).
--   · source_lesson_fact_state 는 내부 전용 — 같은 검증된 p_user 로만 부르고 public/anon/authenticated/service_role 실행 권한이 없다.
--
-- 전제: _pending_source_lesson_reflection.sql(2B) 뒤.
-- 되돌리기(행 없음 · 별도 승인): drop function source_lesson_repair_receipts(uuid, timestamptz); drop function source_lesson_fact_state(uuid, uuid);

do $$
begin
  if to_regclass('public.source_lesson_reflection') is null or to_regprocedure('public.factory_dcp_learning_current(uuid)') is null then
    raise exception 'source lesson repair receipt requires 2B source lesson reflection first';
  end if;
  if to_regprocedure('public.source_lesson_repair_receipts(uuid, timestamptz)') is not null then raise exception 'source lesson repair receipt already installed'; end if;
end $$;

-- ── 과거 수행 사실의 유효성 — 'ok' 또는 닫힌 거절 코드(1D 코드와 같은 이름 · lineage 대신 goal_changed) ─────────────
create function public.source_lesson_fact_state(p_delivery uuid, p_user uuid)
returns text language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $$
declare d record; a record; v_ws text;
begin
  select * into d from workspace_content_delivery w where w.id = p_delivery and w.user_id = p_user;
  if not found then return 'not_found'; end if;
  if d.artifact_kind <> 'dcp_item' then return 'not_factory_dcp'; end if;
  select * into a from factory_dcp_admission x where x.dcp_item_id::text = d.artifact_ref;
  if not found then return 'not_factory_dcp'; end if;
  if a.source_id <> '003946dd-f5e6-4efe-9254-b7a69ca39e61'
     or a.source_content_sha256 <> '33dc4880f42b6b5815b93da059beb2dae640b138371e0cb1992ad46ba6452b0f' then return 'lesson_mismatch'; end if;
  if d.role <> 'guided_practice' or d.task_id <> 'r.central_meaning' or a.role <> d.role or a.task_id <> d.task_id then return 'wrong_role_task'; end if;
  select w.status into v_ws from learner_workspace w where w.id = d.workspace_id and w.user_id = d.user_id;
  if v_ws is distinct from 'active' then return 'workspace_closed'; end if;
  if d.artifact_revision is distinct from a.artifact_revision then return 'stale_revision'; end if;
  if public.supply_delivery_valid(d.id) is not true then return 'not_current'; end if;
  if d.order_id is null then return 'goal_changed'; end if;
  if not exists (select 1 from factory_order o join workspace_content_demand_line l on l.id = o.line_id
                   join workspace_content_demand dm on dm.id = l.demand_id
                  where o.id = d.order_id and o.user_id = d.user_id and o.workspace_id = d.workspace_id and o.state <> 'failed'
                    and dm.goal_version_id is not distinct from (select max(g.id) from csat_map_goal_version g where g.user_id = d.user_id)) then
    return 'goal_changed';
  end if;
  if not exists (select 1 from factory_order_product_link k where k.order_id = d.order_id and k.product_order_id = a.product_order_id
                 and k.order_revision = a.order_revision and k.order_hash = a.order_hash) then return 'product_link_mismatch'; end if;
  if public.factory_product_order_is_current(a.product_order_id, a.order_revision) is not true then return 'product_not_current'; end if;
  return 'ok';
end $$;
revoke all on function public.source_lesson_fact_state(uuid, uuid) from public, anon, authenticated, service_role;

-- ── 영수증 — 개인 주문(한 원문 · 한 Workspace)별 세 단계 수행 사실 ─────────────────────────
-- 반환 jsonb 배열: [{ workspace_id, order_id, task_id, current, complete, completed_at,
--   steps: [{ step, delivery_id, dcp_item_id, attempt_id, is_correct, attempt_received_at, reflected_at }] }]
--   step 하나 = 그 납품에 저장된 설명 1행 + 그 설명이 가리킨 실제 채점 영수증(정오는 채점기 값 그대로). 설명 없는 시도는 싣지 않는다.
--   complete = 요지 · 제목 · 주제 세 단계 모두 실렸을 때만. 미완료 주문도 돌려준다(시도 중 표시용 · 성공 근거 아님).
create function public.source_lesson_repair_receipts(p_user uuid, p_as_of timestamptz)
returns jsonb language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $$
declare
  v_auth uuid := auth.uid();
  v_uid uuid := p_user;
  v_role text := coalesce(nullif(current_setting('request.jwt.claim.role', true), ''),
                          nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role');
begin
  if p_user is null then raise exception 'user required' using errcode = '22023'; end if;
  -- 본인 세션은 자기 것만 · auth.uid 없는 호출은 진짜 service_role 만(서버가 인증한 userId)
  if v_auth is not null then
    if v_auth <> p_user then raise exception 'Forbidden' using errcode = '42501'; end if;
  elsif v_role is distinct from 'service_role' then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  if p_as_of is null then raise exception 'as_of required' using errcode = '22023'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('workspace_id', o.workspace_id, 'order_id', o.order_id, 'task_id', 'r.central_meaning',
             'current', public.factory_dcp_learning_current(o.order_id),
             'complete', o.n = 3, 'completed_at', case when o.n = 3 then o.last_at end, 'steps', o.steps) order by o.last_at)
      from (
        select s.workspace_id, s.order_id, count(distinct s.step) as n, max(s.reflected_at) as last_at,
               jsonb_agg(jsonb_build_object('step', s.step, 'delivery_id', s.delivery_id, 'dcp_item_id', s.dcp_item_id, 'attempt_id', s.attempt_id,
                 'is_correct', s.is_correct, 'attempt_received_at', s.attempt_received_at, 'reflected_at', s.reflected_at)
                 order by array_position(array['main_point','title','topic'], s.step)) as steps
          from (
            select r.workspace_id, r.order_id, r.step, r.delivery_id, t.dcp_item_id, t.id as attempt_id, t.is_correct,
                   t.received_at as attempt_received_at, r.received_at as reflected_at
              from source_lesson_reflection r
              join factory_dcp_attempt t on t.id = r.attempt_id and t.user_id = r.user_id and t.delivery_id = r.delivery_id
              join csat_dcp_items i on i.id = t.dcp_item_id and i.type = r.step
             where r.user_id = v_uid and r.lesson_sha256 = '0b653454bfea053f0523cee1647de1eb97ad5038661bd2fac49162336db0c7f0'
               and r.received_at <= p_as_of and t.received_at <= p_as_of and t.received_at <= r.received_at
               and public.source_lesson_fact_state(r.delivery_id, v_uid) = 'ok'
          ) s
         group by s.workspace_id, s.order_id
      ) o), '[]'::jsonb);
end $$;
revoke all on function public.source_lesson_repair_receipts(uuid, timestamptz) from public, anon, authenticated, service_role;
grant execute on function public.source_lesson_repair_receipts(uuid, timestamptz) to authenticated, service_role;

-- END EXACT STAGE source_lesson_repair_receipt

-- BEGIN EXACT STAGE two_existing_rationale_DATA_correction 9aa6b0caf2d2734597eb9bcd04c2b93b1733aaba50cff91494f05f5f5798b34d
-- supabase/deploy/learning-outcomes-20261021/rationale-correction.sql
-- PROPOSAL ONLY; no shared DB execution. Two rationale_ko strings only; owner SQL/data approval required.
-- Caller must use one transaction. Source, payload, choices, primary keys and attempt rows are preserved.
DO $rationale_correction$
DECLARE r record; current_item record; current_content text; affected integer;
BEGIN
  SELECT content INTO current_content FROM public.library_articles WHERE id='003946dd-f5e6-4efe-9254-b7a69ca39e61' FOR SHARE;
  IF current_content IS NULL OR encode(sha256(convert_to(current_content,'UTF8')),'hex') <> '33dc4880f42b6b5815b93da059beb2dae640b138371e0cb1992ad46ba6452b0f' THEN
    RAISE EXCEPTION 'rationale correction: source changed';
  END IF;
  FOR r IN SELECT * FROM (VALUES
    ('4dbcca67-2e17-4e96-a2d1-9d513b4b87b6'::uuid,'title','21bb9ea4c343560ccbe1a880c3020d1f22f89454d8d41693270daba4b0391ca1','22f9c79b4d320496f425741b7224271b577d8a5c92c46de50ced448af96d5362','{"answer":1,"rationale_ko":"이 발췌는 같은 그림에 서로 다른 제목을 붙이는 가정 사례를 든 뒤 \"a title tells the eye where to begin\"이라고 이유를 밝힌다. 이어 \"the first words attached to it become a kind of route through the frame\"이라고 설명하며, 마지막 문장은 노래와 이야기로 같은 원리를 확장한다. 따라서 제목이 보는 방향을 이끈다는 ①이 발췌 전체를 묶는다. ②의 이름을 없애야 한다는 권고와 ③의 작품 명명 권리는 발췌에 없다. ④는 시선을 이끄는 원인을 색 선택으로 바꾸지만 글은 제목의 언어를 다룬다. ⑤는 제목이 다르기 때문에 두 집단의 관찰이 달라진 사례를 집단들이 좀처럼 의견을 같이하지 않는 일반적인 현상으로 넓힌다."}'::jsonb,'이 발췌는 같은 그림에 서로 다른 제목을 붙이는 가정 사례를 든 뒤 "a title tells the eye where to begin"이라고 이유를 밝힌다. 이어 "the first words attached to it become a kind of route through the frame"이라고 설명하며, 마지막 문장은 노래와 이야기로 같은 원리를 확장한다. 따라서 제목이 보는 방향을 이끈다는 ①이 발췌 전체를 묶는다. ②의 이름을 없애야 한다는 권고와 ③의 작품 명명 권리는 발췌에 없다. ④는 시선을 이끄는 원인을 색 선택으로 바꾸지만 글은 제목의 언어를 다룬다. ⑤는 제목이 다르기 때문에 두 집단의 관찰이 달라진 사례를 집단들이 좀처럼 의견을 같이하지 않는 일반적인 현상으로 넓힌다.'),
    ('33ee70d0-d812-49b1-9098-d97f7aaee5af'::uuid,'topic','a23f3d0c8f7b92f910ebf4a1fb316b9b3ebc0ac40d9490c1b91baa1b597d8269','2fdabbd16a92b763f28b858d62cd53ed29ecc02cac1dde78a91684eab58fbb4e','{"answer":2,"rationale_ko":"글은 같은 그림에 다른 제목을 붙이는 가정 사례로 시선의 차이를 보여 준 뒤 \"a title tells the eye where to begin\"이라고 설명하고, 제목에 대해 \"It belongs to the work, and choosing it is a real decision.\"이라고 판단한다. 중심은 제목이 감상의 경로를 정하고 작품의 일부로 작용한다는 것이므로 ②가 주제다. ①의 노래·이야기와 그림 사이 명명 난도 비교는 글에 없다. ③의 관람객 전반이 하늘을 먼저 보는 경향도 글의 주장이 아니다. 원문은 제목에 따라 한 집단은 하늘, 다른 집단은 구석 인물을 본다는 사례를 든다. ④는 제목을 완성 뒤에만 붙여야 한다는 권고로, 제목을 사후에 붙는 표지로 보지 않는 글의 판단과 어긋난다. ⑤는 일부 작가의 무제 선택이라는 마지막 사례를 현대의 일반 습관으로 넓히며 글 전체의 중심을 대신한다."}'::jsonb,'글은 같은 그림에 다른 제목을 붙이는 가정 사례로 시선의 차이를 보여 준 뒤 "a title tells the eye where to begin"이라고 설명하고, 제목에 대해 "It belongs to the work, and choosing it is a real decision."이라고 판단한다. 중심은 제목이 감상의 경로를 정하고 작품의 일부로 작용한다는 것이므로 ②가 주제다. ①의 노래·이야기와 그림 사이 명명 난도 비교는 글에 없다. ③의 관람객 전반이 하늘을 먼저 보는 경향도 글의 주장이 아니다. 원문은 제목에 따라 한 집단은 하늘, 다른 집단은 구석 인물을 본다는 사례를 든다. ④는 제목을 완성 뒤에만 붙여야 한다는 권고로, 제목을 사후에 붙는 표지로 보지 않는 글의 판단과 어긋난다. ⑤는 일부 작가의 무제 선택이라는 마지막 사례를 현대의 일반 습관으로 넓히며 글 전체의 중심을 대신한다.')
  ) v(id, item_type, payload_sha, old_answer_sha, proposed_answer, replacement_rationale) ORDER BY id LOOP
    SELECT * INTO current_item FROM public.csat_dcp_items WHERE id=r.id FOR UPDATE;
    IF NOT FOUND OR current_item.kind <> 'article' OR current_item.ref_id::text <> '003946dd-f5e6-4efe-9254-b7a69ca39e61'
       OR current_item.type <> r.item_type OR current_item.paragraph_idx <> 0 OR current_item.item_role <> 'practice'
       OR encode(sha256(convert_to(current_item.payload::text,'UTF8')),'hex') <> r.payload_sha THEN
      RAISE EXCEPTION 'rationale correction: row changed %',r.id;
    END IF;
    IF encode(sha256(convert_to(current_item.answer_key::text,'UTF8')),'hex') <> r.old_answer_sha THEN
      RAISE EXCEPTION 'rationale correction: answer key changed %',r.id;
    END IF;
    IF EXISTS(SELECT 1 FROM public.content_qualification q WHERE q.artifact_kind='dcp_item' AND q.artifact_ref=r.id::text)
       OR EXISTS(SELECT 1 FROM public.factory_dcp_admission a WHERE a.dcp_item_id=r.id) THEN
      RAISE EXCEPTION 'rationale correction: qualification/admission already exists %',r.id;
    END IF;
    UPDATE public.csat_dcp_items SET answer_key=jsonb_set(answer_key,'{rationale_ko}',to_jsonb(r.replacement_rationale::text),false) WHERE id=r.id;
    GET DIAGNOSTICS affected=ROW_COUNT;
    IF affected <> 1 THEN RAISE EXCEPTION 'rationale correction: expected one row %',r.id; END IF;
  END LOOP;
END $rationale_correction$;

-- END EXACT STAGE two_existing_rationale_DATA_correction

DO $verify$
DECLARE r record; v_after bigint;
BEGIN
  FOR r IN SELECT * FROM learning_outcomes_before_counts LOOP
    EXECUTE format('SELECT count(*) FROM public.%I',r.table_name) INTO v_after;
    IF v_after <> r.rows THEN RAISE EXCEPTION 'existing row count changed: %',r.table_name; END IF;
  END LOOP;
  IF to_regclass('public.authored_item') IS NULL THEN RAISE EXCEPTION 'missing new table: authored_item'; END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.authored_item'::regclass) THEN RAISE EXCEPTION 'RLS missing: authored_item'; END IF;
  IF has_table_privilege('service_role','public.authored_item','INSERT,UPDATE,DELETE,TRUNCATE') THEN RAISE EXCEPTION 'backend direct mutation granted: authored_item'; END IF;
  IF to_regclass('public.content_human_decision') IS NULL THEN RAISE EXCEPTION 'missing new table: content_human_decision'; END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.content_human_decision'::regclass) THEN RAISE EXCEPTION 'RLS missing: content_human_decision'; END IF;
  IF has_table_privilege('service_role','public.content_human_decision','INSERT,UPDATE,DELETE,TRUNCATE') THEN RAISE EXCEPTION 'backend direct mutation granted: content_human_decision'; END IF;
  IF to_regclass('public.content_human_decision_revocation') IS NULL THEN RAISE EXCEPTION 'missing new table: content_human_decision_revocation'; END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.content_human_decision_revocation'::regclass) THEN RAISE EXCEPTION 'RLS missing: content_human_decision_revocation'; END IF;
  IF has_table_privilege('service_role','public.content_human_decision_revocation','INSERT,UPDATE,DELETE,TRUNCATE') THEN RAISE EXCEPTION 'backend direct mutation granted: content_human_decision_revocation'; END IF;
  IF to_regclass('public.content_ai_decision') IS NULL THEN RAISE EXCEPTION 'missing new table: content_ai_decision'; END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.content_ai_decision'::regclass) THEN RAISE EXCEPTION 'RLS missing: content_ai_decision'; END IF;
  IF has_table_privilege('service_role','public.content_ai_decision','INSERT,UPDATE,DELETE,TRUNCATE') THEN RAISE EXCEPTION 'backend direct mutation granted: content_ai_decision'; END IF;
  IF to_regclass('public.content_ai_decision_revocation') IS NULL THEN RAISE EXCEPTION 'missing new table: content_ai_decision_revocation'; END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.content_ai_decision_revocation'::regclass) THEN RAISE EXCEPTION 'RLS missing: content_ai_decision_revocation'; END IF;
  IF has_table_privilege('service_role','public.content_ai_decision_revocation','INSERT,UPDATE,DELETE,TRUNCATE') THEN RAISE EXCEPTION 'backend direct mutation granted: content_ai_decision_revocation'; END IF;
  IF to_regclass('public.factory_dcp_admission') IS NULL THEN RAISE EXCEPTION 'missing new table: factory_dcp_admission'; END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.factory_dcp_admission'::regclass) THEN RAISE EXCEPTION 'RLS missing: factory_dcp_admission'; END IF;
  IF has_table_privilege('service_role','public.factory_dcp_admission','INSERT,UPDATE,DELETE,TRUNCATE') THEN RAISE EXCEPTION 'backend direct mutation granted: factory_dcp_admission'; END IF;
  IF to_regclass('public.factory_dcp_qualification') IS NULL THEN RAISE EXCEPTION 'missing new table: factory_dcp_qualification'; END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.factory_dcp_qualification'::regclass) THEN RAISE EXCEPTION 'RLS missing: factory_dcp_qualification'; END IF;
  IF has_table_privilege('service_role','public.factory_dcp_qualification','INSERT,UPDATE,DELETE,TRUNCATE') THEN RAISE EXCEPTION 'backend direct mutation granted: factory_dcp_qualification'; END IF;
  IF to_regclass('public.factory_dcp_attempt') IS NULL THEN RAISE EXCEPTION 'missing new table: factory_dcp_attempt'; END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.factory_dcp_attempt'::regclass) THEN RAISE EXCEPTION 'RLS missing: factory_dcp_attempt'; END IF;
  IF has_table_privilege('service_role','public.factory_dcp_attempt','INSERT,UPDATE,DELETE,TRUNCATE') THEN RAISE EXCEPTION 'backend direct mutation granted: factory_dcp_attempt'; END IF;
  IF to_regclass('public.source_lesson_reflection') IS NULL THEN RAISE EXCEPTION 'missing new table: source_lesson_reflection'; END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.source_lesson_reflection'::regclass) THEN RAISE EXCEPTION 'RLS missing: source_lesson_reflection'; END IF;
  IF has_table_privilege('service_role','public.source_lesson_reflection','INSERT,UPDATE,DELETE,TRUNCATE') THEN RAISE EXCEPTION 'backend direct mutation granted: source_lesson_reflection'; END IF;
END $verify$;
-- History registration needs a fresh unique version selected immediately before approved application.
-- This review preview intentionally does not claim an applied migration/history record.
