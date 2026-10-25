// scripts/db/lcp-story-s3/deploy.mjs
//
// LCP Story S3 SQL 의 승인형 배포 러너(T-0169 hardening). 정책: 중앙 development_policy.db_apply(2026-10-25) — 공유 DB 쓰기는
// 사용자 대화 승인 뒤 main_worktree(main-serving)의 이 러너 apply 로만, db-approval 훅의 1회용 티켓을 소비하고 실행 기록을 남긴다.
// MCP SQL 도구로 쓰지 않는다. 사용자 입력으로 SQL 을 받지 않는다(본문은 저장소 파일 바이트뿐).
//
//   node scripts/db/lcp-story-s3/deploy.mjs preflight --stage schema|quarantine --deps <dir> [--db-url-env KEY] [--ca <PEM>]   # 읽기 전용
//   node scripts/db/lcp-story-s3/deploy.mjs apply     --stage schema|quarantine --deps <dir> [--db-url-env KEY] [--ca <PEM>] --confirm-sha <sha>
//   node scripts/db/lcp-story-s3/deploy.mjs verify    --stage schema|quarantine --deps <dir> [--db-url-env KEY] [--ca <PEM>]   # 읽기 전용
//   --ca: 운영자가 준 PEM 파일(Supabase Root 2021 CA 등)을 신뢰 루트로 쓴다 — 검증을 끄지 않는다(rejectUnauthorized:true ·
//   servername = 대상 호스트 · tls.checkServerIdentity · TLS 1.2 이상). 검증을 끄는 인자 · 환경 변수 경로는 없고
//   NODE_TLS_REJECT_UNAUTHORIZED 가 '1' 이 아닌 값으로 있으면 접속 전에 차단한다. Node 의 TLS 버전 상한 플래그(--tls-max-v1.2)만 허용.
//
// 종료 코드: 0 성공 · 1 사용법 · 2 적용 전 차단(아무것도 쓰지 않음) · 3 롤백됨 · 4 결과 불명/검증 실패(재시도 금지 · /db-incident)
//
// ── apply 의 DB 접속 전 차단(이 순서, 앞 묶음이 막히면 거기서 멈춘다 — 모두 DB 접속 · 티켓 소비 전) ─────────────────
//   0. 사용법: 명령 · 단계 · --deps 필수 · 모르는 인자 · 중복 인자 → 종료 1
//   1. 권한: 자동화(VFC_AUTOMATED_RUN=1 · AGENT_GUARD_ASK=0 · CI≠false) 거절 · --confirm-sha = STAGES[stage].sha256 ·
//      --approval-nonce(48 hex) 필수. **TTY 예외 없음** — 터미널의 `APPLY <stage> <sha>` 입력은 티켓에 더하는 추가 확인일 뿐 대신하지 않는다.
//   2. 위치 + 실행 환경(한 묶음으로 함께 판정):
//      · 위치 — process.argv[1] realpath = 이 파일 realpath = <ROOT>/scripts/db/lcp-story-s3/deploy.mjs(복사본 · node -e import 거절),
//        그리고 이 파일 · ROOT 의 realpath 가 중앙 설정(CENTRAL_DEV_MODE)의 main_worktree realpath 와 같아야 한다(Windows 는 대소문자 무시).
//        설정은 고정 경로로만 읽고 환경 변수로 바꾸지 않는다(바꿀 수 있으면 위치 검사를 우회할 수 있다). 못 읽으면 차단.
//      · 실행 환경 — VF_DB_APPROVAL_DIR 이 있으면 차단(티켓 위치 재지정). 홈(os.homedir = USERPROFILE/HOME)이 계정 프로필
//        (os.userInfo().homedir)과 다르면 차단. 티켓은 계정 프로필 아래 고정 폴더(fixedApprovalDir)에서만 소비한다.
//        process.execArgv · NODE_OPTIONS 에 TLS 버전 플래그 밖의 것(--require · -r · --import · --loader · --inspect · --env-file …)이 있으면 차단.
//        TLS 검증을 끄는 NODE_TLS_REJECT_UNAUTHORIZED 도 차단. (같은 OS 계정의 의도적 위조 — 사전 로드가 검사 자체를 바꾸는 것 — 까지는
//        막지 못한다. db-approval.mjs 의 문서화된 한계와 같다.)
//   3. 본문: 파일 바이트 sha256 = STAGES · 최상위 문 정적 검사(SQL_POLICY — 아래).
//   4. 커밋 상태: main_worktree HEAD 가 브랜치 main 이고, 러너가 실제로 import 하는 모듈 폐포(importClosure — db-approval.mjs ·
//      factory-i1 의 deploy · build · catalog · sql · source · restore · spec) · 단계 SQL 이 git 추적 중이며 HEAD 와 같다(--no-optional-locks, 읽기만).
//   5. 접속 준비: TLS 환경 · --ca PEM(인증서만 · CA 인증서 · 해석 가능) · --deps 의 pg · 접속 문자열(값은 출력 · 로그에 남기지 않음) ·
//      대상 = 개발 DB 직결 또는 session pooler 5432(쿼리 문자열 금지 — sslmode 로 TLS 설정을 덮을 수 없다).
// 접속 뒤 · 쓰기 전: 읽기 전용 트랜잭션에서 이력 순서(evaluate) · preflight → 막히면 종료 2(티켓은 소비하지 않음) →
//   (TTY 면 추가 입력) → 티켓 소비(consumeTicket — 고정 폴더, 실패하면 종료 2) → 'applying' 로그 → applyStage → 사후 verify(읽기 전용).
//
// ── applyStage = 한 트랜잭션(BEGIN ISOLATION LEVEL REPEATABLE READ) ───────────────────────────────────────
//   이력 표 SHARE ROW EXCLUSIVE 잠금(스냅숏을 잡기 전 — LOCK 은 스냅숏을 만들지 않는다) → 이력 읽기(여기서 스냅숏) → 순서 재판정 →
//   preflight 재판정 → 지문(전) → 본문(단순 질의 1회) → 지문(후) → 다르면 롤백 → VERIFY_SQL[stage](권한 행렬 · RLS · 집합) →
//   하나라도 실패하면 롤백 → 이력 행 1개 → COMMIT. 잘못된 권한이 커밋된 뒤에야 발견되는 일이 없다(사후 verify 는 재확인).
//   · 단계 SQL 파일에는 BEGIN/COMMIT 이 없다 — 러너가 감싼다. 최상위 트랜잭션 제어 · 트랜잭션 밖 전용 문이 있으면 applyStage 가 시작 전에 거절한다.
//     그래서 파일을 단독 실행하면 원자성이 없다 — 공유 DB 에 직접 돌리지 않는다.
//   · 실패는 전체 롤백(부분 스키마 · 이력 행 없음). COMMIT 을 보낸 뒤 확인을 못 받으면 결과 불명(종료 4, 재시도 금지).
//   · quarantine 도 같은 함수 · 같은 트랜잭션이라 원자적이다. 최상위 문은 DO · REVOKE 만 허용하고(정적 검사), story 표 행 · 정의 ·
//     함수 정의(ACL 제외) 지문까지 전후 비교한다(비파괴 확인). 표 · 행 · 이력은 남는다.
//   · REPEATABLE READ 인 이유: 전후 지문이 같은 스냅숏을 읽어 다른 세션의 무관한 동시 쓰기로 거짓 실패가 나지 않고, 본문 자신의 변경은
//     같은 트랜잭션 안이라 보인다. 본문은 새 객체 생성 · 권한 문 · 사전 검사 DO 블록뿐이라 RR 에서 동작한다
//     (story_admin_publish · story_service_attest_validation 의 READ COMMITTED 요구는 RPC 호출 때만 걸리고 적용 중에는 부르지 않는다).
//
// ── 지문 범위(FINGERPRINT_SCOPE) — 이것보다 넓게 주장하지 않는다 ────────────────────────────────────────
//   rows:<표>  = 행 수 + 각 행 전체 텍스트(md5(행::text) — 모든 사용자 열 값)의 정렬 목록 md5. 행 추가 · 삭제 · 열 값 변경을 잡는다.
//                같은 값으로 다시 쓴 UPDATE(값 불변)는 잡지 않는다 — 「보이는 행 내용 불변」이지 「튜플을 다시 쓰지 않음」이 아니다.
//   def:<표>   = 그 표의 원시 카탈로그 열: pg_class(relkind · relpersistence · relnatts · RLS 두 플래그 · relreplident · relispartition · ACL),
//                pg_attribute(이름 · 형 · typmod · not null · 기본값 유무 · identity · generated · 삭제 · collation · 열 ACL), pg_attrdef,
//                그 표를 가리키거나 그 표에 걸린 pg_constraint, pg_trigger, pg_policy, pg_index, pg_rewrite.
//                syscache 를 읽는 pg_get_* 함수와 VACUUM 이 제자리에서 바꾸는 통계 열(relpages · reltuples · relhas*)은 쓰지 않는다.
//   functions:story(quarantine 만) = story.* · public.story_* 함수 정의(원시 pg_proc 열 + md5(prosrc), proacl 제외).
//   schema 단계 = 원본 5표(LEGACY_TABLES) rows + def. quarantine 단계 = 원본 5표 + story 12표 rows + def + functions:story.
//   이 밖의 표 · 객체는 지문에 없다. 대신 SQL_POLICY 가 최상위 문이 story 스키마 · public.story_* 함수만 만들고 권한을 다루는지 본다
//   (DO 블록 안쪽은 정적 검사 밖 — 그 효과는 위 지문 범위만큼만 확인된다).
//
// 격리 시험(verify-isolated.ts --engine pg17)은 자기 임시 클러스터에서 applyStage · runVerify 를 직접 부른다 — CLI 에는 승인 · 위치를
// 건너뛰는 인자가 없다.

import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { createInterface } from 'node:readline/promises'
import tls from 'node:tls'
import { fileURLToPath } from 'node:url'
import { consumeTicket, NONCE_FLAG } from '../../../agents/scripts/db-approval.mjs'
import { redactText, resolveDbUrl, targetOf, ticketApprovalRecord, writeAuthorizationBlocks } from '../factory-i1/deploy.mjs'

const SELF = fileURLToPath(import.meta.url)
const ROOT = path.resolve(path.dirname(SELF), '..', '..', '..')
const RUNNER = 'lcp-story-s3'
const RUNNER_REL = 'scripts/db/lcp-story-s3/deploy.mjs'
const LOG_DIR = 'scripts/db/lcp-story-s3/logs' // .gitignore 의 logs/ 가 덮는다
/** 중앙 개발 정책 — main_worktree 를 여기서만 읽는다(환경 변수 재지정 없음). */
export const CENTRAL_DEV_MODE = 'D:/workspace/Vocaflow-AI-Control/config/dev-mode.json'
/** 이 실행이 허용하는 Node 플래그(execArgv · NODE_OPTIONS) — TLS 버전 범위만. 사전 로드 · 로더 · 디버거 · env 파일 등은 모두 거절. */
const ALLOWED_NODE_FLAGS = /^--tls-(max|min)-v1\.[23]$/

export const STAGES = {
  schema: {
    version: '20261025140000', name: 'lcp_story_s3_schema',
    path: 'supabase/migrations/_pending_lcp_story_s3_schema.sql',
    sha256: '09fb0dc48e49530c50f8fbe0cb1f06ef128fc5be9be103b1bdc6e8b3d85b560c',
    after: null,
  },
  quarantine: {
    version: '20261025140100', name: 'lcp_story_s3_quarantine',
    path: 'supabase/migrations/_pending_lcp_story_s3_quarantine.sql',
    sha256: 'a9e7258907f6c0afeb564b8d2bc312f7ad7398588fa7a11357cd1be0ac74f016',
    after: 'schema',
  },
}

const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex')
const same = (a, b, platform = process.platform) => a != null && b != null && (platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b)

// ── 계약(docs/LCP_STORY.md §15 · supabase/migrations/_pending_lcp_story_s3_schema.sql) ──────────────────────

export const STORY_TABLES = ['sources', 'policies', 'edition_slots', 'edition_versions', 'reviews', 'validation_attestations',
  'rights_decisions', 'releases', 'release_units', 'reading_progress', 'reading_unit_completions', 'action_log']
export const RPC = {
  admin: ['story_admin_register_source', 'story_admin_register_policy', 'story_admin_submit_edition', 'story_admin_submit_review',
    'story_admin_record_rights', 'story_admin_publish', 'story_admin_withdraw', 'story_admin_list_slots', 'story_admin_get_bundle'],
  service: ['story_service_validation_input', 'story_service_attest_validation'],
  learner: ['story_catalog', 'story_read_unit', 'story_record_position', 'story_complete_unit', 'story_my_progress'],
}
export const STORY_RPCS = [...RPC.admin, ...RPC.service, ...RPC.learner]
/** 실행 권한 행렬 — anon 은 story_catalog 만 · authenticated 는 서비스 2개를 뺀 14개 · service_role 은 서비스 2개만 · PUBLIC 없음 */
export const GRANT_MATRIX = Object.fromEntries(STORY_RPCS.map((f) => [f,
  RPC.service.includes(f) ? ['service_role'] : f === 'story_catalog' ? ['anon', 'authenticated'] : ['authenticated']]))
/** 원본 지문 대상 표 — RPC 가 읽는 표(도서 · 프로필)와 S3 가 쓰지 않는다고 약속한 읽기 · 학습 표 */
export const LEGACY_TABLES = ['public.library_books', 'public.user_profiles', 'public.texts', 'public.content_chunks', 'public.reading_sessions']

const sqlList = (xs) => `array[${xs.map((x) => `'${x}'`).join(', ')}]::text[]`
const TABLES = sqlList(STORY_TABLES)
const FNS = sqlList(STORY_RPCS)
const SERVICE_FNS = sqlList(RPC.service)
const ANON_FNS = sqlList(['story_catalog'])
const CLIENT_ROLES = sqlList(['anon', 'authenticated', 'service_role'])
const STORY_RPC_ROWS = `from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = any(${FNS})`
const PUBLIC_STORY_ROWS = `from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname like 'story\\_%'`
const publicExec = (p) => `exists (select 1 from aclexplode(coalesce(${p}.proacl, acldefault('f', ${p}.proowner))) x where x.grantee = 0 and x.privilege_type = 'EXECUTE')`
const clientExec = (p) => `(has_function_privilege('anon', ${p}.oid, 'EXECUTE') or has_function_privilege('authenticated', ${p}.oid, 'EXECUTE') or has_function_privilege('service_role', ${p}.oid, 'EXECUTE') or ${publicExec(p)})`
const execMatches = (role, expected) => `has_function_privilege('${role}', p.oid, 'EXECUTE') = (${expected})`
const TABLE_PRIVS = "'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'"
const COLUMN_PRIVS = "'SELECT,INSERT,UPDATE,REFERENCES'"
const relPriv = (r) => `(has_table_privilege(${r}, c.oid, ${TABLE_PRIVS}) or has_any_column_privilege(${r}, c.oid, ${COLUMN_PRIVS}))`
const colExists = (spec, extra = '') => `exists (select 1 from pg_attribute a where a.attrelid = to_regclass(split_part(${spec}, ':', 1)) and a.attname = split_part(${spec}, ':', 2) and a.attnum > 0 and not a.attisdropped${extra})`
// pg_trigger.tgtype 비트: ROW 1 · BEFORE 2 · INSERT 4 · DELETE 8 · UPDATE 16 · TRUNCATE 32
const trig = (mask, want) => `exists (select 1 from pg_trigger x where x.tgrelid = to_regclass('story.' || t.t) and not x.tgisinternal and (x.tgtype::int & ${mask}) = ${want})`

const NO_CLIENT_SCHEMA = `select 'no_client_schema_privileges', bool_and(not has_schema_privilege(r, 'story', 'USAGE,CREATE')), string_agg(r, ',') filter (where has_schema_privilege(r, 'story', 'USAGE,CREATE')) from unnest(${CLIENT_ROLES}) r`
const NO_CLIENT_RELATIONS = `select 'no_client_table_privileges', coalesce(bool_and(not ${relPriv('r')}), false), string_agg(r || ':' || c.relname, ',') filter (where ${relPriv('r')}) from pg_class c cross join unnest(${CLIENT_ROLES}) r where c.relnamespace = to_regnamespace('story') and c.relkind in ('r', 'p', 'v', 'm', 'f')`
const NO_CLIENT_SEQUENCES = `select 'no_client_sequence_privileges', coalesce(bool_and(not has_sequence_privilege(r, c.oid, 'USAGE,SELECT,UPDATE')), true), string_agg(r || ':' || c.relname, ',') filter (where has_sequence_privilege(r, c.oid, 'USAGE,SELECT,UPDATE')) from pg_class c cross join unnest(${CLIENT_ROLES}) r where c.relnamespace = to_regnamespace('story') and c.relkind = 'S'`
const FINGERPRINT_TABLES_PRESENT = `select 'fingerprint_tables_present', bool_and(to_regclass(t) is not null), string_agg(t, ',') filter (where to_regclass(t) is null) from unnest(${sqlList(LEGACY_TABLES)}) t`

export const HISTORY_SQL = `select version, name, encode(sha256(convert_to(array_to_string(statements, ''), 'UTF8')), 'hex') as sha256
  from supabase_migrations.schema_migrations where version in (${Object.values(STAGES).map((s) => `'${s.version}'`).join(',')}) order by version`

/** 적용 전 읽기 전용 전제 — 각 행 (check, ok, detail). apply 는 접속 직후 한 번, 쓰기 트랜잭션 안(잠금 뒤)에서 한 번 더 본다. */
export const PREFLIGHT_SQL = {
  schema: [
    `select 'story_schema_absent', to_regnamespace('story') is null, null`,
    `select 'no_public_story_functions', count(*) = 0, string_agg(p.proname, ',') ${PUBLIC_STORY_ROWS}`,
    `select 'server_version_13_plus', current_setting('server_version_num')::int >= 130000, current_setting('server_version')`,
    `select 'prereq_functions', bool_and(to_regprocedure(f) is not null), string_agg(f, ',') filter (where to_regprocedure(f) is null) from unnest(${sqlList(['auth.uid()', 'pg_catalog.gen_random_uuid()', 'pg_catalog.sha256(bytea)'])}) f`,
    `select 'prereq_columns', bool_and(${colExists('c')}), string_agg(c, ',') filter (where not ${colExists('c')}) from unnest(${sqlList([
      'public.user_profiles:user_id', 'public.user_profiles:role', 'public.user_profiles:status',
      'public.library_books:id', 'public.library_books:source', 'public.library_books:source_id', 'public.library_books:status',
      'supabase_migrations.schema_migrations:version', 'supabase_migrations.schema_migrations:name', 'supabase_migrations.schema_migrations:statements',
      'supabase_migrations.schema_migrations:created_by', 'supabase_migrations.schema_migrations:idempotency_key'])}) c`,
    `select 'prereq_roles', count(*) = 3, string_agg(rolname, ',' order by rolname) from pg_roles where rolname in ('anon', 'authenticated', 'service_role')`,
    FINGERPRINT_TABLES_PRESENT,
  ],
  quarantine: [
    `select 'story_schema_present', to_regnamespace('story') is not null, null`,
    `select 'story_tables_present', bool_and(to_regclass('story.' || t) is not null), string_agg(t, ',') filter (where to_regclass('story.' || t) is null) from unnest(${TABLES}) t`,
    `select 'story_rpcs_present', count(*) = ${STORY_RPCS.length} and count(distinct p.proname) = ${STORY_RPCS.length}, string_agg(p.proname, ',' order by p.proname) ${STORY_RPC_ROWS}`,
    FINGERPRINT_TABLES_PRESENT,
  ],
}

/** 단계별 사후 검증 — 각 행 (check, ok, detail). schema 는 「적용 직후」 기준(story 행 0)이다. */
export const VERIFY_SQL = {
  schema: [
    `select 'tables_exist_rls', bool_and(coalesce(c.relrowsecurity, false)), string_agg(t.t, ',') filter (where not coalesce(c.relrowsecurity, false)) from unnest(${TABLES}) t(t) left join pg_class c on c.oid = to_regclass('story.' || t.t)`,
    `select 'story_table_set_exact', count(*) = ${STORY_TABLES.length} and coalesce(bool_and(c.relname = any(${TABLES})), false), string_agg(c.relname, ',' order by c.relname) from pg_class c where c.relnamespace = to_regnamespace('story') and c.relkind in ('r', 'p')`,
    NO_CLIENT_SCHEMA,
    NO_CLIENT_RELATIONS,
    NO_CLIENT_SEQUENCES,
    `select 'rpc_set_exact', count(*) = ${STORY_RPCS.length} and count(distinct p.proname) = ${STORY_RPCS.length} and coalesce(bool_and(p.proname = any(${FNS})), false), string_agg(p.proname, ',' order by p.proname) ${PUBLIC_STORY_ROWS}`,
    `select 'rpc_definer_search_path_pg_temp', coalesce(bool_and(p.prosecdef and coalesce(array_to_string(p.proconfig, ','), '') = 'search_path=pg_catalog, pg_temp'), false), string_agg(p.proname, ',') filter (where not (p.prosecdef and coalesce(array_to_string(p.proconfig, ','), '') = 'search_path=pg_catalog, pg_temp')) ${STORY_RPC_ROWS}`,
    `select 'no_public_execute', coalesce(bool_and(not ${publicExec('p')}), false), string_agg(p.proname, ',') filter (where ${publicExec('p')}) ${STORY_RPC_ROWS}`,
    `select 'anon_only_catalog', coalesce(bool_and(${execMatches('anon', `p.proname = any(${ANON_FNS})`)}), false), string_agg(p.proname, ',') filter (where not ${execMatches('anon', `p.proname = any(${ANON_FNS})`)}) ${STORY_RPC_ROWS}`,
    `select 'authenticated_all_but_service', coalesce(bool_and(${execMatches('authenticated', `not (p.proname = any(${SERVICE_FNS}))`)}), false), string_agg(p.proname, ',') filter (where not ${execMatches('authenticated', `not (p.proname = any(${SERVICE_FNS}))`)}) ${STORY_RPC_ROWS}`,
    `select 'service_role_only_service_rpcs', coalesce(bool_and(${execMatches('service_role', `p.proname = any(${SERVICE_FNS})`)}), false), string_agg(p.proname, ',') filter (where not ${execMatches('service_role', `p.proname = any(${SERVICE_FNS})`)}) ${STORY_RPC_ROWS}`,
    `select 'story_internal_not_executable', coalesce(bool_and(not ${clientExec('p')}), true), string_agg(p.proname, ',') filter (where ${clientExec('p')}) from pg_proc p where p.pronamespace = to_regnamespace('story')`,
    `select 'mutation_guards_present', bool_and(g.ok), string_agg(g.t, ',') filter (where not g.ok) from (select t.t, ${trig(19, 19)} and ${trig(11, 11)} and ${trig(35, 34)} as ok from unnest(${TABLES}) t(t)) g`,
    `select 'contract_columns', bool_and(${colExists('c', " and (split_part(c, ':', 3) <> 'not_null' or a.attnotnull)")}), string_agg(c, ',') filter (where not ${colExists('c', " and (split_part(c, ':', 3) <> 'not_null' or a.attnotnull)")}) from unnest(${sqlList([
      'story.action_log:actor_kind:not_null', 'story.releases:validation_attestation_id:not_null', 'story.validation_attestations:binding_sha256:not_null',
      'story.reading_unit_completions:unit_index:not_null', 'story.reading_progress:furthest_unit_index:not_null'])}) c`,
    `select 'story_rows_empty_initial', (${STORY_TABLES.map((t) => `(select count(*) from story.${t})`).join(' + ')}) = 0, null`,
  ],
  quarantine: [
    `select 'tables_kept', bool_and(to_regclass('story.' || t) is not null), string_agg(t, ',') filter (where to_regclass('story.' || t) is null) from unnest(${TABLES}) t`,
    `select 'rpc_closed_all_16', count(*) = ${STORY_RPCS.length} and coalesce(bool_and(not ${clientExec('p')}), false), string_agg(p.proname, ',') filter (where ${clientExec('p')}) ${STORY_RPC_ROWS}`,
    `select 'public_story_rpcs_closed', coalesce(bool_and(not ${clientExec('p')}), true), string_agg(p.proname, ',') filter (where ${clientExec('p')}) ${PUBLIC_STORY_ROWS}`,
    NO_CLIENT_SCHEMA,
    NO_CLIENT_RELATIONS,
  ],
}

// ── 지문 ─────────────────────────────────────────────────────────────────────────────────────────

const aclRows = (col) => `(select string_agg(row(x.grantor, x.grantee, x.privilege_type, x.is_grantable)::text, ',' order by x.grantee, x.privilege_type, x.grantor) from aclexplode(${col}) x)`

/** 행 수 + 행마다 md5(행 전체 텍스트)를 정렬해 이은 md5 — 한 거대 문자열 대신 행 해시를 모은다. */
export const rowDigestSql = (table) =>
  `select 'rows:${table}', count(*)::text || ':' || md5(coalesce(string_agg(s.h, '' order by s.h collate "C"), '')) from (select md5(vf_fp_row::text) as h from ${table} vf_fp_row) s`

/** 표 정의 — 원시 카탈로그 열만(syscache 함수 · 제자리 갱신 통계 열 없음) */
export const definitionDigestSql = (table) => `select 'def:${table}', md5(row(
  (select row(c.relkind, c.relpersistence, c.relnatts, c.relrowsecurity, c.relforcerowsecurity, c.relreplident, c.relispartition, ${aclRows('c.relacl')})::text from pg_class c where c.oid = r.oid),
  (select string_agg(row(a.attnum, a.attname, a.atttypid, a.atttypmod, a.attnotnull, a.atthasdef, a.attidentity, a.attgenerated, a.attisdropped, a.attcollation, ${aclRows('a.attacl')})::text, ',' order by a.attnum) from pg_attribute a where a.attrelid = r.oid and a.attnum > 0),
  (select string_agg(row(d.adnum, d.adbin)::text, ',' order by d.adnum) from pg_attrdef d where d.adrelid = r.oid),
  (select string_agg(row(k.conname, k.contype, k.conrelid, k.confrelid, k.conkey, k.confkey, k.condeferrable, k.condeferred, k.convalidated, k.confupdtype, k.confdeltype, k.conbin)::text, ',' order by k.conrelid, k.conname) from pg_constraint k where k.conrelid = r.oid or k.confrelid = r.oid),
  (select string_agg(row(g.tgname, g.tgfoid, g.tgtype, g.tgenabled, g.tgisinternal, g.tgconstraint)::text, ',' order by g.tgname) from pg_trigger g where g.tgrelid = r.oid),
  (select string_agg(row(p.polname, p.polcmd, p.polpermissive, p.polroles, p.polqual, p.polwithcheck)::text, ',' order by p.polname) from pg_policy p where p.polrelid = r.oid),
  (select string_agg(row(i.indexrelid, i.indkey, i.indisunique, i.indisprimary, i.indisexclusion, i.indexprs, i.indpred)::text, ',' order by i.indexrelid) from pg_index i where i.indrelid = r.oid),
  (select string_agg(row(w.rulename, w.ev_type, w.ev_enabled, w.is_instead)::text, ',' order by w.rulename) from pg_rewrite w where w.ev_class = r.oid)
)::text) from (select '${table}'::regclass::oid as oid) r`

/** story.* · public.story_* 함수 정의(실행 권한 proacl 은 뺀다 — quarantine 이 바꾸는 유일한 것) */
export const STORY_FUNCTIONS_DIGEST_SQL = `select 'functions:story', count(*)::text || ':' || md5(coalesce(string_agg(row(p.oid, p.pronamespace, p.proname, p.proowner, p.prolang, p.prokind, p.prosecdef, p.proleakproof, p.proisstrict, p.proretset, p.provolatile, p.proparallel, p.pronargs, p.prorettype, p.proargtypes, p.proallargtypes, p.proargmodes, p.proargnames, p.proconfig, md5(p.prosrc))::text, ',' order by p.oid), '')) from pg_proc p where p.pronamespace = to_regnamespace('story') or (p.pronamespace = 'public'::regnamespace and p.proname like 'story\\_%')`

const STORY_QUALIFIED = STORY_TABLES.map((t) => `story.${t}`)
export const FINGERPRINT_SCOPE = {
  schema: { rows: LEGACY_TABLES, definitions: LEGACY_TABLES, storyFunctions: false },
  quarantine: { rows: [...LEGACY_TABLES, ...STORY_QUALIFIED], definitions: [...LEGACY_TABLES, ...STORY_QUALIFIED], storyFunctions: true },
}
export const FINGERPRINT_SQL = Object.fromEntries(Object.entries(FINGERPRINT_SCOPE).map(([stage, s]) => [stage, [
  ...s.rows.map(rowDigestSql), ...s.definitions.map(definitionDigestSql), ...(s.storyFunctions ? [STORY_FUNCTIONS_DIGEST_SQL] : []),
]]))

export function compareFingerprints(stage, before, after) {
  const names = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])].sort()
  const changed = names.filter((n) => before?.[n] !== after?.[n])
  return { scope: stage, before, after, changed, unchanged: names.length > 0 && changed.length === 0 }
}

// ── 본문 정적 검사(SQL_POLICY) ─────────────────────────────────────────────────────────────────────

const isIdentChar = (ch) => ch !== undefined && /[A-Za-z0-9_$]/.test(ch)

/** 최상위 SQL 문 — 주석 · 문자열 · 달러 인용 · 따옴표 식별자를 걷어 내고 ; 로 나눈다(소문자 · 공백 1칸). 끝나지 않은 인용은 던진다. */
export function topLevelStatements(sql) {
  const out = []
  let cur = ''
  let i = 0
  const n = sql.length
  const push = () => {
    const s = cur.replace(/\s+/g, ' ').trim().toLowerCase()
    if (s) out.push(s)
    cur = ''
  }
  while (i < n) {
    const c = sql[i]
    const d = sql[i + 1]
    if (c === '-' && d === '-') {
      const j = sql.indexOf('\n', i)
      i = j < 0 ? n : j
      cur += ' '
    } else if (c === '/' && d === '*') {
      let depth = 1
      i += 2
      while (i < n && depth) {
        if (sql[i] === '/' && sql[i + 1] === '*') { depth++; i += 2 } else if (sql[i] === '*' && sql[i + 1] === '/') { depth--; i += 2 } else i++
      }
      if (depth) throw new Error('끝나지 않은 /* 주석')
      cur += ' '
    } else if (c === "'") {
      const escapes = /[eE]/.test(sql[i - 1] ?? '') && !isIdentChar(sql[i - 2])
      if (escapes) cur = cur.slice(0, -1) // E'…' 의 E 접두는 문자열의 일부
      i++
      for (;;) {
        if (i >= n) throw new Error('끝나지 않은 문자열')
        if (escapes && sql[i] === '\\') { i += 2; continue }
        if (sql[i] === "'") { if (sql[i + 1] === "'") { i += 2; continue } i++; break }
        i++
      }
      cur += " '' "
    } else if (c === '"') {
      i++
      for (;;) {
        if (i >= n) throw new Error('끝나지 않은 따옴표 식별자')
        if (sql[i] === '"') { if (sql[i + 1] === '"') { i += 2; continue } i++; break }
        i++
      }
      cur += ' "_" '
    } else if (c === '$' && !isIdentChar(sql[i - 1]) && /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/.test(sql.slice(i, i + 64))) {
      const tag = sql.slice(i, i + 64).match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/)[0]
      const end = sql.indexOf(tag, i + tag.length)
      if (end < 0) throw new Error(`끝나지 않은 달러 인용 ${tag}`)
      i = end + tag.length
      cur += ' $$ '
    } else if (c === ';') {
      push()
      i++
    } else {
      cur += c
      i++
    }
  }
  push()
  return out
}

/** 원자성을 깨는 최상위 문 — 트랜잭션 제어 · 트랜잭션 밖 전용 · 세션 정체 변경 */
const TX_CONTROL = /^(begin|start transaction|commit|end|rollback|abort|savepoint|release|prepare transaction)\b/
const NON_TX = /^(vacuum|checkpoint|cluster|reindex|load|listen|notify|unlisten|discard|reset|copy|create database|drop database|alter system|create tablespace|drop tablespace|alter tablespace|set (session |local )?(role|session authorization)|set session characteristics|set transaction)\b|\bconcurrently\b/
const DO_BLOCK = /^do( language [a-z_]+)? \$\$( language [a-z_]+)?$/
const GRANTEES = String.raw`[a-z_]+(, [a-z_]+)*$`
const STORY_PRIV_TARGET = String.raw`(schema story|all (tables|sequences|functions|routines) in schema story|function (story\.|public\.story_)[a-z0-9_]+ ?\([^)]*\))`
/**
 * 최상위 grant 허용 판정 — 오직 `grant execute on function public.story_<rpc>(…) to <역할들>` 이고, 역할이 그 RPC 의 행렬 안일 때만.
 * (anon 은 story_catalog 만 · service_role 은 증인 RPC 2개만 · PUBLIC · with grant option · 표/스키마/내부 함수 grant 는 모두 거절)
 */
export function grantAllowed(stmt) {
  const m = stmt.match(/^grant execute on function public\.(story_[a-z0-9_]+) ?\([^)]*\) to ([a-z_]+(?:, [a-z_]+)*)$/)
  if (!m || !Object.hasOwn(GRANT_MATRIX, m[1])) return false
  return m[2].split(', ').every((r) => GRANT_MATRIX[m[1]].includes(r))
}
/** 단계별 허용 최상위 문 — story 스키마 · public.story_* 함수만 만들고 권한을 다룬다. quarantine 은 DO · REVOKE 만(비파괴). */
export const SQL_POLICY = {
  schema: [
    DO_BLOCK,
    /^create schema story$/,
    /^create table story\.[a-z0-9_]+ ?\(/,
    /^create (unique )?index [a-z0-9_]+ on story\.[a-z0-9_]+ /,
    /^create function (story\.|public\.story_)[a-z0-9_]+ ?\(/,
    /^create trigger [a-z0-9_]+ (before|after) [a-z ]+ on story\.[a-z0-9_]+ for each (row|statement) execute (function|procedure) story\.[a-z0-9_]+ ?\(/,
    /^alter table story\.[a-z0-9_]+ enable row level security$/,
    /^comment on (schema story|table story\.[a-z0-9_]+|column story\.[a-z0-9_]+\.[a-z0-9_]+|function (story\.|public\.story_)[a-z0-9_]+ ?\([^)]*\)) is ''$/,
    { test: (s) => grantAllowed(s) }, // grant 는 권한 행렬(GRANT_MATRIX) 안의 「execute on function public.story_<rpc>」 만
    new RegExp(String.raw`^revoke [a-z ,]+ on ${STORY_PRIV_TARGET} from ${GRANTEES}`),
  ],
  quarantine: [
    DO_BLOCK,
    new RegExp(String.raw`^revoke [a-z ,]+ on ${STORY_PRIV_TARGET} from ${GRANTEES}`),
  ],
}

const preview = (s) => (s.length > 90 ? `${s.slice(0, 90)}…` : s)

/** 원자성 검사만(모든 호출자) — applyStage 가 BEGIN 전에 부른다 */
export function transactionControlBlocks(text) {
  let st
  try { st = topLevelStatements(text) } catch (e) { return [`DEPLOY_BLOCKED[sql] 본문을 해석할 수 없다: ${e.message}`] }
  return st.flatMap((s, i) => (TX_CONTROL.test(s) || NON_TX.test(s)
    ? [`DEPLOY_BLOCKED[sql] #${i + 1} 트랜잭션 제어 · 트랜잭션 밖 전용 문은 본문에 둘 수 없다(러너가 한 트랜잭션으로 감싼다): ${preview(s)}`] : []))
}

/** 단계 본문 정적 검사 — 원자성 + 허용 최상위 문(CLI 경로: offlineCheck) */
export function sqlPolicyBlocks(stage, text) {
  const allow = SQL_POLICY[stage]
  if (!allow) return [`DEPLOY_BLOCKED[stage] 알 수 없는 단계 ${stage}`]
  const tx = transactionControlBlocks(text)
  if (tx.length) return tx
  const st = topLevelStatements(text)
  const b = st.flatMap((s, i) => (allow.some((re) => re.test(s)) ? [] : [`DEPLOY_BLOCKED[sql] #${i + 1} ${stage} 단계에 허용되지 않은 최상위 문: ${preview(s)}`]))
  if (stage === 'schema' && !st.includes('create schema story')) b.push('DEPLOY_BLOCKED[sql] schema 단계에 create schema story 가 없다')
  if (stage === 'quarantine' && !st.some((s) => s.startsWith('revoke '))) b.push('DEPLOY_BLOCKED[sql] quarantine 단계에 revoke 가 없다')
  return b
}

// ── 오프라인 · 권한 · 위치 ─────────────────────────────────────────────────────────────────────────

/** 이력 행으로 적용 전 차단 판정. history = [{version, name, sha256}] (이 러너의 버전만) */
export function evaluate(stage, history, { mode }) {
  const st = STAGES[stage]
  if (!st) return [`DEPLOY_BLOCKED[stage] 알 수 없는 단계 ${stage}`]
  const b = []
  const by = Object.fromEntries(history.map((h) => [h.version, h]))
  if (st.after) {
    const prev = STAGES[st.after]
    if (by[prev.version]?.sha256 !== prev.sha256) b.push(`DEPLOY_BLOCKED[order] ${st.after}(${prev.version}) 이력이 없거나 SHA 가 승인값과 다르다`)
  }
  if (mode === 'apply' && by[st.version]) b.push(`DEPLOY_BLOCKED[already] ${stage}(${st.version}) 는 이미 적용됐다 — 재적용하지 않는다`)
  if (mode === 'verify' && by[st.version]?.sha256 !== st.sha256) b.push(`DEPLOY_BLOCKED[history] ${stage} 이력 SHA 가 승인값과 다르다`)
  return b
}

/** 저장소 본문이 승인 SHA 와 같고 정적 검사를 통과하는가 */
export function offlineCheck(stage, { root = ROOT } = {}) {
  const st = STAGES[stage]
  if (!st) return { blocks: [`DEPLOY_BLOCKED[stage] 알 수 없는 단계 ${stage}`], text: null }
  const abs = path.join(root, st.path)
  if (!fs.existsSync(abs)) return { blocks: [`DEPLOY_BLOCKED[sha] ${st.path} 가 없다`], text: null }
  const buf = fs.readFileSync(abs)
  if (sha256(buf) !== st.sha256) return { blocks: [`DEPLOY_BLOCKED[sha] ${st.path} sha256 이 승인값과 다르다`], text: null }
  const text = buf.toString('utf8')
  const policy = sqlPolicyBlocks(stage, text)
  return policy.length ? { blocks: policy, text: null } : { blocks: [], text }
}

/** apply 권한 차단 — 자동화 거절 · SHA 일치 · 1회용 티켓 난수 필수(TTY 여부와 무관). 티켓 소비 전에 부른다. */
export function applyAuthorizationBlocks(o, { env = process.env } = {}) {
  // 자동화 판정만 공용 함수에서 가져온다(ticket:true 로 부르면 그 함수의 TTY/난수 문구는 나오지 않는다 — 난수 판정은 아래에서 직접).
  const b = writeAuthorizationBlocks({}, { env, stdinIsTTY: false, stdoutIsTTY: false, ticket: true })
  if (!STAGES[o.stage]) b.push(`DEPLOY_BLOCKED[stage] 알 수 없는 단계 ${o.stage}`)
  else if (o.confirmSha !== STAGES[o.stage].sha256) b.push('DEPLOY_BLOCKED[sha] --confirm-sha 가 승인 SHA 와 다르다')
  if (!o.approvalNonce) b.push(`DEPLOY_BLOCKED[permission] ${NONCE_FLAG}(Claude Code 승인 창의 1회용 티켓)이 없다 — TTY 입력만으로는 적용하지 않는다(development_policy.db_apply)`)
  else if (!/^[0-9a-f]{48}$/.test(o.approvalNonce)) b.push(`DEPLOY_BLOCKED[permission] ${NONCE_FLAG} 형식이 다르다`)
  return b
}

/** 중앙 정책의 main_worktree — 못 읽거나 값이 없거나 서로 다르면 ok:false(호출부가 차단) */
export function readMainWorktree({ file = CENTRAL_DEV_MODE, read = (f) => fs.readFileSync(f, 'utf8') } = {}) {
  let cfg
  try { cfg = JSON.parse(read(file)) } catch (e) { return { ok: false, why: `중앙 정책 ${file} 을 읽지 못했다(${e.code ?? e.name})` } }
  const values = [cfg?.main_worktree, cfg?.development_policy?.main_worktree].filter((v) => v !== undefined)
  if (!values.length || values.some((v) => typeof v !== 'string' || !path.isAbsolute(v))) return { ok: false, why: `중앙 정책 ${file} 에 절대 경로 main_worktree 가 없다` }
  if (new Set(values.map((v) => path.resolve(v).toLowerCase())).size !== 1) return { ok: false, why: `중앙 정책 ${file} 의 main_worktree 값이 서로 다르다` }
  return { ok: true, mainWorktree: values[0] }
}

/** 정본 호출 + main_worktree 위치. 막히면 문구 목록, 통과면 []. */
export function locationBlocks({ self = SELF, root = ROOT, argv1 = process.argv[1], main = readMainWorktree(), realpath = fs.realpathSync.native, platform = process.platform } = {}) {
  const real = (p) => { try { return p ? realpath(p) : null } catch { return null } }
  const eq = (a, b) => same(a, b, platform)
  const selfReal = real(self)
  const rootReal = real(root)
  const b = []
  if (!eq(real(argv1), selfReal) || !rootReal || !eq(selfReal, path.join(rootReal, ...RUNNER_REL.split('/')))) {
    b.push(`DEPLOY_BLOCKED[permission] approval-nonce mode requires running the canonical ${RUNNER_REL} directly (복사본 · node -e import 거절)`)
  }
  if (!main?.ok) return [...b, `DEPLOY_BLOCKED[location] ${main?.why ?? 'main_worktree 를 모른다'} — 공유 DB apply 는 main_worktree 에서만`]
  const mainReal = real(main.mainWorktree)
  if (!mainReal) b.push(`DEPLOY_BLOCKED[location] main_worktree ${main.mainWorktree} 의 실제 경로를 확인할 수 없다`)
  else if (!eq(rootReal, mainReal) || !eq(selfReal, path.join(mainReal, ...RUNNER_REL.split('/')))) {
    b.push(`DEPLOY_BLOCKED[location] 공유 DB apply 는 main_worktree(${mainReal}) 의 ${RUNNER_REL} 로만 — 지금 실행 위치 ${rootReal ?? root}`)
  }
  return b
}

const IMPORT_PATTERNS = [
  /\b(?:import|export)\s[^'";]*?\bfrom\s*['"]([^'"]+)['"]/g, // import … from '…' · export … from '…'
  /\bimport\s*['"]([^'"]+)['"]/g, // import '…'(부수 효과)
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g, // import('…') — 문자열 리터럴만
]

/**
 * 러너가 실제로 불러오는 저장소 안 모듈의 폐포(상대 경로 import 만 — node: · 패키지는 저장소 밖, pg 는 --deps).
 * 경로를 문자열 조립으로 만드는 동적 import 는 잡지 못한다(이 폐포에는 없다). 결과는 ROOT 기준 상대 경로(정렬).
 */
export function importClosure(entry = SELF, { root = ROOT, read = (f) => fs.readFileSync(f, 'utf8'), exists = (f) => fs.existsSync(f) } = {}) {
  const seen = new Set()
  const stack = [path.resolve(entry)]
  while (stack.length) {
    const f = stack.pop()
    if (seen.has(f)) continue
    seen.add(f)
    const src = read(f)
    for (const re of IMPORT_PATTERNS) {
      for (const m of src.matchAll(re)) {
        if (!m[1].startsWith('./') && !m[1].startsWith('../')) continue
        const dep = path.resolve(path.dirname(f), m[1])
        if (exists(dep)) stack.push(dep)
      }
    }
  }
  return [...seen].map((f) => path.relative(root, f).replaceAll('\\', '/')).sort()
}

const gitIn = (root) => (args) => execFileSync('git', ['--no-optional-locks', '-C', root, ...args], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })

/** main_worktree 가 브랜치 main 이고, 주어진 파일이 git 추적 중이며 HEAD 와 같은가(읽기만, 인덱스 갱신 없음) */
export function committedBlocks(root, rels, { git = gitIn(root) } = {}) {
  let branch = ''
  try { branch = String(git(['symbolic-ref', '--short', '-q', 'HEAD'])).trim() } catch { /* detached HEAD */ }
  if (branch !== 'main') return [`DEPLOY_BLOCKED[committed] main_worktree HEAD 가 브랜치 main 이 아니다(${branch || 'detached HEAD'}) — 로컬 main 정본에서만 적용한다`]
  try {
    git(['ls-files', '--error-unmatch', '--', ...rels])
    const dirty = String(git(['status', '--porcelain=v1', '--untracked-files=all', '--', ...rels])).trim()
    return dirty ? [`DEPLOY_BLOCKED[committed] main_worktree HEAD 와 다른 파일: ${dirty.split(/\r?\n/).join(' · ')}`] : []
  } catch {
    return [`DEPLOY_BLOCKED[committed] 러너 · import 모듈 · 본문이 main_worktree 에서 git 추적 중이 아니다(${rels.join(', ')})`]
  }
}

/** 커밋 상태 판정 대상 = 러너의 import 폐포 + 단계 SQL */
function committedGate(stage) {
  let rels
  try { rels = importClosure() } catch (e) { return [`DEPLOY_BLOCKED[committed] import 폐포를 계산하지 못했다: ${e.message}`] }
  return committedBlocks(ROOT, [...rels, STAGES[stage].path])
}

/** 계정 프로필 아래 고정 승인 폴더 — 환경 변수(VF_DB_APPROVAL_DIR · USERPROFILE · HOME)로 바뀌지 않는다. 못 구하면 null. */
export function fixedApprovalDir({ userInfo = os.userInfo } = {}) {
  try {
    const h = userInfo().homedir
    return h && path.isAbsolute(h) ? path.join(h, '.vocaflow', 'db-approvals') : null
  } catch { return null }
}

/** execArgv · NODE_OPTIONS 에서 허용(TLS 버전 플래그) 밖의 항목 */
export function nodeFlagProblems(execArgv = process.execArgv, nodeOptions = process.env.NODE_OPTIONS) {
  return [
    ...execArgv.filter((a) => !ALLOWED_NODE_FLAGS.test(a)).map((a) => `execArgv ${a}`),
    ...String(nodeOptions ?? '').split(/\s+/).filter(Boolean).filter((t) => !ALLOWED_NODE_FLAGS.test(t)).map((t) => `NODE_OPTIONS ${t}`),
  ]
}

/** TLS 검증을 끄는 환경 — 접속하는 모든 명령(preflight · apply · verify)에서 접속 전에 차단 */
export function tlsEnvBlocks(env = process.env) {
  const v = env.NODE_TLS_REJECT_UNAUTHORIZED
  return v !== undefined && v !== '1' ? ['DEPLOY_BLOCKED[tls] NODE_TLS_REJECT_UNAUTHORIZED 가 설정돼 있다 — 인증서 검증을 끄는 경로는 쓰지 않는다'] : []
}

/** apply 실행 환경 — 티켓 위치 재지정 · 홈 재지정 · 사전 로드/로더/디버거 플래그 · TLS 검증 끄기 */
export function runtimeBlocks({ env = process.env, execArgv = process.execArgv, homedir = os.homedir, approvalDir = fixedApprovalDir(), realpath = fs.realpathSync.native, platform = process.platform } = {}) {
  const b = []
  if (env.VF_DB_APPROVAL_DIR !== undefined) b.push('DEPLOY_BLOCKED[environment] VF_DB_APPROVAL_DIR 가 설정돼 있다 — apply 는 티켓 위치를 바꾸지 않는다(계정 프로필 아래 고정 폴더만)')
  if (!approvalDir) b.push('DEPLOY_BLOCKED[environment] 계정 프로필 경로(os.userInfo)를 확인할 수 없다')
  else {
    const profile = path.dirname(path.dirname(approvalDir))
    const real = (p) => { try { return realpath(p) } catch { return path.resolve(p) } }
    let home = null
    try { home = homedir() } catch { /* 없음 */ }
    if (!home || !same(real(home), real(profile), platform)) b.push(`DEPLOY_BLOCKED[environment] 홈(USERPROFILE/HOME → ${home}) 이 계정 프로필(${profile}) 과 다르다 — 승인 티켓 위치가 바뀔 수 있다`)
  }
  const flags = nodeFlagProblems(execArgv, env.NODE_OPTIONS)
  if (flags.length) b.push(`DEPLOY_BLOCKED[environment] 허용되지 않은 Node 실행 플래그(사전 로드 · 로더 · 디버거 등): ${flags.join(', ')} — 허용은 --tls-max/min-v1.2|v1.3 뿐`)
  b.push(...tlsEnvBlocks(env))
  return b
}

/** --ca PEM — 인증서 블록만(개인 키 금지) · 모두 해석되고 CA 인증서여야 한다. 공개 인증서라 지문(SHA-256)만 로그에 남긴다. */
export function loadCa(file, { read = (f) => fs.readFileSync(f, 'utf8') } = {}) {
  let text
  try { text = read(file) } catch (e) { return { blocks: [`DEPLOY_BLOCKED[tls] --ca ${file} 를 읽지 못했다(${e.code ?? e.name})`] } }
  if (/PRIVATE KEY/.test(text)) return { blocks: ['DEPLOY_BLOCKED[tls] --ca 파일에 개인 키가 있다 — CA 인증서(PEM)만 준다'] }
  const pems = text.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) ?? []
  if (!pems.length) return { blocks: [`DEPLOY_BLOCKED[tls] --ca ${file} 에 PEM 인증서가 없다`] }
  const fingerprints = []
  for (const pem of pems) {
    let x
    try { x = new crypto.X509Certificate(pem) } catch { return { blocks: ['DEPLOY_BLOCKED[tls] --ca 의 인증서를 해석할 수 없다'] } }
    if (!x.ca) return { blocks: [`DEPLOY_BLOCKED[tls] --ca 의 인증서가 CA 인증서가 아니다(${x.subject.replace(/\n/g, ', ')})`] }
    fingerprints.push(x.fingerprint256)
  }
  return { blocks: [], ca: pems.join('\n'), fingerprints }
}

/** pg 의 ssl 설정 — 검증은 항상 켠다(끄는 분기 없음). ca 가 있으면 그 루트만 신뢰하고, 없으면 Node 기본 신뢰 저장소. */
export function tlsOptions({ host, ca } = {}) {
  return { rejectUnauthorized: true, servername: host, checkServerIdentity: tls.checkServerIdentity, minVersion: 'TLSv1.2', ...(ca ? { ca } : {}) }
}

/** apply 의 DB 접속 전 차단 — 권한 → 위치 + 실행 환경(함께) → 본문 → 커밋 상태. 앞 묶음이 막히면 뒤는 보지 않는다. */
export function applyGates(o, { env = process.env, location = () => locationBlocks(), runtime = () => runtimeBlocks({ env }), offline = () => offlineCheck(o.stage), committed = () => committedGate(o.stage) } = {}) {
  const auth = applyAuthorizationBlocks(o, { env })
  if (auth.length) return { blocks: auth, text: null }
  const where = [...location(), ...runtime()]
  if (where.length) return { blocks: where, text: null }
  const off = offline()
  if (off.blocks.length) return { blocks: off.blocks, text: null }
  const com = committed()
  if (com.length) return { blocks: com, text: null }
  return { blocks: [], text: off.text }
}

/**
 * 티켓 소비 — 항상 필요하다. TTY 면 그 전에 `APPLY <stage> <sha>` 를 추가로 입력받는다(틀리면 티켓을 태우지 않고 멈춘다).
 * confirm(expected) → 입력 문자열, consume() → consumeTicket 결과. 둘 다 주입 가능(시험).
 */
export async function approveApply(o, { tty, confirm, consume }) {
  if (tty) {
    const expected = `APPLY ${o.stage} ${STAGES[o.stage].sha256}`
    if ((await confirm(expected)) !== expected) return { approvedBy: null, blocks: ['DEPLOY_BLOCKED[permission] confirmation mismatch — 티켓은 소비하지 않았다'] }
  }
  const r = consume()
  if (!r?.ticket) return { approvedBy: null, blocks: [`DEPLOY_BLOCKED[permission] ${r?.reason ?? '승인 티켓이 없다'}`] }
  return { approvedBy: `${ticketApprovalRecord(r.ticket)}${tty ? ' +tty-confirm' : ''}`, blocks: [] }
}

// ── DB 단계 ─────────────────────────────────────────────────────────────────────────────────────

export async function readHistory(client) {
  return (await client.query(HISTORY_SQL)).rows
}

const checkName = (q) => q.match(/^\s*select '([a-z0-9_:]+)'/)?.[1] ?? '?'

/** 검사 목록 실행(트랜잭션은 호출부). savepoint=true 면 한 검사의 오류가 나머지를 막지 않는다. */
export async function runChecks(client, list, { savepoint = true } = {}) {
  const rows = []
  for (const q of list) {
    if (savepoint) await client.query('savepoint vf_check')
    try {
      const r = await client.query({ text: q, rowMode: 'array' })
      const [check, ok, detail] = r.rows[0]
      rows.push({ check, ok: ok === true, detail: detail ?? null })
      if (savepoint) await client.query('release savepoint vf_check')
    } catch (e) {
      if (!savepoint) throw e
      rows.push({ check: checkName(q), ok: false, detail: `error ${e.code ?? ''} ${e.message}` })
      await client.query('rollback to savepoint vf_check')
    }
  }
  return { ok: rows.every((r) => r.ok), rows }
}

/** 읽기 전용 · 한 스냅숏(REPEATABLE READ READ ONLY) 안에서 fn 을 돌리고 항상 롤백한다 */
export async function readOnly(client, fn) {
  await client.query('begin transaction isolation level repeatable read read only')
  try { return await fn() } finally { await client.query('rollback').catch(() => {}) }
}

export const runPreflight = (client, stage) => readOnly(client, () => runChecks(client, PREFLIGHT_SQL[stage]))
export const runVerify = (client, stage) => readOnly(client, () => runChecks(client, VERIFY_SQL[stage]))

/** 지문 — 트랜잭션은 호출부(같은 스냅숏을 쓰려면 한 트랜잭션 안에서 부른다) */
export async function legacyFingerprint(client, stage) {
  const out = {}
  for (const q of FINGERPRINT_SQL[stage]) {
    const r = await client.query({ text: q, rowMode: 'array' })
    const [name, digest] = r.rows[0]
    out[name] = String(digest)
  }
  return out
}

const blocked = (lines) => Object.assign(new Error(lines.join('\n')), { code: 'P0001' })

/**
 * 단계 적용 — 한 트랜잭션(REPEATABLE READ): 잠금 → 이력 순서 → preflight → 지문(전) → 본문 → 지문(후) → 이력 행 → COMMIT.
 * 격리 시험(verify-isolated.ts --engine pg17)도 이 함수를 그대로 부른다. 결과 outcome: committed · rolled_back · unknown · blocked(시작 전).
 */
export async function applyStage(client, stage, { text, approvedBy }) {
  const st = STAGES[stage]
  const t0 = new Date().toISOString()
  const pre = !st ? [`DEPLOY_BLOCKED[stage] 알 수 없는 단계 ${stage}`] : transactionControlBlocks(text)
  if (pre.length) return { ok: false, outcome: 'blocked', legacy: null, preflight: null, started_at: t0, ended_at: new Date().toISOString(), error: { code: null, message: pre.join('\n') } }
  let committing = false
  let legacy = null
  let preflight = null
  let verify = null
  try {
    await client.query('begin isolation level repeatable read')
    await client.query("set local lock_timeout = '15s'")
    await client.query("set local statement_timeout = '120s'")
    await client.query('lock table supabase_migrations.schema_migrations in share row exclusive mode')
    const order = evaluate(stage, await readHistory(client), { mode: 'apply' }) // 스냅숏은 잠금 뒤 이 질의에서 잡힌다
    if (order.length) throw blocked(order)
    preflight = await runChecks(client, PREFLIGHT_SQL[stage], { savepoint: false })
    if (!preflight.ok) throw blocked(preflight.rows.filter((r) => !r.ok).map((r) => `DEPLOY_BLOCKED[preflight] ${r.check}${r.detail ? ` (${r.detail})` : ''}`))
    const before = await legacyFingerprint(client, stage)
    await client.query(text)
    const after = await legacyFingerprint(client, stage)
    legacy = compareFingerprints(stage, before, after)
    if (!legacy.unchanged) throw blocked([`DEPLOY_BLOCKED[impact] 지문이 바뀌었다(${legacy.changed.join(', ') || '비어 있음'}) — 롤백`])
    // 권한 행렬 · RLS · 객체 집합을 커밋 전에 같은 트랜잭션에서 확인한다 — 하나라도 실패하면 이력 행 없이 롤백.
    verify = await runChecks(client, VERIFY_SQL[stage], { savepoint: false })
    if (!verify.ok) throw blocked(verify.rows.filter((r) => !r.ok).map((r) => `DEPLOY_BLOCKED[verify] ${r.check}${r.detail ? ` (${r.detail})` : ''}`))
    await client.query(`insert into supabase_migrations.schema_migrations (version, name, statements, created_by, idempotency_key)
      values ($1, $2, $3, $4, $5)`, [st.version, st.name, [text], `${RUNNER}-deploy:${approvedBy}`, sha256(Buffer.from(text, 'utf8'))])
    committing = true
    const committed = await client.query('commit')
    if (committed?.command !== 'COMMIT') throw Object.assign(new Error('server did not confirm COMMIT'), { code: '40003' })
    return { ok: true, outcome: 'committed', legacy, preflight, verify, started_at: t0, ended_at: new Date().toISOString() }
  } catch (e) {
    // COMMIT 을 보낸 뒤의 통신 오류는 커밋됐을 수 있다 — 서버의 명시적 거절(제약 · 직렬화 · PL/pgSQL 등)만 롤백으로 본다.
    const serverRejection = /^(23|40|P0|22|25|42|0A)[0-9A-Z]{3}$/.test(e.code ?? '') && e.code !== '40003'
    let unknown = committing && !serverRejection
    await client.query('rollback').catch(() => { if (committing) unknown = true })
    return { ok: false, outcome: unknown ? 'unknown' : 'rolled_back', legacy, preflight, verify, started_at: t0, ended_at: new Date().toISOString(), error: { code: e.code ?? null, message: e.message } }
  }
}

// ── CLI ─────────────────────────────────────────────────────────────────────────────────────────

const FLAG_KEYS = { '--stage': 'stage', '--deps': 'deps', '--db-url-env': 'urlEnv', '--ca': 'ca', '--confirm-sha': 'confirmSha', [NONCE_FLAG]: 'approvalNonce' }

/** 인자 — SQL · 대상 URL · 검증 끄기 · 우회 인자를 받지 않는다. 모르는 인자 · 중복 · 값 없음은 problems 로(종료 1). */
export function parseArgs(a = process.argv.slice(2)) {
  const o = { cmd: a[0], stage: undefined, deps: undefined, urlEnv: 'VF_DEPLOY_DB_URL', ca: undefined, confirmSha: undefined, approvalNonce: undefined, problems: [] }
  const seen = new Set()
  for (let i = 1; i < a.length; i++) {
    let flag = a[i]
    let value
    const eq = flag.indexOf('=')
    if (flag.startsWith('--') && eq > 0) { value = flag.slice(eq + 1); flag = flag.slice(0, eq) } else value = a[i + 1]
    const key = FLAG_KEYS[flag]
    if (!key) { o.problems.push(`알 수 없는 인자 ${flag}`); continue }
    if (seen.has(flag)) o.problems.push(`${flag} 는 한 번만`)
    seen.add(flag)
    if (value === undefined || value === '' || value.startsWith('--')) { o.problems.push(`${flag} 값이 없다`); continue }
    o[key] = value
    if (eq < 0 || !a[i].startsWith('--')) i++
  }
  return o
}

let secretUrl
function writeLog(obj, existing) {
  const dir = path.join(ROOT, LOG_DIR)
  fs.mkdirSync(dir, { recursive: true })
  const f = existing ? path.join(ROOT, existing) : path.join(dir, `${obj.stage}-${obj.command}-${obj.target}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  fs.writeFileSync(f, redactText(JSON.stringify(obj, null, 2), secretUrl) + '\n')
  return path.relative(ROOT, f).replaceAll('\\', '/')
}

/** 접속 준비(접속하지 않는다) — TLS 환경 → --ca → pg 모듈 → 접속 문자열 → 대상. 접속 문자열은 쿼리 문자열이 없어야 한다(targetOf). */
function prepareConnection(o, { env = process.env } = {}) {
  const tlsEnv = tlsEnvBlocks(env)
  if (tlsEnv.length) return { exit: 2, msg: tlsEnv.join('\n') }
  let ca = null
  if (o.ca) {
    ca = loadCa(o.ca)
    if (ca.blocks.length) return { exit: 2, msg: ca.blocks.join('\n') }
  }
  let pg
  try { pg = createRequire(path.join(path.resolve(o.deps), 'package.json'))('pg') } catch { return { exit: 2, msg: `DEPLOY_BLOCKED[deps] ${o.deps} 에서 pg 를 찾지 못했다` } }
  const url = resolveDbUrl(o.urlEnv)
  if (!url) return { exit: 2, msg: `DEPLOY_BLOCKED[target] 접속 문자열 ${o.urlEnv} 가 없다` }
  const target = targetOf(url)
  if (!target.ok) return { exit: 2, msg: target.why }
  return { pg, url, target, ssl: tlsOptions({ host: target.host, ca: ca?.ca }),
    tls: { ca_file: o.ca ?? null, ca_sha256_fingerprints: ca?.fingerprints ?? [], reject_unauthorized: true, servername: target.host } }
}

async function askTyped(expected) {
  const term = createInterface({ input: process.stdin, output: process.stdout })
  try { return await term.question(`추가 확인(1회용 티켓은 그대로 필요) — ${expected} 를 입력: `) } finally { term.close() }
}

async function main() {
  const o = parseArgs()
  if (!['preflight', 'apply', 'verify'].includes(o.cmd) || !Object.hasOwn(STAGES, o.stage ?? '') || !o.deps || o.problems.length) {
    console.error(['preflight|apply|verify --stage schema|quarantine --deps <pg 설치 폴더> [--db-url-env KEY] [--ca <CA PEM>] [--confirm-sha <sha>]', ...o.problems].join('\n'))
    return 1
  }
  const st = STAGES[o.stage]
  let text
  if (o.cmd === 'apply') {
    const g = applyGates(o)
    if (g.blocks.length) { console.error(g.blocks.join('\n')); return 2 }
    text = g.text
  } else {
    const off = offlineCheck(o.stage)
    if (off.blocks.length) { console.error(off.blocks.join('\n')); return 2 }
    text = off.text
  }
  const conn = prepareConnection(o)
  if (conn.exit) { console.error(conn.msg); return conn.exit }
  secretUrl = conn.url
  const client = new conn.pg.Client({ connectionString: conn.url, application_name: 'vf-lcp-story-s3-deploy', ssl: conn.ssl })
  try { await client.connect() } catch (e) { console.error(redactText(`DEPLOY_BLOCKED[connect] ${e.code ?? ''} ${e.message}`, secretUrl)); return 2 }
  const log = { package: 'lcp-story-s3-deploy', stage: o.stage, command: o.cmd, target: conn.target.target, stage_sha256: st.sha256,
    git_head: execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true }).trim(),
    runner_sha256: sha256(fs.readFileSync(SELF)), root_realpath: fs.realpathSync.native(ROOT), fingerprint_scope: FINGERPRINT_SCOPE[o.stage], tls: conn.tls }
  try {
    if (o.cmd === 'preflight') {
      const r = await readOnly(client, async () => {
        const history = await readHistory(client)
        return { history, blocks: evaluate(o.stage, history, { mode: 'apply' }), preflight: await runChecks(client, PREFLIGHT_SQL[o.stage]),
          legacy: await legacyFingerprint(client, o.stage) }
      })
      Object.assign(log, r)
      const ok = !r.blocks.length && r.preflight.ok
      console.log(JSON.stringify({ ok, blocks: r.blocks, preflight: r.preflight.rows, legacy: r.legacy, log: writeLog(log) }, null, 2))
      return ok ? 0 : 2
    }
    if (o.cmd === 'verify') {
      const r = await readOnly(client, async () => {
        const history = await readHistory(client)
        return { history, blocks: evaluate(o.stage, history, { mode: 'verify' }), verify: await runChecks(client, VERIFY_SQL[o.stage]) }
      })
      const ok = r.verify.ok && !r.blocks.length
      Object.assign(log, { history: r.history, blocks: r.blocks, verify: { ...r.verify, ok } })
      console.log(JSON.stringify({ ok, blocks: r.blocks, rows: r.verify.rows, log: writeLog(log) }, null, 2))
      return ok ? 0 : 4
    }
    // apply — 쓰기 전 읽기 전용 판정(막히면 티켓을 소비하지 않는다)
    const pre = await readOnly(client, async () => {
      const history = await readHistory(client)
      return { history, blocks: evaluate(o.stage, history, { mode: 'apply' }), preflight: await runChecks(client, PREFLIGHT_SQL[o.stage]) }
    })
    if (pre.blocks.length || !pre.preflight.ok) {
      Object.assign(log, pre, { state: 'blocked_before_ticket' })
      console.error([...pre.blocks, ...pre.preflight.rows.filter((r) => !r.ok).map((r) => `DEPLOY_BLOCKED[preflight] ${r.check}${r.detail ? ` (${r.detail})` : ''}`)].join('\n'))
      console.error(`log ${writeLog(log)}`)
      return 2
    }
    const tty = Boolean(process.stdin.isTTY && process.stdout.isTTY)
    const approval = await approveApply(o, { tty, confirm: askTyped,
      // 고정 폴더(계정 프로필 아래)만 — VF_DB_APPROVAL_DIR · 홈 재지정은 applyGates 가 이미 막았다
      consume: () => consumeTicket({ runner: RUNNER, stage: o.stage, sha: o.confirmSha, nonce: o.approvalNonce, dir: fixedApprovalDir() }) })
    if (approval.blocks.length) {
      Object.assign(log, pre, { state: 'blocked_ticket' })
      console.error(approval.blocks.join('\n'))
      console.error(`log ${writeLog(log)}`)
      return 2
    }
    console.log(`승인 티켓 소비 — ${approval.approvedBy}`)
    Object.assign(log, { approved_by: approval.approvedBy, history: pre.history, preflight: pre.preflight, state: 'applying' })
    const logPath = writeLog(log) // DDL 전에 의도를 남긴다 — 장애 복구는 이 파일에서 시작한다
    const r = await applyStage(client, o.stage, { text, approvedBy: approval.approvedBy })
    Object.assign(log, { apply: r, state: r.outcome })
    writeLog(log, logPath)
    if (!r.ok) {
      console.error(redactText(`${r.outcome === 'unknown' ? 'INCIDENT: COMMIT outcome unknown; do not retry' : '적용 실패 — 롤백됨'}: ${r.error.message}`, secretUrl))
      console.error(`log ${logPath}`)
      return r.outcome === 'unknown' ? 4 : 3
    }
    let v
    try { v = await runVerify(client, o.stage) } catch (e) { v = { ok: false, rows: [], error: { code: e.code ?? null, message: e.message } } }
    Object.assign(log, { verify: v, state: v.ok ? 'verified' : 'committed_verify_failed' })
    console.log(redactText(JSON.stringify({ applied: true, legacy: r.legacy, verify: v, log: writeLog(log, logPath) }, null, 2), secretUrl))
    return v.ok ? 0 : 4
  } finally { await client.end().catch(() => {}) }
}

function isEntry() {
  try { return Boolean(process.argv[1]) && same(fs.realpathSync.native(process.argv[1]), fs.realpathSync.native(SELF)) } catch { return false }
}

if (isEntry()) {
  try { process.exitCode = await main() } catch (e) {
    console.error(redactText(`DEPLOY_ERROR ${e.code ?? ''} ${e.message}`, secretUrl))
    process.exitCode = 4
  }
}
