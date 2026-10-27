-- s5-proposal-forward.sql (r3 초안: W2 P2-1~P2-9 · R2-P2-a/e/g 반영) — LCP Story S5 forward SQL 제안 (W1 작성 · 미적용 · 격리 시험 전)
-- ⚠️ 보류(적용 안 함) — 공유 DB 적용은 SQL 전문 · 전체 SHA-256 · 영향 범위 · 복구 SQL(s5-proposal-recovery.sql)을 대화에서 보이고
--    사용자가 승인한 뒤 승인형 배포 러너 또는 Supabase MCP apply_migration 으로만 한다. 저장소 마이그레이션 파일 이름은 반영 때 정한다.
-- ⚠️ 트랜잭션: 이 파일에는 BEGIN/COMMIT 이 없다. 러너(또는 apply_migration)가 본문 전체를 한 트랜잭션으로 감싸 적용하고,
--    실패하면 전부 되돌린다. psql · SQL 편집기 등으로 공유 DB 에 단독 실행하지 않는다. READ COMMITTED 에서만 적용한다(아래 C 참고).
--    tripwire: 첫 문장 `set local lcp_story_s5.in_txn = 'on'` 을 A · C 의 DO 가 확인한다. 문장마다 자동 커밋이면 SET LOCAL 은 그 문장 밖에서
--    효과가 없어 A 가 객체를 만들기 전에 실패한다(함수만 열리고 이벤트 이름은 없는 반쪽 상태 방지). 러너 · apply_migration 의 원장 기록
--    원자성 자체는 PG 시험으로 증명되지 않는다.
--
-- 무엇(두 가지 · 기존 행 0 변경):
--   B. 학습자 읽기 문맥 RPC public.story_reader_context(p_release_key text, p_unit_index integer) returns jsonb 하나.
--      authenticated 만 실행 · SECURITY DEFINER · STABLE(쓰기 없음 — 위치 기록은 기존 story_record_position) ·
--      search_path = pg_catalog, pg_temp · 표 · 함수 모두 스키마를 붙여 정적으로 부른다(동적 SQL 없음).
--      열람 판정은 story_read_unit 과 같다: story.require_learner() → 철회 안 됨 AND story.source_rights_ok(원천)을 호출마다
--      (아니면 story:release_unavailable) → 단위 범위 · 행(아니면 story:unit_not_found).
--      내용은 발행본이 가리키는 불변 판(releases.edition_version_id)에서만 읽는다 — 판본 자리의 최신 판 · 초안은 읽지 않는다.
--      돌려주는 것: 발행본 메타 · 이 학습자의 진도 · 목차(단위별 이 학습자 완료 여부) · 고른 단위의 원문 앵커(저장된 검증 인용 그대로 +
--      UTF-16 코드 단위 오프셋 메타) · Original Bridge 링크 · 출처 표기에 필요한 원천 판본 메타 허용 목록. 인용은 SQL 에서 다시 자르지 않는다
--      (PostgreSQL 문자 오프셋 ≠ UTF-16). 원문 전문 · 다른 단위 본문 · 현재 단위 본문(story_read_unit 이 준다) · snapshot_meta 전체 ·
--      권리 · 근거 · 판본 artifact · 활동 · 정답 · 검수 · 증명 · 생산자/세션 주장 · UUID 는 돌려주지 않는다. 모든 객체는 명시 키 허용 목록이다.
--      저장값이 어긋나면(단위 수 · unit_id · 앵커 원문 해시 · 앵커 JSON 형태 · 원천 해시 · 메타 형태) story:reader_context_mismatch 로 닫는다.
--      공개(P2-2): 호출 하나는 고른 단위의 인용만 주지만, 정렬 누락 금지(정본 §7)로 범위의 모든 문단이 앵커 또는 omit 이라
--      0..unit_count-1 을 차례로 부르면 인용의 합이 제작 범위 원문의 대부분이 된다. 권리 게이트가 story_read_unit 과 같아(source_text
--      confirmed) 계약 위반은 아니다 — 「원문 전문을 내보내지 않는다」 = 한 번에 전문 없음이며 인용 합은 범위 원문에 가깝다.
--      화면 조건(P2-6): source.source_url 은 저장값 그대로다(S2 z.string().url() 은 javascript: · data: 도 통과할 수 있다).
--      S5 UI 는 http: · https: 만 링크로 만들고 rel="noopener noreferrer" 를 쓴다(S5 UI 수용 기준).
--      신뢰(R2-P2-e): 앵커 인용은 S2 검증 증명에 결속된 저장값을 믿는다. SQL 은 원문 대조를 하지 않으며 원천 body 는 일부러 읽지 않는다.
--      불변 트리거를 우회해 quote 를 제자리 변조하고 증명을 위조한 service_role 키 보유자(정본 §15 신뢰 경계)는 SQL 에서 잡히지 않는다.
--      비용(P2-7): 호출마다 그 판 artifact jsonb 전체(전 단위 본문 · 활동 · change_log)를 detoast 한다(반환은 안 함). 단위 수에 비례 — 측정 후 결정.
--      노출(P2-9): 새 public 함수는 PostgREST 스키마 캐시 갱신 뒤 RPC 로 보인다. 적용 후 검증에 RPC 노출 확인을 넣고,
--      보이지 않으면 별도 단계로 `notify pgrst, 'reload schema'`(이 파일에는 넣지 않는다 — 승인 범위).
--   C. public.funnel_events 의 funnel_events_event_check 추가형 확장 — 이벤트 이름 story_catalog_viewed · story_reader_action.
--      적용 시점의 실제 식(pg_get_expr)을 그대로 두고 「(원래 식) OR (event = ANY (두 이름))」으로 같은 이름의 제약을 다시 건다.
--      기존 허용 이름 목록을 이 파일에 복사하지 않는다(다른 작업자가 그 사이 더한 이름도 보존된다).
--      이후 호환(P2-8): 허용 목록을 손으로 복사해 DROP/ADD 하는 후속 마이그레이션(예: 20261024025906 형태)은 두 이름을 조용히 지운다 —
--      이후 funnel CHECK 변경은 pg_get_expr 보존형 또는 리터럴 추출형만 쓴다. events.ts 의 두 이름은 S5 UI 커밋에 함께 넣어
--      db-allowlist.integration.test.ts(코드 ⊆ DB)가 드리프트를 잡게 한다.
--
-- 영향: 기존 행 0 · 기존 함수 · 표 · 정책 변경 0. 새 함수 1 · 제약 1개 재작성(의미는 기존 허용 ∪ 새 이름 2 — 좁아지지 않는다).
--   story 스키마 표 · 진도 행은 읽기만 한다. events.ts 는 이 SQL 의 범위가 아니다(코드는 별도 커밋).
-- 잠금 · 재시도: C 는 set local lock_timeout = '3s' 뒤 public.funnel_events 를 ACCESS EXCLUSIVE 로 잠근다. 3초 안에 못 얻으면
--   트랜잭션 전체가 실패하고 아무것도 남지 않는다(B 포함) — 나중에 그대로 다시 적용하면 된다. 잠금을 기다리는 동안(≤3초)과
--   얻은 뒤 커밋까지 funnel_events 읽기 · 쓰기(record_funnel_event · funnel_summary)가 줄을 선다. 얻은 뒤의 일은
--   제약 재작성 + 기존 행 검증 스캔 1회(새 식은 원래 식의 상위 집합이라 원래 식을 만족한 행은 모두 통과)뿐이며,
--   set local statement_timeout = '60s' 가 그 스캔을 묶는다(초과 시 전부 되돌림 · 재시도 안전). C 는 파일 끝에 두어 잠금 보유를 짧게 한다.
--   두 set local 값은 트랜잭션 끝까지 남아 러너의 원장(supabase_migrations) INSERT 에도 걸린다(그 INSERT 도 3초 잠금 · 60초 문장 한도).
--   미측정(R2-P2-g): 검증 스캔 시간은 격리 시험(funnel_events 약 5행)으로만 봤고 live 규모(약 5만 행)에서는 재지 않았다 — 정적 추정뿐이다.
-- 멱등: 함수가 이미 있으면 preflight 가 실패한다(조용한 재적용 없음). C 는 원래 식이 두 이름을 이미 모두 받으면 아무것도 바꾸지 않는다.
-- 전제: 적용된 S3(20261025094450_lcp_story_s3_schema.sql · sha256 09fb0dc4…b560c)의 story 표 · story.require_learner() ·
--   story.source_rights_ok(uuid), public.funnel_events(event text) 와 그 위의 check 제약 funnel_events_event_check 정확히 1개,
--   역할 authenticated · anon · service_role. 적용 역할(= 함수 소유자)은 story 스키마 USAGE · story 표 SELECT ·
--   story.require_learner() · story.source_rights_ok(uuid) EXECUTE 가 있고, 읽는 story 표 6개의 RLS 를 면제받아야 한다(FORCE RLS 없음 +
--   표 소유자(멤버 포함) · BYPASSRLS · superuser 중 하나). public.funnel_events 소유자(멤버 포함) 또는 superuser 여야 한다. S3 학습자 RPC(story_read_unit · story_my_progress)가
--   authenticated 에 열려 있어야 한다 — S3 quarantine 뒤에는 새 학습자 문을 열지 않는다.
-- 되돌리기: 파괴 없이 s5-proposal-recovery.sql(새 RPC 실행 권한만 회수 — 함수 정의 · 진도 · 추가된 이벤트 이름은 보존).
--   라우트 비노출은 앱 쪽 운영 조치다.
-- 상태: 미적용 · 격리 시험 전.

-- ── A. preflight(fail closed) ────────────────────────────────────────────────

set local lcp_story_s5.in_txn = 'on';

do $$
declare
  v_missing text[];
  v_rel oid := pg_catalog.to_regclass('public.funnel_events');
  v_attnum smallint;
  v_con record;
begin
  if pg_catalog.current_setting('lcp_story_s5.in_txn', true) is distinct from 'on' then
    raise exception 'lcp story s5: 한 트랜잭션으로 감싸 적용해야 한다(set local tripwire 가 사라졌다 — 자동 커밋 실행)';
  end if;
  if pg_catalog.current_setting('transaction_isolation') is distinct from 'read committed' then
    raise exception 'lcp story s5: read committed 에서만 적용한다(현재 %)', pg_catalog.current_setting('transaction_isolation');
  end if;
  if pg_catalog.to_regnamespace('story') is null then
    raise exception 'lcp story s5: schema story does not exist — 적용된 S3 가 없다';
  end if;
  select pg_catalog.array_agg(x order by x) into v_missing
    from pg_catalog.unnest(array[
      'releases.id', 'releases.release_key', 'releases.slot_id', 'releases.edition_version_id', 'releases.source_id',
      'releases.work_key', 'releases.edition_key', 'releases.kind', 'releases.coverage', 'releases.completion_label',
      'releases.counts_as_work_completion', 'releases.source_identity_sha256', 'releases.source_text_sha256',
      'releases.edition_sha256', 'releases.title', 'releases.unit_count', 'releases.withdrawn_at',
      'release_units.release_id', 'release_units.unit_index', 'release_units.unit_id', 'release_units.unit_title',
      'edition_versions.id', 'edition_versions.slot_id', 'edition_versions.artifact', 'edition_versions.edition_sha256',
      'edition_versions.unit_count',
      'sources.id', 'sources.snapshot_meta', 'sources.text_sha256', 'sources.identity_sha256', 'sources.original_language',
      'sources.text_language', 'sources.translator', 'sources.coverage', 'sources.paragraph_count',
      'reading_progress.user_id', 'reading_progress.release_id', 'reading_progress.last_unit_index',
      'reading_progress.furthest_unit_index', 'reading_progress.completed_unit_count', 'reading_progress.completed_at',
      'reading_unit_completions.user_id', 'reading_unit_completions.release_id', 'reading_unit_completions.unit_index']) as x
   where not exists (
     select 1 from pg_catalog.pg_attribute a
      where a.attrelid = pg_catalog.to_regclass('story.' || pg_catalog.split_part(x, '.', 1))
        and a.attname = pg_catalog.split_part(x, '.', 2) and a.attnum > 0 and not a.attisdropped);
  if v_missing is not null then
    raise exception 'lcp story s5: story columns missing: %', v_missing;
  end if;
  select pg_catalog.array_agg(t order by t) into v_missing
    from pg_catalog.unnest(array['story.releases', 'story.release_units', 'story.edition_versions', 'story.sources',
                                 'story.reading_progress', 'story.reading_unit_completions']) as t
   where not pg_catalog.has_table_privilege(t, 'SELECT');
  if v_missing is not null then
    raise exception 'lcp story s5: 적용 역할(= 새 DEFINER 함수 소유자)에 SELECT 권한이 없다: %', v_missing;
  end if;
  -- story 표는 RLS 켜짐 · 정책 없음이다. 소유자(멤버 포함) · BYPASSRLS · superuser 가 아니면 DEFINER 가 0행을 읽어
  -- 적용은 성공해 보이고 모든 호출이 release_unavailable 이 된다 — FORCE RLS 도 같은 결과라 거부한다.
  select pg_catalog.array_agg(c.relname::text order by c.relname) into v_missing
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    cross join (select r.rolsuper, r.rolbypassrls from pg_catalog.pg_roles r where r.rolname = current_user) as me
   where n.nspname = 'story'
     and c.relname in ('releases', 'release_units', 'edition_versions', 'sources', 'reading_progress', 'reading_unit_completions')
     and (c.relforcerowsecurity
          or not (pg_catalog.pg_has_role(current_user, c.relowner, 'USAGE') or me.rolbypassrls or me.rolsuper));
  if v_missing is not null
     or not exists (select 1 from pg_catalog.pg_roles r where r.rolname = current_user) then
    raise exception 'lcp story s5: 적용 역할이 story 표 RLS 를 면제받지 못한다(소유자 · BYPASSRLS · superuser 아님 또는 FORCE RLS): %', v_missing;
  end if;
  -- C 의 ALTER TABLE 이 잠금 뒤 늦게 실패하지 않게 funnel_events 소유자(멤버 포함) 또는 superuser 를 요구한다.
  if v_rel is not null
     and not (pg_catalog.pg_has_role(current_user, (select c.relowner from pg_catalog.pg_class c where c.oid = v_rel), 'USAGE')
              or coalesce((select r.rolsuper from pg_catalog.pg_roles r where r.rolname = current_user), false)) then
    raise exception 'lcp story s5: 적용 역할이 public.funnel_events 소유자가 아니다 — C 의 ALTER 가 실패한다';
  end if;
  if pg_catalog.to_regprocedure('story.require_learner()') is null
     or pg_catalog.to_regprocedure('story.source_rights_ok(uuid)') is null
     or (select p.prorettype from pg_catalog.pg_proc p where p.oid = pg_catalog.to_regprocedure('story.require_learner()'))
        is distinct from 'pg_catalog.uuid'::pg_catalog.regtype::oid
     or (select p.prorettype from pg_catalog.pg_proc p where p.oid = pg_catalog.to_regprocedure('story.source_rights_ok(uuid)'))
        is distinct from 'pg_catalog.bool'::pg_catalog.regtype::oid then
    raise exception 'lcp story s5: story.require_learner() uuid / story.source_rights_ok(uuid) boolean missing';
  end if;
  -- DEFINER 소유자(= 적용 역할)가 실제로 실행할 수 있어야 한다 — 아니면 적용은 성공해 보이고 모든 호출이 42501 이 된다.
  if not pg_catalog.has_schema_privilege('story', 'USAGE')
     or not pg_catalog.has_function_privilege(pg_catalog.to_regprocedure('story.require_learner()'), 'EXECUTE')
     or not pg_catalog.has_function_privilege(pg_catalog.to_regprocedure('story.source_rights_ok(uuid)'), 'EXECUTE') then
    raise exception 'lcp story s5: 적용 역할에 story USAGE / require_learner · source_rights_ok EXECUTE 가 없다';
  end if;
  -- S3 학습자 문이 격리(quarantine)돼 있으면 새 학습자 문을 열지 않는다.
  if pg_catalog.to_regprocedure('public.story_read_unit(text,integer)') is null
     or pg_catalog.to_regprocedure('public.story_my_progress()') is null
     or not pg_catalog.has_function_privilege('authenticated', pg_catalog.to_regprocedure('public.story_read_unit(text,integer)'), 'EXECUTE')
     or not pg_catalog.has_function_privilege('authenticated', pg_catalog.to_regprocedure('public.story_my_progress()'), 'EXECUTE') then
    raise exception 'lcp story s5: S3 학습자 RPC 가 authenticated 에 열려 있지 않다(quarantine 상태) — 새 문을 열지 않는다';
  end if;
  if exists (select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname = 'story_reader_context') then
    raise exception 'lcp story s5: public.story_reader_context already exists — 재적용하지 않는다';
  end if;

  if v_rel is null then
    raise exception 'lcp story s5: public.funnel_events does not exist';
  end if;
  if (select c.relkind from pg_catalog.pg_class c where c.oid = v_rel) is distinct from 'r'
     or exists (select 1 from pg_catalog.pg_inherits i where i.inhparent = v_rel or i.inhrelid = v_rel) then
    raise exception 'lcp story s5: public.funnel_events is not a plain table without inheritance';
  end if;
  select a.attnum into v_attnum from pg_catalog.pg_attribute a
   where a.attrelid = v_rel and a.attname = 'event' and a.attnum > 0 and not a.attisdropped
     and a.atttypid = 'pg_catalog.text'::pg_catalog.regtype::oid;
  if not found then
    raise exception 'lcp story s5: public.funnel_events.event text column missing';
  end if;
  if (select pg_catalog.count(*) from pg_catalog.pg_constraint c
       where c.conrelid = v_rel and c.conname = 'funnel_events_event_check') <> 1 then
    raise exception 'lcp story s5: funnel_events_event_check must exist exactly once';
  end if;
  select c.contype, c.conkey, c.conislocal into v_con from pg_catalog.pg_constraint c
   where c.conrelid = v_rel and c.conname = 'funnel_events_event_check';
  if v_con.contype is distinct from 'c' or v_con.conkey is distinct from array[v_attnum]::smallint[] or not v_con.conislocal then
    raise exception 'lcp story s5: funnel_events_event_check is not a local check constraint on event only';
  end if;
end
$$;

-- ── B. 학습자 읽기 문맥 RPC ─────────────────────────────────────────────────────
-- 반환 jsonb(키 고정 · 모두 명시 허용 목록):
--   { release_key, work_key, edition_key, kind, coverage, completion_label, counts_as_work_completion,
--     counts_as_original_text_completion: false, title, unit_count,
--     progress: null | { last_unit_index, furthest_unit_index, completed_unit_count, completed: bool },   -- 호출한 학습자 것만
--     toc: [ { unit_index, unit_title, completed: bool } ] (unit_index 순 · completed = 이 학습자의 단위 완료 기록 있음),
--     unit: { unit_index, unit_title, anchors: [ { paragraph, start, end, quote } ], offset_unit: 'utf16_code_unit' },
--     source: { identity_sha256, text_sha256, title, author, original_language, text_language, translator,
--               edition_label, coverage, source_url } }
--   anchors 는 판본 단위의 source_anchors 순서 그대로, quote 는 저장된 검증 인용 그대로다. start · end 는 원문 전문 기준
--   UTF-16 코드 단위 반열린 구간 [start, end)(정본 §7) 메타일 뿐 SQL 에서 문자열을 자르지 않는다.
--   source.coverage 는 원천 스냅숏 범위(complete_work · excerpt), 최상위 coverage 는 판본 범위(complete_work · episode · excerpt)다.
--   source.source_url 은 저장된 값 그대로(null 가능) — 링크 안전 처리는 화면 쪽 책임이다.

create function public.story_reader_context(p_release_key text, p_unit_index integer)
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
  v_unit_title text;
  v_artifact jsonb;
  v_unit jsonb;
  v_anchors jsonb;
  v_toc jsonb;
  v_toc_count integer;
  v_toc_max integer;
  v_progress jsonb;
  v_src_text_sha text;
  v_src_identity_sha text;
  v_src_original_language text;
  v_src_text_language text;
  v_src_translator text;
  v_src_coverage text;
  v_src_paragraphs integer;
  v_src_meta jsonb;
begin
  select * into v_release from story.releases rl where rl.release_key = p_release_key and rl.withdrawn_at is null;
  if not found or not story.source_rights_ok(v_release.source_id) then
    raise exception 'story:release_unavailable';
  end if;
  if p_unit_index is null or p_unit_index < 0 or p_unit_index >= v_release.unit_count then
    raise exception 'story:unit_not_found';
  end if;
  select ru.unit_id, ru.unit_title into v_unit_id, v_unit_title
    from story.release_units ru where ru.release_id = v_release.id and ru.unit_index = p_unit_index;
  if not found then
    raise exception 'story:unit_not_found';
  end if;

  -- 발행본이 가리키는 불변 판만 읽는다(판본 자리의 최신 판 · 초안이 아니다). 판 · 원천의 결속을 발행본 행과 다시 대조한다.
  select ev.artifact into v_artifact from story.edition_versions ev
   where ev.id = v_release.edition_version_id and ev.slot_id = v_release.slot_id
     and ev.edition_sha256 = v_release.edition_sha256 and ev.unit_count = v_release.unit_count;
  if not found or v_artifact ->> 'edition_key' is distinct from v_release.edition_key
     or v_artifact ->> 'kind' is distinct from v_release.kind then
    raise exception 'story:reader_context_mismatch' using detail = 'edition_version';
  end if;
  if pg_catalog.jsonb_typeof(v_artifact -> 'units') is distinct from 'array'
     or pg_catalog.jsonb_array_length(v_artifact -> 'units') <> v_release.unit_count then
    raise exception 'story:reader_context_mismatch' using detail = 'unit_count';
  end if;
  v_unit := v_artifact -> 'units' -> p_unit_index;
  if pg_catalog.jsonb_typeof(v_unit -> 'unit_id') is distinct from 'string' or v_unit ->> 'unit_id' is distinct from v_unit_id then
    raise exception 'story:reader_context_mismatch' using detail = 'unit_id';
  end if;

  select s.text_sha256, s.identity_sha256, s.original_language, s.text_language, s.translator, s.coverage,
         s.paragraph_count, s.snapshot_meta
    into v_src_text_sha, v_src_identity_sha, v_src_original_language, v_src_text_language, v_src_translator,
         v_src_coverage, v_src_paragraphs, v_src_meta
    from story.sources s where s.id = v_release.source_id;
  if not found or v_src_text_sha is distinct from v_release.source_text_sha256
     or v_src_identity_sha is distinct from v_release.source_identity_sha256
     or pg_catalog.jsonb_typeof(v_src_meta #> '{work,title}') is distinct from 'string'
     or pg_catalog.jsonb_typeof(v_src_meta #> '{edition,edition_label}') is distinct from 'string'
     or coalesce(pg_catalog.jsonb_typeof(v_src_meta #> '{work,author}'), 'null') not in ('string', 'null')
     or coalesce(pg_catalog.jsonb_typeof(v_src_meta #> '{edition,source_url}'), 'null') not in ('string', 'null') then
    raise exception 'story:reader_context_mismatch' using detail = 'source';
  end if;

  -- 앵커: 비어 있지 않은 배열 · 원문 해시 = 발행본 원문 해시 · 정수 문단/구간(문단 < 원천 문단 수, start < end) · 비어 있지 않은 인용.
  v_anchors := v_unit -> 'source_anchors';
  if pg_catalog.jsonb_typeof(v_anchors) is distinct from 'array' or pg_catalog.jsonb_array_length(v_anchors) = 0
     or exists (
       select 1 from pg_catalog.jsonb_array_elements(v_anchors) as a
        where pg_catalog.jsonb_typeof(a) is distinct from 'object'
           or pg_catalog.jsonb_typeof(a -> 'source_sha256') is distinct from 'string'
           or a ->> 'source_sha256' is distinct from v_release.source_text_sha256
           or pg_catalog.jsonb_typeof(a -> 'paragraph') is distinct from 'number'
           or pg_catalog.jsonb_typeof(a -> 'start') is distinct from 'number'
           or pg_catalog.jsonb_typeof(a -> 'end') is distinct from 'number'
           or pg_catalog.jsonb_typeof(a -> 'quote') is distinct from 'string'
           or a ->> 'quote' = ''
           or case when (a ->> 'paragraph') ~ '^(0|[1-9][0-9]{0,8})$' and (a ->> 'start') ~ '^(0|[1-9][0-9]{0,8})$'
                        and (a ->> 'end') ~ '^[1-9][0-9]{0,8}$'
                   then (a ->> 'paragraph')::integer >= v_src_paragraphs or (a ->> 'start')::integer >= (a ->> 'end')::integer
                   else true end) then
    raise exception 'story:reader_context_mismatch' using detail = 'anchors';
  end if;

  -- 목차: 발행 단위 행 0..unit_count-1 전부(그 밖이면 닫는다). completed 는 이 학습자의 단위 완료 기록만 본다.
  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'unit_index', ru.unit_index,
           'unit_title', ru.unit_title,
           'completed', exists (select 1 from story.reading_unit_completions c
                                 where c.user_id = v_user and c.release_id = ru.release_id and c.unit_index = ru.unit_index))
           order by ru.unit_index),
         pg_catalog.count(*)::integer, pg_catalog.max(ru.unit_index)
    into v_toc, v_toc_count, v_toc_max
    from story.release_units ru where ru.release_id = v_release.id;
  if v_toc_count <> v_release.unit_count or v_toc_max <> v_release.unit_count - 1 then
    raise exception 'story:reader_context_mismatch' using detail = 'toc';
  end if;

  select pg_catalog.jsonb_build_object(
           'last_unit_index', rp.last_unit_index,
           'furthest_unit_index', rp.furthest_unit_index,
           'completed_unit_count', rp.completed_unit_count,
           'completed', rp.completed_at is not null)
    into v_progress
    from story.reading_progress rp where rp.user_id = v_user and rp.release_id = v_release.id;

  return pg_catalog.jsonb_build_object(
    'release_key', v_release.release_key,
    'work_key', v_release.work_key,
    'edition_key', v_release.edition_key,
    'kind', v_release.kind,
    'coverage', v_release.coverage,
    'completion_label', v_release.completion_label,
    'counts_as_work_completion', v_release.counts_as_work_completion,
    'counts_as_original_text_completion', false,
    'title', v_release.title,
    'unit_count', v_release.unit_count,
    'progress', v_progress,
    'toc', v_toc,
    'unit', pg_catalog.jsonb_build_object(
      'unit_index', p_unit_index,
      'unit_title', v_unit_title,
      'anchors', (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                           'paragraph', a -> 'paragraph', 'start', a -> 'start', 'end', a -> 'end', 'quote', a -> 'quote')
                           order by t.o)
                    from pg_catalog.jsonb_array_elements(v_anchors) with ordinality as t(a, o)),
      'offset_unit', 'utf16_code_unit'),
    'source', pg_catalog.jsonb_build_object(
      'identity_sha256', v_src_identity_sha,
      'text_sha256', v_src_text_sha,
      'title', v_src_meta #> '{work,title}',
      'author', v_src_meta #> '{work,author}',
      'original_language', v_src_original_language,
      'text_language', v_src_text_language,
      'translator', v_src_translator,
      'edition_label', v_src_meta #> '{edition,edition_label}',
      'coverage', v_src_coverage,
      'source_url', v_src_meta #> '{edition,source_url}'));
end
$fn$;

comment on function public.story_reader_context(text, integer) is
  'LCP Story 학습자 읽기 문맥(읽기 전용) — 이용 가능한 발행본의 불변 판에서 목차 · 내 진도 · 고른 단위 원문 앵커 인용(UTF-16 오프셋 메타) · 원천 판본 메타 허용 목록. 본문 · 판본 artifact · 권리 · 검수 · UUID 없음(docs/LCP_STORY.md §7 · §12 · §15).';

revoke all on function public.story_reader_context(text, integer) from public, anon, authenticated, service_role;
grant execute on function public.story_reader_context(text, integer) to authenticated;

do $$
declare
  v_fn oid := pg_catalog.to_regprocedure('public.story_reader_context(text,integer)');
  v_grantees oid[];
begin
  select pg_catalog.array_agg(distinct g.grantee order by g.grantee) into v_grantees
    from pg_catalog.pg_proc p cross join lateral pg_catalog.aclexplode(p.proacl) as g
   where p.oid = v_fn and g.privilege_type = 'EXECUTE' and g.grantee <> p.proowner;
  if v_grantees is distinct from array['authenticated'::pg_catalog.regrole::oid]
     or not (select p.prosecdef and p.provolatile = 's' from pg_catalog.pg_proc p where p.oid = v_fn) then
    raise exception 'lcp story s5: story_reader_context grants/attributes unexpected: %', v_grantees;
  end if;
  -- 유효 권한(멤버십 상속 포함) 행렬과 고정 search_path 를 정확히 확인한다.
  if pg_catalog.has_function_privilege('anon', v_fn, 'EXECUTE')
     or pg_catalog.has_function_privilege('service_role', v_fn, 'EXECUTE')
     or pg_catalog.has_function_privilege('public', v_fn, 'EXECUTE')
     or not pg_catalog.has_function_privilege('authenticated', v_fn, 'EXECUTE')
     or (select p.proconfig from pg_catalog.pg_proc p where p.oid = v_fn)
        is distinct from '{"search_path=pg_catalog, pg_temp"}'::text[] then
    raise exception 'lcp story s5: story_reader_context effective privileges/search_path unexpected';
  end if;
end
$$;

-- ── C. funnel_events_event_check 추가형 확장 ─────────────────────────────────────
-- 잠금: 3초 안에 못 얻으면 트랜잭션 전체 실패(재시도 안전). 잠금을 쥔 뒤 식을 읽어야 그 사이 다른 작업자의 변경을 놓치지 않는다
--   (READ COMMITTED — 문장마다 새 스냅숏. A 가 다른 격리 수준을 거부한다).
-- 판정은 문자열 검색이 아니라 실제 평가다: 원래 식을 (event = 후보) 행에 대해 계산한다(conkey = {event} 를 A 가 확인).
--   후보 = 원래 식에 나오는 모든 문자열 리터럴 + 새 이름 2 + 이벤트일 수 없는 표지 값.
--   · 두 이름을 모두 이미 받음 → 변경 없음(멱등). 하나만 받음 · 이름이 식에 나오는데 거부됨 · 표지 값을 받음 · null 결과 → 예외.
--   · 한계: 리터럴 목록이 아닌 식(정규식 등)은 리터럴로 열거할 수 없어 사후 동치 검사가 리터럴 · 두 이름 · 표지 값까지만이다.
-- 검증: 원래 제약이 VALID 면 일반 ADD(기존 행 검증 스캔 1회 — 새 식이 원래 식의 상위 집합이라 실패할 수 없다), NOT VALID 였으면
--   NOT VALID 로 다시 건다(상태 보존). 같은 트랜잭션 안의 NOT VALID + VALIDATE 는 ACCESS EXCLUSIVE 를 커밋까지 쥐므로 이득이 없다.
-- 제약 설명(comment)이 있으면 그대로 다시 붙인다.

set local lock_timeout = '3s';
set local statement_timeout = '60s';
lock table public.funnel_events in access exclusive mode;

do $$
declare
  v_rel oid := pg_catalog.to_regclass('public.funnel_events');
  v_names constant text[] := array['story_catalog_viewed', 'story_reader_action'];
  v_sentinel constant text := '~lcp-story-s5-sentinel-not-an-event~';
  v_eval constant text :=
    'select pg_catalog.array_agg((%s) order by t.o) from pg_catalog.unnest($1::text[]) with ordinality as t(event, o)';
  v_con oid;
  v_conkey smallint[];
  v_old text;
  v_valid boolean;
  v_comment text;
  v_lits text[];
  v_cand text[];
  v_n integer;
  v_old_res boolean[];
  v_new_con oid;
  v_new text;
  v_new_valid boolean;
  v_new_type "char";
  v_new_conkey smallint[];
  v_new_res boolean[];
begin
  if pg_catalog.current_setting('lcp_story_s5.in_txn', true) is distinct from 'on' then
    raise exception 'lcp story s5: 한 트랜잭션으로 감싸 적용해야 한다(C 에서 tripwire 없음)';
  end if;
  select c.oid, c.conkey, pg_catalog.pg_get_expr(c.conbin, c.conrelid), c.convalidated
    into strict v_con, v_conkey, v_old, v_valid
    from pg_catalog.pg_constraint c
   where c.conrelid = v_rel and c.conname = 'funnel_events_event_check' and c.contype = 'c';
  v_lits := array(select pg_catalog.replace(m[1], '''''', '''')
                    from pg_catalog.regexp_matches(v_old, '''((?:[^'']|'''')*)''', 'g') as m);
  v_n := pg_catalog.cardinality(v_lits);
  if v_old is null or v_n = 0 then
    raise exception 'lcp story s5: funnel_events_event_check expression has no literals — 닫힌 허용 목록으로 보이지 않는다';
  end if;
  v_cand := v_lits || v_names || array[v_sentinel];
  execute pg_catalog.format(v_eval, v_old) into v_old_res using v_cand;
  if pg_catalog.array_position(v_old_res, null) is not null or v_old_res[v_n + 3] then
    raise exception 'lcp story s5: original expression is not a closed event allowlist (null or sentinel accepted)';
  end if;
  if v_old_res[v_n + 1] and v_old_res[v_n + 2] then
    raise notice 'lcp story s5: funnel_events_event_check already accepts both names — 변경 없음';
    return;
  end if;
  if v_old_res[v_n + 1] or v_old_res[v_n + 2] or v_lits && v_names then
    raise exception 'lcp story s5: funnel_events_event_check partially contains the new names — 모호하다, 손대지 않는다';
  end if;
  v_comment := pg_catalog.obj_description(v_con, 'pg_constraint');

  alter table public.funnel_events drop constraint funnel_events_event_check;
  execute pg_catalog.format(
    'alter table public.funnel_events add constraint funnel_events_event_check check ((%s) or (event = any (array[''story_catalog_viewed''::text, ''story_reader_action''::text])))%s',
    v_old, case when v_valid then '' else ' not valid' end);
  if v_comment is not null then
    execute pg_catalog.format('comment on constraint funnel_events_event_check on public.funnel_events is %L', v_comment);
  end if;

  -- 사후 확인: 하나뿐 · check · event 열 · 검증 상태 그대로 · 원래 식 텍스트 보존 · 두 이름 포함 · 리터럴 판정 동일 · 두 이름 허용 · 표지 거부.
  select c.oid, pg_catalog.pg_get_expr(c.conbin, c.conrelid), c.convalidated, c.contype, c.conkey
    into strict v_new_con, v_new, v_new_valid, v_new_type, v_new_conkey
    from pg_catalog.pg_constraint c
   where c.conrelid = v_rel and c.conname = 'funnel_events_event_check';
  if v_new_type is distinct from 'c' or v_new_conkey is distinct from v_conkey or v_new_valid is distinct from v_valid then
    raise exception 'lcp story s5 postcheck: constraint shape/validation changed';
  end if;
  -- 원래 식이 이미 OR 이면 파서가 OR 를 평탄화해 「((a) OR (b) OR (새))」가 된다 — 그때는 원래 식에서 마지막 ')' 를 뺀 앞부분으로 시작해야 한다.
  if pg_catalog.strpos(v_new, v_old) = 0 and not pg_catalog.starts_with(v_new, pg_catalog.left(v_old, -1) || ' OR ') then
    raise exception 'lcp story s5 postcheck: original expression text not preserved';
  end if;
  if pg_catalog.strpos(v_new, '''story_catalog_viewed''::text') = 0 or pg_catalog.strpos(v_new, '''story_reader_action''::text') = 0 then
    raise exception 'lcp story s5 postcheck: new names missing from expression';
  end if;
  execute pg_catalog.format(v_eval, v_new) into v_new_res using v_cand;
  if pg_catalog.array_position(v_new_res, null) is not null
     or v_new_res[1:v_n] is distinct from v_old_res[1:v_n]
     or not (v_new_res[v_n + 1] and v_new_res[v_n + 2]) or v_new_res[v_n + 3] then
    raise exception 'lcp story s5 postcheck: semantic check failed';
  end if;
  if pg_catalog.obj_description(v_new_con, 'pg_constraint') is distinct from v_comment then
    raise exception 'lcp story s5 postcheck: constraint comment not preserved';
  end if;
  raise notice 'lcp story s5: funnel_events_event_check extended (literals %, validated %)', v_n, v_valid;
end
$$;
