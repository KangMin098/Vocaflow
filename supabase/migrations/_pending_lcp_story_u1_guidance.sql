-- supabase/migrations/_pending_lcp_story_u1_guidance.sql
-- ⚠️ 보류(적용 안 함) — LCP Story D2 U1(T-0187) forward SQL 제안. 공유 DB 적용은 SQL 전문 · 전체 SHA-256 · 영향 범위 ·
--    복구 SQL(_pending_lcp_story_u1_guidance_recovery.sql)을 대화에서 보이고 사용자가 개별 승인한 뒤
--    승인형 배포 러너 또는 Supabase MCP apply_migration 으로만 한다. 저장소 마이그레이션 파일 이름(타임스탬프)은 반영 때 정한다.
-- ⚠️ 트랜잭션: 이 파일에는 BEGIN/COMMIT 이 없다. 러너(또는 apply_migration)가 본문 전체를 한 트랜잭션으로 감싸 적용하고,
--    실패하면 전부 되돌린다. psql · SQL 편집기 등으로 공유 DB 에 단독 실행하지 않는다. READ COMMITTED 에서만 적용한다.
--    tripwire: 첫 문장 `set local lcp_story_u1.in_txn = 'on'` 을 A · C 의 DO 가 확인한다(자동 커밋 실행이면 A 에서 실패 — 아무것도 만들지 않는다).
--
-- 무엇(하나 · 기존 행 0 변경 · 기존 함수 · 표 · 정책 변경 0):
--   B. 공개 읽기 RPC public.story_release_guidance(p_release_key text default null)
--        returns table (release_key, target_cefr, cognitive_demand, background_load, cautions jsonb).
--      anon · authenticated 실행(서가 story_catalog 와 같은 공개 범위) · SECURITY DEFINER · STABLE(쓰기 없음) ·
--      search_path = pg_catalog, pg_temp · 표 · 함수 모두 스키마를 붙여 정적으로 부른다(동적 SQL 없음).
--      대상 = 서가와 같은 「이용 가능」 발행본(철회 안 됨 AND story.source_rights_ok(원천)). p_release_key 가 null 이면 이용 가능한 전부
--      (서가 한 번에 한 호출 — N+1 없음), 값이 있으면 그 발행본 하나(이용 가능하지 않거나 형식이 틀리면 0행 — 예외 없음).
--      값의 출처 = 발행본이 가리키는 불변 판본 자리(releases.slot_id → edition_slots.production.target). 판본 artifact 에는 target 이 없다.
--      최신 판 · 초안 · 다른 자리 · 정책 원문의 다른 값은 읽지 않는다.
--      결속(하나라도 어긋나면 story:guidance_mismatch 로 호출 전체를 닫는다 — 빈 결과 · 「주의 없음」으로 바꾸지 않는다):
--        자리: id = 발행본 slot_id · 원천 · 판본 키 · 종류 · 범위가 발행본과 같고 저장된 target_sha256 = 발행본 target_sha256,
--              그리고 story.canonical_sha256(production) 을 지금 다시 계산한 값 = 발행본 target_sha256(투영하는 값 자체가 발행 결속과 같다),
--              production 의 edition_key · kind · coverage = 발행본.
--        기준: 자리의 policy_id 행 · 원천이 같고 policy_sha256 = 발행본 policy_sha256 · 기준의 source_sha256 = 원천 본문 해시 ·
--              기준 production 배열에 이 자리의 production 이 그대로 들어 있다.
--        판:   발행본 edition_version_id 행의 slot_id · edition_sha256 = 발행본.
--        원천: 본문 해시 · 정체 해시 = 발행본.
--        target 모양(S2 ReadingTargetSchema 와 같은 의미의 방어 검사): language.basis = 'editorial_target' · language.cefr = 발행본 target_cefr ·
--              cognitive.basis = 'editorial_judgment' · cognitive.demand ∈ {low, moderate, high} · background_knowledge.load ∈ {low, moderate, high} ·
--              emotional_suitability.cautions = 문자열 배열(0..20개 · 각 1..500자 · 앞뒤 공백만인 것 없음).
--      돌려주는 것(명시 허용 목록): release_key · target_cefr(편집 목표 — 실측 아님) · cognitive_demand(편집 판단 등급) ·
--        background_load(편집 판단 등급) · cautions(저장된 주의 문장 배열 그대로 · 빈 배열 가능 — 빈 배열은 「검수된 주의 없음」이다).
--      돌려주지 않는 것: cognitive.note · background_knowledge.supports(편집 의도이지 동작하는 도움 기능이 아니다) ·
--        emotional_suitability.note(줄거리 상세) · goals · v_level · 기준의 preserve · review_concerns · 활동 · 정답 · 판본 artifact ·
--        검수 · 증명 · 권리 · UUID · 다른 해시.
--      공개 노출(알림): cautions 문장은 검수된 콘텐츠지만 장면 내용(사건 · 인물 행동)을 일부 말한다. 화면은 접힌 영역 안에 두고
--        펼치기 전 요약에 장면을 쓰지 않는다(U1 UI 수용 기준). 같은 문장이 이미 공개 대상이 아니던 값이라는 점은 사용자 승인 범위다.
--      비용: 이용 가능한 발행본마다 production(수 KB) 정본 직렬화 1회 + 기준 production 배열 포함 검사 1회. 서가 규모에 비례 — 측정은 격리 시험만.
--      노출: 새 public 함수는 PostgREST 스키마 캐시 갱신 뒤 RPC 로 보인다. 보이지 않으면 별도 단계로 `notify pgrst, 'reload schema'`
--        (이 파일에는 넣지 않는다 — 승인 범위).
--
-- 영향: 기존 행 0 · 기존 함수 · 표 · 정책 · 권한 변경 0 · 새 함수 1. story 표는 읽기만 한다. 진도 · 완료 · 이벤트 쓰기 없음. 잠금은 함수 생성의
--   카탈로그 잠금뿐(사용자 표 잠금 없음).
-- 멱등: 함수가 이미 있으면 preflight 가 실패한다(조용한 재적용 없음).
-- 전제: 적용된 S3(20261025094450_lcp_story_s3_schema.sql)의 story 표 · story.canonical_sha256(jsonb) · story.source_rights_ok(uuid) ·
--   public.story_catalog() 가 anon 에 열려 있음(S3 quarantine 뒤에는 새 공개 문을 열지 않는다). 역할 anon · authenticated · service_role.
--   적용 역할(= 함수 소유자)은 story 스키마 USAGE · 읽는 story 표 5개 SELECT · 두 story 함수 EXECUTE 가 있고 그 표들의 RLS 를 면제받아야 한다
--   (FORCE RLS 없음 + 표 소유자(멤버 포함) · BYPASSRLS · superuser 중 하나).
-- 되돌리기: 파괴 없이 _pending_lcp_story_u1_guidance_recovery.sql(새 RPC 실행 권한만 회수 — 함수 정의 · 데이터 보존).
--   화면은 RPC 가 없거나 권한이 없으면 「안내를 불러오지 못함」으로 보이고 기존 독서는 그대로다.
-- 상태: 미적용.

-- ── A. preflight(fail closed) ────────────────────────────────────────────────

set local lcp_story_u1.in_txn = 'on';

do $$
declare
  v_missing text[];
begin
  if pg_catalog.current_setting('lcp_story_u1.in_txn', true) is distinct from 'on' then
    raise exception 'lcp story u1: 한 트랜잭션으로 감싸 적용해야 한다(set local tripwire 가 사라졌다 — 자동 커밋 실행)';
  end if;
  if pg_catalog.current_setting('transaction_isolation') is distinct from 'read committed' then
    raise exception 'lcp story u1: read committed 에서만 적용한다(현재 %)', pg_catalog.current_setting('transaction_isolation');
  end if;
  if pg_catalog.to_regnamespace('story') is null then
    raise exception 'lcp story u1: schema story does not exist — 적용된 S3 가 없다';
  end if;
  select pg_catalog.array_agg(x order by x) into v_missing
    from pg_catalog.unnest(array[
      'releases.release_key', 'releases.slot_id', 'releases.edition_version_id', 'releases.source_id', 'releases.work_key',
      'releases.edition_key', 'releases.kind', 'releases.coverage', 'releases.source_identity_sha256', 'releases.source_text_sha256',
      'releases.policy_sha256', 'releases.target_sha256', 'releases.edition_sha256', 'releases.target_cefr', 'releases.withdrawn_at',
      'edition_slots.id', 'edition_slots.policy_id', 'edition_slots.source_id', 'edition_slots.edition_key', 'edition_slots.kind',
      'edition_slots.coverage', 'edition_slots.production', 'edition_slots.target_sha256',
      'policies.id', 'policies.source_id', 'policies.policy', 'policies.policy_sha256',
      'edition_versions.id', 'edition_versions.slot_id', 'edition_versions.edition_sha256',
      'sources.id', 'sources.text_sha256', 'sources.identity_sha256']) as x
   where not exists (
     select 1 from pg_catalog.pg_attribute a
      where a.attrelid = pg_catalog.to_regclass('story.' || pg_catalog.split_part(x, '.', 1))
        and a.attname = pg_catalog.split_part(x, '.', 2) and a.attnum > 0 and not a.attisdropped);
  if v_missing is not null then
    raise exception 'lcp story u1: story columns missing: %', v_missing;
  end if;
  select pg_catalog.array_agg(t order by t) into v_missing
    from pg_catalog.unnest(array['story.releases', 'story.edition_slots', 'story.policies', 'story.edition_versions', 'story.sources']) as t
   where not pg_catalog.has_table_privilege(t, 'SELECT');
  if v_missing is not null then
    raise exception 'lcp story u1: 적용 역할(= 새 DEFINER 함수 소유자)에 SELECT 권한이 없다: %', v_missing;
  end if;
  -- story 표는 RLS 켜짐 · 정책 없음이다. 소유자(멤버 포함) · BYPASSRLS · superuser 가 아니면 DEFINER 가 0행을 읽어
  -- 적용은 성공해 보이고 모든 호출이 빈 결과가 된다 — FORCE RLS 도 같은 결과라 거부한다.
  select pg_catalog.array_agg(c.relname::text order by c.relname) into v_missing
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    cross join (select r.rolsuper, r.rolbypassrls from pg_catalog.pg_roles r where r.rolname = current_user) as me
   where n.nspname = 'story'
     and c.relname in ('releases', 'edition_slots', 'policies', 'edition_versions', 'sources')
     and (c.relforcerowsecurity
          or not (pg_catalog.pg_has_role(current_user, c.relowner, 'USAGE') or me.rolbypassrls or me.rolsuper));
  if v_missing is not null
     or not exists (select 1 from pg_catalog.pg_roles r where r.rolname = current_user) then
    raise exception 'lcp story u1: 적용 역할이 story 표 RLS 를 면제받지 못한다(소유자 · BYPASSRLS · superuser 아님 또는 FORCE RLS): %', v_missing;
  end if;
  if pg_catalog.to_regprocedure('story.canonical_sha256(jsonb)') is null
     or pg_catalog.to_regprocedure('story.source_rights_ok(uuid)') is null
     or (select p.prorettype from pg_catalog.pg_proc p where p.oid = pg_catalog.to_regprocedure('story.canonical_sha256(jsonb)'))
        is distinct from 'pg_catalog.text'::pg_catalog.regtype::oid
     or (select p.prorettype from pg_catalog.pg_proc p where p.oid = pg_catalog.to_regprocedure('story.source_rights_ok(uuid)'))
        is distinct from 'pg_catalog.bool'::pg_catalog.regtype::oid then
    raise exception 'lcp story u1: story.canonical_sha256(jsonb) text / story.source_rights_ok(uuid) boolean missing';
  end if;
  -- DEFINER 소유자(= 적용 역할)가 실제로 실행할 수 있어야 한다 — 아니면 적용은 성공해 보이고 모든 호출이 42501 이 된다.
  if not pg_catalog.has_schema_privilege('story', 'USAGE')
     or not pg_catalog.has_function_privilege(pg_catalog.to_regprocedure('story.canonical_sha256(jsonb)'), 'EXECUTE')
     or not pg_catalog.has_function_privilege(pg_catalog.to_regprocedure('story.source_rights_ok(uuid)'), 'EXECUTE') then
    raise exception 'lcp story u1: 적용 역할에 story USAGE / canonical_sha256 · source_rights_ok EXECUTE 가 없다';
  end if;
  -- S3 공개 서가 문이 격리(quarantine)돼 있으면 새 공개 문을 열지 않는다.
  if pg_catalog.to_regprocedure('public.story_catalog()') is null
     or not pg_catalog.has_function_privilege('anon', pg_catalog.to_regprocedure('public.story_catalog()'), 'EXECUTE') then
    raise exception 'lcp story u1: public.story_catalog() 가 anon 에 열려 있지 않다(quarantine 상태) — 새 공개 문을 열지 않는다';
  end if;
  if exists (select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'story_release_guidance') then
    raise exception 'lcp story u1: public.story_release_guidance already exists — 재적용하지 않는다';
  end if;
end
$$;

-- ── B. 공개 선택 안내 RPC ───────────────────────────────────────────────────────
-- 반환 행(이용 가능한 발행본 하나당 한 행 · work_key, edition_key 순):
--   release_key text · target_cefr text(편집 목표 CEFR — 실측 아님) · cognitive_demand text(low | moderate | high · 편집 판단) ·
--   background_load text(low | moderate | high · 편집 판단) · cautions jsonb(저장된 주의 문장 문자열 배열 그대로 · 순서 보존 · 빈 배열 가능)

create function public.story_release_guidance(p_release_key text default null)
returns table (release_key text, target_cefr text, cognitive_demand text, background_load text, cautions jsonb)
language plpgsql
stable
security definer
set search_path = pg_catalog, pg_temp
as $fn$
#variable_conflict error
declare
  v_row record;
  v_target jsonb;
  v_cautions jsonb;
begin
  if p_release_key is not null and p_release_key !~ '^lsr_[0-9a-f]{32}$' then
    return;
  end if;
  for v_row in
    select rl.release_key as r_key, rl.slot_id as r_slot, rl.source_id as r_source, rl.edition_key as r_edition_key,
           rl.kind as r_kind, rl.coverage as r_coverage, rl.target_sha256 as r_target_sha, rl.policy_sha256 as r_policy_sha,
           rl.edition_sha256 as r_edition_sha, rl.source_text_sha256 as r_text_sha, rl.source_identity_sha256 as r_identity_sha,
           rl.target_cefr as r_cefr,
           es.id as s_id, es.source_id as s_source, es.edition_key as s_edition_key, es.kind as s_kind, es.coverage as s_coverage,
           es.target_sha256 as s_target_sha, es.production as s_production,
           p.id as p_id, p.source_id as p_source, p.policy_sha256 as p_policy_sha, p.policy -> 'production' as p_production,
           p.policy ->> 'source_sha256' as p_source_sha,
           ev.id as v_id, ev.slot_id as v_slot, ev.edition_sha256 as v_edition_sha,
           src.id as o_id, src.text_sha256 as o_text_sha, src.identity_sha256 as o_identity_sha
      from story.releases rl
      left join story.edition_slots es on es.id = rl.slot_id
      left join story.policies p on p.id = es.policy_id
      left join story.edition_versions ev on ev.id = rl.edition_version_id
      left join story.sources src on src.id = rl.source_id
     where rl.withdrawn_at is null
       and (p_release_key is null or rl.release_key = p_release_key)
       and story.source_rights_ok(rl.source_id)
     order by rl.work_key, rl.edition_key, rl.release_key
  loop
    -- 결속: 자리 · 기준 · 판 · 원천이 발행본 행과 같은가(같은 불변 행을 가리키는가).
    if v_row.s_id is null or v_row.p_id is null or v_row.v_id is null or v_row.o_id is null
       or v_row.s_source is distinct from v_row.r_source
       or v_row.s_edition_key is distinct from v_row.r_edition_key
       or v_row.s_kind is distinct from v_row.r_kind
       or v_row.s_coverage is distinct from v_row.r_coverage
       or v_row.s_target_sha is distinct from v_row.r_target_sha
       or v_row.p_source is distinct from v_row.r_source
       or v_row.p_policy_sha is distinct from v_row.r_policy_sha
       or v_row.p_source_sha is distinct from v_row.o_text_sha
       or v_row.v_slot is distinct from v_row.r_slot
       or v_row.v_edition_sha is distinct from v_row.r_edition_sha
       or v_row.o_text_sha is distinct from v_row.r_text_sha
       or v_row.o_identity_sha is distinct from v_row.r_identity_sha then
      raise exception 'story:guidance_mismatch' using detail = 'binding';
    end if;
    -- 투영하는 값 자체가 발행 결속(target_sha256)과 같아야 한다 — 저장된 production 을 지금 다시 해시한다.
    if pg_catalog.jsonb_typeof(v_row.s_production) is distinct from 'object'
       or story.canonical_sha256(v_row.s_production) is distinct from v_row.r_target_sha
       or v_row.s_production ->> 'edition_key' is distinct from v_row.r_edition_key
       or v_row.s_production ->> 'kind' is distinct from v_row.r_kind
       or v_row.s_production ->> 'coverage' is distinct from v_row.r_coverage
       or pg_catalog.jsonb_typeof(v_row.p_production) is distinct from 'array'
       or not (v_row.p_production @> pg_catalog.jsonb_build_array(v_row.s_production)) then
      raise exception 'story:guidance_mismatch' using detail = 'target_binding';
    end if;

    -- target 모양(공개하는 값만 · 방어 검사).
    v_target := v_row.s_production -> 'target';
    v_cautions := v_target #> '{emotional_suitability,cautions}';
    if pg_catalog.jsonb_typeof(v_target) is distinct from 'object'
       or v_target #>> '{language,basis}' is distinct from 'editorial_target'
       or pg_catalog.jsonb_typeof(v_target #> '{language,cefr}') is distinct from 'string'
       or v_target #>> '{language,cefr}' is distinct from v_row.r_cefr
       or v_target #>> '{cognitive,basis}' is distinct from 'editorial_judgment'
       or pg_catalog.jsonb_typeof(v_target #> '{cognitive,demand}') is distinct from 'string'
       or (v_target #>> '{cognitive,demand}') not in ('low', 'moderate', 'high')
       or pg_catalog.jsonb_typeof(v_target #> '{background_knowledge,load}') is distinct from 'string'
       or (v_target #>> '{background_knowledge,load}') not in ('low', 'moderate', 'high')
       or pg_catalog.jsonb_typeof(v_cautions) is distinct from 'array'
       or pg_catalog.jsonb_array_length(v_cautions) > 20
       or exists (
         select 1 from pg_catalog.jsonb_array_elements(v_cautions) as c(x)
          where pg_catalog.jsonb_typeof(c.x) is distinct from 'string'
             or pg_catalog.char_length(c.x #>> '{}') not between 1 and 500
             or pg_catalog.btrim(c.x #>> '{}') = '') then
      raise exception 'story:guidance_mismatch' using detail = 'target_shape';
    end if;

    release_key := v_row.r_key;
    target_cefr := v_target #>> '{language,cefr}';
    cognitive_demand := v_target #>> '{cognitive,demand}';
    background_load := v_target #>> '{background_knowledge,load}';
    -- 문자열 배열을 새로 만든다(저장 순서 보존 · 다른 값은 싣지 않는다).
    cautions := coalesce(
      (select pg_catalog.jsonb_agg(c.x order by c.o) from pg_catalog.jsonb_array_elements(v_cautions) with ordinality as c(x, o)),
      '[]'::jsonb);
    return next;
  end loop;
end
$fn$;

comment on function public.story_release_guidance(text) is
  'LCP Story 공개 선택 안내(읽기 전용) — 이용 가능한 발행본의 불변 판본 자리 production.target 에서 편집 목표 CEFR · 인지 부담 · 배경지식 부담 등급과 저장된 주의 문장 배열만. 결속(자리 · 기준 · 판 · 원천 · target 재해시) 불일치는 story:guidance_mismatch. 본문 · 줄거리 설명 · 목표 · 활동 · 검수 · 권리 · UUID 없음(docs/LCP_STORY.md §12 · §15 · U1).';

revoke all on function public.story_release_guidance(text) from public, anon, authenticated, service_role;
grant execute on function public.story_release_guidance(text) to anon, authenticated;

-- ── C. 사후 확인 ────────────────────────────────────────────────────────────────

do $$
declare
  v_fn oid := pg_catalog.to_regprocedure('public.story_release_guidance(text)');
  v_grantees oid[];
begin
  if pg_catalog.current_setting('lcp_story_u1.in_txn', true) is distinct from 'on' then
    raise exception 'lcp story u1: 한 트랜잭션으로 감싸 적용해야 한다(C 에서 tripwire 없음)';
  end if;
  if v_fn is null then
    raise exception 'lcp story u1 postcheck: function missing';
  end if;
  select pg_catalog.array_agg(distinct g.grantee order by g.grantee) into v_grantees
    from pg_catalog.pg_proc p cross join lateral pg_catalog.aclexplode(p.proacl) as g
   where p.oid = v_fn and g.privilege_type = 'EXECUTE' and g.grantee <> p.proowner;
  if v_grantees is distinct from (select pg_catalog.array_agg(r order by r)
                                     from pg_catalog.unnest(array['anon'::pg_catalog.regrole::oid, 'authenticated'::pg_catalog.regrole::oid]) as r)
     or not (select p.prosecdef and p.provolatile = 's' from pg_catalog.pg_proc p where p.oid = v_fn) then
    raise exception 'lcp story u1 postcheck: story_release_guidance grants/attributes unexpected: %', v_grantees;
  end if;
  -- 유효 권한(멤버십 상속 포함) 행렬과 고정 search_path 를 정확히 확인한다.
  if not pg_catalog.has_function_privilege('anon', v_fn, 'EXECUTE')
     or not pg_catalog.has_function_privilege('authenticated', v_fn, 'EXECUTE')
     or pg_catalog.has_function_privilege('service_role', v_fn, 'EXECUTE')
     or pg_catalog.has_function_privilege('public', v_fn, 'EXECUTE')
     or (select p.proconfig from pg_catalog.pg_proc p where p.oid = v_fn)
        is distinct from '{"search_path=pg_catalog, pg_temp"}'::text[] then
    raise exception 'lcp story u1 postcheck: story_release_guidance effective privileges/search_path unexpected';
  end if;
end
$$;
