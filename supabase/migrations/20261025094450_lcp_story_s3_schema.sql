-- supabase/migrations/_pending_lcp_story_s3_schema.sql
-- ⚠️ 보류(적용 안 함) — LCP Story S3. 공유 DB 적용은 별도 사용자 대화 승인(L4) 뒤 승인형 배포 러너
--    (main-serving 의 scripts/db/lcp-story-s3/deploy.mjs apply --stage schema --confirm-sha <이 파일 SHA-256>)로만 한다.
--    격리 임시 DB(PGlite · 임시 PostgreSQL 클러스터) 시험에서만 실행했다.
-- ⚠️ 트랜잭션: 이 파일에는 BEGIN/COMMIT 이 없다. 승인형 러너가 이 단계 본문 전체와 원장(supabase_migrations) 행을 한 트랜잭션으로
--    감싸 적용하고, 실패하면 전부 되돌린다. 이 파일을 psql · SQL 편집기 · MCP 도구 등으로 공유 DB 에 단독 실행하는 것은 금지다
--    (중간 실패 시 일부 객체만 남을 수 있고, 원장 · 승인 기록이 남지 않는다).
--
-- 무엇: 이야기 판본 라인(계약 정본 docs/LCP_STORY.md §8–§15 와 이 파일)의 격리 저장소. 기존 원본 도서 테이블 · 함수 · 정책 · 행을 하나도 바꾸지 않는다.
--   · 새 스키마 story(PostgREST 비노출) 표 12 — 원천 스냅숏 · 편집 기준 · 판본 자리 · 판본 판 · 검수 · 검증 증명 · 권리 결정 · 발행본 ·
--     발행 단위 본문 · 발행본별 읽기 진도 · 단위 완료 기록 · 작업 기록. 모든 표 RLS 켜짐 + 정책 없음 + anon/authenticated/service_role 권한 없음.
--   · 문은 public.story_* RPC 16개뿐(SECURITY DEFINER, search_path = pg_catalog, pg_temp — 표 · 함수는 모두 스키마를 붙여 부른다):
--     관리 9(authenticated · 내부에서 auth.uid() 의 user_profiles 역할 + status='active' 확인) · 검증 증인 2(service_role 만) ·
--     학습자 5(서가 story_catalog = anon + authenticated · 나머지 authenticated).
--   · 행위자: 관리 RPC 는 auth.uid() 로만 판단한다 — service_role(사용자 없음)은 관리 행위자가 아니다. 호출자가 보낸 생산자 · 검수자 · 권리 값은
--     「주장」으로만 저장한다. DB 가 강제하는 분리는 정확히 이것이다:
--       검수 계정 ≠ 판본 제출 계정(그리고 검수자 세션 주장 ≠ 생산자 세션 주장) · 발행자 = admin 이고 판본 제출 계정이 아니다 ·
--       권리 결정 · 철회 = admin. 검수자와 발행 admin 은 같은 계정이어도 된다 — 실제 발행에 필요한 인증 계정은 최소 2개
--       (예: curator 제출 + admin 검수 · 발행)다. 세 사람(생산자 · 검수자 · 발행자 모두 다름)을 요구하지 않는다.
--     live 감사(2026-10-25, docs/lcp-story/S3_DB_AUDIT.md)는 active admin 1 · curator 0 을 보았다 — 실제 발행 전에 두 번째 인증 스태프 계정이
--     실제로 있어야 한다. 이 마이그레이션은 역할을 만들거나 부여하지 않으며, 로컬 AI 세션 id 는 스태프 계정이 아니다(주장일 뿐이다).
--   · 검증 증인: DB 는 S2 구조 검증(앵커의 UTF-16 구간 · 인용 · 정렬 누락 · 보존 요소 · 변경 기록 · 진입 장면 · 요청 활동 등)을 SQL 로
--     다시 구현하지 않는다(아래 판본 제출 검사는 방어용 일부일 뿐 S2 검증이 아니다). 대신 발행은 백엔드 서비스 주체(service_role)만 쓸 수 있는
--     검증 증명(story.validation_attestations)이 지금 저장된 원천 · 정체 · 기준 · 목표 · 판본 · 활동 · 검수 해시 묶음에 결속돼 있을 때만 된다.
--     증명은 S2 어댑터(packages/library-pipeline/src/story/attest.ts)가 story_service_validation_input 이 돌려준 저장값 그대로를 S2 검증기로 검사한 뒤
--     story_service_attest_validation 으로 쓰고, DB 가 결속을 다시 계산해 대조한다. 두 증인 RPC 는 EXECUTE 가 service_role 에만 있고,
--     그에 더해 JWT 역할 주장(request.jwt.claims->>'role' 또는 request.jwt.claim.role)이 반드시 있고 모두 service_role 이어야 한다 —
--     PostgREST 의 service_role 요청만 통과한다. authenticated · curator · admin 과, 주장이 없는 소유자 · SQL 편집기 · MCP SQL 세션은 증명을 쓸 수 없다.
--     어댑터가 없는 배포는 발행이 막힌다(fail closed). 서비스 주체는 증인일 뿐 생산자 · 검수자 · 권리 결정자 · 발행자로 기록되지 않는다
--     (action_log actor_kind='service_validator', actor 없음). 초안 · 검수 저장은 증명 없이 된다(학습자에게 보이지 않는다).
--     신뢰 경계: 증명은 「service_role 자격 증명을 가진 주체가 S2 통과를 주장했다」는 신뢰된 증인 기록이지, S2 가 실제로 실행됐다는 암호학적 증거가 아니다.
--     증명의 검증기 판은 story.current_validator() 이고 발행은 그 판의 증명만 받는다 — S2 규칙을 강화하면 어댑터와 이 함수의 contract 를 함께 올리는
--     새 승인 마이그레이션으로 옛 증명 전부를 무효로 만든다. validated_at 은 DB 시계 + 30초까지 받는다(백엔드 시계는 DB 와 30초 안으로 맞춘다).
--   · 해시: 본문 해시 · 원천 판본 정체 해시 · 기준/목표/판본/활동/검수/검증 결속 해시 · release_key 를 DB 가 S2(packages/library-pipeline/src/story)와
--     같은 정본 직렬화(키 UTF-16=ASCII 순 정렬 · 배열 순서 보존 · JSON.stringify 와 같은 문자열 이스케이프 · 정수만)로 다시 계산한다.
--   · 발행 조건: 최신 판(판본 자리 잠금을 쥔 채 계산한 max(seq)) · 그 판의 검수 전부 적격 · 발행자 admin ≠ 판본 제출자 · 원문(+번역) 권리 최신 결정
--     confirmed · 자산 없음 · 합성 아님 · 같은 원천 · 같은 판본 키(source_id, edition_key)의 살아 있는 발행본 없음(기준을 다시 등록해 판본 자리가
--     둘이 돼도 하나뿐) · 현재 결속 + 현재 검증기 판의 검증 증명 있음. 발행본 행 · 단위 본문은 불변, 철회는 철회 칸만 한 번 채운다.
--   · 권리: 발행본 「이용 가능」 = 철회되지 않음 AND story.source_rights_ok(원천) — 필요 권리(source_text, 그리고 번역본이거나 스냅숏이 translation 권리를
--     주장하면 translation)의 최신 인증 결정이 모두 confirmed. 서가 · 본문 · 위치 · 완료 · 내 진도 · 발행이 모두 이 판정을 쓴다. 나중의 hold · rejected 는
--     발행본 행을 바꾸지 않고 즉시 열람을 닫으며(이력 보존) 다시 confirmed 면 열린다. 쓰지 않는 오디오 · 삽화 권리는 본문을 막지 않는다.
--   · 진도: 위치(story_record_position — 이동만, 단위 완료 · 발행본 완료를 만들지 않는다)와 단위 완료(story_complete_unit — 학습자의 명시적 표시)를 나눈다.
--     발행본 완료(completed_at)는 0..unit_count-1 모든 단위에 완료 기록이 있을 때 한 번만 찍힌다 — 마지막 단위로 건너뛰어도 완료가 아니다.
--     진도는 발행본별이고 원문 완독 · 숙달 · FSRS 로 세지 않으며 다른 판본 · 발행본으로 승계하지 않는다(원본 texts · 학습 표를 쓰지 않는다).
--     보존: S3 에는 Story 진도 · 단위 완료 행을 지우는 경로가 없다(DELETE 는 트리거가 막는다). 계정 삭제 처리는 이 범위 밖이며
--     별도로 승인된 설계가 필요하다.
--   · 잠금 순서(관리 · 증인 변경 RPC — register_policy · submit_edition · submit_review · record_rights · publish · withdraw ·
--     service_attest_validation): story.sources 행 → story.edition_slots 행 → story.releases 행(FOR UPDATE). register_source 는 잠글 기존 행이 없고
--     (같은 정체의 동시 등록은 on conflict 로 created=false), 학습자 RPC(record_position · complete_unit)는 자기 진도 행과 FK KEY SHARE 만 잡는다.
--     권리 결정은 원천 잠금을 쥐므로 발행과 한 줄로 선다. 자연 키가 있는 등록(원천 · 기준 · 판 · 검수 · 증명 · 단위 완료)은 재호출 · 동시 호출에
--     같은 행을 created=false 로 돌려준다. 발행 · 검증 증명은 READ COMMITTED(PostgREST 기본)에서만 실행된다 — 잠금을 얻은 뒤의 문장마다
--     새 스냅숏으로 최신 판 · 검수 · 권리를 읽기 위해서다.
--
-- 영향: 기존 행 0 · 기존 객체 변경 0(새 스키마 1 · 새 표 12 · 새 함수 · 트리거 · 인덱스만). public.library_books 는 읽기만 한다
--   (library_book 원천의 대응 확인). 원본 표에 FK 를 걸지 않아 원본 도서 삭제 · 재처리 동작을 막지 않는다.
-- 전제: PostgreSQL 13+(IS NFC NORMALIZED · gen_random_uuid · sha256), auth.uid(), public.user_profiles(user_id, role, status),
--   public.library_books(id, source, source_id, status), 역할 anon · authenticated · service_role. 스키마 story · public.story_* 함수가 없어야 한다.
-- 되돌리기: 파괴 없이 _pending_lcp_story_s3_quarantine.sql(public.story_* RPC 16개 실행 권한 회수 — 표 · 이력 보존).
--   다시 여는 단계는 러너에 없다 — 다시 열려면 새 SQL 파일 + 새 러너 단계 + 새 사용자 승인이 필요하다.

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
comment on schema story is 'LCP Story 격리 저장소 — 직접 접근 없음, public.story_* RPC 만 문이다(docs/LCP_STORY.md §15).';
-- 클라이언트 역할(PUBLIC · anon · authenticated · service_role)에 스키마 USAGE · CREATE 를 주지 않는다. 표 · 시퀀스 · 내부 함수 회수는 5절.
revoke all on schema story from public, anon, authenticated, service_role;

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

-- ── 2. 행위자 · 실행 조건 ─────────────────────────────────────────────────────

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

-- 검증 증인 = 백엔드 서비스 주체(PostgREST 의 service_role 요청). 1차 문은 EXECUTE 권한(service_role 만)이고, 이것이 둘째 문이다:
-- JWT 역할 주장(request.jwt.claims->>'role' 또는 옛 GUC request.jwt.claim.role)이 하나 이상 반드시 있고, 있는 것은 모두 정확히 'service_role'
-- 이어야 한다. 주장이 없는 세션(소유자 · SQL 편집기 · MCP SQL), JSON 객체가 아닌 claims, 다른 역할, 두 주장이 서로 다른 경우는 모두 거부한다.
create function story.require_service_validator()
returns void
language plpgsql
stable
set search_path = pg_catalog, pg_temp
as $fn$
declare
  v_claim text := nullif(pg_catalog.current_setting('request.jwt.claim.role', true), '');
  v_claims text := nullif(pg_catalog.current_setting('request.jwt.claims', true), '');
  v_claims_json jsonb;
  v_claims_role text;
begin
  if v_claims is not null then
    begin
      v_claims_json := v_claims::jsonb;
    exception when others then
      raise exception 'story:service_role_required' using errcode = '42501', detail = 'unreadable request.jwt.claims';
    end;
    if pg_catalog.jsonb_typeof(v_claims_json) is distinct from 'object' then
      raise exception 'story:service_role_required' using errcode = '42501', detail = 'request.jwt.claims is not an object';
    end if;
    if v_claims_json ? 'role' then
      if pg_catalog.jsonb_typeof(v_claims_json -> 'role') is distinct from 'string' then
        raise exception 'story:service_role_required' using errcode = '42501', detail = 'role claim is not a string';
      end if;
      v_claims_role := v_claims_json ->> 'role';
    end if;
  end if;
  if v_claim is null and v_claims_role is null then
    raise exception 'story:service_role_required' using errcode = '42501', detail = 'no role claim';
  end if;
  if (v_claim is not null and v_claim is distinct from 'service_role')
     or (v_claims_role is not null and v_claims_role is distinct from 'service_role') then
    raise exception 'story:service_role_required' using errcode = '42501';
  end if;
end
$fn$;

-- 지금 발행을 허가하는 S2 검증기 판. 증명 기록(같아야 저장)과 발행(이 판의 증명만 인정)이 함께 쓴다.
-- S2 규칙을 강화하면 어댑터(packages/library-pipeline/src/story/attest.ts)와 이 값을 함께 올리는 새 승인 마이그레이션으로 옛 증명을 무효로 한다.
create function story.current_validator()
returns jsonb
language sql
immutable
set search_path = pg_catalog, pg_temp
as $fn$
  select '{"name": "lcp-story-s2", "contract": "lcp-story/s2@1"}'::jsonb
$fn$;

-- 발행 · 검증 증명은 잠금을 얻은 뒤 문장마다 새 스냅숏으로 최신 판 · 검수 · 권리를 읽어야 한다. REPEATABLE READ · SERIALIZABLE 에서는
-- 잠금 전 스냅숏으로 옛 상태를 읽을 수 있으므로 거부한다(PostgREST 기본은 READ COMMITTED).
create function story.require_read_committed()
returns void
language plpgsql
stable
set search_path = pg_catalog, pg_temp
as $fn$
begin
  if pg_catalog.current_setting('transaction_isolation') is distinct from 'read committed' then
    raise exception 'story:read_committed_required' using detail = pg_catalog.current_setting('transaction_isolation');
  end if;
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
  identity_sha256 text not null check (identity_sha256 ~ '^[0-9a-f]{64}$'),
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
  constraint sources_identity_sha256_key unique (identity_sha256),
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
comment on table story.edition_versions is '판본 판(초안 포함). 저장은 S2 검증 통과를 뜻하지 않는다 — 발행은 검증 증명이 따로 있어야 한다.';

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

-- 백엔드 검증 증인(service_role)만 쓰는 S2 검증 증명. 결속 = 지금 저장된 원천 · 정체 · 기준 · 목표 · 판본 · 활동 · 검수 해시 전부.
create table story.validation_attestations (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  edition_version_id uuid not null references story.edition_versions (id) on delete restrict,
  binding jsonb not null,
  binding_sha256 text not null check (binding_sha256 ~ '^[0-9a-f]{64}$'),
  -- 증명을 쓴 S2 검증기 판(story.current_validator() 의 그때 값). 발행은 지금 판과 같은 행만 인정한다.
  validator jsonb not null,
  attestation jsonb not null,
  attested_at timestamptz not null default pg_catalog.now(),
  -- null 안전 비교: attestation 에 validator 키가 없으면(null) 통과하지 않는다.
  constraint validation_attestations_validator check (validator is not distinct from (attestation -> 'validator')),
  constraint validation_attestations_version_binding_validator_key unique (edition_version_id, binding_sha256, validator)
);
comment on table story.validation_attestations is
  'S2 검증 증명 — story_service_attest_validation(service_role)만 쓴다. 관리자 · 사용자 행위가 아니며 사람 검수의 증거도 아니다.';

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
comment on table story.rights_decisions is
  '인증된 관리자(admin)의 권리 결정(추가만). 스냅숏의 권리 「주장」과 별개이며 발행 · 열람 게이트는 자산별 최신(seq) 결정만 본다.';

create table story.releases (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  release_key text not null unique check (release_key ~ '^lsr_[0-9a-f]{32}$'),
  slot_id uuid not null references story.edition_slots (id) on delete restrict,
  edition_version_id uuid not null references story.edition_versions (id) on delete restrict,
  source_id uuid not null references story.sources (id) on delete restrict,
  validation_attestation_id uuid not null references story.validation_attestations (id) on delete restrict,
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
-- 같은 원천 · 같은 판본 키에 살아 있는 발행본은 하나 — 기준을 다시 등록해 자리가 여럿이어도 마찬가지(자리 하나 = 원천 하나 + 판본 키 하나라
-- 자리 기준 유일성도 함께 성립한다). 발행의 원천 잠금 아래 검사(story:live_release_exists)가 1차, 이 색인이 동시 경합의 최종 방어다.
create unique index releases_one_live_per_source_edition on story.releases (source_id, edition_key) where withdrawn_at is null;
comment on table story.releases is
  '발행본(불변). 학습자 이용 가능 = withdrawn_at 없음 AND story.source_rights_ok(source_id) — 권리 보류는 행을 바꾸지 않고 열람을 닫는다.';

-- 학습자 본문은 메타데이터 JSON 이 아니라 이 표의 text 열에만 있다. 읽기는 story_read_unit(이용 가능한 발행본)뿐이다.
create table story.release_units (
  release_id uuid not null references story.releases (id) on delete restrict,
  unit_index integer not null check (unit_index >= 0),
  unit_id text not null,
  unit_title text,
  body text not null check (body <> ''),
  primary key (release_id, unit_index)
);

-- 진도는 발행본별이다. 위치(last · furthest)는 이동 기록일 뿐 완료가 아니다. 다른 판본 · 발행본으로 승계하지 않고, 숙달 · FSRS 표를 건드리지 않는다.
create table story.reading_progress (
  user_id uuid not null,
  release_id uuid not null references story.releases (id) on delete restrict,
  last_unit_index integer not null check (last_unit_index >= 0),
  furthest_unit_index integer not null check (furthest_unit_index >= 0),
  completed_unit_count integer not null default 0 check (completed_unit_count >= 0),
  completed_at timestamptz,
  first_read_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint reading_progress_pkey primary key (user_id, release_id),
  constraint reading_progress_position check (furthest_unit_index >= last_unit_index)
);

-- 학습자가 명시적으로 「이 단위를 읽었다」고 표시한 기록(추가만). 발행본 완료는 모든 단위의 기록이 있을 때만이다.
create table story.reading_unit_completions (
  user_id uuid not null,
  release_id uuid not null,
  unit_index integer not null check (unit_index >= 0),
  completed_at timestamptz not null default pg_catalog.now(),
  constraint reading_unit_completions_pkey primary key (user_id, release_id, unit_index),
  constraint reading_unit_completions_progress foreign key (user_id, release_id)
    references story.reading_progress (user_id, release_id) on delete restrict,
  constraint reading_unit_completions_unit foreign key (release_id, unit_index)
    references story.release_units (release_id, unit_index) on delete restrict
);

create table story.action_log (
  id bigint generated always as identity primary key,
  action text not null,
  actor_kind text not null default 'user' check (actor_kind in ('user', 'service_validator')),
  actor uuid,
  target_id uuid,
  detail jsonb not null default '{}'::jsonb,
  at timestamptz not null default pg_catalog.now(),
  -- 사용자 행위는 인증된 행위자가 있고, 검증 증인(service_validator)은 사람 · 계정 행위자로 기록하지 않는다.
  constraint action_log_actor check ((actor_kind = 'user') = (actor is not null))
);

create index edition_versions_slot_seq on story.edition_versions (slot_id, seq desc);
create index reviews_version on story.reviews (edition_version_id);
create index rights_decisions_source_asset on story.rights_decisions (source_id, asset, seq desc);
create index reading_progress_release on story.reading_progress (release_id);

-- ── 4. 불변 · 철회 · 진도 가드, 권리 · 결속 판정 ─────────────────────────────────

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

-- 진도 가드: 새 행은 완료 0 으로만 시작한다. 키 · 처음 읽은 시각 불변, furthest · completed_unit_count 는 줄지 않고,
-- completed_unit_count 는 실제 단위 완료 기록 수와 같아야 하며, completed_at 은 모든 단위 완료 기록이 있을 때 한 번만 찍힌다.
create function story.guard_progress()
returns trigger
language plpgsql
set search_path = pg_catalog, pg_temp
as $fn$
declare
  v_done integer;
  v_units integer;
begin
  if tg_op = 'DELETE' then
    raise exception 'story:immutable_row' using detail = 'reading_progress DELETE';
  end if;
  if tg_op = 'INSERT' then
    if new.completed_unit_count <> 0 or new.completed_at is not null then
      raise exception 'story:progress_invalid';
    end if;
    return new;
  end if;
  if new.user_id is distinct from old.user_id or new.release_id is distinct from old.release_id
     or new.first_read_at is distinct from old.first_read_at
     or new.furthest_unit_index < old.furthest_unit_index
     or new.completed_unit_count < old.completed_unit_count
     or (old.completed_at is not null and new.completed_at is distinct from old.completed_at) then
    raise exception 'story:progress_regression';
  end if;
  if new.completed_unit_count is distinct from old.completed_unit_count
     or (new.completed_at is not null and old.completed_at is null) then
    select pg_catalog.count(*)::integer into v_done from story.reading_unit_completions c
     where c.user_id = new.user_id and c.release_id = new.release_id;
    if new.completed_unit_count <> v_done then
      raise exception 'story:progress_count_mismatch';
    end if;
    if new.completed_at is not null and old.completed_at is null then
      select rl.unit_count into v_units from story.releases rl where rl.id = new.release_id;
      if v_done is distinct from v_units then
        raise exception 'story:completion_incomplete';
      end if;
    end if;
  end if;
  return new;
end
$fn$;

-- 본문을 이루는 필요 권리와 자산별 최신 인증 결정(seq 순). 원문 + (번역본이거나 스냅숏이 번역 권리를 주장하면) 번역.
-- 쓰지 않는 오디오 · 삽화 결정은 여기 없다 — 본문을 막지 않는다. 결정이 없으면 status 는 null 이다.
create function story.required_rights(p_source_id uuid)
returns table (asset text, status text)
language sql
stable
set search_path = pg_catalog, pg_temp
as $fn$
  select req.asset, d.status
    from story.sources s
    cross join lateral (
      select 'source_text'::text as asset
      union all
      select 'translation'::text
       where s.original_language <> s.text_language
          or exists (select 1 from pg_catalog.jsonb_array_elements(s.snapshot_meta -> 'rights') as r
                      where r ->> 'asset' = 'translation')
    ) as req
    left join lateral (
      select rd.status from story.rights_decisions rd
       where rd.source_id = s.id and rd.asset = req.asset
       order by rd.seq desc
       limit 1
    ) as d on true
   where s.id = p_source_id
$fn$;

-- 지금 권리로 본문을 내보내도 되는가 — 필요 권리 전부의 최신 결정이 confirmed. 원천이 없으면 false.
create function story.source_rights_ok(p_source_id uuid)
returns boolean
language sql
stable
set search_path = pg_catalog, pg_temp
as $fn$
  select coalesce(pg_catalog.bool_and(rr.status is not distinct from 'confirmed'), false)
    from story.required_rights(p_source_id) as rr
$fn$;

-- 검증 증명 결속 — 저장된 값에서 DB 가 다시 계산한다(호출자 값을 쓰지 않는다). review_sha256s 는 그 판의 검수 전부, "C" 오름차순.
create function story.attestation_binding(p_edition_version_id uuid)
returns jsonb
language sql
stable
set search_path = pg_catalog, pg_temp
as $fn$
  select pg_catalog.jsonb_build_object(
           'source_sha256', s.text_sha256,
           'source_identity_sha256', s.identity_sha256,
           'policy_sha256', p.policy_sha256,
           'target_sha256', es.target_sha256,
           'edition_sha256', ev.edition_sha256,
           'activities_sha256', ev.activities_sha256,
           'review_sha256s', coalesce(
             (select pg_catalog.jsonb_agg(r.review_sha256 order by r.review_sha256 collate "C")
                from story.reviews r where r.edition_version_id = ev.id),
             '[]'::jsonb))
    from story.edition_versions ev
    join story.edition_slots es on es.id = ev.slot_id
    join story.sources s on s.id = es.source_id
    join story.policies p on p.id = es.policy_id
   where ev.id = p_edition_version_id
$fn$;

create trigger sources_immutable before update or delete on story.sources for each row execute function story.forbid_mutation();
create trigger policies_immutable before update or delete on story.policies for each row execute function story.forbid_mutation();
create trigger edition_slots_immutable before update or delete on story.edition_slots for each row execute function story.forbid_mutation();
create trigger edition_versions_immutable before update or delete on story.edition_versions for each row execute function story.forbid_mutation();
create trigger reviews_immutable before update or delete on story.reviews for each row execute function story.forbid_mutation();
create trigger validation_attestations_immutable before update or delete on story.validation_attestations for each row execute function story.forbid_mutation();
create trigger rights_decisions_immutable before update or delete on story.rights_decisions for each row execute function story.forbid_mutation();
create trigger release_units_immutable before update or delete on story.release_units for each row execute function story.forbid_mutation();
create trigger reading_unit_completions_immutable before update or delete on story.reading_unit_completions for each row execute function story.forbid_mutation();
create trigger action_log_immutable before update or delete on story.action_log for each row execute function story.forbid_mutation();
create trigger releases_guard before update or delete on story.releases for each row execute function story.guard_release_update();
create trigger reading_progress_guard before insert or update or delete on story.reading_progress for each row execute function story.guard_progress();

create trigger sources_no_truncate before truncate on story.sources for each statement execute function story.forbid_mutation();
create trigger policies_no_truncate before truncate on story.policies for each statement execute function story.forbid_mutation();
create trigger edition_slots_no_truncate before truncate on story.edition_slots for each statement execute function story.forbid_mutation();
create trigger edition_versions_no_truncate before truncate on story.edition_versions for each statement execute function story.forbid_mutation();
create trigger reviews_no_truncate before truncate on story.reviews for each statement execute function story.forbid_mutation();
create trigger validation_attestations_no_truncate before truncate on story.validation_attestations for each statement execute function story.forbid_mutation();
create trigger rights_decisions_no_truncate before truncate on story.rights_decisions for each statement execute function story.forbid_mutation();
create trigger releases_no_truncate before truncate on story.releases for each statement execute function story.forbid_mutation();
create trigger release_units_no_truncate before truncate on story.release_units for each statement execute function story.forbid_mutation();
create trigger reading_progress_no_truncate before truncate on story.reading_progress for each statement execute function story.forbid_mutation();
create trigger reading_unit_completions_no_truncate before truncate on story.reading_unit_completions for each statement execute function story.forbid_mutation();
create trigger action_log_no_truncate before truncate on story.action_log for each statement execute function story.forbid_mutation();

-- ── 5. 직접 접근 차단 ──────────────────────────────────────────────────────────

alter table story.sources enable row level security;
alter table story.policies enable row level security;
alter table story.edition_slots enable row level security;
alter table story.edition_versions enable row level security;
alter table story.reviews enable row level security;
alter table story.validation_attestations enable row level security;
alter table story.rights_decisions enable row level security;
alter table story.releases enable row level security;
alter table story.release_units enable row level security;
alter table story.reading_progress enable row level security;
alter table story.reading_unit_completions enable row level security;
alter table story.action_log enable row level security;

revoke all on all tables in schema story from public, anon, authenticated, service_role;
revoke all on all sequences in schema story from public, anon, authenticated, service_role;
revoke all on all functions in schema story from public, anon, authenticated, service_role;

-- ── 6. 관리 RPC(authenticated · 내부 역할 검사) ───────────────────────────────────

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

  -- 같은 정체의 동시 등록: 먼저 커밋한 쪽만 넣고, 다른 쪽은 23505 대신 그 행을 created=false 로 돌려준다.
  insert into story.sources as s (snapshot_id, work_key, snapshot_meta, body, text_sha256, identity_sha256, original_language,
                                  text_language, translator, coverage, paragraph_count, library_book_id, correspondence,
                                  correspondence_library_status, registered_by)
  values (p_snapshot ->> 'snapshot_id', p_snapshot #>> '{work,work_key}', p_snapshot - 'text' - 'text_sha256', v_text, v_sha,
          v_identity, p_snapshot #>> '{work,original_language}', p_snapshot #>> '{edition,text_language}',
          p_snapshot #>> '{edition,translator}', p_snapshot ->> 'coverage',
          pg_catalog.array_length(pg_catalog.string_to_array(v_text, E'\n\n'), 1), v_lb_id, v_corr, v_lb_status, v_actor)
  on conflict on constraint sources_identity_sha256_key do nothing
  returning s.id into v_id;
  if v_id is null then
    select s.id into v_existing from story.sources s where s.identity_sha256 = v_identity;
    if not found then
      raise exception 'story:source_not_found' using detail = v_identity;
    end if;
    return query select v_existing, v_identity, v_sha, false;
    return;
  end if;
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
  -- 잠금 순서 1: 원천.
  select * into v_source from story.sources s where s.id = p_source_id for update;
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

-- 판본 판 제출(초안 저장). 아래 형태 검사는 방어용 일부다 — S2 검증을 대신하지 않으며, 발행은 검증 증명이 따로 있어야 한다.
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
  -- 판본 자리 행은 불변이라 잠금 없이 원천 id 를 읽고, 잠금 순서(원천 → 판본 자리)대로 잠근다.
  select * into v_slot from story.edition_slots es where es.id = p_slot_id;
  if not found then
    raise exception 'story:slot_not_found';
  end if;
  select * into v_source from story.sources s where s.id = v_slot.source_id for update;
  select * into v_slot from story.edition_slots es where es.id = p_slot_id for update;
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
  -- 검수 계정 ≠ 판본 제출 계정.
  if v_version.submitted_by = v_actor then
    raise exception 'story:self_review';
  end if;
  -- 잠금 순서: 원천 → 판본 자리(발행 · 검증 증명과 한 줄로 선다).
  select * into v_slot from story.edition_slots es where es.id = v_version.slot_id;
  select * into v_source from story.sources s where s.id = v_slot.source_id for update;
  select * into v_slot from story.edition_slots es where es.id = v_version.slot_id for update;
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
  -- 검수자 세션 주장 ≠ 생산자 세션 주장.
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

-- 권리 결정(admin, 추가만). 원천 잠금을 쥐어 같은 원천의 발행과 한 줄로 선다. 보류 · 거부는 발행본 행을 바꾸지 않고
-- story.source_rights_ok 를 통해 서가 · 본문 · 진도를 즉시 닫는다.
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
  -- 잠금 순서 1: 원천.
  perform 1 from story.sources s where s.id = p_source_id for update;
  if not found then
    raise exception 'story:source_not_found';
  end if;
  insert into story.rights_decisions (source_id, asset, status, basis, evidence_ref, decided_by)
  values (p_source_id, p_asset, p_status, p_basis, p_evidence_ref, v_actor)
  returning id into v_id;
  insert into story.action_log (action, actor, target_id, detail)
  values ('record_rights', v_actor, v_id,
          pg_catalog.jsonb_build_object('source_id', p_source_id, 'asset', p_asset, 'status', p_status));
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
  v_binding jsonb;
  v_binding_sha text;
  v_attestation uuid;
  v_identity jsonb;
  v_key text;
  v_full boolean;
  v_id uuid;
begin
  perform story.require_read_committed();
  select * into v_version from story.edition_versions ev where ev.id = p_edition_version_id;
  if not found then
    raise exception 'story:edition_version_not_found';
  end if;
  -- 잠금 순서: 원천 → 판본 자리. 같은 원천의 권리 결정 · 같은 자리의 판 제출 · 검수 · 검증 증명 · 발행 · 철회가 한 줄로 선다.
  select * into v_slot from story.edition_slots es where es.id = v_version.slot_id;
  select * into v_source from story.sources s where s.id = v_slot.source_id for update;
  select * into v_slot from story.edition_slots es where es.id = v_version.slot_id for update;
  select * into v_policy from story.policies p where p.id = v_slot.policy_id;

  -- 현재 판 = 판본 자리 잠금을 쥔 채 계산한 max(seq).
  select ev.id into v_latest from story.edition_versions ev where ev.slot_id = v_slot.id order by ev.seq desc limit 1;
  if v_latest is distinct from v_version.id then
    raise exception 'story:not_latest_version';
  end if;
  -- 발행자 = admin(require_staff) 이고 판본 제출 계정이 아니다. 검수 계정과는 같아도 된다.
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

  -- 본문을 이루는 권리(원문 + 필요하면 번역)의 최신 인증 결정이 모두 confirmed — 열람 게이트와 같은 판정.
  if not story.source_rights_ok(v_source.id) then
    raise exception 'story:rights_unconfirmed' using detail = (
      select pg_catalog.string_agg(rr.asset || ':' || coalesce(rr.status, 'missing'), ',' order by rr.asset)
        from story.required_rights(v_source.id) as rr);
  end if;

  if not exists (select 1 from story.reviews r where r.edition_version_id = v_version.id) then
    raise exception 'story:review_missing';
  end if;
  if exists (select 1 from story.reviews r where r.edition_version_id = v_version.id and not r.qualifies) then
    raise exception 'story:review_not_qualifying';
  end if;
  -- 같은 원천 · 같은 판본 키의 살아 있는 발행본은 하나(다른 기준 등록으로 생긴 다른 자리 포함). 원천 잠금 아래라 같은 원천의 발행끼리 한 줄로 선다.
  if exists (select 1 from story.releases rl
              where rl.source_id = v_source.id and rl.edition_key = v_slot.edition_key and rl.withdrawn_at is null) then
    raise exception 'story:live_release_exists';
  end if;

  -- 검증 증명: 지금 저장값에서 다시 계산한 결속 + 현재 검증기 판(story.current_validator())의 증명이 있어야 한다.
  -- 증명 뒤에 검수가 더해지면 결속이 바뀌어 다시 증명해야 하고, 검증기 판이 오르면 옛 증명은 발행을 허가하지 않는다.
  -- 백엔드 검증 증인이 없는 배포는 여기서 막힌다(fail closed).
  v_binding := story.attestation_binding(v_version.id);
  v_binding_sha := story.canonical_sha256(v_binding);
  select va.id into v_attestation from story.validation_attestations va
   where va.edition_version_id = v_version.id and va.binding_sha256 = v_binding_sha
     and va.validator = story.current_validator();
  if not found then
    raise exception 'story:validation_attestation_missing' using detail = v_binding_sha;
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

  insert into story.releases (release_key, slot_id, edition_version_id, source_id, validation_attestation_id, work_key,
                              edition_key, kind, coverage, completion_label, counts_as_work_completion,
                              source_identity_sha256, source_text_sha256, policy_sha256, target_sha256, edition_sha256,
                              activities_sha256, review_ids, review_sha256s, title, hook_text, unit_count, target_cefr,
                              published_by)
  values (v_key, v_slot.id, v_version.id, v_source.id, v_attestation, v_source.work_key, v_slot.edition_key, v_slot.kind,
          v_slot.coverage, case when v_full then 'adapted_full_work' else 'adapted_partial' end, v_full,
          v_source.identity_sha256, v_source.text_sha256, v_policy.policy_sha256, v_slot.target_sha256,
          v_version.edition_sha256, v_version.activities_sha256, v_review_ids, v_review_shas, v_version.artifact ->> 'title',
          v_version.artifact #>> '{hook,text}', v_version.unit_count, v_slot.production #>> '{target,language,cefr}', v_actor)
  returning id into v_id;
  insert into story.release_units (release_id, unit_index, unit_id, unit_title, body)
  select v_id, (u.i - 1)::integer, u.e ->> 'unit_id', u.e ->> 'title', u.e ->> 'text'
    from pg_catalog.jsonb_array_elements(v_version.artifact -> 'units') with ordinality as u(e, i);
  insert into story.action_log (action, actor, target_id, detail)
  values ('publish', v_actor, v_id,
          pg_catalog.jsonb_build_object('release_key', v_key, 'validation_attestation_id', v_attestation,
                                        'binding_sha256', v_binding_sha));
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
  -- 잠금 없이 위치만 찾고(원천 · 자리 id 는 불변), 잠금 순서 원천 → 판본 자리 → 발행본으로 잠근 뒤 다시 읽는다.
  select * into v_release from story.releases rl where rl.release_key = p_release_key;
  if not found then
    raise exception 'story:release_not_found';
  end if;
  perform 1 from story.sources s where s.id = v_release.source_id for update;
  perform 1 from story.edition_slots es where es.id = v_release.slot_id for update;
  select * into v_release from story.releases rl where rl.id = v_release.id for update;
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
  v_binding jsonb;
  v_binding_sha text;
  v_rights_ok boolean;
begin
  perform story.require_staff('curator');
  select * into v_version from story.edition_versions ev where ev.id = p_edition_version_id;
  if not found then
    raise exception 'story:edition_version_not_found';
  end if;
  select * into v_slot from story.edition_slots es where es.id = v_version.slot_id;
  v_binding := story.attestation_binding(v_version.id);
  v_binding_sha := story.canonical_sha256(v_binding);
  v_rights_ok := story.source_rights_ok(v_slot.source_id);
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
    -- 검증 증명: 지금 결속과 그 결속에 대한 증명 존재 여부(관리자가 발행 전에 본다). 증명 내용은 백엔드 증인의 기록이다.
    'validation', pg_catalog.jsonb_build_object('binding', v_binding, 'binding_sha256', v_binding_sha,
                 'attested', exists (select 1 from story.validation_attestations va
                                      where va.edition_version_id = v_version.id and va.binding_sha256 = v_binding_sha
                                        and va.validator = story.current_validator())),
    'rights_ok', v_rights_ok,
    'rights', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('asset', d.asset, 'status', d.status,
                 'basis', d.basis, 'evidence_ref', d.evidence_ref, 'decided_by', d.decided_by, 'decided_at', d.decided_at)
                 order by d.asset)
                 from (select distinct on (rd.asset) rd.* from story.rights_decisions rd
                        where rd.source_id = v_slot.source_id order by rd.asset, rd.seq desc) d), '[]'::jsonb),
    'releases', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('release_key', rl.release_key,
                 'published_at', rl.published_at, 'withdrawn_at', rl.withdrawn_at,
                 'available', rl.withdrawn_at is null and v_rights_ok) order by rl.published_at)
                 from story.releases rl where rl.slot_id = v_slot.id), '[]'::jsonb));
end
$fn$;

-- ── 7. 검증 증인 RPC(service_role 만) ─────────────────────────────────────────

-- S2 어댑터가 검사할 「저장된 그대로」의 입력. 어댑터는 이 값만 검증하고(로컬 파일 · 호출자 값이 아니다) 결과를 증명으로 돌려준다.
create function public.story_service_validation_input(p_edition_version_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, pg_temp
as $fn$
declare
  v_version story.edition_versions;
  v_slot story.edition_slots;
begin
  perform story.require_service_validator();
  select * into v_version from story.edition_versions ev where ev.id = p_edition_version_id;
  if not found then
    raise exception 'story:edition_version_not_found';
  end if;
  select * into v_slot from story.edition_slots es where es.id = v_version.slot_id;
  return pg_catalog.jsonb_build_object(
    'edition_version_id', v_version.id,
    'edition_key', v_slot.edition_key,
    'snapshot', (select s.snapshot_meta || pg_catalog.jsonb_build_object('text', s.body, 'text_sha256', s.text_sha256)
                   from story.sources s where s.id = v_slot.source_id),
    'policy', (select p.policy from story.policies p where p.id = v_slot.policy_id),
    'artifact', v_version.artifact,
    'reviews', coalesce((select pg_catalog.jsonb_agg(r.review order by r.review_sha256 collate "C")
                           from story.reviews r where r.edition_version_id = v_version.id), '[]'::jsonb));
end
$fn$;

-- S2 검증 증명 기록. DB 가 결속을 다시 계산해 증명의 결속과 정확히 같을 때만 저장한다(같은 결속 재호출은 기존 행을 돌려준다).
-- 서비스 주체는 증인일 뿐이다 — 작업 기록은 actor_kind='service_validator', actor 없음.
create function public.story_service_attest_validation(p_edition_version_id uuid, p_attestation jsonb)
returns table (attestation_id uuid, binding_sha256 text, created boolean)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $fn$
declare
  v_version story.edition_versions;
  v_slot story.edition_slots;
  v_binding jsonb;
  v_sha text;
  v_keys text[];
  v_validated_at timestamptz;
  v_id uuid;
begin
  perform story.require_service_validator();
  perform story.require_read_committed();
  select * into v_version from story.edition_versions ev where ev.id = p_edition_version_id;
  if not found then
    raise exception 'story:edition_version_not_found';
  end if;
  -- 잠금 순서: 원천 → 판본 자리(검수 추가 · 발행과 한 줄로 선다).
  select * into v_slot from story.edition_slots es where es.id = v_version.slot_id;
  perform 1 from story.sources s where s.id = v_slot.source_id for update;
  perform 1 from story.edition_slots es where es.id = v_slot.id for update;

  v_binding := story.attestation_binding(v_version.id);
  if pg_catalog.jsonb_array_length(v_binding -> 'review_sha256s') = 0 then
    raise exception 'story:review_missing';
  end if;

  if pg_catalog.jsonb_typeof(p_attestation) is distinct from 'object' then
    raise exception 'story:attestation_invalid' using detail = 'not an object';
  end if;
  select pg_catalog.array_agg(k order by k collate "C") into v_keys from pg_catalog.jsonb_object_keys(p_attestation) as k;
  if v_keys is distinct from array['binding', 'checks', 'schema', 'validated_at', 'validator'] then
    raise exception 'story:attestation_invalid' using detail = 'keys';
  end if;
  if p_attestation ->> 'schema' is distinct from 'lcp-story/validation-attestation@1'
     or (p_attestation -> 'validator') is distinct from story.current_validator() then
    raise exception 'story:attestation_invalid' using detail = 'schema/validator';
  end if;
  if (p_attestation -> 'checks')
     is distinct from '{"snapshot": "valid", "policy": "valid", "edition": "valid", "reviews": "valid"}'::jsonb then
    raise exception 'story:attestation_invalid' using detail = 'checks';
  end if;
  if pg_catalog.jsonb_typeof(p_attestation -> 'validated_at') is distinct from 'string'
     or (p_attestation ->> 'validated_at')
        !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,9})?(Z|[+-][0-9]{2}:[0-9]{2})$' then
    raise exception 'story:attestation_invalid' using detail = 'validated_at';
  end if;
  begin
    v_validated_at := (p_attestation ->> 'validated_at')::timestamptz;
  exception when data_exception then
    raise exception 'story:attestation_invalid' using detail = 'validated_at';
  end;
  -- 백엔드 시계와 DB 시계의 허용 차이는 30초다(그보다 앞선 증명 시각은 거부).
  if v_validated_at > pg_catalog.clock_timestamp() + interval '30 seconds' then
    raise exception 'story:time_in_future';
  end if;
  if (p_attestation -> 'binding') is distinct from v_binding then
    raise exception 'story:attestation_binding_mismatch';
  end if;

  v_sha := story.canonical_sha256(v_binding);
  -- 유일 키는 (판, 결속, 검증기 판)이다 — 다른 검증기 판의 옛 행이 같은 결속을 쥐고 있어도 현재 판의 증명은 새 행으로 들어간다.
  insert into story.validation_attestations as va (edition_version_id, binding, binding_sha256, validator, attestation)
  values (v_version.id, v_binding, v_sha, story.current_validator(), p_attestation)
  on conflict on constraint validation_attestations_version_binding_validator_key do nothing
  returning va.id into v_id;
  if v_id is null then
    select va.id into v_id from story.validation_attestations va
     where va.edition_version_id = v_version.id and va.binding_sha256 = v_sha and va.validator = story.current_validator();
    return query select v_id, v_sha, false;
    return;
  end if;
  insert into story.action_log (action, actor_kind, actor, target_id, detail)
  values ('attest_validation', 'service_validator', null, v_id,
          pg_catalog.jsonb_build_object('edition_version_id', v_version.id, 'binding_sha256', v_sha,
                                        'validator', story.current_validator()));
  return query select v_id, v_sha, true;
end
$fn$;

-- ── 8. 학습자 RPC ──────────────────────────────────────────────────────────────
-- 「이용 가능」 = 철회되지 않음 AND story.source_rights_ok(원천). 권리가 나중에 보류 · 거부되면 아래 모두가 즉시 닫힌다.

-- 서가(로그인 없이도): 이용 가능한 발행본의 메타 · 진입 장면만. 본문 단위는 없다.
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
   where rl.withdrawn_at is null and story.source_rights_ok(rl.source_id)
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
  if not found or not story.source_rights_ok(v_release.source_id) then
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

-- 위치 기록(이동만): 마지막 위치 · 가장 먼 위치만 바꾼다. 단위 완료 · 발행본 완료를 만들지 않는다.
create function public.story_record_position(p_release_key text, p_unit_index integer)
returns table (release_key text, last_unit_index integer, furthest_unit_index integer, completed_unit_count integer,
               unit_count integer, completed boolean)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $fn$
declare
  v_user uuid := story.require_learner();
  v_release story.releases;
begin
  select * into v_release from story.releases rl where rl.release_key = p_release_key and rl.withdrawn_at is null;
  if not found or not story.source_rights_ok(v_release.source_id) then
    raise exception 'story:release_unavailable';
  end if;
  if p_unit_index is null or p_unit_index < 0 or p_unit_index >= v_release.unit_count then
    raise exception 'story:unit_not_found';
  end if;
  insert into story.reading_progress as rp (user_id, release_id, last_unit_index, furthest_unit_index)
  values (v_user, v_release.id, p_unit_index, p_unit_index)
  on conflict on constraint reading_progress_pkey do update
     set last_unit_index = excluded.last_unit_index,
         furthest_unit_index = greatest(rp.furthest_unit_index, excluded.furthest_unit_index),
         updated_at = pg_catalog.now();
  return query
  select v_release.release_key, rp.last_unit_index, rp.furthest_unit_index, rp.completed_unit_count, v_release.unit_count,
         rp.completed_at is not null
    from story.reading_progress rp where rp.user_id = v_user and rp.release_id = v_release.id;
end
$fn$;

-- 단위 완료(학습자의 명시적 표시 · 재호출 안전): 그 단위 하나만 완료로 기록하고 위치도 그 단위로 옮긴다.
-- 발행본 완료(completed_at)는 0..unit_count-1 모든 단위에 완료 기록이 있을 때 한 번만 찍힌다. completion_label 은 완료일 때만 뜻이 있다.
create function public.story_complete_unit(p_release_key text, p_unit_index integer)
returns table (release_key text, unit_index integer, completed_unit_count integer, unit_count integer, completed boolean,
               completion_label text)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $fn$
declare
  v_user uuid := story.require_learner();
  v_release story.releases;
  v_done integer;
  v_completed_at timestamptz;
begin
  select * into v_release from story.releases rl where rl.release_key = p_release_key and rl.withdrawn_at is null;
  if not found or not story.source_rights_ok(v_release.source_id) then
    raise exception 'story:release_unavailable';
  end if;
  if p_unit_index is null or p_unit_index < 0 or p_unit_index >= v_release.unit_count then
    raise exception 'story:unit_not_found';
  end if;
  -- 진도 행을 먼저 올려(그 학습자 · 발행본 행 잠금) 같은 학습자의 동시 완료 표시를 한 줄로 세운다.
  insert into story.reading_progress as rp (user_id, release_id, last_unit_index, furthest_unit_index)
  values (v_user, v_release.id, p_unit_index, p_unit_index)
  on conflict on constraint reading_progress_pkey do update
     set last_unit_index = excluded.last_unit_index,
         furthest_unit_index = greatest(rp.furthest_unit_index, excluded.furthest_unit_index),
         updated_at = pg_catalog.now();
  insert into story.reading_unit_completions as c (user_id, release_id, unit_index)
  values (v_user, v_release.id, p_unit_index)
  on conflict on constraint reading_unit_completions_pkey do nothing;
  select pg_catalog.count(*)::integer into v_done from story.reading_unit_completions c
   where c.user_id = v_user and c.release_id = v_release.id;
  update story.reading_progress rp
     set completed_unit_count = v_done,
         completed_at = coalesce(rp.completed_at, case when v_done = v_release.unit_count then pg_catalog.now() end),
         updated_at = pg_catalog.now()
   where rp.user_id = v_user and rp.release_id = v_release.id
  returning rp.completed_at into v_completed_at;
  return query select v_release.release_key, p_unit_index, v_done, v_release.unit_count, v_completed_at is not null,
                      v_release.completion_label;
end
$fn$;

-- 내 진도: 철회 · 권리 보류된 발행본도 이력으로 남는다(본문 없이 release_available = false). 원문 완독으로 세지 않는다.
create function public.story_my_progress()
returns table (release_key text, work_key text, edition_key text, completion_label text, counts_as_work_completion boolean,
               counts_as_original_text_completion boolean, last_unit_index integer, furthest_unit_index integer,
               completed_unit_count integer, unit_count integer, completed_at timestamptz, release_available boolean)
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
         rp.last_unit_index, rp.furthest_unit_index, rp.completed_unit_count, rl.unit_count, rp.completed_at,
         rl.withdrawn_at is null and story.source_rights_ok(rl.source_id)
    from story.reading_progress rp join story.releases rl on rl.id = rp.release_id
   where rp.user_id = v_user
   order by rp.updated_at desc;
end
$fn$;

-- ── 9. 실행 권한(16) ──────────────────────────────────────────────────────────
-- 관리 9 = authenticated(내부 역할 검사) · 검증 증인 2 = service_role 만 · 서가 = anon + authenticated · 학습 4 = authenticated.

revoke all on function public.story_admin_register_source(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.story_admin_register_policy(uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.story_admin_submit_edition(uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.story_admin_submit_review(uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.story_admin_record_rights(uuid, text, text, text, text) from public, anon, authenticated, service_role;
revoke all on function public.story_admin_publish(uuid) from public, anon, authenticated, service_role;
revoke all on function public.story_admin_withdraw(text, text) from public, anon, authenticated, service_role;
revoke all on function public.story_admin_list_slots() from public, anon, authenticated, service_role;
revoke all on function public.story_admin_get_bundle(uuid) from public, anon, authenticated, service_role;
revoke all on function public.story_service_validation_input(uuid) from public, anon, authenticated, service_role;
revoke all on function public.story_service_attest_validation(uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.story_catalog() from public, anon, authenticated, service_role;
revoke all on function public.story_read_unit(text, integer) from public, anon, authenticated, service_role;
revoke all on function public.story_record_position(text, integer) from public, anon, authenticated, service_role;
revoke all on function public.story_complete_unit(text, integer) from public, anon, authenticated, service_role;
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
grant execute on function public.story_service_validation_input(uuid) to service_role;
grant execute on function public.story_service_attest_validation(uuid, jsonb) to service_role;
grant execute on function public.story_catalog() to anon, authenticated;
grant execute on function public.story_read_unit(text, integer) to authenticated;
grant execute on function public.story_record_position(text, integer) to authenticated;
grant execute on function public.story_complete_unit(text, integer) to authenticated;
grant execute on function public.story_my_progress() to authenticated;
