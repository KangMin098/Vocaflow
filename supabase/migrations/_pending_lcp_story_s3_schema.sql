-- supabase/migrations/_pending_lcp_story_s3_schema.sql
-- ⚠️ 보류(적용 안 함) — LCP Story S3. 공유 DB 적용은 별도 사용자 대화 승인(L4) 뒤 승인형 배포 러너
--    (scripts/db/lcp-story-s3/deploy.mjs apply --stage schema --confirm-sha <이 파일 SHA-256>)로만 한다.
--    격리 PGlite 시험(scripts/db/lcp-story-s3/verify-isolated.ts)에서만 실행했다.
--
-- 무엇: 이야기 판본 라인(docs/LCP_STORY.md)의 격리 저장소. 기존 원본 도서 테이블 · 함수 · 정책 · 행을 하나도 바꾸지 않는다.
--   · 새 스키마 story(PostgREST 비노출) — 원천 스냅숏 · 편집 기준 · 판본 자리 · 판본 판 · 검수 · 권리 결정 · 발행본 · 발행 단위 본문 ·
--     발행본별 읽기 진도 · 작업 기록. 모든 표 RLS 켜짐 + 정책 없음 + anon/authenticated/service_role 권한 없음.
--   · public.story_* RPC(SECURITY DEFINER, search_path = pg_catalog, pg_temp — 표는 모두 스키마를 붙여 부른다)만 문이다. 관리자 RPC 는 auth.uid() 의 user_profiles 역할로
--     판단한다 — service_role(사용자 없음)은 행위자가 아니다. 호출자가 보낸 생산자 · 검수자 · 권리 값은 「주장」으로만 저장한다.
--   · 본문 해시 · 원천 판본 정체 해시 · 기준/목표/판본/활동/검수 해시 · release_key 를 DB 가 S2(packages/library-pipeline/src/story)와
--     같은 정본 직렬화(키 UTF-16=ASCII 순 정렬 · 배열 순서 보존 · JSON.stringify 와 같은 문자열 이스케이프 · 정수만)로 다시 계산한다.
--   · 발행은 최신 판 · 현재 결속 검수 전부 적격 · 생산자 ≠ 검수자 ≠ 발행자(발행자 ≠ 생산자) · 원문(+선언/번역) 권리 confirmed ·
--     자산 없음 · 같은 자리 살아 있는 발행본 없음일 때만. 발행본 행 · 단위 본문은 불변, 철회는 철회 칸만 한 번 채운다.
--   · 학습자는 살아 있는 발행본만 읽고(로그인), 진도는 발행본별로만 쌓인다. 철회는 본문 · 직접 읽기를 막고 진도 · 이력을 보존한다.
--
-- 영향: 기존 행 0 · 기존 객체 변경 0(새 스키마 1 · 새 표 10 · 새 함수 · 트리거 · 인덱스만). public.library_books 는 읽기만 한다
--   (library_book 원천의 대응 확인). FK 를 걸지 않아 원본 도서 삭제 · 재처리 동작을 막지 않는다.
-- 전제: PostgreSQL 13+(IS NFC NORMALIZED · gen_random_uuid · sha256), auth.uid(), public.user_profiles(user_id, role, status),
--   public.library_books(id, source, source_id, status), 역할 anon · authenticated · service_role. 스키마 story 가 없어야 한다.
-- 되돌리기: 파괴 없이 _pending_lcp_story_s3_quarantine.sql(모든 public.story_* 실행 권한 회수 — 표 · 이력 보존).

do $$
declare v_missing text[];
begin
  select array_agg(x) into v_missing from unnest(array[
    'auth.uid()', 'pg_catalog.gen_random_uuid()', 'pg_catalog.sha256(bytea)']) x where to_regprocedure(x) is null;
  if v_missing is not null or to_regclass('public.user_profiles') is null or to_regclass('public.library_books') is null then
    raise exception 'lcp story s3 prerequisites missing: % user_profiles=% library_books=%',
      v_missing, to_regclass('public.user_profiles'), to_regclass('public.library_books');
  end if;
  if exists (select 1 from pg_namespace where nspname = 'story') then
    raise exception 'lcp story s3: schema story already exists — 재적용하지 않는다';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname like 'story\_%') then
    raise exception 'lcp story s3: public.story_* functions already exist';
  end if;
end
$$;

create schema story;
comment on schema story is 'LCP Story 격리 저장소 — 직접 접근 없음, public.story_* RPC 만 문이다(docs/LCP_STORY.md).';
revoke all on schema story from public;

-- ── 1. 정본 직렬화 · 해시(S2 canonical.ts 와 같은 의미) ─────────────────────────────

create function story.canonical_json(p_value jsonb)
returns text
language plpgsql
stable
strict
set search_path = pg_catalog, pg_temp
as $fn$
declare
  v_type text := pg_catalog.jsonb_typeof(p_value);
  v_key text;
  v_parts text[] := '{}';
  v_elem jsonb;
  v_num text;
begin
  if v_type = 'object' then
    for v_key in select k from pg_catalog.jsonb_object_keys(p_value) as k order by k collate "C" loop
      -- S2 는 UTF-16 코드 단위 순으로 키를 정렬한다. ASCII 키만 받아 "C"(바이트) 순과 같게 한다.
      if v_key !~ '^[ -~]*$' then
        raise exception 'story:canonical_non_ascii_key' using detail = v_key;
      end if;
      v_parts := v_parts || (pg_catalog.to_json(v_key)::text || ':' || story.canonical_json(p_value -> v_key));
    end loop;
    return '{' || pg_catalog.array_to_string(v_parts, ',') || '}';
  elsif v_type = 'array' then
    for v_elem in select e from pg_catalog.jsonb_array_elements(p_value) with ordinality as t(e, i) order by i loop
      v_parts := v_parts || story.canonical_json(v_elem);
    end loop;
    return '[' || pg_catalog.array_to_string(v_parts, ',') || ']';
  elsif v_type = 'string' then
    -- to_json(text) 은 JSON.stringify 와 같은 이스케이프(" \ \b \f \n \r \t, 나머지 제어 문자 \u00xx 소문자)를 쓴다.
    return pg_catalog.to_json(p_value #>> '{}')::text;
  elsif v_type = 'number' then
    -- S2 스키마의 수는 정수뿐이다. 소수 · 지수 · 안전 범위 밖은 표기가 갈릴 수 있어 거부한다.
    v_num := p_value::text;
    if v_num !~ '^-?(0|[1-9][0-9]{0,15})$' or pg_catalog.abs(v_num::numeric) > 9007199254740991 then
      raise exception 'story:canonical_unsupported_number' using detail = v_num;
    end if;
    return v_num;
  elsif v_type = 'boolean' then
    return p_value::text;
  end if;
  return 'null';
end
$fn$;

create function story.sha256_hex(p_text text)
returns text
language sql
stable
strict
set search_path = pg_catalog, pg_temp
as $fn$
  select pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_text, 'UTF8')), 'hex')
$fn$;

create function story.canonical_sha256(p_value jsonb)
returns text
language sql
stable
strict
set search_path = pg_catalog, pg_temp
as $fn$
  select story.sha256_hex(story.canonical_json(p_value))
$fn$;

-- S2 validate.ts sourceIdentity 와 같다: 본문 · 선언 해시를 뺀 스냅숏 + 계산한 본문 해시 + 자산 이름 순 권리 기록.
create function story.source_identity(p_snapshot jsonb, p_text_sha256 text)
returns jsonb
language sql
stable
set search_path = pg_catalog, pg_temp
as $fn$
  select (p_snapshot - 'text' - 'text_sha256' - 'rights')
    || pg_catalog.jsonb_build_object(
         'text_sha256', p_text_sha256,
         'rights', coalesce(
           (select pg_catalog.jsonb_agg(r order by r ->> 'asset' collate "C")
              from pg_catalog.jsonb_array_elements(p_snapshot -> 'rights') as r),
           '[]'::jsonb))
$fn$;

-- S2 validate.ts requiredChecks 와 같다.
create function story.required_checks(p_artifact jsonb)
returns text[]
language sql
stable
set search_path = pg_catalog, pg_temp
as $fn$
  select array['source_alignment', 'meaning_preservation', 'preserve_items', 'language_target', 'cognitive_target',
               'background_supports', 'sensitivity_handling', 'hook_spoiler_free', 'naturalness']
    || case when pg_catalog.jsonb_array_length(coalesce(p_artifact -> 'activities', '[]'::jsonb)) > 0
            then array['activities'] else '{}'::text[] end
    || case when pg_catalog.jsonb_array_length(coalesce(p_artifact -> 'assets', '[]'::jsonb)) > 0
            then array['assets'] else '{}'::text[] end
$fn$;

-- ── 2. 행위자 ──────────────────────────────────────────────────────────────────

-- 관리 행위자 = 로그인한 사용자 + user_profiles 역할 + active. service_role 은 auth.uid() 가 없어 여기서 막힌다.
create function story.require_staff(p_min_role text)
returns uuid
language plpgsql
stable
set search_path = pg_catalog, pg_temp
as $fn$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_status text;
begin
  if v_uid is null then
    raise exception 'story:auth_required' using errcode = '42501';
  end if;
  select up.role, up.status into v_role, v_status from public.user_profiles up where up.user_id = v_uid;
  if not found or v_status is distinct from 'active' then
    raise exception 'story:staff_required' using errcode = '42501';
  end if;
  if p_min_role = 'admin' and v_role is distinct from 'admin' then
    raise exception 'story:admin_required' using errcode = '42501';
  end if;
  if p_min_role = 'curator' and v_role not in ('admin', 'curator') then
    raise exception 'story:staff_required' using errcode = '42501';
  end if;
  if p_min_role not in ('admin', 'curator') then
    raise exception 'story:unknown_role_requirement';
  end if;
  return v_uid;
end
$fn$;

-- 학습 행위자 = 로그인한 사용자, 정지 · 삭제 계정 아님(프로필이 없으면 막지 않는다 — apps/web isUsableAccount 와 같음).
create function story.require_learner()
returns uuid
language plpgsql
stable
set search_path = pg_catalog, pg_temp
as $fn$
declare
  v_uid uuid := auth.uid();
  v_status text;
begin
  if v_uid is null then
    raise exception 'story:auth_required' using errcode = '42501';
  end if;
  select up.status into v_status from public.user_profiles up where up.user_id = v_uid;
  if v_status in ('suspended', 'deleted') then
    raise exception 'story:account_blocked' using errcode = '42501';
  end if;
  return v_uid;
end
$fn$;

-- ── 3. 표 ─────────────────────────────────────────────────────────────────────

create table story.sources (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  snapshot_id text not null check (snapshot_id ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  work_key text not null check (work_key ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  snapshot_meta jsonb not null,
  body text not null,
  text_sha256 text not null check (text_sha256 ~ '^[0-9a-f]{64}$'),
  identity_sha256 text not null unique check (identity_sha256 ~ '^[0-9a-f]{64}$'),
  original_language text not null check (original_language ~ '^[a-z]{2,3}$'),
  text_language text not null check (text_language = 'en'),
  translator text,
  coverage text not null check (coverage in ('complete_work', 'excerpt')),
  paragraph_count integer not null check (paragraph_count > 0),
  library_book_id uuid,
  correspondence text not null check (correspondence in ('not_library_book', 'library_book_id_source_match')),
  correspondence_library_status text,
  registered_by uuid not null,
  registered_at timestamptz not null default pg_catalog.now(),
  -- story-text-v1 의 DB 쪽 방어(정본 검증은 S2 가 먼저 한다): NFC · CR 없음 · 앞뒤/줄 끝 공백 없음 · 빈 줄 하나.
  constraint sources_body_story_text check (
    body <> '' and body is nfc normalized and pg_catalog.strpos(body, E'\r') = 0
    and body !~ E'\n\n\n' and body !~ E'[ \t]\n' and body !~ E'^[ \t\n]' and body !~ E'[ \t\n]$'),
  constraint sources_translation check ((original_language = text_language) = (translator is null)),
  constraint sources_library_book check ((correspondence = 'library_book_id_source_match') = (library_book_id is not null))
);
comment on table story.sources is '원천 스냅숏(본문 + 메타). snapshot_meta 의 권리 · 생산 기록은 등록자가 보낸 주장이다.';

create table story.policies (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  source_id uuid not null references story.sources (id) on delete restrict,
  policy jsonb not null,
  policy_sha256 text not null check (policy_sha256 ~ '^[0-9a-f]{64}$'),
  policy_full_sha256 text not null check (policy_full_sha256 ~ '^[0-9a-f]{64}$'),
  registered_by uuid not null,
  registered_at timestamptz not null default pg_catalog.now(),
  unique (source_id, policy_full_sha256)
);

create table story.edition_slots (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  policy_id uuid not null references story.policies (id) on delete restrict,
  source_id uuid not null references story.sources (id) on delete restrict,
  work_key text not null,
  edition_key text not null check (edition_key ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  kind text not null check (kind in ('story_edition', 'easy_reader')),
  transformation text not null,
  coverage text not null check (coverage in ('complete_work', 'episode', 'excerpt')),
  production jsonb not null,
  target_sha256 text not null check (target_sha256 ~ '^[0-9a-f]{64}$'),
  constraint edition_slots_kind_transformation check (
    (kind = 'story_edition' and transformation = 'language_modernization')
    or (kind = 'easy_reader' and transformation = 'level_adaptation')),
  unique (policy_id, edition_key)
);

create table story.edition_versions (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  seq bigint generated always as identity,
  slot_id uuid not null references story.edition_slots (id) on delete restrict,
  artifact jsonb not null,
  edition_sha256 text not null check (edition_sha256 ~ '^[0-9a-f]{64}$'),
  activities_sha256 text not null check (activities_sha256 ~ '^[0-9a-f]{64}$'),
  unit_count integer not null check (unit_count > 0),
  has_assets boolean not null,
  producer_claim jsonb not null,
  submitted_by uuid not null,
  submitted_at timestamptz not null default pg_catalog.now(),
  unique (slot_id, edition_sha256, activities_sha256)
);

create table story.reviews (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  edition_version_id uuid not null references story.edition_versions (id) on delete restrict,
  review jsonb not null,
  review_sha256 text not null check (review_sha256 ~ '^[0-9a-f]{64}$'),
  binding_sha256 text not null check (binding_sha256 ~ '^[0-9a-f]{64}$'),
  verdict text not null check (verdict in ('approve', 'changes_requested', 'hold', 'reject')),
  qualifies boolean not null,
  reviewer_claim jsonb not null,
  submitted_by uuid not null,
  submitted_at timestamptz not null default pg_catalog.now(),
  unique (edition_version_id, review_sha256)
);

create table story.rights_decisions (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  seq bigint generated always as identity,
  source_id uuid not null references story.sources (id) on delete restrict,
  asset text not null check (asset in ('source_text', 'translation', 'audio', 'illustration')),
  status text not null check (status in ('confirmed', 'hold', 'rejected')),
  basis text not null check (pg_catalog.length(pg_catalog.btrim(basis)) > 0),
  evidence_ref text,
  decided_by uuid not null,
  decided_at timestamptz not null default pg_catalog.now(),
  constraint rights_decisions_confirmed_evidence check (
    status <> 'confirmed' or (evidence_ref is not null and pg_catalog.length(pg_catalog.btrim(evidence_ref)) > 0))
);
comment on table story.rights_decisions is '인증된 관리자(admin)의 권리 결정. 스냅숏의 권리 「주장」과 별개이며 발행 게이트는 이 표만 본다.';

create table story.releases (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  release_key text not null unique check (release_key ~ '^lsr_[0-9a-f]{32}$'),
  slot_id uuid not null references story.edition_slots (id) on delete restrict,
  edition_version_id uuid not null references story.edition_versions (id) on delete restrict,
  source_id uuid not null references story.sources (id) on delete restrict,
  work_key text not null,
  edition_key text not null,
  kind text not null,
  coverage text not null,
  completion_label text not null check (completion_label in ('adapted_full_work', 'adapted_partial')),
  counts_as_work_completion boolean not null,
  source_identity_sha256 text not null,
  source_text_sha256 text not null,
  policy_sha256 text not null,
  target_sha256 text not null,
  edition_sha256 text not null,
  activities_sha256 text not null,
  review_ids uuid[] not null check (pg_catalog.cardinality(review_ids) > 0),
  review_sha256s text[] not null,
  title text not null,
  hook_text text not null,
  unit_count integer not null check (unit_count > 0),
  target_cefr text,
  published_by uuid not null,
  published_at timestamptz not null default pg_catalog.now(),
  withdrawn_at timestamptz,
  withdrawn_by uuid,
  withdraw_reason text,
  constraint releases_withdraw_fields check (
    (withdrawn_at is null) = (withdrawn_by is null) and (withdrawn_at is null) = (withdraw_reason is null)),
  constraint releases_completion check ((completion_label = 'adapted_full_work') = counts_as_work_completion)
);
-- 같은 판본 자리에 살아 있는 발행본은 하나 — 동시 발행 경합의 최종 방어.
create unique index releases_one_live_per_slot on story.releases (slot_id) where withdrawn_at is null;

-- 학습자 본문은 메타데이터 JSON 이 아니라 이 표의 text 열에만 있다. 읽기는 story_read_unit(살아 있는 발행본)뿐이다.
create table story.release_units (
  release_id uuid not null references story.releases (id) on delete restrict,
  unit_index integer not null check (unit_index >= 0),
  unit_id text not null,
  unit_title text,
  body text not null check (body <> ''),
  primary key (release_id, unit_index)
);

-- 진도는 발행본별이다. 다른 판본 · 발행본으로 승계하지 않고, 숙달 · FSRS 표를 건드리지 않는다.
create table story.reading_progress (
  user_id uuid not null,
  release_id uuid not null references story.releases (id) on delete restrict,
  furthest_unit_index integer not null check (furthest_unit_index >= 0),
  completed_at timestamptz,
  first_read_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  primary key (user_id, release_id)
);

create table story.action_log (
  id bigint generated always as identity primary key,
  action text not null,
  actor uuid not null,
  target_id uuid,
  detail jsonb not null default '{}'::jsonb,
  at timestamptz not null default pg_catalog.now()
);

create index edition_versions_slot_seq on story.edition_versions (slot_id, seq desc);
create index reviews_version on story.reviews (edition_version_id);
create index rights_decisions_source_asset on story.rights_decisions (source_id, asset, seq desc);
create index reading_progress_release on story.reading_progress (release_id);

-- ── 4. 불변 · 철회 · 진도 가드 ──────────────────────────────────────────────────

create function story.forbid_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, pg_temp
as $fn$
begin
  raise exception 'story:immutable_row' using detail = tg_table_name || ' ' || tg_op;
end
$fn$;

create function story.guard_release_update()
returns trigger
language plpgsql
set search_path = pg_catalog, pg_temp
as $fn$
begin
  if tg_op <> 'UPDATE' then
    raise exception 'story:immutable_row' using detail = 'releases ' || tg_op;
  end if;
  if old.withdrawn_at is not null then
    raise exception 'story:already_withdrawn';
  end if;
  if new.withdrawn_at is null
     or (pg_catalog.to_jsonb(new) - array['withdrawn_at', 'withdrawn_by', 'withdraw_reason'])
        is distinct from (pg_catalog.to_jsonb(old) - array['withdrawn_at', 'withdrawn_by', 'withdraw_reason']) then
    raise exception 'story:release_content_immutable';
  end if;
  return new;
end
$fn$;

create function story.guard_progress_update()
returns trigger
language plpgsql
set search_path = pg_catalog, pg_temp
as $fn$
begin
  if tg_op = 'DELETE' then
    raise exception 'story:immutable_row' using detail = 'reading_progress DELETE';
  end if;
  if new.user_id is distinct from old.user_id or new.release_id is distinct from old.release_id
     or new.first_read_at is distinct from old.first_read_at
     or new.furthest_unit_index < old.furthest_unit_index
     or (old.completed_at is not null and new.completed_at is distinct from old.completed_at) then
    raise exception 'story:progress_regression';
  end if;
  return new;
end
$fn$;

create trigger sources_immutable before update or delete on story.sources for each row execute function story.forbid_mutation();
create trigger policies_immutable before update or delete on story.policies for each row execute function story.forbid_mutation();
create trigger edition_slots_immutable before update or delete on story.edition_slots for each row execute function story.forbid_mutation();
create trigger edition_versions_immutable before update or delete on story.edition_versions for each row execute function story.forbid_mutation();
create trigger reviews_immutable before update or delete on story.reviews for each row execute function story.forbid_mutation();
create trigger rights_decisions_immutable before update or delete on story.rights_decisions for each row execute function story.forbid_mutation();
create trigger release_units_immutable before update or delete on story.release_units for each row execute function story.forbid_mutation();
create trigger action_log_immutable before update or delete on story.action_log for each row execute function story.forbid_mutation();
create trigger releases_guard before update or delete on story.releases for each row execute function story.guard_release_update();
create trigger reading_progress_guard before update or delete on story.reading_progress for each row execute function story.guard_progress_update();

create trigger sources_no_truncate before truncate on story.sources for each statement execute function story.forbid_mutation();
create trigger policies_no_truncate before truncate on story.policies for each statement execute function story.forbid_mutation();
create trigger edition_slots_no_truncate before truncate on story.edition_slots for each statement execute function story.forbid_mutation();
create trigger edition_versions_no_truncate before truncate on story.edition_versions for each statement execute function story.forbid_mutation();
create trigger reviews_no_truncate before truncate on story.reviews for each statement execute function story.forbid_mutation();
create trigger rights_decisions_no_truncate before truncate on story.rights_decisions for each statement execute function story.forbid_mutation();
create trigger releases_no_truncate before truncate on story.releases for each statement execute function story.forbid_mutation();
create trigger release_units_no_truncate before truncate on story.release_units for each statement execute function story.forbid_mutation();
create trigger reading_progress_no_truncate before truncate on story.reading_progress for each statement execute function story.forbid_mutation();
create trigger action_log_no_truncate before truncate on story.action_log for each statement execute function story.forbid_mutation();

-- ── 5. 직접 접근 차단 ──────────────────────────────────────────────────────────

alter table story.sources enable row level security;
alter table story.policies enable row level security;
alter table story.edition_slots enable row level security;
alter table story.edition_versions enable row level security;
alter table story.reviews enable row level security;
alter table story.rights_decisions enable row level security;
alter table story.releases enable row level security;
alter table story.release_units enable row level security;
alter table story.reading_progress enable row level security;
alter table story.action_log enable row level security;

revoke all on all tables in schema story from public, anon, authenticated, service_role;
revoke all on all sequences in schema story from public, anon, authenticated, service_role;
revoke all on all functions in schema story from public, anon, authenticated, service_role;

-- ── 6. 관리 RPC ────────────────────────────────────────────────────────────────

create function public.story_admin_register_source(p_snapshot jsonb)
returns table (source_id uuid, identity_sha256 text, text_sha256 text, created boolean)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $fn$
declare
  v_actor uuid := story.require_staff('curator');
  v_text text;
  v_sha text;
  v_identity text;
  v_existing uuid;
  v_kind text;
  v_lb_id uuid;
  v_lb_source text;
  v_lb_source_id text;
  v_lb_status text;
  v_corr text := 'not_library_book';
  v_rights jsonb := p_snapshot -> 'rights';
  v_id uuid;
begin
  if p_snapshot ->> 'schema' is distinct from 'lcp-story/source-snapshot@1' then
    raise exception 'story:snapshot_schema';
  end if;
  if (p_snapshot -> 'synthetic') is distinct from 'false'::jsonb then
    raise exception 'story:synthetic_not_allowed';
  end if;
  if p_snapshot ->> 'normalization' is distinct from 'story-text-v1' then
    raise exception 'story:normalization';
  end if;
  v_text := p_snapshot ->> 'text';
  if v_text is null or v_text = '' then
    raise exception 'story:text_missing';
  end if;
  v_sha := story.sha256_hex(v_text);
  if v_sha is distinct from p_snapshot ->> 'text_sha256' then
    raise exception 'story:text_hash_mismatch';
  end if;
  if pg_catalog.jsonb_typeof(v_rights) is distinct from 'array'
     or (select count(*) from pg_catalog.jsonb_array_elements(v_rights) r where r ->> 'asset' = 'source_text') <> 1
     or (select count(*) from pg_catalog.jsonb_array_elements(v_rights) r)
        <> (select count(distinct r ->> 'asset') from pg_catalog.jsonb_array_elements(v_rights) r) then
    raise exception 'story:rights_claims_invalid';
  end if;

  v_identity := story.canonical_sha256(story.source_identity(p_snapshot, v_sha));
  select s.id into v_existing from story.sources s where s.identity_sha256 = v_identity;
  if found then
    return query select v_existing, v_identity, v_sha, false;
    return;
  end if;

  v_kind := p_snapshot #>> '{edition,source_kind}';
  if v_kind = 'library_book' then
    begin
      v_lb_id := (p_snapshot #>> '{edition,library_book_id}')::uuid;
    exception when invalid_text_representation then
      raise exception 'story:library_book_id_invalid';
    end;
    select lb.source, lb.source_id, lb.status into v_lb_source, v_lb_source_id, v_lb_status
      from public.library_books lb where lb.id = v_lb_id;
    if not found then
      raise exception 'story:library_book_not_found';
    end if;
    if v_lb_source is distinct from p_snapshot #>> '{edition,source}'
       or v_lb_source_id is distinct from p_snapshot #>> '{edition,source_id}' then
      raise exception 'story:library_book_mismatch';
    end if;
    v_corr := 'library_book_id_source_match';
  elsif v_kind = 'external_file' then
    if p_snapshot #>> '{edition,library_book_id}' is not null then
      raise exception 'story:library_book_id_unexpected';
    end if;
  else
    raise exception 'story:source_kind_not_allowed' using detail = coalesce(v_kind, 'null');
  end if;

  insert into story.sources (snapshot_id, work_key, snapshot_meta, body, text_sha256, identity_sha256, original_language,
                             text_language, translator, coverage, paragraph_count, library_book_id, correspondence,
                             correspondence_library_status, registered_by)
  values (p_snapshot ->> 'snapshot_id', p_snapshot #>> '{work,work_key}', p_snapshot - 'text' - 'text_sha256', v_text, v_sha,
          v_identity, p_snapshot #>> '{work,original_language}', p_snapshot #>> '{edition,text_language}',
          p_snapshot #>> '{edition,translator}', p_snapshot ->> 'coverage',
          pg_catalog.array_length(pg_catalog.string_to_array(v_text, E'\n\n'), 1), v_lb_id, v_corr, v_lb_status, v_actor)
  returning id into v_id;
  insert into story.action_log (action, actor, target_id, detail)
  values ('register_source', v_actor, v_id, pg_catalog.jsonb_build_object('identity_sha256', v_identity, 'correspondence', v_corr));
  return query select v_id, v_identity, v_sha, true;
end
$fn$;

create function public.story_admin_register_policy(p_source_id uuid, p_policy jsonb)
returns table (policy_id uuid, policy_sha256 text, slot_id uuid, edition_key text, target_sha256 text, created boolean)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $fn$
declare
  v_actor uuid := story.require_staff('curator');
  v_source story.sources;
  v_core text;
  v_full text;
  v_policy_id uuid;
  v_item jsonb;
  v_last integer;
begin
  select * into v_source from story.sources s where s.id = p_source_id;
  if not found then
    raise exception 'story:source_not_found';
  end if;
  if p_policy ->> 'schema' is distinct from 'lcp-story/editorial-policy@1' then
    raise exception 'story:policy_schema';
  end if;
  if p_policy ->> 'source_sha256' is distinct from v_source.text_sha256 then
    raise exception 'story:policy_source_stale';
  end if;
  if p_policy ->> 'work_key' is distinct from v_source.work_key then
    raise exception 'story:work_key_mismatch';
  end if;
  if pg_catalog.jsonb_typeof(p_policy -> 'production') is distinct from 'array'
     or pg_catalog.jsonb_array_length(p_policy -> 'production') = 0 then
    raise exception 'story:production_missing';
  end if;
  if (select count(*) from pg_catalog.jsonb_array_elements(p_policy -> 'production') i)
     <> (select count(distinct i ->> 'edition_key') from pg_catalog.jsonb_array_elements(p_policy -> 'production') i) then
    raise exception 'story:duplicate_edition_key';
  end if;

  v_core := story.canonical_sha256(p_policy - 'production');
  v_full := story.canonical_sha256(p_policy);
  select p.id into v_policy_id from story.policies p where p.source_id = p_source_id and p.policy_full_sha256 = v_full;
  if found then
    return query select v_policy_id, v_core, es.id, es.edition_key, es.target_sha256, false
      from story.edition_slots es where es.policy_id = v_policy_id order by es.edition_key;
    return;
  end if;

  for v_item in select i from pg_catalog.jsonb_array_elements(p_policy -> 'production') as i loop
    if v_item ->> 'transformation' = 'renarration' then
      raise exception 'story:renarration_excluded';
    end if;
    v_last := (v_item #>> '{scope,last_paragraph}')::integer;
    if v_last is null or (v_item #>> '{scope,first_paragraph}') is null
       or (v_item #>> '{scope,first_paragraph}')::integer < 0
       or (v_item #>> '{scope,first_paragraph}')::integer > v_last
       or v_last > v_source.paragraph_count - 1 then
      raise exception 'story:scope_invalid' using detail = v_item ->> 'edition_key';
    end if;
    if v_item ->> 'coverage' = 'complete_work'
       and (v_source.coverage <> 'complete_work' or (v_item #>> '{scope,first_paragraph}')::integer <> 0
            or v_last <> v_source.paragraph_count - 1) then
      raise exception 'story:coverage_claim_invalid' using detail = v_item ->> 'edition_key';
    end if;
  end loop;

  insert into story.policies (source_id, policy, policy_sha256, policy_full_sha256, registered_by)
  values (p_source_id, p_policy, v_core, v_full, v_actor)
  returning id into v_policy_id;
  insert into story.edition_slots (policy_id, source_id, work_key, edition_key, kind, transformation, coverage, production,
                                   target_sha256)
  select v_policy_id, p_source_id, v_source.work_key, i ->> 'edition_key', i ->> 'kind', i ->> 'transformation',
         i ->> 'coverage', i, story.canonical_sha256(i)
    from pg_catalog.jsonb_array_elements(p_policy -> 'production') as i;
  insert into story.action_log (action, actor, target_id, detail)
  values ('register_policy', v_actor, v_policy_id, pg_catalog.jsonb_build_object('policy_sha256', v_core));
  return query select v_policy_id, v_core, es.id, es.edition_key, es.target_sha256, true
    from story.edition_slots es where es.policy_id = v_policy_id order by es.edition_key;
end
$fn$;

create function public.story_admin_submit_edition(p_slot_id uuid, p_artifact jsonb)
returns table (edition_version_id uuid, edition_sha256 text, activities_sha256 text, created boolean)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $fn$
declare
  v_actor uuid := story.require_staff('curator');
  v_slot story.edition_slots;
  v_source story.sources;
  v_policy story.policies;
  v_expected jsonb;
  v_edition text;
  v_activities text;
  v_existing uuid;
  v_id uuid;
begin
  select * into v_slot from story.edition_slots es where es.id = p_slot_id;
  if not found then
    raise exception 'story:slot_not_found';
  end if;
  select * into v_source from story.sources s where s.id = v_slot.source_id;
  select * into v_policy from story.policies p where p.id = v_slot.policy_id;
  if p_artifact ->> 'schema' is distinct from 'lcp-story/edition@1' then
    raise exception 'story:edition_schema';
  end if;
  if p_artifact ->> 'edition_key' is distinct from v_slot.edition_key or p_artifact ->> 'kind' is distinct from v_slot.kind then
    raise exception 'story:edition_slot_mismatch';
  end if;
  v_expected := pg_catalog.jsonb_build_object(
    'source_sha256', v_source.text_sha256,
    'source_identity_sha256', v_source.identity_sha256,
    'policy_sha256', v_policy.policy_sha256,
    'target_sha256', v_slot.target_sha256);
  if (p_artifact -> 'binding') is distinct from v_expected then
    raise exception 'story:edition_binding_stale';
  end if;
  if p_artifact #>> '{produced_by,provenance}' is distinct from 'ai_generated'
     and p_artifact #>> '{produced_by,provenance}' is distinct from 'human_authored' then
    raise exception 'story:producer_provenance';
  end if;
  if coalesce(p_artifact #>> '{produced_by,session_id}', '') = '' then
    raise exception 'story:producer_session_missing';
  end if;
  if pg_catalog.jsonb_typeof(p_artifact -> 'units') is distinct from 'array'
     or pg_catalog.jsonb_array_length(p_artifact -> 'units') = 0
     or exists (select 1 from pg_catalog.jsonb_array_elements(p_artifact -> 'units') u
                where coalesce(pg_catalog.btrim(u ->> 'text'), '') = '')
     or pg_catalog.jsonb_typeof(p_artifact -> 'activities') is distinct from 'array'
     or pg_catalog.jsonb_typeof(p_artifact -> 'assets') is distinct from 'array'
     or coalesce(pg_catalog.btrim(p_artifact ->> 'title'), '') = ''
     or coalesce(pg_catalog.btrim(p_artifact #>> '{hook,text}'), '') = '' then
    raise exception 'story:edition_incomplete';
  end if;

  v_edition := story.canonical_sha256(p_artifact - 'activities');
  v_activities := story.canonical_sha256(p_artifact -> 'activities');
  select ev.id into v_existing from story.edition_versions ev
   where ev.slot_id = p_slot_id and ev.edition_sha256 = v_edition and ev.activities_sha256 = v_activities;
  if found then
    return query select v_existing, v_edition, v_activities, false;
    return;
  end if;
  insert into story.edition_versions (slot_id, artifact, edition_sha256, activities_sha256, unit_count, has_assets,
                                      producer_claim, submitted_by)
  values (p_slot_id, p_artifact, v_edition, v_activities, pg_catalog.jsonb_array_length(p_artifact -> 'units'),
          pg_catalog.jsonb_array_length(p_artifact -> 'assets') > 0, p_artifact -> 'produced_by', v_actor)
  returning id into v_id;
  insert into story.action_log (action, actor, target_id, detail)
  values ('submit_edition', v_actor, v_id, pg_catalog.jsonb_build_object('edition_sha256', v_edition));
  return query select v_id, v_edition, v_activities, true;
end
$fn$;

create function public.story_admin_submit_review(p_edition_version_id uuid, p_review jsonb)
returns table (review_id uuid, review_sha256 text, qualifies boolean, created boolean)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $fn$
declare
  v_actor uuid := story.require_staff('curator');
  v_version story.edition_versions;
  v_slot story.edition_slots;
  v_source story.sources;
  v_policy story.policies;
  v_binding jsonb;
  v_required text[];
  v_verdict text := p_review ->> 'verdict';
  v_qualifies boolean;
  v_sha text;
  v_existing uuid;
  v_id uuid;
begin
  select * into v_version from story.edition_versions ev where ev.id = p_edition_version_id;
  if not found then
    raise exception 'story:edition_version_not_found';
  end if;
  if v_version.submitted_by = v_actor then
    raise exception 'story:self_review';
  end if;
  select * into v_slot from story.edition_slots es where es.id = v_version.slot_id;
  select * into v_source from story.sources s where s.id = v_slot.source_id;
  select * into v_policy from story.policies p where p.id = v_slot.policy_id;
  if p_review ->> 'schema' is distinct from 'lcp-story/review@1' then
    raise exception 'story:review_schema';
  end if;
  if coalesce(p_review ->> 'provenance', '') not in ('ai_review', 'human_review') then
    raise exception 'story:review_provenance';
  end if;
  if (p_review ->> 'provenance' = 'human_review') is distinct from (p_review #>> '{reviewer,kind}' = 'human') then
    raise exception 'story:review_provenance';
  end if;
  if coalesce(p_review #>> '{reviewer,session_id}', '') = ''
     or p_review #>> '{reviewer,session_id}' = v_version.producer_claim ->> 'session_id' then
    raise exception 'story:self_review_claim';
  end if;
  v_binding := pg_catalog.jsonb_build_object(
    'task_id', v_version.artifact ->> 'task_id',
    'edition_key', v_slot.edition_key,
    'source_sha256', v_source.text_sha256,
    'source_identity_sha256', v_source.identity_sha256,
    'policy_sha256', v_policy.policy_sha256,
    'target_sha256', v_slot.target_sha256,
    'edition_sha256', v_version.edition_sha256,
    'activities_sha256', v_version.activities_sha256);
  if (p_review -> 'binding') is distinct from v_binding then
    raise exception 'story:review_binding_mismatch';
  end if;
  if coalesce(v_verdict, '') not in ('approve', 'changes_requested', 'hold', 'reject')
     or pg_catalog.jsonb_typeof(p_review -> 'checks') is distinct from 'array'
     or pg_catalog.jsonb_typeof(p_review -> 'issues') is distinct from 'array' then
    raise exception 'story:review_incomplete';
  end if;
  if (p_review ->> 'reviewed_at')::timestamptz > pg_catalog.now() then
    raise exception 'story:time_in_future';
  end if;
  if exists (select 1 from pg_catalog.jsonb_array_elements(p_review -> 'issues') i
             where i ->> 'severity' = 'critical' and i ->> 'status' = 'accepted_risk') then
    raise exception 'story:critical_issue_accepted';
  end if;
  if v_verdict = 'approve' and (
       exists (select 1 from pg_catalog.jsonb_array_elements(p_review -> 'checks') c where c ->> 'verdict' in ('fail', 'hold'))
       or exists (select 1 from pg_catalog.jsonb_array_elements(p_review -> 'issues') i
                  where i ->> 'severity' = 'critical' and i ->> 'status' = 'open')) then
    raise exception 'story:review_inconsistent';
  end if;

  v_required := story.required_checks(v_version.artifact);
  v_qualifies := v_verdict = 'approve'
    and not exists (
      select 1 from pg_catalog.unnest(v_required) as req(check_id)
       where not exists (select 1 from pg_catalog.jsonb_array_elements(p_review -> 'checks') c
                          where c ->> 'check' = req.check_id and c ->> 'verdict' = 'pass'))
    and not exists (select 1 from pg_catalog.jsonb_array_elements(p_review -> 'issues') i
                     where i ->> 'status' = 'open' and i ->> 'severity' in ('critical', 'major'));

  v_sha := story.canonical_sha256(p_review);
  select r.id into v_existing from story.reviews r where r.edition_version_id = p_edition_version_id and r.review_sha256 = v_sha;
  if found then
    return query select v_existing, v_sha, v_qualifies, false;
    return;
  end if;
  insert into story.reviews (edition_version_id, review, review_sha256, binding_sha256, verdict, qualifies, reviewer_claim,
                             submitted_by)
  values (p_edition_version_id, p_review, v_sha, story.canonical_sha256(v_binding), v_verdict, v_qualifies,
          p_review -> 'reviewer', v_actor)
  returning id into v_id;
  insert into story.action_log (action, actor, target_id, detail)
  values ('submit_review', v_actor, v_id, pg_catalog.jsonb_build_object('verdict', v_verdict, 'qualifies', v_qualifies));
  return query select v_id, v_sha, v_qualifies, true;
end
$fn$;

create function public.story_admin_record_rights(
  p_source_id uuid, p_asset text, p_status text, p_basis text, p_evidence_ref text)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $fn$
declare
  v_actor uuid := story.require_staff('admin');
  v_id uuid;
begin
  if not exists (select 1 from story.sources s where s.id = p_source_id) then
    raise exception 'story:source_not_found';
  end if;
  insert into story.rights_decisions (source_id, asset, status, basis, evidence_ref, decided_by)
  values (p_source_id, p_asset, p_status, p_basis, p_evidence_ref, v_actor)
  returning id into v_id;
  insert into story.action_log (action, actor, target_id, detail)
  values ('record_rights', v_actor, v_id, pg_catalog.jsonb_build_object('asset', p_asset, 'status', p_status));
  return v_id;
end
$fn$;

create function public.story_admin_publish(p_edition_version_id uuid)
returns table (release_id uuid, release_key text)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $fn$
declare
  v_actor uuid := story.require_staff('admin');
  v_version story.edition_versions;
  v_slot story.edition_slots;
  v_source story.sources;
  v_policy story.policies;
  v_latest uuid;
  v_review_ids uuid[];
  v_review_shas text[];
  v_identity jsonb;
  v_key text;
  v_full boolean;
  v_id uuid;
  v_asset text;
  v_status text;
begin
  select * into v_version from story.edition_versions ev where ev.id = p_edition_version_id;
  if not found then
    raise exception 'story:edition_version_not_found';
  end if;
  -- 같은 자리의 발행 · 철회를 한 줄로 세운다.
  select * into v_slot from story.edition_slots es where es.id = v_version.slot_id for update;
  select * into v_source from story.sources s where s.id = v_slot.source_id;
  select * into v_policy from story.policies p where p.id = v_slot.policy_id;

  select ev.id into v_latest from story.edition_versions ev where ev.slot_id = v_slot.id order by ev.seq desc limit 1;
  if v_latest is distinct from v_version.id then
    raise exception 'story:not_latest_version';
  end if;
  if v_version.submitted_by = v_actor then
    raise exception 'story:publisher_is_producer';
  end if;
  if v_version.has_assets then
    raise exception 'story:assets_not_supported';
  end if;
  if (v_source.snapshot_meta -> 'synthetic') is distinct from 'false'::jsonb
     or v_version.producer_claim ->> 'provenance' = 'synthetic_fixture' then
    raise exception 'story:synthetic_not_allowed';
  end if;

  -- 본문을 이루는 권리: 원문 + (번역본이거나 번역 권리를 주장했으면) 번역. 인증된 결정 중 최신만 본다.
  for v_asset in
    select 'source_text'
    union all
    select 'translation'
     where v_source.original_language <> v_source.text_language
        or exists (select 1 from pg_catalog.jsonb_array_elements(v_source.snapshot_meta -> 'rights') r
                    where r ->> 'asset' = 'translation')
  loop
    select rd.status into v_status from story.rights_decisions rd
     where rd.source_id = v_source.id and rd.asset = v_asset order by rd.seq desc limit 1;
    if v_status is distinct from 'confirmed' then
      raise exception 'story:rights_unconfirmed' using detail = v_asset || ':' || coalesce(v_status, 'missing');
    end if;
    v_status := null;
  end loop;

  if not exists (select 1 from story.reviews r where r.edition_version_id = v_version.id) then
    raise exception 'story:review_missing';
  end if;
  if exists (select 1 from story.reviews r where r.edition_version_id = v_version.id and not r.qualifies) then
    raise exception 'story:review_not_qualifying';
  end if;
  if exists (select 1 from story.releases rl where rl.slot_id = v_slot.id and rl.withdrawn_at is null) then
    raise exception 'story:live_release_exists';
  end if;

  select pg_catalog.array_agg(r.id order by r.review_sha256 collate "C"),
         pg_catalog.array_agg(r.review_sha256 order by r.review_sha256 collate "C")
    into v_review_ids, v_review_shas
    from story.reviews r where r.edition_version_id = v_version.id;

  -- S2 plan.ts decideEdition 의 발행 키 정체와 같다.
  v_identity := pg_catalog.jsonb_build_object(
    'work_key', v_source.work_key,
    'edition_key', v_slot.edition_key,
    'source_identity_sha256', v_source.identity_sha256,
    'source_text_sha256', v_source.text_sha256,
    'policy_sha256', v_policy.policy_sha256,
    'target_sha256', v_slot.target_sha256,
    'edition_sha256', v_version.edition_sha256,
    'activities_sha256', v_version.activities_sha256,
    'review_sha256s', pg_catalog.to_jsonb(v_review_shas),
    'quality_contract', 'lcp-story/quality@1');
  v_key := 'lsr_' || pg_catalog.left(story.canonical_sha256(v_identity), 32);
  if exists (select 1 from story.releases rl where rl.release_key = v_key) then
    raise exception 'story:release_key_exists' using detail = v_key;
  end if;
  v_full := v_slot.coverage = 'complete_work' and v_source.coverage = 'complete_work';

  insert into story.releases (release_key, slot_id, edition_version_id, source_id, work_key, edition_key, kind, coverage,
                              completion_label, counts_as_work_completion, source_identity_sha256, source_text_sha256,
                              policy_sha256, target_sha256, edition_sha256, activities_sha256, review_ids, review_sha256s,
                              title, hook_text, unit_count, target_cefr, published_by)
  values (v_key, v_slot.id, v_version.id, v_source.id, v_source.work_key, v_slot.edition_key, v_slot.kind, v_slot.coverage,
          case when v_full then 'adapted_full_work' else 'adapted_partial' end, v_full, v_source.identity_sha256,
          v_source.text_sha256, v_policy.policy_sha256, v_slot.target_sha256, v_version.edition_sha256,
          v_version.activities_sha256, v_review_ids, v_review_shas, v_version.artifact ->> 'title',
          v_version.artifact #>> '{hook,text}', v_version.unit_count, v_slot.production #>> '{target,language,cefr}', v_actor)
  returning id into v_id;
  insert into story.release_units (release_id, unit_index, unit_id, unit_title, body)
  select v_id, (u.i - 1)::integer, u.e ->> 'unit_id', u.e ->> 'title', u.e ->> 'text'
    from pg_catalog.jsonb_array_elements(v_version.artifact -> 'units') with ordinality as u(e, i);
  insert into story.action_log (action, actor, target_id, detail)
  values ('publish', v_actor, v_id, pg_catalog.jsonb_build_object('release_key', v_key));
  return query select v_id, v_key;
end
$fn$;

create function public.story_admin_withdraw(p_release_key text, p_reason text)
returns table (release_key text, withdrawn_at timestamptz, changed boolean)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $fn$
declare
  v_actor uuid := story.require_staff('admin');
  v_release story.releases;
begin
  if coalesce(pg_catalog.btrim(p_reason), '') = '' then
    raise exception 'story:withdraw_reason_required';
  end if;
  select * into v_release from story.releases rl where rl.release_key = p_release_key for update;
  if not found then
    raise exception 'story:release_not_found';
  end if;
  if v_release.withdrawn_at is not null then
    return query select v_release.release_key, v_release.withdrawn_at, false;
    return;
  end if;
  update story.releases rl
     set withdrawn_at = pg_catalog.now(), withdrawn_by = v_actor, withdraw_reason = p_reason
   where rl.id = v_release.id;
  insert into story.action_log (action, actor, target_id, detail)
  values ('withdraw', v_actor, v_release.id, pg_catalog.jsonb_build_object('release_key', v_release.release_key));
  return query select rl.release_key, rl.withdrawn_at, true from story.releases rl where rl.id = v_release.id;
end
$fn$;

create function public.story_admin_list_slots()
returns table (slot_id uuid, work_key text, edition_key text, kind text, coverage text, source_id uuid, policy_id uuid,
               latest_version_id uuid, version_count bigint, review_count bigint, qualifying_review_count bigint,
               live_release_key text, withdrawn_release_count bigint)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $fn$
begin
  perform story.require_staff('curator');
  return query
  select es.id, es.work_key, es.edition_key, es.kind, es.coverage, es.source_id, es.policy_id,
         (select ev.id from story.edition_versions ev where ev.slot_id = es.id order by ev.seq desc limit 1),
         (select count(*) from story.edition_versions ev where ev.slot_id = es.id),
         (select count(*) from story.reviews r join story.edition_versions ev on ev.id = r.edition_version_id
           where ev.slot_id = es.id),
         (select count(*) from story.reviews r join story.edition_versions ev on ev.id = r.edition_version_id
           where ev.slot_id = es.id and r.qualifies),
         (select rl.release_key from story.releases rl where rl.slot_id = es.id and rl.withdrawn_at is null),
         (select count(*) from story.releases rl where rl.slot_id = es.id and rl.withdrawn_at is not null)
    from story.edition_slots es
   order by es.work_key, es.edition_key;
end
$fn$;

create function public.story_admin_get_bundle(p_edition_version_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $fn$
declare
  v_version story.edition_versions;
  v_slot story.edition_slots;
begin
  perform story.require_staff('curator');
  select * into v_version from story.edition_versions ev where ev.id = p_edition_version_id;
  if not found then
    raise exception 'story:edition_version_not_found';
  end if;
  select * into v_slot from story.edition_slots es where es.id = v_version.slot_id;
  return pg_catalog.jsonb_build_object(
    'source', (select pg_catalog.jsonb_build_object('id', s.id, 'meta', s.snapshot_meta, 'body', s.body,
                 'text_sha256', s.text_sha256, 'identity_sha256', s.identity_sha256, 'correspondence', s.correspondence,
                 'library_book_id', s.library_book_id, 'registered_by', s.registered_by, 'registered_at', s.registered_at)
                 from story.sources s where s.id = v_slot.source_id),
    'policy', (select pg_catalog.jsonb_build_object('id', p.id, 'policy', p.policy, 'policy_sha256', p.policy_sha256)
                 from story.policies p where p.id = v_slot.policy_id),
    'slot', pg_catalog.jsonb_build_object('id', v_slot.id, 'edition_key', v_slot.edition_key, 'production', v_slot.production,
              'target_sha256', v_slot.target_sha256),
    'version', pg_catalog.jsonb_build_object('id', v_version.id, 'artifact', v_version.artifact,
              'edition_sha256', v_version.edition_sha256, 'activities_sha256', v_version.activities_sha256,
              'submitted_by', v_version.submitted_by, 'submitted_at', v_version.submitted_at,
              'is_latest', v_version.id = (select ev.id from story.edition_versions ev where ev.slot_id = v_slot.id
                                            order by ev.seq desc limit 1)),
    'reviews', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', r.id, 'review', r.review,
                 'review_sha256', r.review_sha256, 'verdict', r.verdict, 'qualifies', r.qualifies,
                 'submitted_by', r.submitted_by, 'submitted_at', r.submitted_at) order by r.submitted_at)
                 from story.reviews r where r.edition_version_id = v_version.id), '[]'::jsonb),
    'rights', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('asset', d.asset, 'status', d.status,
                 'basis', d.basis, 'evidence_ref', d.evidence_ref, 'decided_by', d.decided_by, 'decided_at', d.decided_at)
                 order by d.asset)
                 from (select distinct on (rd.asset) rd.* from story.rights_decisions rd
                        where rd.source_id = v_slot.source_id order by rd.asset, rd.seq desc) d), '[]'::jsonb),
    'releases', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('release_key', rl.release_key,
                 'published_at', rl.published_at, 'withdrawn_at', rl.withdrawn_at) order by rl.published_at)
                 from story.releases rl where rl.slot_id = v_slot.id), '[]'::jsonb));
end
$fn$;

-- ── 7. 학습자 RPC ──────────────────────────────────────────────────────────────

-- 서가(로그인 없이도): 살아 있는 발행본의 메타 · 진입 장면만. 본문 단위는 없다.
create function public.story_catalog()
returns table (release_key text, work_key text, edition_key text, kind text, coverage text, completion_label text,
               title text, hook_text text, unit_count integer, target_cefr text, published_at timestamptz)
language sql
stable
security definer
set search_path = pg_catalog, pg_temp
as $fn$
  select rl.release_key, rl.work_key, rl.edition_key, rl.kind, rl.coverage, rl.completion_label, rl.title, rl.hook_text,
         rl.unit_count, rl.target_cefr, rl.published_at
    from story.releases rl
   where rl.withdrawn_at is null
   order by rl.work_key, rl.edition_key
$fn$;

create function public.story_read_unit(p_release_key text, p_unit_index integer)
returns table (release_key text, unit_index integer, unit_count integer, unit_title text, unit_text text)
language plpgsql
stable
security definer
set search_path = pg_catalog, pg_temp
as $fn$
declare
  v_release story.releases;
begin
  perform story.require_learner();
  select * into v_release from story.releases rl where rl.release_key = p_release_key and rl.withdrawn_at is null;
  if not found then
    raise exception 'story:release_unavailable';
  end if;
  return query
  select v_release.release_key, ru.unit_index, v_release.unit_count, ru.unit_title, ru.body
    from story.release_units ru where ru.release_id = v_release.id and ru.unit_index = p_unit_index;
  if not found then
    raise exception 'story:unit_not_found';
  end if;
end
$fn$;

create function public.story_record_progress(p_release_key text, p_unit_index integer)
returns table (release_key text, furthest_unit_index integer, unit_count integer, completed boolean, completion_label text)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $fn$
declare
  v_user uuid := story.require_learner();
  v_release story.releases;
begin
  select * into v_release from story.releases rl where rl.release_key = p_release_key and rl.withdrawn_at is null;
  if not found then
    raise exception 'story:release_unavailable';
  end if;
  if p_unit_index is null or p_unit_index < 0 or p_unit_index >= v_release.unit_count then
    raise exception 'story:unit_not_found';
  end if;
  insert into story.reading_progress as rp (user_id, release_id, furthest_unit_index, completed_at)
  values (v_user, v_release.id, p_unit_index,
          case when p_unit_index = v_release.unit_count - 1 then pg_catalog.now() end)
  on conflict (user_id, release_id) do update
     set furthest_unit_index = greatest(rp.furthest_unit_index, excluded.furthest_unit_index),
         completed_at = coalesce(rp.completed_at, excluded.completed_at),
         updated_at = pg_catalog.now();
  return query
  select v_release.release_key, rp.furthest_unit_index, v_release.unit_count, rp.completed_at is not null,
         v_release.completion_label
    from story.reading_progress rp where rp.user_id = v_user and rp.release_id = v_release.id;
end
$fn$;

-- 내 진도: 철회된 발행본도 이력으로 남는다(본문 없이 release_available = false). 원문 완독으로 세지 않는다.
create function public.story_my_progress()
returns table (release_key text, work_key text, edition_key text, completion_label text, counts_as_work_completion boolean,
               counts_as_original_text_completion boolean, furthest_unit_index integer, unit_count integer,
               completed_at timestamptz, release_available boolean)
language plpgsql
stable
security definer
set search_path = pg_catalog, pg_temp
as $fn$
declare
  v_user uuid := story.require_learner();
begin
  return query
  select rl.release_key, rl.work_key, rl.edition_key, rl.completion_label, rl.counts_as_work_completion, false,
         rp.furthest_unit_index, rl.unit_count, rp.completed_at, rl.withdrawn_at is null
    from story.reading_progress rp join story.releases rl on rl.id = rp.release_id
   where rp.user_id = v_user
   order by rp.updated_at desc;
end
$fn$;

-- ── 8. 실행 권한 ───────────────────────────────────────────────────────────────

revoke all on function public.story_admin_register_source(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.story_admin_register_policy(uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.story_admin_submit_edition(uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.story_admin_submit_review(uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.story_admin_record_rights(uuid, text, text, text, text) from public, anon, authenticated, service_role;
revoke all on function public.story_admin_publish(uuid) from public, anon, authenticated, service_role;
revoke all on function public.story_admin_withdraw(text, text) from public, anon, authenticated, service_role;
revoke all on function public.story_admin_list_slots() from public, anon, authenticated, service_role;
revoke all on function public.story_admin_get_bundle(uuid) from public, anon, authenticated, service_role;
revoke all on function public.story_catalog() from public, anon, authenticated, service_role;
revoke all on function public.story_read_unit(text, integer) from public, anon, authenticated, service_role;
revoke all on function public.story_record_progress(text, integer) from public, anon, authenticated, service_role;
revoke all on function public.story_my_progress() from public, anon, authenticated, service_role;

grant execute on function public.story_admin_register_source(jsonb) to authenticated;
grant execute on function public.story_admin_register_policy(uuid, jsonb) to authenticated;
grant execute on function public.story_admin_submit_edition(uuid, jsonb) to authenticated;
grant execute on function public.story_admin_submit_review(uuid, jsonb) to authenticated;
grant execute on function public.story_admin_record_rights(uuid, text, text, text, text) to authenticated;
grant execute on function public.story_admin_publish(uuid) to authenticated;
grant execute on function public.story_admin_withdraw(text, text) to authenticated;
grant execute on function public.story_admin_list_slots() to authenticated;
grant execute on function public.story_admin_get_bundle(uuid) to authenticated;
grant execute on function public.story_catalog() to anon, authenticated;
grant execute on function public.story_read_unit(text, integer) to authenticated;
grant execute on function public.story_record_progress(text, integer) to authenticated;
grant execute on function public.story_my_progress() to authenticated;
