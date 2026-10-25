// scripts/db/lcp-story-s3/deploy.test.mjs — node --test scripts/db/lcp-story-s3/deploy.test.mjs
//
// 승인형 러너가 DB 에 닿기 전에 닫히는지(fail closed), 트랜잭션 순서가 맞는지 — 순수 함수 · 가짜 클라이언트 · 실제 프로세스 실행으로 본다.
// DB 접속 · 티켓 발급 · 티켓 파일 작성 없음. 프로세스 시험은 빈 임시 승인 폴더(VF_DB_APPROVAL_DIR)와 없는 env 파일(VF_DEPLOY_ENV_FILE)을
// 넘겨 실제 승인 기록 · 접속 문자열을 읽지 않는다.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import tls from 'node:tls'
import { fileURLToPath } from 'node:url'
import { consumeTicket } from '../../../agents/scripts/db-approval.mjs'
import {
  applyAuthorizationBlocks, applyGates, applyStage, approveApply, CENTRAL_DEV_MODE, committedBlocks, compareFingerprints, evaluate,
  FINGERPRINT_SCOPE, FINGERPRINT_SQL, fixedApprovalDir, GRANT_MATRIX, grantAllowed, HISTORY_SQL, importClosure, LEGACY_TABLES, loadCa,
  locationBlocks, nodeFlagProblems, offlineCheck, parseArgs, PREFLIGHT_SQL, readMainWorktree, RPC, runtimeBlocks, sqlPolicyBlocks, STAGES,
  STORY_RPCS, STORY_TABLES, tlsEnvBlocks, tlsOptions, topLevelStatements, transactionControlBlocks, VERIFY_SQL,
} from './deploy.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..', '..')
const RUNNER = path.join(HERE, 'deploy.mjs')
const nonce = 'a'.repeat(48)
const schemaOk = { stage: 'schema', confirmSha: STAGES.schema.sha256, approvalNonce: nonce }
const mineSchema = { version: STAGES.schema.version, name: STAGES.schema.name, sha256: STAGES.schema.sha256 }
const mineQuarantine = { version: STAGES.quarantine.version, name: STAGES.quarantine.name, sha256: STAGES.quarantine.sha256 }
const fileText = (stage) => fs.readFileSync(path.join(ROOT, STAGES[stage].path), 'utf8')
const checkNames = (list) => list.map((q) => q.match(/^select '([a-z0-9_]+)'/)[1])

// ── 고정값 · 본문 ───────────────────────────────────────────────────────────────────────────────

test('단계 SHA = 저장소 SQL 파일 바이트 sha256(부모가 최종 고정) · 본문 경로는 보류 SQL 두 파일뿐', () => {
  for (const [stage, st] of Object.entries(STAGES)) {
    assert.match(st.path, /^supabase\/migrations\/_pending_lcp_story_s3_(schema|quarantine)\.sql$/)
    assert.match(st.sha256, /^[0-9a-f]{64}$/)
    const buf = fs.readFileSync(path.join(ROOT, st.path))
    assert.equal(crypto.createHash('sha256').update(buf).digest('hex'), st.sha256, `${stage} 파일 sha256 ≠ STAGES — 고정 갱신 필요`)
    assert.deepEqual(offlineCheck(stage).blocks, [], stage)
  }
})

test('본문이 한 바이트라도 바뀌면 sha 차단 · 없는 단계 · 없는 파일도 차단', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lcp-story-s3-runner-'))
  try {
    const target = path.join(dir, STAGES.schema.path)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, fileText('schema').replace(/\n/g, '\r\n'))
    assert.match(offlineCheck('schema', { root: dir }).blocks.join(), /DEPLOY_BLOCKED\[sha\]/)
    assert.match(offlineCheck('quarantine', { root: dir }).blocks.join(), /가 없다/)
    assert.match(offlineCheck('nope').blocks.join(), /DEPLOY_BLOCKED\[stage\]/)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('현재 단계 SQL 은 정적 검사를 통과한다 — BEGIN/COMMIT 없음 · story 객체만 · quarantine 은 DO · REVOKE 뿐', () => {
  assert.deepEqual(sqlPolicyBlocks('schema', fileText('schema')), [])
  assert.deepEqual(sqlPolicyBlocks('quarantine', fileText('quarantine')), [])
  const q = topLevelStatements(fileText('quarantine'))
  assert.ok(q.every((s) => s === 'do $$' || s.startsWith('revoke ')))
  assert.equal(q.filter((s) => s.startsWith('revoke all on function public.story_')).length, STORY_RPCS.length)
})

test('정적 검사 — 최상위 트랜잭션 제어 · 트랜잭션 밖 문 · 범위 밖 객체는 차단, 인용 · 주석 · 함수 본문 안은 무시', () => {
  const base = fileText('schema')
  for (const extra of ['commit;', 'BEGIN;', 'end;', 'rollback;', 'savepoint s;', 'vacuum public.texts;', 'set role postgres;',
    'create index concurrently texts_x on story.sources (id);', 'start transaction;']) {
    assert.match(transactionControlBlocks(`${base}\n${extra}\n`).join(), /DEPLOY_BLOCKED\[sql\]/, extra)
  }
  for (const extra of ['drop table public.texts;', 'truncate public.content_chunks;', 'update public.library_books set status = status;',
    'delete from public.user_profiles;', 'alter table public.texts add column x int;', 'create function public.foo() returns int language sql as $$ select 1 $$;',
    'grant authenticated to anon;', 'alter default privileges in schema public grant all on tables to anon;',
    'grant select on table public.texts to anon;', 'create or replace function public.story_catalog() returns int language sql as $$ select 1 $$;']) {
    assert.match(sqlPolicyBlocks('schema', `${base}\n${extra}\n`).join(), /DEPLOY_BLOCKED\[sql\]/, extra)
  }
  // grant 는 권한 행렬 안의 RPC execute 만 — anon 은 story_catalog 만, service_role 은 증인 RPC 2개만
  for (const extra of ['grant execute on function public.story_admin_publish(uuid) to anon;', 'grant execute on function public.story_catalog() to public;',
    'grant execute on function public.story_catalog() to service_role;', 'grant execute on function public.story_service_attest_validation(uuid, jsonb) to authenticated;',
    'grant execute on function public.story_read_unit(text, integer) to authenticated with grant option;', 'grant select on table story.releases to authenticated;',
    'grant usage on schema story to anon;', 'grant execute on function story.canonical_json(jsonb) to authenticated;',
    'grant execute on function public.story_unknown() to authenticated;', 'grant all on function public.story_catalog() to anon;']) {
    assert.match(sqlPolicyBlocks('schema', `${base}\n${extra}\n`).join(), /DEPLOY_BLOCKED\[sql\]/, extra)
  }
  assert.equal(grantAllowed('grant execute on function public.story_catalog() to anon, authenticated'), true)
  assert.equal(grantAllowed('grant execute on function public.story_service_validation_input(uuid) to service_role'), true)
  assert.equal(grantAllowed('grant execute on function public.story_admin_publish(uuid) to anon'), false)
  const q = fileText('quarantine')
  for (const extra of ['drop schema story cascade;', 'grant execute on function public.story_catalog() to anon;', 'delete from story.releases;',
    'alter table story.releases disable trigger all;']) {
    assert.match(sqlPolicyBlocks('quarantine', `${q}\n${extra}\n`).join(), /DEPLOY_BLOCKED\[sql\]/, extra)
  }
  const harmless = `-- commit;\n/* begin; /* nested */ commit; */\ndo $x$ begin perform 1; commit_x := 1; end $x$;\n`
    + `comment on schema story is 'a;commit;''b';\ncomment on table story.sources is E'it\\'s; rollback;';\n`
  assert.deepEqual(transactionControlBlocks(harmless), [])
  assert.deepEqual(topLevelStatements(harmless), ['do $$', "comment on schema story is ''", "comment on table story.sources is ''"])
  assert.match(transactionControlBlocks('do $$ begin perform 1;').join(), /해석할 수 없다/)
  assert.match(sqlPolicyBlocks('schema', 'create table story.x (id int);').join(), /create schema story 가 없다/)
  assert.match(sqlPolicyBlocks('quarantine', 'do $$ begin end $$;').join(), /revoke 가 없다/)
})

// ── 계약 상수 · SQL 상수 ─────────────────────────────────────────────────────────────────────────

test('계약 — story 표 12 · RPC 16(관리 9 · 서비스 2 · 학습자 5) · story_record_progress 없음 · 권한 행렬', () => {
  assert.equal(new Set(STORY_TABLES).size, 12)
  assert.ok(STORY_TABLES.includes('validation_attestations') && STORY_TABLES.includes('reading_unit_completions'))
  assert.deepEqual([RPC.admin.length, RPC.service.length, RPC.learner.length], [9, 2, 5])
  assert.equal(new Set(STORY_RPCS).size, 16)
  assert.ok(!STORY_RPCS.includes('story_record_progress'))
  assert.deepEqual(RPC.service, ['story_service_validation_input', 'story_service_attest_validation'])
  assert.deepEqual(Object.entries(GRANT_MATRIX).filter(([, r]) => r.includes('service_role')).map(([f]) => f).sort(), [...RPC.service].sort())
  assert.deepEqual(Object.entries(GRANT_MATRIX).filter(([, r]) => r.includes('anon')).map(([f]) => f), ['story_catalog'])
  assert.equal(Object.values(GRANT_MATRIX).filter((r) => r.includes('authenticated')).length, 14)
})

test('러너 권한 행렬 = 단계 SQL 의 grant/revoke 문(파일에서 직접 읽음) · quarantine 은 16개 모두 회수', () => {
  const stmts = topLevelStatements(fileText('schema'))
  const granted = {}
  for (const s of stmts) {
    const m = s.match(/^grant execute on function public\.(story_[a-z_]+) ?\([^)]*\) to (.+)$/)
    if (m) granted[m[1]] = m[2].split(', ').sort()
  }
  assert.deepEqual(Object.keys(granted).sort(), [...STORY_RPCS].sort())
  for (const f of STORY_RPCS) assert.deepEqual(granted[f], [...GRANT_MATRIX[f]].sort(), f)
  const revokedAll = (txt) => new Set(topLevelStatements(txt)
    .map((s) => s.match(/^revoke all on function public\.(story_[a-z_]+) ?\([^)]*\) from public, anon, authenticated, service_role$/)?.[1]).filter(Boolean))
  assert.deepEqual([...revokedAll(fileText('schema'))].sort(), [...STORY_RPCS].sort())
  assert.deepEqual([...revokedAll(fileText('quarantine'))].sort(), [...STORY_RPCS].sort())
  assert.ok(stmts.includes('revoke all on schema story from public, anon, authenticated, service_role'))
  for (const k of ['tables', 'sequences', 'functions']) assert.ok(stmts.includes(`revoke all on all ${k} in schema story from public, anon, authenticated, service_role`), k)
})

test('VERIFY · PREFLIGHT — 이름 유일 · 계약 검사 포함 · 상수만(입력 SQL 없음)', () => {
  for (const [kind, set] of Object.entries({ PREFLIGHT_SQL, VERIFY_SQL })) {
    for (const [stage, list] of Object.entries(set)) {
      const names = checkNames(list)
      assert.equal(new Set(names).size, names.length, `${kind}.${stage} 이름 중복`)
    }
  }
  const v = checkNames(VERIFY_SQL.schema)
  for (const n of ['tables_exist_rls', 'story_table_set_exact', 'no_client_schema_privileges', 'no_client_table_privileges', 'no_client_sequence_privileges',
    'rpc_set_exact', 'rpc_definer_search_path_pg_temp', 'no_public_execute', 'anon_only_catalog', 'authenticated_all_but_service',
    'service_role_only_service_rpcs', 'story_internal_not_executable', 'mutation_guards_present', 'contract_columns', 'story_rows_empty_initial']) {
    assert.ok(v.includes(n), n)
  }
  assert.ok(!v.includes('service_role_no_rpc') && !v.includes('authenticated_all_rpc'))
  const all = [...VERIFY_SQL.schema, ...VERIFY_SQL.quarantine].join('\n')
  for (const f of STORY_RPCS) assert.match(all, new RegExp(`'${f}'`))
  for (const t of STORY_TABLES) assert.match(VERIFY_SQL.schema.find((q) => q.startsWith("select 'story_rows_empty_initial'")), new RegExp(`story\\.${t}\\)`))
  assert.doesNotMatch(all, /story_record_progress/)
  assert.deepEqual(checkNames(VERIFY_SQL.quarantine), ['tables_kept', 'rpc_closed_all_16', 'public_story_rpcs_closed', 'no_client_schema_privileges', 'no_client_table_privileges'])
  assert.ok(checkNames(PREFLIGHT_SQL.schema).includes('story_schema_absent'))
  assert.ok(checkNames(PREFLIGHT_SQL.quarantine).includes('story_rpcs_present'))
  assert.match(HISTORY_SQL, new RegExp(`version in \\('${STAGES.schema.version}','${STAGES.quarantine.version}'\\)`))
})

test('지문 범위 — schema 는 원본 5표 행 + 정의 · quarantine 은 story 12표 행 · 정의 + 함수 정의까지 · 전체 행 해시 · syscache/통계 열 없음', () => {
  assert.deepEqual(FINGERPRINT_SCOPE.schema.rows, LEGACY_TABLES)
  assert.deepEqual(FINGERPRINT_SCOPE.schema.definitions, LEGACY_TABLES)
  assert.equal(FINGERPRINT_SCOPE.schema.storyFunctions, false)
  assert.equal(FINGERPRINT_SCOPE.quarantine.rows.length, 5 + 12)
  assert.equal(FINGERPRINT_SCOPE.quarantine.storyFunctions, true)
  assert.equal(FINGERPRINT_SQL.schema.length, 10)
  assert.equal(FINGERPRINT_SQL.quarantine.length, 17 * 2 + 1)
  for (const t of LEGACY_TABLES) {
    assert.ok(FINGERPRINT_SQL.schema.some((q) => q.startsWith(`select 'rows:${t}'`) && q.includes(`md5(vf_fp_row::text) as h from ${t} vf_fp_row`)), t)
    assert.ok(FINGERPRINT_SQL.schema.some((q) => q.startsWith(`select 'def:${t}'`)), t)
  }
  const all = Object.values(FINGERPRINT_SQL).flat().join('\n')
  assert.doesNotMatch(all, /pg_get_|relpages|reltuples|relallvisible|relhas|relfrozenxid|indisvalid|indisready/)
  assert.doesNotMatch(FINGERPRINT_SQL.quarantine.at(-1), /proacl/)
  const c = compareFingerprints('schema', { a: '1', b: '2' }, { a: '1', b: '3' })
  assert.deepEqual([c.unchanged, c.changed], [false, ['b']])
  assert.equal(compareFingerprints('schema', { a: '1' }, { a: '1' }).unchanged, true)
  assert.equal(compareFingerprints('schema', {}, {}).unchanged, false, '빈 지문은 불변 증거가 아니다')
})

// ── 권한 · 승인 ─────────────────────────────────────────────────────────────────────────────────

test('자동화 · CI 는 난수가 있어도 거부 · SHA 불일치 · 난수 없음 · 난수 형식 · 모르는 단계 차단', () => {
  for (const env of [{ VFC_AUTOMATED_RUN: '1' }, { AGENT_GUARD_ASK: '0' }, { CI: 'true' }]) {
    assert.match(applyAuthorizationBlocks(schemaOk, { env }).join(), /automated/)
  }
  assert.deepEqual(applyAuthorizationBlocks(schemaOk, { env: {} }), [])
  assert.deepEqual(applyAuthorizationBlocks(schemaOk, { env: { CI: 'false' } }), [])
  assert.match(applyAuthorizationBlocks({ ...schemaOk, approvalNonce: undefined }, { env: {} }).join(), /approval-nonce.*TTY 입력만으로는/)
  assert.match(applyAuthorizationBlocks({ ...schemaOk, approvalNonce: 'xyz' }, { env: {} }).join(), /형식/)
  assert.match(applyAuthorizationBlocks({ ...schemaOk, confirmSha: STAGES.quarantine.sha256 }, { env: {} }).join(), /DEPLOY_BLOCKED\[sha\]/)
  assert.match(applyAuthorizationBlocks({ stage: 'drop', confirmSha: 'x', approvalNonce: nonce }, { env: {} }).join(), /stage/)
})

test('TTY 예외 없음 — 입력이 맞아도 티켓 소비가 실패하면 차단 · 입력이 틀리면 티켓을 태우지 않음 · 비TTY 는 입력 없이 소비만', async () => {
  let consumed = 0
  let asked = 0
  const noTicket = () => { consumed++; return { ticket: null, reason: '승인 티켓이 없거나 이미 쓰였다' } }
  const typed = (v) => async (expected) => { asked++; return v ?? expected }
  let r = await approveApply(schemaOk, { tty: true, confirm: typed(), consume: noTicket })
  assert.equal(r.approvedBy, null)
  assert.match(r.blocks.join(), /DEPLOY_BLOCKED\[permission\] 승인 티켓/)
  assert.deepEqual([asked, consumed], [1, 1])
  r = await approveApply(schemaOk, { tty: true, confirm: typed('APPLY schema wrong'), consume: noTicket })
  assert.match(r.blocks.join(), /confirmation mismatch/)
  assert.deepEqual([asked, consumed], [2, 1], '틀린 입력은 티켓을 소비하지 않는다')
  r = await approveApply(schemaOk, { tty: false, confirm: typed(), consume: noTicket })
  assert.match(r.blocks.join(), /DEPLOY_BLOCKED\[permission\]/)
  assert.deepEqual([asked, consumed], [2, 2])
})

test('위조 난수 + 빈 승인 폴더 → 티켓 없음 · 폴더에 아무것도 생기지 않음(공용 consumeTicket)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lcp-story-s3-approvals-'))
  try {
    const r = consumeTicket({ runner: 'lcp-story-s3', stage: 'schema', sha: STAGES.schema.sha256, nonce, dir })
    assert.equal(r.ticket, null)
    assert.deepEqual(fs.readdirSync(dir), [])
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

// ── 위치 ────────────────────────────────────────────────────────────────────────────────────────

test('중앙 정책 main_worktree 읽기 — 없음 · 깨짐 · 상대 경로 · 값 충돌은 실패(fail closed)', () => {
  const abs = path.resolve(os.tmpdir(), 'vf-main')
  const read = (obj) => () => (typeof obj === 'string' ? obj : JSON.stringify(obj))
  assert.deepEqual(readMainWorktree({ read: read({ main_worktree: abs }) }), { ok: true, mainWorktree: abs })
  assert.equal(readMainWorktree({ read: read({ main_worktree: abs, development_policy: { main_worktree: abs } }) }).ok, true)
  assert.equal(readMainWorktree({ read: () => { throw Object.assign(new Error('x'), { code: 'ENOENT' }) } }).ok, false)
  assert.equal(readMainWorktree({ read: read('{not json') }).ok, false)
  assert.equal(readMainWorktree({ read: read({ mode: 'LOCAL_FAST' }) }).ok, false)
  assert.equal(readMainWorktree({ read: read({ main_worktree: 'relative/path' }) }).ok, false)
  assert.equal(readMainWorktree({ read: read({ main_worktree: abs, development_policy: { main_worktree: path.resolve(os.tmpdir(), 'other') } }) }).ok, false)
  assert.equal(CENTRAL_DEV_MODE, 'D:/workspace/Vocaflow-AI-Control/config/dev-mode.json')
})

test('위치 — main_worktree 의 정본 러너만 통과 · 기능 worktree · 복사본 · 다른 진입점 · 설정 실패는 차단', () => {
  const dir = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'lcp-story-s3-loc-')))
  try {
    const mk = (name) => {
      const root = path.join(dir, name)
      const file = path.join(root, 'scripts', 'db', 'lcp-story-s3', 'deploy.mjs')
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, '// stub\n')
      return { root, file }
    }
    const main = mk('main')
    const feature = mk('feature')
    const ok = { ok: true, mainWorktree: main.root }
    assert.deepEqual(locationBlocks({ self: main.file, root: main.root, argv1: main.file, main: ok }), [])
    const f = locationBlocks({ self: feature.file, root: feature.root, argv1: feature.file, main: ok })
    assert.equal(f.length, 1)
    assert.match(f[0], /DEPLOY_BLOCKED\[location\]/)
    assert.match(locationBlocks({ self: main.file, root: main.root, argv1: path.join(dir, 'other.mjs'), main: ok }).join(), /DEPLOY_BLOCKED\[permission\]/)
    assert.match(locationBlocks({ self: feature.file, root: main.root, argv1: feature.file, main: ok }).join(), /DEPLOY_BLOCKED\[permission\]/)
    assert.match(locationBlocks({ self: main.file, root: main.root, argv1: main.file, main: { ok: false, why: 'x' } }).join(), /DEPLOY_BLOCKED\[location\] x/)
    assert.match(locationBlocks({ self: main.file, root: main.root, argv1: main.file, main: { ok: true, mainWorktree: path.join(dir, 'nope') } }).join(), /DEPLOY_BLOCKED\[location\]/)
    const upper = locationBlocks({ self: main.file, root: main.root, argv1: main.file, main: { ok: true, mainWorktree: main.root.toUpperCase() } })
    if (process.platform === 'win32') assert.deepEqual(upper, [], 'Windows 는 대소문자 무시')
    else assert.match(upper.join(), /DEPLOY_BLOCKED\[location\]/)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('커밋 상태 — HEAD 가 main 이 아니면 · 추적 안 됨 · 수정됨은 차단, main 이고 깨끗하면 통과(git 주입)', () => {
  const rels = ['a', 'b']
  const git = ({ branch = 'main\n', status = '', lsFail = false } = {}) => (args) => {
    if (args[0] === 'symbolic-ref') { if (branch === null) throw new Error('fatal: ref HEAD is not a symbolic ref'); return branch }
    if (args[0] === 'ls-files' && lsFail) throw new Error('error: pathspec')
    return args[0] === 'status' ? status : ''
  }
  assert.deepEqual(committedBlocks('/r', rels, { git: git() }), [])
  assert.match(committedBlocks('/r', rels, { git: git({ branch: 'feat/x\n' }) }).join(), /DEPLOY_BLOCKED\[committed\].*브랜치 main 이 아니다\(feat\/x\)/)
  assert.match(committedBlocks('/r', rels, { git: git({ branch: null }) }).join(), /detached HEAD/)
  assert.match(committedBlocks('/r', rels, { git: git({ status: ' M a\n' }) }).join(), /DEPLOY_BLOCKED\[committed\].*M a/)
  assert.match(committedBlocks('/r', rels, { git: git({ lsFail: true }) }).join(), /DEPLOY_BLOCKED\[committed\].*추적 중이 아니다/)
})

test('커밋 상태 대상 = 러너의 실제 import 폐포(factory-i1 하위 모듈 포함) — 상대 import · export from · 동적 import 리터럴', () => {
  const closure = importClosure()
  for (const f of ['scripts/db/lcp-story-s3/deploy.mjs', 'agents/scripts/db-approval.mjs', 'scripts/db/factory-i1/deploy.mjs', 'scripts/db/factory-i1/spec.mjs',
    'scripts/db/factory-i1/build.mjs', 'scripts/db/factory-i1/sql.mjs', 'scripts/db/factory-i1/catalog.mjs', 'scripts/db/factory-i1/source.mjs',
    'scripts/db/factory-i1/restore.mjs']) {
    assert.ok(closure.includes(f), f)
  }
  assert.ok(closure.every((f) => !f.startsWith('..') && !f.includes('node_modules') && f.endsWith('.mjs')), closure.join(','))
  assert.ok(!closure.includes('scripts/db/factory-i1/isolated.mjs'), 'import 하지 않는 파일은 넣지 않는다')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lcp-story-s3-closure-'))
  try {
    const w = (rel, src) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), src) }
    w('a/entry.mjs', "import fs from 'node:fs'\nimport {\n  x,\n} from './b.mjs'\nexport { y } from '../c/c.mjs'\nimport './side.mjs'\nconst z = await import('./dyn.mjs')\n")
    w('a/b.mjs', "import pg from 'pg'\nexport const x = 1\n")
    w('c/c.mjs', "import { x } from '../a/b.mjs'\nexport const y = x\n")
    w('a/side.mjs', '')
    w('a/dyn.mjs', "import './gone.mjs'\n")
    assert.deepEqual(importClosure(path.join(dir, 'a/entry.mjs'), { root: dir }), ['a/b.mjs', 'a/dyn.mjs', 'a/entry.mjs', 'a/side.mjs', 'c/c.mjs'])
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('실행 환경 — 티켓 폴더 재지정 · 홈 재지정 · 사전 로드/로더/디버거 플래그 · TLS 검증 끄기는 차단, TLS 버전 플래그만 허용', () => {
  const profile = path.resolve(os.tmpdir(), 'vf-profile')
  const base = { env: {}, execArgv: [], homedir: () => profile, approvalDir: path.join(profile, '.vocaflow', 'db-approvals'), realpath: (p) => path.resolve(p) }
  assert.deepEqual(runtimeBlocks(base), [])
  assert.deepEqual(runtimeBlocks({ ...base, execArgv: ['--tls-max-v1.2'], env: { NODE_OPTIONS: '--tls-min-v1.2' } }), [])
  assert.match(runtimeBlocks({ ...base, env: { VF_DB_APPROVAL_DIR: path.join(profile, 'x') } }).join(), /DEPLOY_BLOCKED\[environment\] VF_DB_APPROVAL_DIR/)
  assert.match(runtimeBlocks({ ...base, env: { VF_DB_APPROVAL_DIR: '' } }).join(), /VF_DB_APPROVAL_DIR/, '빈 값도 설정으로 본다')
  assert.match(runtimeBlocks({ ...base, homedir: () => path.resolve(os.tmpdir(), 'elsewhere') }).join(), /홈.*계정 프로필/)
  assert.match(runtimeBlocks({ ...base, approvalDir: null }).join(), /os\.userInfo/)
  for (const execArgv of [['--require', 'x.cjs'], ['-r', 'x.cjs'], ['--import=x.mjs'], ['--loader', 'x.mjs'], ['--experimental-loader=x.mjs'],
    ['--inspect'], ['--inspect-brk=0'], ['--env-file=.env'], ['--tls-max-v1.0'], ['--preserve-symlinks-main']]) {
    assert.match(runtimeBlocks({ ...base, execArgv }).join(), /DEPLOY_BLOCKED\[environment\] 허용되지 않은 Node 실행 플래그/, execArgv.join(' '))
  }
  for (const NODE_OPTIONS of ['--require ./x.cjs', '--import x.mjs', '--inspect', '--tls-max-v1.2 -r x.cjs', '--use-system-ca']) {
    assert.match(runtimeBlocks({ ...base, env: { NODE_OPTIONS } }).join(), /NODE_OPTIONS/, NODE_OPTIONS)
  }
  assert.deepEqual(nodeFlagProblems(['--tls-max-v1.2'], '--tls-min-v1.3'), [])
  assert.match(runtimeBlocks({ ...base, env: { NODE_TLS_REJECT_UNAUTHORIZED: '0' } }).join(), /DEPLOY_BLOCKED\[tls\]/)
  const fixed = fixedApprovalDir({ userInfo: () => ({ homedir: profile }) })
  assert.equal(fixed, path.join(profile, '.vocaflow', 'db-approvals'))
  assert.equal(fixedApprovalDir({ userInfo: () => { throw new Error('no passwd') } }), null)
  assert.equal(fixedApprovalDir({ userInfo: () => ({ homedir: 'relative' }) }), null)
  // 실제 계정: 고정 폴더는 환경 변수와 무관하다(VF_DB_APPROVAL_DIR · USERPROFILE 를 바꿔도 같은 값)
  assert.equal(fixedApprovalDir(), path.join(os.userInfo().homedir, '.vocaflow', 'db-approvals'))
})

test('TLS — 검증은 항상 켜짐(끄는 분기 없음) · --ca 는 해석 가능한 CA 인증서 PEM 만 · NODE_TLS_REJECT_UNAUTHORIZED 차단', () => {
  const o = tlsOptions({ host: 'db.example.supabase.co' })
  assert.equal(o.rejectUnauthorized, true)
  assert.equal(o.servername, 'db.example.supabase.co')
  assert.equal(o.checkServerIdentity, tls.checkServerIdentity)
  assert.equal(o.minVersion, 'TLSv1.2')
  assert.ok(!('ca' in o))
  assert.equal(tlsOptions({ host: 'h', ca: 'PEM', rejectUnauthorized: false }).rejectUnauthorized, true, '인자로 검증을 끌 수 없다')
  assert.equal(tlsOptions({ host: 'h', ca: 'PEM' }).ca, 'PEM')
  assert.deepEqual(tlsEnvBlocks({}), [])
  assert.deepEqual(tlsEnvBlocks({ NODE_TLS_REJECT_UNAUTHORIZED: '1' }), [])
  for (const v of ['0', '', 'false']) assert.match(tlsEnvBlocks({ NODE_TLS_REJECT_UNAUTHORIZED: v }).join(), /DEPLOY_BLOCKED\[tls\]/, v)

  const root = tls.rootCertificates[0] // Node 내장 공개 루트 인증서(시험용 PEM — 비밀 아님)
  const ok = loadCa('ca.pem', { read: () => `${root}\n${tls.rootCertificates[1]}\n` })
  assert.deepEqual(ok.blocks, [])
  assert.equal(ok.fingerprints.length, 2)
  assert.match(ok.fingerprints[0], /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/)
  assert.match(loadCa('x', { read: () => { throw Object.assign(new Error('nope'), { code: 'ENOENT' }) } }).blocks.join(), /DEPLOY_BLOCKED\[tls\].*ENOENT/)
  assert.match(loadCa('x', { read: () => 'not a pem' }).blocks.join(), /PEM 인증서가 없다/)
  assert.match(loadCa('x', { read: () => `${root}\n-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----\n` }).blocks.join(), /개인 키/)
  assert.match(loadCa('x', { read: () => '-----BEGIN CERTIFICATE-----\nAAAA\n-----END CERTIFICATE-----\n' }).blocks.join(), /해석할 수 없다/)
})

test('접속 전 차단 순서 — 권한 → (위치 + 실행 환경, 함께) → 본문 → 커밋 상태, 앞이 막히면 뒤는 부르지 않는다', () => {
  const calls = []
  const deps = (over = {}) => ({
    env: {},
    location: () => { calls.push('location'); return over.location ?? [] },
    runtime: () => { calls.push('runtime'); return over.runtime ?? [] },
    offline: () => { calls.push('offline'); return over.offline ?? { blocks: [], text: 'body' } },
    committed: () => { calls.push('committed'); return over.committed ?? [] },
  })
  assert.match(applyGates({ ...schemaOk, approvalNonce: undefined }, deps()).blocks.join(), /permission/)
  assert.deepEqual(calls.splice(0), [])
  const both = applyGates(schemaOk, deps({ location: ['DEPLOY_BLOCKED[location] x'], runtime: ['DEPLOY_BLOCKED[environment] e'] })).blocks.join('\n')
  assert.match(both, /location/)
  assert.match(both, /environment/)
  assert.deepEqual(calls.splice(0), ['location', 'runtime'])
  assert.match(applyGates(schemaOk, deps({ runtime: ['DEPLOY_BLOCKED[environment] e'] })).blocks.join(), /environment/)
  assert.deepEqual(calls.splice(0), ['location', 'runtime'])
  assert.match(applyGates(schemaOk, deps({ offline: { blocks: ['DEPLOY_BLOCKED[sha] y'], text: null } })).blocks.join(), /sha/)
  assert.deepEqual(calls.splice(0), ['location', 'runtime', 'offline'])
  assert.match(applyGates(schemaOk, deps({ committed: ['DEPLOY_BLOCKED[committed] z'] })).blocks.join(), /committed/)
  assert.deepEqual(calls.splice(0), ['location', 'runtime', 'offline', 'committed'])
  assert.deepEqual(applyGates(schemaOk, deps()), { blocks: [], text: 'body' })
})

test('인자 — SQL · URL · 우회 인자를 받지 않는다 · 모르는 인자 · 중복 · 값 없음은 problems', () => {
  const p = parseArgs(['apply', '--sql', 'drop table x', '--stage', 'schema'])
  assert.equal(p.stage, 'schema')
  assert.ok(!('sql' in p))
  assert.ok(p.problems.some((x) => x.includes('--sql')))
  assert.ok(parseArgs(['apply', '--stage', 'schema', '--stage', 'quarantine']).problems.some((x) => x.includes('한 번만')))
  assert.ok(parseArgs(['apply', '--stage']).problems.some((x) => x.includes('값이 없다')))
  assert.ok(parseArgs(['apply', '--isolated']).problems.length > 0)
  const eq = parseArgs(['apply', '--stage=quarantine', '--deps', 'd', '--confirm-sha', 'x', '--approval-nonce', nonce])
  assert.deepEqual([eq.stage, eq.deps, eq.confirmSha, eq.approvalNonce, eq.urlEnv, eq.problems], ['quarantine', 'd', 'x', nonce, 'VF_DEPLOY_DB_URL', []])
  assert.equal(parseArgs(['preflight', '--stage', 'schema', '--deps', 'd', '--ca', 'root.pem']).ca, 'root.pem')
  for (const bypass of ['--no-verify', '--insecure', '--sslmode', '--ssl', '--reject-unauthorized']) {
    assert.ok(parseArgs(['apply', '--stage', 'schema', bypass, 'false']).problems.some((x) => x.includes(bypass)), bypass)
  }
})

// ── 이력 순서 · 한 트랜잭션 ─────────────────────────────────────────────────────────────────────

test('순서 — schema 는 한 번만 · quarantine 은 schema 이력 SHA 가 승인값일 때만 · verify 는 자기 이력 SHA 필수', () => {
  assert.deepEqual(evaluate('schema', [], { mode: 'apply' }), [])
  assert.match(evaluate('schema', [mineSchema], { mode: 'apply' }).join(), /already/)
  assert.match(evaluate('quarantine', [], { mode: 'apply' }).join(), /order/)
  assert.match(evaluate('quarantine', [{ ...mineSchema, sha256: 'bad' }], { mode: 'apply' }).join(), /order/)
  assert.deepEqual(evaluate('quarantine', [mineSchema], { mode: 'apply' }), [])
  assert.match(evaluate('quarantine', [mineSchema, mineQuarantine], { mode: 'apply' }).join(), /already/)
  assert.deepEqual(evaluate('schema', [mineSchema], { mode: 'verify' }), [])
  assert.match(evaluate('schema', [{ ...mineSchema, sha256: 'other' }], { mode: 'verify' }).join(), /history/)
  assert.match(evaluate('nope', [], { mode: 'apply' }).join(), /stage/)
})

/** 가짜 pg 클라이언트 — 질의 순서를 기록하고 정해 둔 결과를 돌려준다(DB 없음) */
function fakeClient({ history = [], preflightOk = true, verifyFail = null, changeOnBody = null, bodyError = null, commit = { command: 'COMMIT' }, commitError = null } = {}) {
  const log = []
  let bodyRan = false
  const preflight = new Set([...PREFLIGHT_SQL.schema, ...PREFLIGHT_SQL.quarantine])
  const verify = new Set([...VERIFY_SQL.schema, ...VERIFY_SQL.quarantine])
  const fingerprint = new Set([...FINGERPRINT_SQL.schema, ...FINGERPRINT_SQL.quarantine])
  return {
    log,
    async query(q) {
      const text = typeof q === 'string' ? q : q.text
      if (text === HISTORY_SQL) { log.push('history'); return { rows: history } }
      if (preflight.has(text)) { log.push('preflight'); return { rows: [[text.match(/^select '([a-z0-9_]+)'/)[1], preflightOk, null]] } }
      if (verify.has(text)) {
        const name = text.match(/^select '([a-z0-9_]+)'/)[1]
        log.push('verify')
        return { rows: [[name, name !== verifyFail, name === verifyFail ? 'story_admin_publish' : null]] }
      }
      if (fingerprint.has(text)) {
        const name = text.match(/^select '([^']+)'/)[1]
        log.push(bodyRan ? 'fp-after' : 'fp-before')
        return { rows: [[name, bodyRan && name === changeOnBody ? 'changed' : 'same']] }
      }
      if (text.startsWith('insert into supabase_migrations.schema_migrations')) { log.push('ledger'); return { rows: [] } }
      if (text === 'commit') { log.push('commit'); if (commitError) throw commitError; return commit }
      if (text === 'rollback') { log.push('rollback'); return {} }
      if (/^(begin|set local|lock table)/.test(text)) { log.push(text); return { rows: [] } }
      log.push('body')
      bodyRan = true
      if (bodyError) throw bodyError
      return {}
    },
  }
}
const BODY = 'create schema story;\ncreate table story.sources (id int);\n'
const firstIdx = (log, x) => log.indexOf(x)
const lastIdx = (log, x) => log.lastIndexOf(x)

test('applyStage — REPEATABLE READ 한 트랜잭션: 잠금 → 이력 → preflight → 지문(전) → 본문 → 지문(후) → VERIFY → 이력 행 → COMMIT', async () => {
  const c = fakeClient()
  const r = await applyStage(c, 'schema', { text: BODY, approvedBy: 'test' })
  assert.equal(r.outcome, 'committed')
  assert.equal(r.legacy.unchanged, true)
  assert.equal(r.verify.ok, true)
  assert.deepEqual(r.verify.rows.map((x) => x.check), VERIFY_SQL.schema.map((q) => q.match(/^select '([a-z0-9_]+)'/)[1]))
  assert.deepEqual(Object.keys(r.legacy.before).sort(), FINGERPRINT_SQL.schema.map((q) => q.match(/^select '([^']+)'/)[1]).sort())
  const L = c.log
  assert.equal(L[0], 'begin isolation level repeatable read')
  assert.ok(firstIdx(L, 'lock table supabase_migrations.schema_migrations in share row exclusive mode') < firstIdx(L, 'history'), '스냅숏(첫 질의) 전에 잠금')
  assert.ok(firstIdx(L, 'history') < firstIdx(L, 'preflight'))
  assert.ok(lastIdx(L, 'preflight') < firstIdx(L, 'fp-before'))
  assert.ok(lastIdx(L, 'fp-before') < firstIdx(L, 'body') && firstIdx(L, 'body') === lastIdx(L, 'body'))
  assert.ok(firstIdx(L, 'body') < firstIdx(L, 'fp-after') && lastIdx(L, 'fp-after') < firstIdx(L, 'verify'))
  assert.ok(lastIdx(L, 'verify') < firstIdx(L, 'ledger'), 'VERIFY 는 이력 행 · COMMIT 전에 같은 트랜잭션에서')
  assert.deepEqual(L.slice(-2), ['ledger', 'commit'])
  assert.ok(!L.includes('rollback'))
})

test('applyStage — 트랜잭션 안 VERIFY 가 하나라도 실패하면 이력 행 없이 롤백(잘못된 권한을 커밋하지 않는다)', async () => {
  for (const [stage, name, history] of [['schema', 'anon_only_catalog', []], ['schema', 'service_role_only_service_rpcs', []],
    ['schema', 'tables_exist_rls', []], ['quarantine', 'rpc_closed_all_16', [mineSchema]]]) {
    const c = fakeClient({ history, verifyFail: name })
    const text = stage === 'schema' ? BODY : 'revoke all on function public.story_catalog() from anon;'
    const r = await applyStage(c, stage, { text, approvedBy: 'test' })
    assert.deepEqual([r.outcome, c.log.includes('ledger'), c.log.includes('commit'), c.log.at(-1)], ['rolled_back', false, false, 'rollback'], name)
    assert.match(r.error.message, new RegExp(`DEPLOY_BLOCKED\\[verify\\] ${name}`))
    assert.equal(r.verify.ok, false)
  }
})

test('applyStage — 이미 적용 · preflight 실패 · 지문 변경 · 본문 오류는 이력 행 없이 롤백, COMMIT 확인 불가는 unknown', async () => {
  let c = fakeClient({ history: [mineSchema] })
  let r = await applyStage(c, 'schema', { text: BODY, approvedBy: 'test' })
  assert.deepEqual([r.outcome, c.log.includes('body'), c.log.includes('ledger'), c.log.at(-1)], ['rolled_back', false, false, 'rollback'])
  assert.match(r.error.message, /DEPLOY_BLOCKED\[already\]/)

  c = fakeClient({ preflightOk: false })
  r = await applyStage(c, 'schema', { text: BODY, approvedBy: 'test' })
  assert.deepEqual([r.outcome, c.log.includes('body'), c.log.includes('ledger')], ['rolled_back', false, false])
  assert.match(r.error.message, /DEPLOY_BLOCKED\[preflight\] story_schema_absent/)

  c = fakeClient({ changeOnBody: 'rows:public.library_books' })
  r = await applyStage(c, 'schema', { text: BODY, approvedBy: 'test' })
  assert.deepEqual([r.outcome, c.log.includes('ledger'), c.log.at(-1)], ['rolled_back', false, 'rollback'])
  assert.match(r.error.message, /DEPLOY_BLOCKED\[impact\].*rows:public\.library_books/)
  assert.deepEqual(r.legacy.changed, ['rows:public.library_books'])

  c = fakeClient({ bodyError: Object.assign(new Error('relation exists'), { code: '42P07' }) })
  r = await applyStage(c, 'schema', { text: BODY, approvedBy: 'test' })
  assert.deepEqual([r.outcome, c.log.includes('ledger'), c.log.includes('fp-after')], ['rolled_back', false, false])

  c = fakeClient({ commitError: Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' }) })
  r = await applyStage(c, 'schema', { text: BODY, approvedBy: 'test' })
  assert.equal(r.outcome, 'unknown')
  c = fakeClient({ commitError: Object.assign(new Error('could not serialize'), { code: '40001' }) })
  assert.equal((await applyStage(c, 'schema', { text: BODY, approvedBy: 'test' })).outcome, 'rolled_back')
  c = fakeClient({ commit: { command: 'ROLLBACK' } })
  assert.equal((await applyStage(c, 'schema', { text: BODY, approvedBy: 'test' })).outcome, 'unknown')
})

test('applyStage — 본문에 최상위 COMMIT 이 있으면 BEGIN 전에 거절(blocked) · quarantine 은 story 표 지문까지 비교', async () => {
  let c = fakeClient()
  const r = await applyStage(c, 'schema', { text: `${BODY}commit;\ncreate table story.after_commit (id int);\n`, approvedBy: 'test' })
  assert.deepEqual([r.outcome, c.log.length], ['blocked', 0])
  assert.match(r.error.message, /DEPLOY_BLOCKED\[sql\]/)
  c = fakeClient({ history: [mineSchema], changeOnBody: 'rows:story.releases' })
  const q = await applyStage(c, 'quarantine', { text: 'revoke all on function public.story_catalog() from anon;', approvedBy: 'test' })
  assert.equal(q.outcome, 'rolled_back')
  assert.match(q.error.message, /DEPLOY_BLOCKED\[impact\].*rows:story\.releases/)
  assert.ok(!c.log.includes('ledger'))
})

// ── 실제 프로세스 ────────────────────────────────────────────────────────────────────────────────

function run(args, extraEnv = {}, nodeFlags = []) {
  const approvals = fs.mkdtempSync(path.join(os.tmpdir(), 'lcp-story-s3-approvals-'))
  const env = { ...process.env, VF_DB_APPROVAL_DIR: approvals, VF_DEPLOY_ENV_FILE: path.join(approvals, 'no-such.env'), ...extraEnv }
  for (const k of ['CI', 'VFC_AUTOMATED_RUN', 'AGENT_GUARD_ASK', 'VF_DEPLOY_DB_URL', 'NODE_OPTIONS', 'NODE_TLS_REJECT_UNAUTHORIZED']) if (!(k in extraEnv)) delete env[k]
  try {
    const r = spawnSync(process.execPath, [...nodeFlags, RUNNER, ...args], { cwd: ROOT, env, encoding: 'utf8', input: '', timeout: 60_000 })
    return { status: r.status, out: `${r.stdout}${r.stderr}`, approvalsAfter: fs.readdirSync(approvals) }
  } finally {
    fs.rmSync(approvals, { recursive: true, force: true })
  }
}

test('실제 실행: 사용법 1 · 승인 없는 apply 는 DB 접속 전에 2 · 위치 차단은 러너의 실제 위치대로 · 승인 폴더 · 로그 · 접속 문자열 흔적 없음', () => {
  const logDir = path.join(HERE, 'logs')
  const logsBefore = fs.existsSync(logDir) ? fs.readdirSync(logDir).length : 0
  const deps = path.join(os.tmpdir(), 'lcp-story-s3-no-such-deps')
  const apply = (extra = []) => ['apply', '--stage', 'schema', '--deps', deps, '--confirm-sha', STAGES.schema.sha256, ...extra]

  assert.equal(run(['bogus']).status, 1)
  assert.equal(run(['apply', '--stage', 'everything', '--deps', deps]).status, 1)
  assert.equal(run(['preflight', '--stage', 'schema']).status, 1) // --deps 없음
  assert.equal(run([...apply(), '--sql', 'drop table x']).status, 1)

  const wrongSha = run(['apply', '--stage', 'schema', '--deps', deps, '--confirm-sha', STAGES.quarantine.sha256, '--approval-nonce', nonce])
  assert.equal(wrongSha.status, 2)
  assert.match(wrongSha.out, /DEPLOY_BLOCKED\[sha\]/)

  const noNonce = run(apply())
  assert.equal(noNonce.status, 2)
  assert.match(noNonce.out, /DEPLOY_BLOCKED\[permission\].*approval-nonce/)

  const automated = run(apply(['--approval-nonce', nonce]), { VFC_AUTOMATED_RUN: '1' })
  assert.equal(automated.status, 2)
  assert.match(automated.out, /automated/)

  // 형식이 맞는 난수 + 맞는 SHA 여도 시험이 건 VF_DB_APPROVAL_DIR 는 어느 위치에서든 실행 환경 차단이다(티켓을 찾지도 소비하지도 않는다).
  // 위치 차단은 러너의 실제 위치대로 — 기능 worktree 면 함께 보고되고, main_worktree 의 정본 러너면 없다(두 판정은 위 locationBlocks 단위 시험)
  const expectLocation = locationBlocks({ argv1: RUNNER }).some((b) => b.startsWith('DEPLOY_BLOCKED[location]'))
  const forged = run(apply(['--approval-nonce', nonce]))
  assert.equal(forged.status, 2)
  if (expectLocation) assert.match(forged.out, /DEPLOY_BLOCKED\[location\]/)
  else assert.doesNotMatch(forged.out, /DEPLOY_BLOCKED\[location\]/)
  assert.match(forged.out, /DEPLOY_BLOCKED\[environment\] VF_DB_APPROVAL_DIR/)
  assert.doesNotMatch(forged.out, /DEPLOY_BLOCKED\[(sha|committed|target|deps|tls)\]|승인 티켓/)
  assert.deepEqual(forged.approvalsAfter, [])

  // 사전 로드 — 실행 플래그(--require)와 NODE_OPTIONS 둘 다 실제 프로세스에서 차단된다(무해한 빈 preload 파일)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lcp-story-s3-preload-'))
  let preloadFlag
  let preloadEnv
  try {
    const preload = path.join(tmp, 'harmless.cjs')
    fs.writeFileSync(preload, '// 시험용 빈 사전 로드\n')
    preloadFlag = run(apply(['--approval-nonce', nonce]), {}, ['--require', preload])
    // NODE_OPTIONS 의 따옴표 안 역슬래시는 Node 가 이스케이프로 읽는다 — 경로는 / 로 넘긴다
    preloadEnv = run(apply(['--approval-nonce', nonce]), { NODE_OPTIONS: `--require "${preload.replaceAll('\\', '/')}"` })
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
  assert.equal(preloadFlag.status, 2, preloadFlag.out)
  assert.match(preloadFlag.out, /허용되지 않은 Node 실행 플래그.*execArgv --require/)
  assert.equal(preloadEnv.status, 2, preloadEnv.out)
  assert.match(preloadEnv.out, /허용되지 않은 Node 실행 플래그.*NODE_OPTIONS --require/)

  const tlsOff = run(apply(['--approval-nonce', nonce]), { NODE_TLS_REJECT_UNAUTHORIZED: '0' })
  assert.equal(tlsOff.status, 2, tlsOff.out)
  assert.match(tlsOff.out, /DEPLOY_BLOCKED\[tls\]/)

  for (const r of [wrongSha, noNonce, automated, forged, preloadFlag, preloadEnv, tlsOff]) {
    assert.doesNotMatch(r.out, /postgres(ql)?:\/\//)
    assert.deepEqual(r.approvalsAfter, [])
  }
  const logsAfter = fs.existsSync(logDir) ? fs.readdirSync(logDir).length : 0
  assert.equal(logsAfter, logsBefore, '차단된 실행은 로그를 만들지 않는다(DB 에 닿지 않았다)')
})

test('실제 실행(읽기 전용 경로): TLS 검증 끄기 · 잘못된 --ca 는 접속 준비 전에 2, 올바른 CA PEM 은 통과해 다음 단계(--deps)에서 멈춘다 — 접속 없음', () => {
  const deps = path.join(os.tmpdir(), 'lcp-story-s3-no-such-deps')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lcp-story-s3-ca-'))
  try {
    const good = path.join(dir, 'root.pem')
    fs.writeFileSync(good, tls.rootCertificates[0]) // Node 내장 공개 루트(시험용 — 비밀 아님)
    const bad = path.join(dir, 'bad.pem')
    fs.writeFileSync(bad, 'not a certificate\n')
    const pre = (extra) => ['preflight', '--stage', 'schema', '--deps', deps, ...extra]
    const off = run(pre([]), { NODE_TLS_REJECT_UNAUTHORIZED: '0' })
    assert.equal(off.status, 2)
    assert.match(off.out, /DEPLOY_BLOCKED\[tls\] NODE_TLS_REJECT_UNAUTHORIZED/)
    const missing = run(pre(['--ca', path.join(dir, 'missing.pem')]))
    assert.equal(missing.status, 2)
    assert.match(missing.out, /DEPLOY_BLOCKED\[tls\] --ca .*ENOENT/)
    const invalid = run(pre(['--ca', bad]))
    assert.equal(invalid.status, 2)
    assert.match(invalid.out, /DEPLOY_BLOCKED\[tls\].*PEM 인증서가 없다/)
    const accepted = run(pre(['--ca', good]))
    assert.equal(accepted.status, 2)
    assert.match(accepted.out, /DEPLOY_BLOCKED\[deps\]/)
    assert.doesNotMatch(accepted.out, /DEPLOY_BLOCKED\[tls\]/)
    for (const r of [off, missing, invalid, accepted]) assert.doesNotMatch(r.out, /postgres(ql)?:\/\//)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
