-- supabase/migrations/_pending_lcp_story_w2_context_notes.sql
-- 판 v2(2026-10-27): v1(SHA 06970f9f…, 독립 검토 CHANGES_REQUESTED — P1 내용 해시 · 결속 재계산 없음 · P2 handling 열거 없음)을 고친 판.
--   v1 바이트는 승인 요청에 쓰지 않는다(이력으로만 보존).
-- ⚠️ 보류(적용 안 함) — LCP Story D3 W2(T-0189) forward SQL 제안. 공유 DB 적용은 SQL 전문 · 전체 SHA-256 · 영향 범위 ·
--    복구 SQL(_pending_lcp_story_w2_context_notes_recovery.sql)을 대화에서 보이고 사용자가 개별 승인한 뒤
--    승인형 배포 러너 또는 Supabase MCP apply_migration 으로만 한다. 저장소 마이그레이션 파일 이름(타임스탬프)은 반영 때 정한다.
-- ⚠️ 트랜잭션: 이 파일에는 BEGIN/COMMIT 이 없다. 러너(또는 apply_migration)가 본문 전체를 한 트랜잭션으로 감싸 적용하고,
--    실패하면 전부 되돌린다. psql · SQL 편집기 등으로 공유 DB 에 단독 실행하지 않는다. READ COMMITTED 에서만 적용한다.
--    tripwire: 첫 문장 `set local lcp_story_w2.in_txn = 'on'` 을 A · C 의 DO 가 확인한다(자동 커밋 실행이면 A 에서 실패 — 아무것도 만들지 않는다).
--    시간 한도: 이어서 `set local lock_timeout = '3s'` · `set local statement_timeout = '60s'` 를 건다. 둘 다 이 트랜잭션 끝(커밋 · 롤백)까지
--    남고 러너가 같은 트랜잭션에서 쓰는 원장 INSERT 에도 걸린다. 이 파일은 사용자 표를 잠그지 않는다(함수 생성의 카탈로그 잠금뿐) —
--    3초 안에 카탈로그 잠금을 못 얻거나 한 문장이 60초를 넘으면 트랜잭션 전체가 실패하고 아무것도 남지 않는다(그대로 다시 적용해도 안전).
--
-- 무엇(하나 · 기존 행 0 변경 · 기존 함수 · 표 · 정책 · 권한 변경 0):
--   B. 학습자 읽기 RPC public.story_unit_context_notes(p_release_key text, p_unit_index integer) returns jsonb.
--      authenticated 만 실행 · SECURITY DEFINER · STABLE(쓰기 없음) · search_path = pg_catalog, pg_temp · 표 · 함수 모두 스키마를 붙여 정적으로 부른다.
--      목적: 편집 기준이 `retain_with_context`(원문 표현을 남기고 맥락 설명을 단다)로 정한 민감 표현의 **이미 검수 · 발행된** 학습자 설명을
--      그 설명이 가리키는 단위를 읽는 학습자에게만 준다(D3 W2 — 당시의 가정과 증거를 가려 읽도록 돕는 시대적 맥락).
--      열람 판정은 story_read_unit · story_reader_context 와 같다: story.require_learner() → 철회 안 됨 AND story.source_rights_ok(원천)을 호출마다
--      (아니면 story:release_unavailable) → 단위 범위 · 행(아니면 story:unit_not_found).
--      내용은 발행본이 가리키는 불변 판(releases.edition_version_id)과 그 자리의 기준(policy)에서만 읽는다 — 최신 판 · 초안 · 다른 기준을 읽지 않는다.
--      결속(어긋나면 story:context_notes_mismatch — 빈 목록 · 「설명 없음」으로 바꾸지 않는다):
--        판:   id = 발행본 edition_version_id · slot_id · edition_sha256 · unit_count = 발행본 · artifact 의 edition_key · kind = 발행본 ·
--              units 배열 길이 = unit_count · 고른 단위의 unit_id = 발행 단위 행의 unit_id(story_reader_context 와 같은 검사).
--        판 내용(v2): 저장 artifact 에서 지금 다시 계산한 story.canonical_sha256(artifact - 'activities')(S3 submit_edition 의 edition_sha256
--              정의 그대로) = 발행본 edition_sha256(detail edition_content) · artifact.binding = 발행본의
--              { source_sha256: source_text_sha256 · source_identity_sha256 · policy_sha256 · target_sha256 }(S3 submit_edition 의 기대값과 같은
--              키 · detail artifact_binding). 저장 해시 열끼리만 비교하지 않는다 — 내보내는 learner_note 가 검수 · 발행된 바이트인지 확인한다.
--        자리: id = 발행본 slot_id · 원천 · 판본 키 · 저장 target_sha256 = 발행본.
--        기준: 자리의 policy_id 행 · 원천이 같고 policy_sha256 = 발행본 policy_sha256 · 기준의 source_sha256 = 원천 본문 해시.
--        기준 내용(v2): 저장 policy 에서 지금 다시 계산한 story.canonical_sha256(policy - 'production')(S3 register_policy 의 policy_sha256 정의
--              그대로) = 발행본 policy_sha256(detail policy_content) — 고르는 데 쓰는 sensitive_content 가 발행 결속 바이트인지 확인한다.
--        원천: 본문 해시 · 정체 해시 = 발행본.
--        저장된 행 · 해시는 바꾸지 않는다(읽기 · 다시 계산 · 비교만).
--      고르는 설명(S2 validate.ts 의 변경 기록 · 민감 표현 규칙과 같은 의미):
--        change_log 원소 c 중 type = 'editorial_note' AND operation = 'context_note' AND sensitive_ref 가 기준 sensitive_content 의 handling =
--        'retain_with_context' 항목 id AND unit_ids 가 고른 단위의 unit_id 를 포함. 결과 = 그 원소의 change_id · learner_note(저장 그대로 · 순서 보존).
--        sensitive_ref 가 없는 일반 주석(줄거리 · 정답에 가까운 설명이 있을 수 있다) · 다른 단위 · rewrite/omit 처리는 내보내지 않는다.
--      모양 방어(S2 가 받지 않았을 저장값이면 닫는다 — S2 보다 엄격한 상한은 두지 않는다):
--        change_log 가 배열이 아니거나 change_id 가 문자열이 아니거나 겹침(S2 duplicate_id) · sensitive_content 가 배열이 아니거나 id 가 겹치거나
--        handling 이 S2 SensitiveItemSchema 의 세 값(retain_with_context · revise_with_note · omit_with_note)이 아님(v2 — 모르는 값을 「맥락 없음」으로 바꾸지 않는다) ·
--        민감 표현을 가리키는 원소의 sensitive_ref 가 기준에 없음(S2 sensitive_unknown) · 고른 원소의 unit_ids 가 문자열 배열이 아니거나
--        판의 단위에 없는 id 를 가리킴(S2 change_unit_missing) · 고른 원소의 learner_note 가 문자열이 아니거나 공백(U+0020)만(S2 sensitive_note_missing ·
--        Text — S2 는 JS trim 이라 더 엄격하므로 S2 가 받은 값을 여기서 거부하지 않는다). 개수 · 길이 상한 없음(S2 에 없다).
--      돌려주는 jsonb(키 고정 · 명시 허용 목록): { release_key, unit_index, notes: [ { id, text } ] } — notes 는 빈 배열일 수 있다(그 단위에 해당 설명 없음).
--      돌려주지 않는 것: change_log 의 다른 원소 · rationale · source_anchors · type/operation · sensitive_ref · 기준의 issue/rationale/anchors ·
--        본문 · 활동 · 정답 · 검수 · 증명 · 권리 · 진도 · UUID · 해시.
--      비용: 호출마다 그 판 artifact jsonb 전체와 기준 policy jsonb 를 detoast 하고 둘의 정본 해시(story.canonical_json — plpgsql 재귀)를
--        다시 계산한다(반환은 안 함). 측정은 격리 시험만(공유 DB 규모 측정 없음).
--      노출: 파일 끝(D)의 `notify pgrst, 'reload schema'` 가 같은 트랜잭션 안에서 커밋 때만 PostgREST 에 스키마 다시 읽기를 알린다(롤백이면 전달 안 됨 ·
--        데이터 · 권한 변경 없음 · 다시 읽는 동안 요청이 잠깐 기다릴 수 있음). 실제 PostgREST 노출은 승인 적용 뒤 읽기 전용으로 확인한다.
--
-- 영향: 기존 행 0 · 기존 함수 · 표 · 정책 · 권한 변경 0 · 새 함수 1 · 커밋 시 PostgREST 알림 1. story 표는 읽기만 한다. 진도 · 완료 · 이벤트 쓰기 없음.
-- 멱등: 함수가 이미 있으면 preflight 가 실패한다(조용한 재적용 없음).
-- 전제: 적용된 S3(20261025094450) · S5(20261025143031)의 story 표 · story.require_learner() · story.source_rights_ok(uuid) ·
--   story.canonical_sha256(jsonb)(과 그것이 부르는 story.canonical_json(jsonb) · story.sha256_hex(text)) ·
--   public.story_reader_context(text,integer) 가 authenticated 에 열려 있음(격리 상태면 새 학습자 문을 열지 않는다). 역할 anon · authenticated · service_role.
--   적용 역할(= 함수 소유자)은 story 스키마 USAGE · 읽는 story 표 6개 SELECT · 위 story 함수 5개 EXECUTE 가 있고 그 표들의 RLS 를 면제받아야 한다
--   (FORCE RLS 없음 + 표 소유자(멤버 포함) · BYPASSRLS · superuser 중 하나).
-- 되돌리기: 파괴 없이 _pending_lcp_story_w2_context_notes_recovery.sql(새 RPC 실행 권한만 회수 — 함수 정의 · 데이터 보존).
--   화면은 RPC 가 없거나 권한이 없으면 「시대적 맥락 설명을 불러오지 못함」으로 보이고 본문 · 진도 · 완료는 그대로다.
-- 상태: 미적용.

-- ── A. preflight(fail closed) ────────────────────────────────────────────────

set local lcp_story_w2.in_txn = 'on';
set local lock_timeout = '3s';
set local statement_timeout = '60s';

do $$
declare
  v_missing text[];
begin
  if pg_catalog.current_setting('lcp_story_w2.in_txn', true) is distinct from 'on' then
    raise exception 'lcp story w2: 한 트랜잭션으로 감싸 적용해야 한다(set local tripwire 가 사라졌다 — 자동 커밋 실행)';
  end if;
  if pg_catalog.current_setting('transaction_isolation') is distinct from 'read committed' then
    raise exception 'lcp story w2: read committed 에서만 적용한다(현재 %)', pg_catalog.current_setting('transaction_isolation');
  end if;
  if pg_catalog.to_regnamespace('story') is null then
    raise exception 'lcp story w2: schema story does not exist — 적용된 S3 가 없다';
  end if;
  select pg_catalog.array_agg(x order by x) into v_missing
    from pg_catalog.unnest(array[
      'releases.id', 'releases.release_key', 'releases.slot_id', 'releases.edition_version_id', 'releases.source_id',
      'releases.edition_key', 'releases.kind', 'releases.source_identity_sha256', 'releases.source_text_sha256',
      'releases.policy_sha256', 'releases.target_sha256', 'releases.edition_sha256', 'releases.unit_count', 'releases.withdrawn_at',
      'release_units.release_id', 'release_units.unit_index', 'release_units.unit_id',
      'edition_versions.id', 'edition_versions.slot_id', 'edition_versions.artifact', 'edition_versions.edition_sha256',
      'edition_versions.unit_count',
      'edition_slots.id', 'edition_slots.policy_id', 'edition_slots.source_id', 'edition_slots.edition_key', 'edition_slots.target_sha256',
      'policies.id', 'policies.source_id', 'policies.policy', 'policies.policy_sha256',
      'sources.id', 'sources.text_sha256', 'sources.identity_sha256']) as x
   where not exists (
     select 1 from pg_catalog.pg_attribute a
      where a.attrelid = pg_catalog.to_regclass('story.' || pg_catalog.split_part(x, '.', 1))
        and a.attname = pg_catalog.split_part(x, '.', 2) and a.attnum > 0 and not a.attisdropped);
  if v_missing is not null then
    raise exception 'lcp story w2: story columns missing: %', v_missing;
  end if;
  select pg_catalog.array_agg(t order by t) into v_missing
    from pg_catalog.unnest(array['story.releases', 'story.release_units', 'story.edition_versions', 'story.edition_slots',
                                 'story.policies', 'story.sources']) as t
   where not pg_catalog.has_table_privilege(t, 'SELECT');
  if v_missing is not null then
    raise exception 'lcp story w2: 적용 역할(= 새 DEFINER 함수 소유자)에 SELECT 권한이 없다: %', v_missing;
  end if;
  -- story 표는 RLS 켜짐 · 정책 없음이다. 소유자(멤버 포함) · BYPASSRLS · superuser 가 아니면 DEFINER 가 0행을 읽어
  -- 적용은 성공해 보이고 모든 호출이 release_unavailable 이 된다 — FORCE RLS 도 같은 결과라 거부한다.
  select pg_catalog.array_agg(c.relname::text order by c.relname) into v_missing
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    cross join (select r.rolsuper, r.rolbypassrls from pg_catalog.pg_roles r where r.rolname = current_user) as me
   where n.nspname = 'story'
     and c.relname in ('releases', 'release_units', 'edition_versions', 'edition_slots', 'policies', 'sources')
     and (c.relforcerowsecurity
          or not (pg_catalog.pg_has_role(current_user, c.relowner, 'USAGE') or me.rolbypassrls or me.rolsuper));
  if v_missing is not null
     or not exists (select 1 from pg_catalog.pg_roles r where r.rolname = current_user) then
    raise exception 'lcp story w2: 적용 역할이 story 표 RLS 를 면제받지 못한다(소유자 · BYPASSRLS · superuser 아님 또는 FORCE RLS): %', v_missing;
  end if;
  if pg_catalog.to_regprocedure('story.require_learner()') is null
     or pg_catalog.to_regprocedure('story.source_rights_ok(uuid)') is null
     or (select p.prorettype from pg_catalog.pg_proc p where p.oid = pg_catalog.to_regprocedure('story.require_learner()'))
        is distinct from 'pg_catalog.uuid'::pg_catalog.regtype::oid
     or (select p.prorettype from pg_catalog.pg_proc p where p.oid = pg_catalog.to_regprocedure('story.source_rights_ok(uuid)'))
        is distinct from 'pg_catalog.bool'::pg_catalog.regtype::oid then
    raise exception 'lcp story w2: story.require_learner() uuid / story.source_rights_ok(uuid) boolean missing';
  end if;
  -- 내용 결속에 쓰는 S3 정본 해시 함수(v2). canonical_sha256 은 SECURITY INVOKER 라 DEFINER 소유자가 안쪽 두 함수도 실행할 수 있어야 한다.
  if pg_catalog.to_regprocedure('story.canonical_sha256(jsonb)') is null
     or pg_catalog.to_regprocedure('story.canonical_json(jsonb)') is null
     or pg_catalog.to_regprocedure('story.sha256_hex(text)') is null
     or (select p.prorettype from pg_catalog.pg_proc p where p.oid = pg_catalog.to_regprocedure('story.canonical_sha256(jsonb)'))
        is distinct from 'pg_catalog.text'::pg_catalog.regtype::oid then
    raise exception 'lcp story w2: story.canonical_sha256(jsonb) text / story.canonical_json(jsonb) / story.sha256_hex(text) missing';
  end if;
  if not pg_catalog.has_schema_privilege('story', 'USAGE')
     or not pg_catalog.has_function_privilege(pg_catalog.to_regprocedure('story.require_learner()'), 'EXECUTE')
     or not pg_catalog.has_function_privilege(pg_catalog.to_regprocedure('story.source_rights_ok(uuid)'), 'EXECUTE')
     or not pg_catalog.has_function_privilege(pg_catalog.to_regprocedure('story.canonical_sha256(jsonb)'), 'EXECUTE')
     or not pg_catalog.has_function_privilege(pg_catalog.to_regprocedure('story.canonical_json(jsonb)'), 'EXECUTE')
     or not pg_catalog.has_function_privilege(pg_catalog.to_regprocedure('story.sha256_hex(text)'), 'EXECUTE') then
    raise exception 'lcp story w2: 적용 역할에 story USAGE / require_learner · source_rights_ok · canonical_sha256 · canonical_json · sha256_hex EXECUTE 가 없다';
  end if;
  -- 학습자 읽기 문(S5)이 격리(quarantine)돼 있으면 새 학습자 문을 열지 않는다.
  if pg_catalog.to_regprocedure('public.story_reader_context(text,integer)') is null
     or not pg_catalog.has_function_privilege('authenticated', pg_catalog.to_regprocedure('public.story_reader_context(text,integer)'), 'EXECUTE') then
    raise exception 'lcp story w2: public.story_reader_context 가 authenticated 에 열려 있지 않다(quarantine 상태) — 새 학습자 문을 열지 않는다';
  end if;
  if exists (select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'story_unit_context_notes') then
    raise exception 'lcp story w2: public.story_unit_context_notes already exists — 재적용하지 않는다';
  end if;
end
$$;

-- ── B. 단위별 시대적 맥락 설명 RPC ────────────────────────────────────────────────

create function public.story_unit_context_notes(p_release_key text, p_unit_index integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, pg_temp
as $fn$
declare
  v_user uuid := story.require_learner();
  v_release story.releases;
  v_unit_id text;
  v_artifact jsonb;
  v_unit jsonb;
  v_changes jsonb;
  v_unit_ids jsonb;
  v_policy jsonb;
  v_sensitive jsonb;
  v_retain text[];
  v_notes jsonb;
begin
  select * into v_release from story.releases rl where rl.release_key = p_release_key and rl.withdrawn_at is null;
  if not found or not story.source_rights_ok(v_release.source_id) then
    raise exception 'story:release_unavailable';
  end if;
  if p_unit_index is null or p_unit_index < 0 or p_unit_index >= v_release.unit_count then
    raise exception 'story:unit_not_found';
  end if;
  select ru.unit_id into v_unit_id
    from story.release_units ru where ru.release_id = v_release.id and ru.unit_index = p_unit_index;
  if not found then
    raise exception 'story:unit_not_found';
  end if;

  -- 판: 발행본이 가리키는 불변 판만(story_reader_context 와 같은 결속).
  select ev.artifact into v_artifact from story.edition_versions ev
   where ev.id = v_release.edition_version_id and ev.slot_id = v_release.slot_id
     and ev.edition_sha256 = v_release.edition_sha256 and ev.unit_count = v_release.unit_count;
  if not found or v_artifact ->> 'edition_key' is distinct from v_release.edition_key
     or v_artifact ->> 'kind' is distinct from v_release.kind then
    raise exception 'story:context_notes_mismatch' using detail = 'edition_version';
  end if;
  -- 판 내용: 저장 artifact 의 정본 해시를 지금 다시 계산(S3 submit_edition 정의 — activities 제외) = 발행 결속. 내용을 읽기 전에.
  if story.canonical_sha256(v_artifact - 'activities') is distinct from v_release.edition_sha256 then
    raise exception 'story:context_notes_mismatch' using detail = 'edition_content';
  end if;
  -- artifact.binding = 발행본 결속(S3 submit_edition 의 기대값과 같은 키 · 같은 값).
  if (v_artifact -> 'binding') is distinct from pg_catalog.jsonb_build_object(
       'source_sha256', v_release.source_text_sha256,
       'source_identity_sha256', v_release.source_identity_sha256,
       'policy_sha256', v_release.policy_sha256,
       'target_sha256', v_release.target_sha256) then
    raise exception 'story:context_notes_mismatch' using detail = 'artifact_binding';
  end if;
  if pg_catalog.jsonb_typeof(v_artifact -> 'units') is distinct from 'array'
     or pg_catalog.jsonb_array_length(v_artifact -> 'units') <> v_release.unit_count then
    raise exception 'story:context_notes_mismatch' using detail = 'unit_count';
  end if;
  v_unit := v_artifact -> 'units' -> p_unit_index;
  if pg_catalog.jsonb_typeof(v_unit -> 'unit_id') is distinct from 'string' or v_unit ->> 'unit_id' is distinct from v_unit_id then
    raise exception 'story:context_notes_mismatch' using detail = 'unit_id';
  end if;

  -- 자리 · 기준 · 원천: 발행본 행과 같은 불변 행인가.
  select p.policy into v_policy
    from story.edition_slots es
    join story.policies p on p.id = es.policy_id
    join story.sources s on s.id = v_release.source_id
   where es.id = v_release.slot_id and es.source_id = v_release.source_id and es.edition_key = v_release.edition_key
     and es.target_sha256 = v_release.target_sha256
     and p.source_id = v_release.source_id and p.policy_sha256 = v_release.policy_sha256
     and s.text_sha256 = v_release.source_text_sha256 and s.identity_sha256 = v_release.source_identity_sha256
     and p.policy ->> 'source_sha256' = s.text_sha256;
  if not found then
    raise exception 'story:context_notes_mismatch' using detail = 'binding';
  end if;
  -- 기준 내용: 저장 policy 의 정본 해시를 지금 다시 계산(S3 register_policy 정의 — production 제외) = 발행 결속. sensitive_content 를 읽기 전에.
  if story.canonical_sha256(v_policy - 'production') is distinct from v_release.policy_sha256 then
    raise exception 'story:context_notes_mismatch' using detail = 'policy_content';
  end if;

  -- 모양 방어(S2 변경 기록 · 민감 표현 규칙).
  v_changes := v_artifact -> 'change_log';
  v_sensitive := v_policy -> 'sensitive_content';
  if pg_catalog.jsonb_typeof(v_changes) is distinct from 'array' or pg_catalog.jsonb_typeof(v_sensitive) is distinct from 'array' then
    raise exception 'story:context_notes_mismatch' using detail = 'shape';
  end if;
  if exists (select 1 from pg_catalog.jsonb_array_elements(v_changes) as c(x)
              where pg_catalog.jsonb_typeof(c.x) is distinct from 'object' or pg_catalog.jsonb_typeof(c.x -> 'change_id') is distinct from 'string')
     or (select pg_catalog.count(*) from pg_catalog.jsonb_array_elements(v_changes) as c(x))
        <> (select pg_catalog.count(distinct c.x ->> 'change_id') from pg_catalog.jsonb_array_elements(v_changes) as c(x)) then
    raise exception 'story:context_notes_mismatch' using detail = 'change_ids';
  end if;
  if exists (select 1 from pg_catalog.jsonb_array_elements(v_sensitive) as s(x)
              where pg_catalog.jsonb_typeof(s.x) is distinct from 'object' or pg_catalog.jsonb_typeof(s.x -> 'id') is distinct from 'string'
                 or pg_catalog.jsonb_typeof(s.x -> 'handling') is distinct from 'string'
                 or (s.x ->> 'handling') not in ('retain_with_context', 'revise_with_note', 'omit_with_note'))
     or (select pg_catalog.count(*) from pg_catalog.jsonb_array_elements(v_sensitive) as s(x))
        <> (select pg_catalog.count(distinct s.x ->> 'id') from pg_catalog.jsonb_array_elements(v_sensitive) as s(x)) then
    raise exception 'story:context_notes_mismatch' using detail = 'sensitive_content';
  end if;
  -- 민감 표현을 가리키는 원소는 기준에 있는 id 만 가리켜야 한다(S2 sensitive_unknown).
  if exists (select 1 from pg_catalog.jsonb_array_elements(v_changes) as c(x)
              where c.x -> 'sensitive_ref' is not null and c.x -> 'sensitive_ref' <> 'null'::jsonb
                and (pg_catalog.jsonb_typeof(c.x -> 'sensitive_ref') is distinct from 'string'
                     or not exists (select 1 from pg_catalog.jsonb_array_elements(v_sensitive) as s(y) where s.y ->> 'id' = c.x ->> 'sensitive_ref'))) then
    raise exception 'story:context_notes_mismatch' using detail = 'sensitive_ref';
  end if;
  v_retain := array(select s.x ->> 'id' from pg_catalog.jsonb_array_elements(v_sensitive) as s(x) where s.x ->> 'handling' = 'retain_with_context');
  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('unit_id', u.x -> 'unit_id')) into v_unit_ids
    from pg_catalog.jsonb_array_elements(v_artifact -> 'units') as u(x);

  -- 고른 원소(retain_with_context 의 context_note): unit_ids 는 판의 단위만 · learner_note 는 비어 있지 않은 문자열.
  if exists (select 1 from pg_catalog.jsonb_array_elements(v_changes) as c(x)
              where c.x ->> 'type' = 'editorial_note' and c.x ->> 'operation' = 'context_note' and c.x ->> 'sensitive_ref' = any (v_retain)
                and (pg_catalog.jsonb_typeof(c.x -> 'unit_ids') is distinct from 'array'
                     or exists (select 1 from pg_catalog.jsonb_array_elements(c.x -> 'unit_ids') as i(y)
                                 where pg_catalog.jsonb_typeof(i.y) is distinct from 'string'
                                    or not (v_unit_ids @> pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('unit_id', i.y))))
                     or pg_catalog.jsonb_typeof(c.x -> 'learner_note') is distinct from 'string'
                     or pg_catalog.btrim(c.x ->> 'learner_note') = '')) then
    raise exception 'story:context_notes_mismatch' using detail = 'context_note';
  end if;

  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', c.x -> 'change_id', 'text', c.x -> 'learner_note') order by c.o), '[]'::jsonb)
    into v_notes
    from pg_catalog.jsonb_array_elements(v_changes) with ordinality as c(x, o)
   where c.x ->> 'type' = 'editorial_note' and c.x ->> 'operation' = 'context_note'
     and c.x ->> 'sensitive_ref' = any (v_retain)
     and (c.x -> 'unit_ids') @> pg_catalog.jsonb_build_array(v_unit_id);

  return pg_catalog.jsonb_build_object(
    'release_key', v_release.release_key,
    'unit_index', p_unit_index,
    'notes', v_notes);
end
$fn$;

comment on function public.story_unit_context_notes(text, integer) is
  'LCP Story 단위별 시대적 맥락 설명(읽기 전용 · authenticated) — 이용 가능한 발행본의 불변 판 · 기준에서 retain_with_context 민감 표현의 context_note 중 고른 단위를 가리키는 learner_note 만. 결속 · 모양 불일치는 story:context_notes_mismatch. 다른 변경 기록 · 본문 · 활동 · 정답 · 검수 · 권리 · 진도 · UUID 없음(docs/LCP_STORY.md · D3 W2).';

revoke all on function public.story_unit_context_notes(text, integer) from public, anon, authenticated, service_role;
grant execute on function public.story_unit_context_notes(text, integer) to authenticated;

-- ── C. 사후 확인 ────────────────────────────────────────────────────────────────

do $$
declare
  v_fn oid := pg_catalog.to_regprocedure('public.story_unit_context_notes(text,integer)');
  v_grantees oid[];
begin
  if pg_catalog.current_setting('lcp_story_w2.in_txn', true) is distinct from 'on' then
    raise exception 'lcp story w2: 한 트랜잭션으로 감싸 적용해야 한다(C 에서 tripwire 없음)';
  end if;
  if v_fn is null then
    raise exception 'lcp story w2 postcheck: function missing';
  end if;
  select pg_catalog.array_agg(distinct g.grantee order by g.grantee) into v_grantees
    from pg_catalog.pg_proc p cross join lateral pg_catalog.aclexplode(p.proacl) as g
   where p.oid = v_fn and g.privilege_type = 'EXECUTE' and g.grantee <> p.proowner;
  if v_grantees is distinct from array['authenticated'::pg_catalog.regrole::oid]
     or not (select p.prosecdef and p.provolatile = 's' from pg_catalog.pg_proc p where p.oid = v_fn) then
    raise exception 'lcp story w2 postcheck: story_unit_context_notes grants/attributes unexpected: %', v_grantees;
  end if;
  if pg_catalog.has_function_privilege('anon', v_fn, 'EXECUTE')
     or pg_catalog.has_function_privilege('service_role', v_fn, 'EXECUTE')
     or pg_catalog.has_function_privilege('public', v_fn, 'EXECUTE')
     or not pg_catalog.has_function_privilege('authenticated', v_fn, 'EXECUTE')
     or (select p.proconfig from pg_catalog.pg_proc p where p.oid = v_fn)
        is distinct from '{"search_path=pg_catalog, pg_temp"}'::text[] then
    raise exception 'lcp story w2 postcheck: story_unit_context_notes effective privileges/search_path unexpected';
  end if;
end
$$;

-- ── D. PostgREST 스키마 다시 읽기 알림(커밋 때만 전달 · 롤백이면 전달 안 됨) ─────────────────

notify pgrst, 'reload schema';
