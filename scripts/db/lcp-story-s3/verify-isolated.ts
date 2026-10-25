// scripts/db/lcp-story-s3/verify-isolated.ts
//
// LCP Story S3 SQL 격리 검증 — 임시 DB 에만 적용한다. 공유 개발 DB 에 접속하지 않는다.
//
//   pnpm exec tsx scripts/db/lcp-story-s3/verify-isolated.ts                                  # PGlite(메모리, 연결 1)
//   pnpm exec tsx scripts/db/lcp-story-s3/verify-isolated.ts --engine pg17 --deps <dir>       # 실제 PostgreSQL 17 임시 클러스터
//     <dir> = embedded-postgres@17 + pg 를 설치한 폴더(저장소 의존성 아님 — scripts/db/factory-i1/isolated-db.mjs 와 같은 준비).
//
// 1) Supabase 와 비슷한 바탕(역할 anon · authenticated · service_role, auth.uid(), JWT 주장 설정, public 기본 권한, 원본 도서 · 프로필 ·
//    texts · content_chunks · reading_sessions 표, supabase_migrations.schema_migrations)을 만들고
// 2) supabase/migrations/_pending_lcp_story_s3_schema.sql 파일 바이트를 그대로 적용한다(pg17 은 승인형 러너의 applyStage 로)
// 3) S2 TypeScript(packages/library-pipeline/src/story)가 계산한 해시 · release_key · 검증 결속과 DB 가 다시 계산한 값을 대조하고
// 4) 권한 · 행위자 위조 · 결속 변조 · 자기 승인 · 보류 발행 · 직접 행 조작 · 철회 · 불변 · 격리(quarantine) · 원본 무변경을 시험한다.
// 5) 검증 증인(T-0169 보강): 정상 경로 = service_role 이 story_service_validation_input 을 읽고 → S2 어댑터(attest.ts)가 증명을 만들고 →
//    service_role 이 story_service_attest_validation → admin 발행. 증명 없는 발행 · 증명 위조/변조 · 낡은 증명 · S2 가 거부하는
//    판본(앵커 비움 · 거짓 진입 장면 · 인용 불일치 · 문단 밖 · 서로게이트 분할 · 범위 밖 · 중복 · 정렬 누락 · 보존/변경 기록/활동 누락)은
//    직접 authenticated RPC 로 올려도 발행되지 않아야 한다.
// 6) 진도: 위치(story_record_position)는 완료를 만들지 않고, 단위 완료(story_complete_unit)가 0..n-1 전부일 때만 발행본 완료다.
// 7) 권리: 발행 뒤 보류 · 거부(번역 포함)는 서가 · 본문 · 위치 · 완료를 즉시 닫고 이력은 남긴다. 다시 확인하면 열린다. 쓰지 않는 매체 권리는 막지 않는다.
// 8) pg17 만: 러너 사후 검증 · 재적용 차단 · 원본 지문 롤백, 그리고 두 연결의 실제 경합(권리 보류 ↔ 발행 · 새 판 ↔ 발행 · 새 검수 ↔ 발행 ·
//    검증 증명 ↔ 새 검수 · 동시 발행 · 진도 · 철회) — 두 번째 연결이 pg_stat_activity 에서 실제 Lock 대기에 들어간 것을 확인한 뒤 첫째를 커밋한다.
// 9) 독립 검토 1회차 보강(INTERFACE H): 증인 RPC 는 service_role 역할 주장이 실제로 있어야 한다(JWT 없는 소유자 세션의 손 증명 = 검토 F9 차단),
//    살아 있는 발행본은 (원천, 판본 키)마다 하나, validated_at 시계 허용 오차, 검증기 계약이 다른 증명은 발행을 허락하지 않음, 동시 원천 등록 멱등.
//    모든 정상 서비스 호출은 PostgREST 모양(request.jwt.claims = {"role":"service_role"})으로 한다.
// 결과는 JSON 한 개(stdout). 실행하지 못한 항목은 not_run 으로 따로 세고 JSON 에 사유와 함께 남긴다(통과가 아니다).
// 종료 코드: 실패 하나라도 → 1 · 실패 없음 + not_run 있음 → 3(--allow-not-run 을 주면 0) · 전부 통과 + not_run 없음 → 0 · 충돌 → 1.
//   예: PGlite 는 경합 시험을 돌릴 수 없어 not_run 이 남으므로 --allow-not-run 없이 돌리면 3 이다. pg17 은 0 이어야 한다.
// 엔진(임시 PG17 클러스터 · 포트 · 임시 폴더)은 중간 충돌에도 finally 에서 멈추고 지운다.
// --schema-sql <path>: 일부러 결함을 넣은 SQL 사본 · 수정 전 SQL 로 이 시험이 실제로 실패하는지 보는 변이 시험(이때 T01 은 언제나 실패).

import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import * as S from '../../../packages/library-pipeline/src/story/index'
import { sourceIdentity } from '../../../packages/library-pipeline/src/story/validate'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..', '..')
const SCHEMA_SQL = join(REPO, 'supabase', 'migrations', '_pending_lcp_story_s3_schema.sql')
const QUARANTINE_SQL = join(REPO, 'supabase', 'migrations', '_pending_lcp_story_s3_quarantine.sql')
const FIXTURES = join(REPO, 'packages', 'library-pipeline', 'src', 'story', 'fixtures')

interface Db {
  exec(sql: string): Promise<unknown>
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>
}

interface PgClient extends Db {
  connect(): Promise<void>
  end(): Promise<void>
  processID?: number
}

interface Engine {
  name: 'pglite' | 'pg17'
  version: string
  db: Db
  /** pg17 만 — 같은 DB 에 새 연결(동시성 시험) */
  connect?: (database?: string) => Promise<PgClient>
  createDatabase?: (name: string) => Promise<void>
  stop(): Promise<void>
}

interface RunnerModule {
  STAGES: Record<string, { version: string; sha256: string; path: string }>
  offlineCheck(stage: string): { blocks: string[]; text: string | null }
  applyStage(client: unknown, stage: string, o: { text: string; approvedBy: string }): Promise<{
    ok: boolean
    outcome: string
    legacy: { unchanged: boolean } | null
    error?: { message: string }
  }>
  runVerify(client: unknown, stage: string): Promise<{ ok: boolean; rows: Array<{ check: string; ok: boolean; detail: unknown }> }>
  readHistory(client: unknown): Promise<Array<{ version: string; sha256: string }>>
}

/** not_run 이 남아도 종료 0 으로 볼지(PGlite 처럼 경합을 돌릴 수 없는 엔진에서 사람이 명시할 때만). */
const ALLOW_NOT_RUN = process.argv.includes('--allow-not-run')
/** 실패는 없지만 실행하지 못한 항목이 있을 때의 종료 코드 — 통과(0)와 구별한다. */
const EXIT_NOT_RUN = 3

function argValue(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function startPglite(): Promise<Engine> {
  // PGlite 는 apps/web 이 이미 가진 devDependency 를 그대로 쓴다(의존성 · lockfile 변경 없음).
  const requireFromWeb = createRequire(join(REPO, 'apps', 'web', 'package.json'))
  const { PGlite } = requireFromWeb('@electric-sql/pglite') as {
    PGlite: new () => Db & { close(): Promise<void> }
  }
  const db = new PGlite()
  const version = (await db.query<{ v: string }>("select current_setting('server_version') as v")).rows[0]!.v
  return { name: 'pglite', version: `PGlite 0.5.8 (PostgreSQL ${version})`, db, stop: () => db.close() }
}

async function startPg17(deps: string): Promise<Engine> {
  const req = createRequire(join(deps, 'package.json'))
  const { default: EmbeddedPostgres } = (await import(pathToFileURL(req.resolve('embedded-postgres')).href)) as {
    default: new (o: Record<string, unknown>) => { initialise(): Promise<void> }
  }
  const pg = req('pg') as { Client: new (o: Record<string, unknown>) => PgClient }
  const dir = mkdtempSync(join(tmpdir(), 'vf-lcp-story-s3-'))
  const port = 55000 + Math.floor(Math.random() * 900)
  const server = new EmbeddedPostgres({
    databaseDir: dir, user: 'postgres', password: 'pw', port, persistent: false,
    initdbFlags: ['--encoding=UTF8', '--locale=C'], onLog: () => {}, onError: () => {},
  })
  const platform = process.platform === 'win32' ? 'windows' : process.platform
  const bin = join(deps, 'node_modules', '@embedded-postgres', `${platform}-${process.arch}`, 'native', 'bin')
  const pgctl = (args: string[]) =>
    execFileSync(join(bin, process.platform === 'win32' ? 'pg_ctl.exe' : 'pg_ctl'), args, { stdio: 'ignore' })
  const clients: PgClient[] = []
  const stop = async (): Promise<void> => {
    for (const c of clients) await c.end().catch(() => {})
    try { pgctl(['-D', dir, '-m', 'immediate', 'stop']) } catch { /* 이미 멈춤 · 시작 전 */ }
    rmSync(dir, { recursive: true, force: true })
  }
  try {
    await server.initialise()
    pgctl(['-D', dir, '-o', `-p ${port}`, '-w', 'start'])
    const connect = async (database = 'postgres'): Promise<PgClient> => {
      const c = new pg.Client({ host: 'localhost', port, user: 'postgres', password: 'pw', database })
      await c.connect()
      clients.push(c)
      return c
    }
    const main = await connect()
    const db: Db = { exec: (sql) => main.query(sql), query: (sql, params) => main.query(sql, params) }
    const version = (await main.query<{ v: string }>("select current_setting('server_version') as v")).rows[0]!.v
    return {
      name: 'pg17',
      version: `PostgreSQL ${version} (embedded-postgres, isolated cluster)`,
      db,
      connect,
      createDatabase: async (name) => { await main.query(`create database ${name}`) },
      stop,
    }
  } catch (e) {
    // 시작 도중 실패해도 클러스터 · 임시 폴더를 남기지 않는다.
    await stop()
    throw e
  }
}

type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
type Status = 'pass' | 'fail' | 'not_run'
interface Result {
  id: string
  title: string
  status: Status
  detail?: string
  /** 통과했어도 남길 관찰 — 실제 잠금 대기(pg_stat_activity) · 직렬화 결과 등 */
  evidence?: string
}

const results: Result[] = []
// 시험 시계 — 스크립트 시작 시각 하나를 S2 검증 · 어댑터에 주입한다(DB 는 자기 now() 를 쓴다. 검수 · 확보 시각은 고정 과거값).
const NOW = new Date()

async function check(id: string, title: string, fn: () => Promise<string | void>): Promise<void> {
  try {
    const evidence = await fn()
    results.push({ id, title, status: 'pass', ...(evidence ? { evidence } : {}) })
  } catch (e) {
    results.push({ id, title, status: 'fail', detail: e instanceof Error ? e.message : String(e) })
  }
}

function notRun(id: string, title: string, detail: string): void {
  results.push({ id, title, status: 'not_run', detail })
}

function eq(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) throw new Error(`${label}: got ${String(actual)} expected ${String(expected)}`)
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

async function rejects(p: Promise<unknown>, pattern: RegExp, label: string): Promise<void> {
  try {
    await p
  } catch (e) {
    const msg = errMsg(e)
    if (pattern.test(msg)) return
    throw new Error(`${label}: unexpected error "${msg}" (wanted ${pattern})`)
  }
  throw new Error(`${label}: expected failure ${pattern} but it succeeded`)
}

function fixture(name: string): Json {
  return JSON.parse(readFileSync(join(FIXTURES, `gull-rock.${name}.json`), 'utf8')) as Json
}

function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function iso(v: unknown): string | null {
  if (v === null || v === undefined) return null
  return v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString()
}

// ── S2 쪽 기대값 ─────────────────────────────────────────────────────────────

const WORK = 'gull-rock-r1'
const realSnapshot = fixture('snapshot')
realSnapshot.synthetic = false
realSnapshot.snapshot_id = 'gull-rock-db-test'
realSnapshot.edition.source_kind = 'external_file'
realSnapshot.edition.edition_label = 'Isolated DB test copy of the synthetic Gull Rock text (test-only)'
realSnapshot.rights = [
  {
    asset: 'source_text',
    status: 'claimed_by_source',
    basis: '격리 시험용 주장 기록 — 실제 권리 심사 아님',
    evidence_ref: 'test-only-evidence',
    checked_by: null,
    checked_at: null,
  },
]

function must<T>(c: S.Checked<T>, label: string): T {
  if (!c.value) throw new Error(`${label}: ${JSON.stringify(c.errors)}`)
  return c.value
}

const source = must(S.validateSnapshot(realSnapshot, NOW), 'S2 snapshot')
const policyJson = fixture('policy')
const policy = must(S.validatePolicy(policyJson, source), 'S2 policy')

/** 한 원천 판본 + 한 편집 기준 — 판본 결속 · 검수 결속의 S2 쪽 문맥. */
interface Ctx {
  source: S.SourceContext
  policy: S.PolicyContext
}
const MAIN: Ctx = { source, policy }

function produceIn(ctx: Ctx, key: string, art: Json, sessionId = 'producer-session'): Json {
  art.produced_by = { agent: 'claude-code', session_id: sessionId, provenance: 'ai_generated' }
  art.binding = {
    source_sha256: ctx.source.sha256,
    source_identity_sha256: ctx.source.identity_sha256,
    policy_sha256: ctx.policy.policy_sha256,
    target_sha256: ctx.policy.items.get(key)!.target_sha256,
  }
  return art
}

function resultIn(ctx: Ctx, key: string, art: Json): S.EditionResult {
  return must(S.validateEdition(art, { ...ctx, edition_key: key, task_id: `${WORK}:${key}` }), `S2 edition ${key}`)
}

const REVIEWER_CLAIM = { kind: 'ai_model', agent: 'codex', session_id: 'reviewer-session', role: '독립 내용 검수(격리 시험)' }
const ADMIN_REVIEWER_CLAIM = { kind: 'ai_model', agent: 'codex', session_id: 'admin-review-session', role: '두 번째 검수(격리 시험)' }

/** 검수 산출물 — binding 은 S2 가 계산한 값(정상 판본) 또는 DB 가 돌려준 저장 해시(S2 가 거부하는 판본)로 만든다. */
function reviewWith(art: Json, binding: Json, over: Json = {}): Json {
  return {
    schema: 'lcp-story/review@1',
    review_id: `review-${String(art.edition_key)}-${(over.review_id as string | undefined) ?? 'a'}`,
    binding,
    reviewer: REVIEWER_CLAIM,
    provenance: 'ai_review',
    checks: S.requiredChecks(art as S.EditionArtifact).map((check) => ({ check, verdict: 'pass', note: '격리 시험 입력' })),
    issues: [],
    verdict: 'approve',
    reviewed_at: '2026-10-25T01:30:00+09:00',
    ...over,
  }
}

function reviewIn(ctx: Ctx, key: string, result: S.EditionResult, over: Json = {}): Json {
  return reviewWith(result.edition as unknown as Json, S.reviewBindingFor({ ...ctx, edition_key: key, task_id: `${WORK}:${key}` }, result), over)
}

/** S2 가 거부하는 판본에 대한 검수 — 결속의 판본 · 활동 해시는 DB 가 저장하며 돌려준 값이다. */
function reviewOfStored(ctx: Ctx, key: string, art: Json, stored: Json, over: Json = {}): Json {
  return reviewWith(art, {
    task_id: art.task_id,
    edition_key: key,
    source_sha256: ctx.source.sha256,
    source_identity_sha256: ctx.source.identity_sha256,
    policy_sha256: ctx.policy.policy_sha256,
    target_sha256: ctx.policy.items.get(key)!.target_sha256,
    edition_sha256: stored.edition_sha256,
    activities_sha256: stored.activities_sha256,
  }, over)
}

const produce = (key: string, art: Json, sessionId = 'producer-session'): Json => produceIn(MAIN, key, art, sessionId)
const editionResult = (key: string, art: Json): S.EditionResult => resultIn(MAIN, key, art)
const review = (key: string, result: S.EditionResult, over: Json = {}): Json => reviewIn(MAIN, key, result, over)

/** 같은 원천 · 다른 편집 기준 id — 새 판본 자리 묶음(lane)을 만들어 시험끼리 자리를 나눠 쓰지 않는다. */
function policyVariant(policyId: string): Json {
  const p = structuredClone(policyJson)
  p.policy_id = policyId
  return p
}

/**
 * 같은 기준 core(정책 결속 해시 같음)에 제작 항목 하나만 더한 기준 — 독립 검토 D1 재현. 등록하면 같은 원천에 같은 판본 키의 새 자리가 생긴다.
 */
function policyWithExtraItem(): Json {
  const p = structuredClone(policyJson)
  const extra = structuredClone((p.production as Json[]).find((x) => x.edition_key === 'easy-a2')!)
  extra.edition_key = 'easy-a2-alt'
  ;(p.production as Json[]).push(extra)
  return p
}

function snapshotVariant(snapshotId: string, mut?: (s: Json) => void): Json {
  const s = structuredClone(realSnapshot)
  s.snapshot_id = snapshotId
  mut?.(s)
  return s
}

function ctxFor(snapshot: Json, pol: Json): Ctx {
  const src = must(S.validateSnapshot(snapshot, NOW), `S2 snapshot ${String(snapshot.snapshot_id)}`)
  return { source: src, policy: must(S.validatePolicy(pol, src), `S2 policy ${String(pol.policy_id)}`) }
}

/** 판본 내용을 조금 바꿔(제목 꼬리표) 서로 다른 판 해시를 만든다 — S2 검증은 그대로 통과한다. */
function editionIn(ctx: Ctx, key: string, tag: string | null, tweak?: (a: Json) => void, sessionId?: string): Json {
  const art = fixture(key === 'story-b1' ? 'story-b1.edition.out' : 'easy-a2.edition.out')
  if (tag) art.title = `${String(art.title)} (${tag})`
  tweak?.(art)
  return produceIn(ctx, key, art, sessionId)
}

const storyV1 = produce('story-b1', fixture('story-b1.edition.out'))
const storyV1Result = editionResult('story-b1', storyV1)
const storyV2 = produce('story-b1', fixture('story-b1.edition.out'))
storyV2.units[3].text = storyV2.units[3].text.replace('could not get up', 'could not stand up')
const storyV2Result = editionResult('story-b1', storyV2)
const easyV1 = produce('easy-a2', fixture('easy-a2.edition.out'))
const easyV1Result = editionResult('easy-a2', easyV1)
const easyV2 = produce('easy-a2', fixture('easy-a2.edition.out'), 'admin-producer-session')
easyV2.units[0].text = easyV2.units[0].text.replace('Mara was twelve.', 'Mara was twelve years old.')
const easyV2Result = editionResult('easy-a2', easyV2)
const easyV3 = produce('easy-a2', fixture('easy-a2.edition.out'))
easyV3.units[2].text = easyV3.units[2].text.replace('a big storm', 'a very big storm')
easyV3.assets = [
  { asset_id: 'a-voice', kind: 'audio', origin: 'newly_produced', unit_ids: ['e1'], rights_status: 'confirmed', rights_evidence_ref: 'x', alignment: 'verified' },
]
const easyV3Result = editionResult('easy-a2', easyV3)
const storyV3 = produce('story-b1', fixture('story-b1.edition.out'))
storyV3.units[5].text = storyV3.units[5].text.replace("She didn't stop to be afraid.", 'She did not stop to be afraid.')
const storyV3Result = editionResult('story-b1', storyV3)
const UNITS = storyV2.units.length as number

/** S2 어댑터 — DB 가 돌려준 검증 입력 그대로를 받는다. */
const adapt = (validationInput: unknown): S.AttestationResult => S.buildValidationAttestation({ validationInput, now: NOW })

// ── 실행 ────────────────────────────────────────────────────────────────────

const U = {
  admin: '00000000-0000-4000-8000-00000000000a',
  producer: '00000000-0000-4000-8000-00000000000b',
  reviewer: '00000000-0000-4000-8000-00000000000c',
  learner: '00000000-0000-4000-8000-00000000000d',
  suspended: '00000000-0000-4000-8000-00000000000e',
  learner2: '00000000-0000-4000-8000-00000000000f',
  learner3: '00000000-0000-4000-8000-000000000010',
  learner4: '00000000-0000-4000-8000-000000000011',
  learner5: '00000000-0000-4000-8000-000000000012',
  learner6: '00000000-0000-4000-8000-000000000013',
}
/**
 * DB 역할 + JWT 주장. 기본은 PostgREST 모양 — request.jwt.claims = {"sub"?, "role": DB 역할} 하나만 싣고 옛 request.jwt.claim.role 은 비운다
 * (auth.uid() 바탕 함수용 request.jwt.claim.sub 는 함께 싣는다).
 *   claims: undefined = PostgREST 모양 · null = 주장 없음 · 문자열 = request.jwt.claims 원문 그대로(깨진 JSON · 배열 등)
 *   legacyRole: request.jwt.claim.role(옛 GUC) 값. 생략하면 비움.
 *   role 'postgres' = 소유자(슈퍼유저) 세션 그대로 — SET ROLE 하지 않는다(SQL 편집기 · MCP execute_sql 과 같은 모양).
 */
type Actor = {
  role: 'anon' | 'authenticated' | 'service_role' | 'postgres'
  sub: string | null
  claims?: string | null
  legacyRole?: string
}
const A = {
  admin: { role: 'authenticated', sub: U.admin } as Actor,
  producer: { role: 'authenticated', sub: U.producer } as Actor,
  reviewer: { role: 'authenticated', sub: U.reviewer } as Actor,
  learner: { role: 'authenticated', sub: U.learner } as Actor,
  learner2: { role: 'authenticated', sub: U.learner2 } as Actor,
  learner3: { role: 'authenticated', sub: U.learner3 } as Actor,
  learner4: { role: 'authenticated', sub: U.learner4 } as Actor,
  learner5: { role: 'authenticated', sub: U.learner5 } as Actor,
  learner6: { role: 'authenticated', sub: U.learner6 } as Actor,
  suspended: { role: 'authenticated', sub: U.suspended } as Actor,
  noSub: { role: 'authenticated', sub: null } as Actor,
  anon: { role: 'anon', sub: null } as Actor,
  /** 정상 백엔드 = PostgREST service_role 요청 모양. */
  service: { role: 'service_role', sub: null } as Actor,
  serviceLegacyOnly: { role: 'service_role', sub: null, claims: null, legacyRole: 'service_role' } as Actor,
  serviceNoClaim: { role: 'service_role', sub: null, claims: null } as Actor,
  serviceUserClaim: { role: 'service_role', sub: null, claims: JSON.stringify({ role: 'authenticated' }) } as Actor,
  serviceClaimsNoRole: { role: 'service_role', sub: null, claims: JSON.stringify({ iss: 'test' }) } as Actor,
  serviceMalformedClaims: { role: 'service_role', sub: null, claims: '{not json' } as Actor,
  serviceArrayClaims: { role: 'service_role', sub: null, claims: '["service_role"]' } as Actor,
  serviceConflictLegacy: { role: 'service_role', sub: null, legacyRole: 'authenticated' } as Actor,
  serviceConflictClaims: { role: 'service_role', sub: null, claims: JSON.stringify({ role: 'authenticated' }), legacyRole: 'service_role' } as Actor,
  /** 소유자 세션 · JWT 주장 없음 — 독립 검토 F9 의 우회 경로(MCP execute_sql · SQL 편집기). */
  ownerNoClaims: { role: 'postgres', sub: null, claims: null } as Actor,
}

/** Supabase(PostgREST)처럼 JWT 주장을 GUC 로 싣는다. local=true 면 트랜잭션 안에서만. */
const CLAIM_SQL = (local: boolean) =>
  `select set_config('request.jwt.claim.sub', $1, ${local}), set_config('request.jwt.claim.role', $2, ${local}),
          set_config('request.jwt.claims', $3, ${local})`
function claimParams(who: Actor): string[] {
  const claims = who.claims === undefined
    ? JSON.stringify(who.sub ? { sub: who.sub, role: who.role } : { role: who.role })
    : (who.claims ?? '')
  return [who.sub ?? '', who.legacyRole ?? '', claims]
}

const ROLES = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
`

const BOOTSTRAP = `
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
create function auth.uid() returns uuid language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table public.user_profiles (
  user_id uuid primary key, role text not null default 'user', status text not null default 'active', display_name text);
create table public.library_books (
  id uuid primary key default gen_random_uuid(), source text not null, source_id text, status text not null default 'queued',
  title text not null, copyright_safe_in_kr boolean not null default false, published_at timestamptz,
  unique (source, source_id));
alter table public.library_books enable row level security;
create policy anyone_read_published_safe on public.library_books for select using (status = 'published' and copyright_safe_in_kr = true);
create table public.texts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null, title text not null, status text default 'in_progress',
  progress_percent numeric default 0, library_book_id uuid references public.library_books (id), chapter_idx integer);
create table public.content_chunks (hash text primary key, content text not null, byte_size integer not null, ref_count integer not null default 0);
create table public.reading_sessions (id uuid primary key default gen_random_uuid(), text_id uuid references public.texts (id));
create schema supabase_migrations;
create table supabase_migrations.schema_migrations (version text primary key, statements text[], name text,
  created_by text, idempotency_key text, rollback text[]);
insert into supabase_migrations.schema_migrations (version, name) values ('20261023082930', 'existing_history_row');
insert into public.user_profiles (user_id, role, status) values
  ('${U.admin}', 'admin', 'active'), ('${U.producer}', 'curator', 'active'), ('${U.reviewer}', 'curator', 'active'),
  ('${U.learner}', 'user', 'active'), ('${U.suspended}', 'curator', 'suspended'),
  ('${U.learner2}', 'user', 'active'), ('${U.learner3}', 'user', 'active'), ('${U.learner4}', 'user', 'active'),
  ('${U.learner5}', 'user', 'active'), ('${U.learner6}', 'user', 'active');
insert into public.library_books (id, source, source_id, status, title, copyright_safe_in_kr, published_at) values
  ('10000000-0000-4000-8000-000000000001', 'standard_ebooks', 'test-se-1', 'published', 'Legacy Published', true, now()),
  ('10000000-0000-4000-8000-000000000002', 'gutenberg', 'test-pg-2', 'ready', 'Legacy Ready', true, null),
  ('10000000-0000-4000-8000-000000000003', 'manual', 'test-m-3', 'archived', 'Legacy Archived', false, null);
insert into public.texts (id, user_id, title, status, progress_percent, library_book_id, chapter_idx) values
  ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-00000000000d', 'Legacy Ch 1', 'completed', 100,
   '10000000-0000-4000-8000-000000000001', 1);
insert into public.content_chunks (hash, content, byte_size, ref_count) values ('legacy-chunk-1', 'Legacy chapter body.', 20, 1);
insert into public.reading_sessions (text_id) values ('20000000-0000-4000-8000-000000000001');
`

interface Outcome {
  ok: boolean
  msg: string
  rows: Json[]
}

async function main(): Promise<void> {
  const engineName = argValue('--engine') ?? 'pglite'
  if (engineName !== 'pglite' && engineName !== 'pg17') throw new Error('--engine pglite|pg17')
  // --schema-sql <path>: 변이 · 수정 전 기준 시험(일부러 결함을 넣은 사본 · 옛 SQL 로 이 시험이 실제로 실패하는지 확인).
  // pg17 에서도 같은 러너 applyStage 로 적용하지만 T01 은 「러너 본문 ≠ 저장소 파일」로 반드시 실패한다(승인 경로 시험이 아니다).
  const schemaPath = argValue('--schema-sql') ? resolve(argValue('--schema-sql')!) : SCHEMA_SQL
  const schemaSql = readFileSync(schemaPath, 'utf8')
  const quarantineSql = readFileSync(QUARANTINE_SQL, 'utf8')
  const deps = argValue('--deps')
  if (engineName === 'pg17' && !deps) throw new Error('--engine pg17 needs --deps <embedded-postgres + pg folder>')
  const engine = engineName === 'pg17' ? await startPg17(deps!) : await startPglite()
  // 엔진(특히 임시 PG17 클러스터 · 포트 · 임시 폴더)은 중간에 무엇이 던져져도 반드시 멈춘다.
  try {
    const runner = (await import(pathToFileURL(join(HERE, 'deploy.mjs')).href)) as RunnerModule
    const db = engine.db
    await db.exec(ROLES)
    await db.exec(BOOTSTRAP)

    async function as<T = Json>(who: Actor, sql: string, params: unknown[] = []): Promise<T[]> {
      await db.query(CLAIM_SQL(false), claimParams(who))
      await db.exec(who.role === 'postgres' ? 'reset role' : `set role ${who.role}`)
      try {
        return (await db.query<T>(sql, params)).rows
      } finally {
        await db.exec('reset role')
      }
    }
    const one = async <T = Json>(who: Actor, sql: string, params: unknown[] = []): Promise<T> => {
      const rows = await as<T>(who, sql, params)
      if (rows.length === 0) throw new Error(`no row: ${sql}`)
      return rows[0]!
    }
    /** 지정 격리 수준의 트랜잭션 하나에서 실행하고 항상 되돌린다. 오류 메시지 또는 'ok'. */
    async function txAs(isolation: string, who: Actor, sql: string, params: unknown[] = []): Promise<string> {
      await db.exec(`begin isolation level ${isolation}`)
      try {
        await db.query(CLAIM_SQL(true), claimParams(who))
        if (who.role !== 'postgres') await db.exec(`set local role ${who.role}`)
        await db.query(sql, params)
        return 'ok'
      } catch (e) {
        return errMsg(e)
      } finally {
        await db.exec('rollback')
      }
    }
    const legacyHash = async (): Promise<string> =>
      (
        await db.query<{ h: string }>(
          `select md5(coalesce((select string_agg(row_to_json(b)::text, '|' order by b.id) from public.library_books b), '')
                || '#' || coalesce((select string_agg(row_to_json(p)::text, '|' order by p.user_id) from public.user_profiles p), '')
                || '#' || coalesce((select string_agg(row_to_json(t)::text, '|' order by t.id) from public.texts t), '')
                || '#' || coalesce((select string_agg(row_to_json(c)::text, '|' order by c.hash) from public.content_chunks c), '')
                || '#' || coalesce((select string_agg(row_to_json(r)::text, '|' order by r.id) from public.reading_sessions r), '')
                || '#' || (select count(*) from pg_attribute where attrelid = 'public.library_books'::regclass and attnum > 0)
                || '#' || (select count(*) from pg_policies where schemaname = 'public')) as h`,
        )
      ).rows[0]!.h

    const legacyBefore = await legacyHash()
    const approvedBy = 'isolated-pg17-test'

    await check('T01', engine.name === 'pg17'
      ? '승인형 러너 applyStage 로 초안 SQL 을 한 트랜잭션에 적용 · 원본 지문 불변 · 이력 SHA = 승인값(STAGES 고정) · 러너 사후 검증 통과'
      : '초안 SQL 이 Supabase 유사 바탕에 그대로 적용된다', async () => {
      if (engine.name === 'pglite') {
        await db.exec(schemaSql)
        return
      }
      // 러너 STAGES 가 아직 새 SQL 에 고정되지 않았어도 같은 applyStage 로 파일 바이트를 적용해 아래 시험을 계속한다 — T01 은 실패로 남긴다.
      const problems: string[] = []
      const fileSha = sha256File(SCHEMA_SQL)
      const off = runner.offlineCheck('schema')
      if (off.blocks.length || !off.text) problems.push(`STAGES 미고정/offlineCheck 차단: ${off.blocks.join('; ')} (runner ${runner.STAGES.schema!.sha256} ≠ file ${fileSha})`)
      else if (off.text !== schemaSql) problems.push('runner body ≠ pending file')
      const r = await runner.applyStage(db, 'schema', { text: schemaSql, approvedBy })
      if (!r.ok) {
        const exists = (await db.query<{ s: string | null }>(`select to_regnamespace('story')::text as s`)).rows[0]!.s
        if (!exists) {
          // 러너가 적용을 거부했다 — SQL 의미 시험을 계속하려고 같은 바이트를 한 트랜잭션으로 직접 적용한다(이력 행 없음 → T24 는 실패할 수 있다).
          await db.exec('begin')
          try { await db.exec(schemaSql); await db.exec('commit') } catch (e) { await db.exec('rollback'); throw new Error(`direct apply after runner refusal: ${errMsg(e)}`) }
        }
        throw new Error([...problems, `applyStage ${r.outcome}: ${r.error?.message ?? ''} (SQL 은 직접 적용해 시험을 계속)`].join(' | '))
      }
      if (r.legacy?.unchanged !== true) problems.push('legacy fingerprint changed')
      const history = await runner.readHistory(db)
      const hist = history.find((h) => h.version === runner.STAGES.schema!.version)?.sha256
      if (hist !== runner.STAGES.schema!.sha256) problems.push(`history sha ${String(hist)} ≠ STAGES ${runner.STAGES.schema!.sha256}`)
      const v = await runner.runVerify(db, 'schema')
      if (!v.ok) problems.push(`runner verify: ${JSON.stringify(v.rows.filter((x) => !x.ok))}`)
      if (problems.length) throw new Error(problems.join(' | '))
    })

    await check('T02', '원본 도서 · 프로필 · texts · content_chunks · reading_sessions 행 · 열 · 정책이 적용 전후 같다(영향 0)', async () => {
      eq(await legacyHash(), legacyBefore, 'legacy hash')
    })

    const tables = ['sources', 'policies', 'edition_slots', 'edition_versions', 'reviews', 'validation_attestations', 'rights_decisions',
      'releases', 'release_units', 'reading_progress', 'reading_unit_completions', 'action_log']
    await check('T03', 'story 표 12: RLS 켜짐 · anon/authenticated/service_role 에 스키마 USAGE · 표 권한 없음', async () => {
      for (const role of ['anon', 'authenticated', 'service_role']) {
        const usage = await db.query<{ u: boolean }>(`select has_schema_privilege($1, 'story', 'USAGE') as u`, [role])
        eq(usage.rows[0]!.u, false, `${role} schema usage`)
        for (const t of tables) {
          const r = await db.query<{ p: boolean }>(
            `select has_table_privilege($1, $2, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') as p`, [role, `story.${t}`])
          eq(r.rows[0]!.p, false, `${role} story.${t}`)
        }
      }
      const rls = await db.query<{ n: number; total: number }>(
        `select (count(*) filter (where c.relrowsecurity))::int as n, count(*)::int as total from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'story' and c.relkind = 'r'`)
      eq(rls.rows[0]!.total, tables.length, 'story tables')
      eq(rls.rows[0]!.n, tables.length, 'rls tables')
    })

    const RPC: Record<string, Record<string, boolean>> = {
      'public.story_admin_register_source(jsonb)': { anon: false, authenticated: true, service_role: false },
      'public.story_admin_register_policy(uuid,jsonb)': { anon: false, authenticated: true, service_role: false },
      'public.story_admin_submit_edition(uuid,jsonb)': { anon: false, authenticated: true, service_role: false },
      'public.story_admin_submit_review(uuid,jsonb)': { anon: false, authenticated: true, service_role: false },
      'public.story_admin_record_rights(uuid,text,text,text,text)': { anon: false, authenticated: true, service_role: false },
      'public.story_admin_publish(uuid)': { anon: false, authenticated: true, service_role: false },
      'public.story_admin_withdraw(text,text)': { anon: false, authenticated: true, service_role: false },
      'public.story_admin_list_slots()': { anon: false, authenticated: true, service_role: false },
      'public.story_admin_get_bundle(uuid)': { anon: false, authenticated: true, service_role: false },
      'public.story_service_validation_input(uuid)': { anon: false, authenticated: false, service_role: true },
      'public.story_service_attest_validation(uuid,jsonb)': { anon: false, authenticated: false, service_role: true },
      'public.story_catalog()': { anon: true, authenticated: true, service_role: false },
      'public.story_read_unit(text,integer)': { anon: false, authenticated: true, service_role: false },
      'public.story_record_position(text,integer)': { anon: false, authenticated: true, service_role: false },
      'public.story_complete_unit(text,integer)': { anon: false, authenticated: true, service_role: false },
      'public.story_my_progress()': { anon: false, authenticated: true, service_role: false },
    }
    await check('T04', 'RPC 16 실행 권한 행렬(관리=authenticated · 검증 증인=service_role 만 · 서가=anon+authenticated · story_record_progress 없음 · story.* 내부 함수 없음)', async () => {
      for (const [fn, roles] of Object.entries(RPC)) {
        for (const [role, want] of Object.entries(roles)) {
          const r = await db.query<{ p: boolean }>(`select has_function_privilege($1, $2, 'EXECUTE') as p`, [role, fn])
          eq(r.rows[0]!.p, want, `${role} ${fn}`)
        }
        const pub = await db.query<{ p: boolean }>(`select has_function_privilege('public', $1, 'EXECUTE') as p`, [fn])
        eq(pub.rows[0]!.p, false, `PUBLIC ${fn}`)
      }
      const gone = await db.query<{ p: string | null }>(`select to_regprocedure('public.story_record_progress(text,integer)')::text as p`)
      eq(gone.rows[0]!.p, null, 'story_record_progress removed (navigation must not complete)')
      const internal = await db.query<{ n: number }>(
        `select count(*)::int as n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'story' and (has_function_privilege('anon', p.oid, 'EXECUTE')
            or has_function_privilege('authenticated', p.oid, 'EXECUTE') or has_function_privilege('service_role', p.oid, 'EXECUTE'))`)
      eq(internal.rows[0]!.n, 0, 'story internal functions executable')
      const all = await db.query<{ n: number }>(
        `select count(*)::int as n from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'story\\_%'`)
      eq(all.rows[0]!.n, Object.keys(RPC).length, 'public story_* function count')
      const definers = await db.query<{ n: number }>(
        `select count(*)::int as n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname like 'story\\_%' and p.prosecdef
            and coalesce(array_to_string(p.proconfig, ','), '') = 'search_path=pg_catalog, pg_temp'`)
      eq(definers.rows[0]!.n, Object.keys(RPC).length, 'definer + search_path pg_catalog, pg_temp(마지막)')
    })

    await check('T05', 'DB 정본 직렬화 = S2 canonicalJson(정책 · 판본 · 정체 · 까다로운 문자열)', async () => {
      const tricky = { a: 'q" b\\ c\u0001\u001f t\t n\n emoji\u{1F600} ls  é del\u007f', b: [1, -2, 0, true, false, null, { z: 1, A: 2, _: 3 }], K: '' }
      const samples: unknown[] = [policyJson, storyV1, S.policyCore(policy.policy), tricky,
        { identity: sourceIdentity(source.snapshot, source.sha256) }]
      for (const [i, v] of samples.entries()) {
        const r = await db.query<{ c: string }>(`select story.canonical_json($1::jsonb) as c`, [JSON.stringify(v)])
        eq(r.rows[0]!.c, S.canonicalJson(v), `sample ${i}`)
      }
      await rejects(db.query(`select story.canonical_json('{"x":1.5}'::jsonb)`), /story:canonical_unsupported_number/, 'float')
      // jsonb 는 1.0 의 소수 자릿수를 남기지만 JS 는 1 로 쓴다 — 표기가 갈리므로 거부해야 한다.
      await rejects(db.query(`select story.canonical_json('{"x":1.0}'::jsonb)`), /story:canonical_unsupported_number/, 'scale')
      // 1e3 은 jsonb · JS 모두 1000 으로 정규화된다 — 같은 정본이어야 한다.
      const exp = await db.query<{ c: string }>(`select story.canonical_json('{"x":1e3}'::jsonb) as c`)
      eq(exp.rows[0]!.c, S.canonicalJson(JSON.parse('{"x":1e3}')), 'exponent parity')
    })

    let sourceId = ''
    await check('T06', '원천 등록: DB 본문 해시 · 정체 해시 = S2, 키 순서만 다른 재등록은 같은 행', async () => {
      const r = await one<Json>(A.producer, `select * from public.story_admin_register_source($1::jsonb)`, [JSON.stringify(realSnapshot)])
      eq(r.text_sha256, source.sha256, 'text sha')
      eq(r.identity_sha256, source.identity_sha256, 'identity sha')
      eq(r.created, true, 'created')
      sourceId = r.source_id as string
      const reversed = Object.fromEntries(Object.entries(realSnapshot).reverse())
      const again = await one<Json>(A.reviewer, `select * from public.story_admin_register_source($1::jsonb)`, [JSON.stringify(reversed)])
      eq(again.source_id, sourceId, 'same row')
      eq(again.created, false, 'created again')
    })

    await check('T07', '원천 등록 거부: 해시 조작 · 합성 · 대응 도서 없음/불일치 · 학습자 · 사용자 없음 · 정지 · service_role', async () => {
      const bad = (mut: (s: Json) => void): string => {
        const s = structuredClone(realSnapshot)
        mut(s)
        return JSON.stringify(s)
      }
      const call = (who: Actor, body: string) => as(who, `select * from public.story_admin_register_source($1::jsonb)`, [body])
      await rejects(call(A.producer, bad((s) => { s.text_sha256 = 'a'.repeat(64) })), /story:text_hash_mismatch/, 'hash')
      await rejects(call(A.producer, bad((s) => { s.text = `${s.text} extra` })), /story:text_hash_mismatch/, 'text edit')
      await rejects(call(A.producer, bad((s) => { s.synthetic = true })), /story:synthetic_not_allowed/, 'synthetic')
      const lb = (id: string, sourceIdClaim: string) => bad((s) => {
        s.snapshot_id = 'gull-rock-lb'
        s.edition.source_kind = 'library_book'
        s.edition.library_book_id = id
        s.edition.source = 'standard_ebooks'
        s.edition.source_id = sourceIdClaim
      })
      await rejects(call(A.producer, lb('10000000-0000-4000-8000-0000000000ff', 'test-se-1')), /story:library_book_not_found/, 'lb missing')
      await rejects(call(A.producer, lb('10000000-0000-4000-8000-000000000001', 'other-id')), /story:library_book_mismatch/, 'lb mismatch')
      const ok = await one<Json>(A.producer, `select * from public.story_admin_register_source($1::jsonb)`,
        [lb('10000000-0000-4000-8000-000000000001', 'test-se-1')])
      eq(ok.created, true, 'lb match registered')
      const corr = await db.query<{ c: string; s: string }>(
        `select correspondence as c, correspondence_library_status as s from story.sources where id = $1`, [ok.source_id])
      eq(corr.rows[0]!.c, 'library_book_id_source_match', 'correspondence')
      eq(corr.rows[0]!.s, 'published', 'library status recorded')
      await rejects(call(A.learner, JSON.stringify(realSnapshot)), /story:staff_required/, 'learner')
      await rejects(call(A.noSub, JSON.stringify(realSnapshot)), /story:auth_required/, 'no sub')
      await rejects(call(A.suspended, JSON.stringify(realSnapshot)), /story:staff_required/, 'suspended')
      await rejects(call(A.service, JSON.stringify(realSnapshot)), /permission denied/, 'service_role')
      await rejects(call(A.anon, JSON.stringify(realSnapshot)), /permission denied/, 'anon')
    })

    const slots: Record<string, string> = {}
    await check('T08', '편집 기준 등록: 기준 · 목표 해시 = S2, 낡은 원문 · 재서사 거부, 재등록 멱등', async () => {
      const rows = await as<Json>(A.producer, `select * from public.story_admin_register_policy($1, $2::jsonb)`, [sourceId, JSON.stringify(policyJson)])
      eq(rows.length, 2, 'slots')
      for (const r of rows) {
        eq(r.policy_sha256, policy.policy_sha256, 'policy sha')
        eq(r.target_sha256, policy.items.get(r.edition_key as string)!.target_sha256, `target ${String(r.edition_key)}`)
        slots[r.edition_key as string] = r.slot_id as string
      }
      const again = await as<Json>(A.reviewer, `select * from public.story_admin_register_policy($1, $2::jsonb)`, [sourceId, JSON.stringify(policyJson)])
      eq(again.every((r) => r.created === false), true, 'idempotent')
      const stale = structuredClone(policyJson)
      stale.source_sha256 = 'b'.repeat(64)
      await rejects(as(A.producer, `select * from public.story_admin_register_policy($1, $2::jsonb)`, [sourceId, JSON.stringify(stale)]),
        /story:policy_source_stale/, 'stale')
      const ren = structuredClone(policyJson)
      ren.production[0].transformation = 'renarration'
      ren.production[0].edition_key = 'story-renarrated'
      await rejects(as(A.producer, `select * from public.story_admin_register_policy($1, $2::jsonb)`, [sourceId, JSON.stringify(ren)]),
        /story:renarration_excluded/, 'renarration')
    })

    const submit = (who: Actor, slot: string, art: Json) =>
      one<Json>(who, `select * from public.story_admin_submit_edition($1, $2::jsonb)`, [slot, JSON.stringify(art)])
    const submitReview = (who: Actor, version: string, rv: Json) =>
      one<Json>(who, `select * from public.story_admin_submit_review($1, $2::jsonb)`, [version, JSON.stringify(rv)])
    const publish = (who: Actor, version: string) => one<Json>(who, `select * from public.story_admin_publish($1)`, [version])
    const rightsOn = (who: Actor, src: string, asset: string, status: string, evidence: string | null) =>
      as(who, `select public.story_admin_record_rights($1, $2, $3, $4, $5) as id`, [src, asset, status, '격리 시험 결정', evidence])
    const rights = (who: Actor, asset: string, status: string, evidence: string | null) => rightsOn(who, sourceId, asset, status, evidence)
    const validationInput = async (version: string, who: Actor = A.service): Promise<Json> =>
      (await one<{ v: Json }>(who, `select public.story_service_validation_input($1) as v`, [version])).v
    const attestRpc = (who: Actor, version: string, att: unknown) =>
      one<Json>(who, `select * from public.story_service_attest_validation($1, $2::jsonb)`, [version, JSON.stringify(att)])
    /** 정상 경로: service_role 이 저장값을 읽고 → S2 어댑터 → service_role 이 증명 기록. DB binding_sha256 = S2 sha256Canonical(binding). */
    const attestVersion = async (version: string): Promise<{ attestation: Json; bindingSha256: string; id: string; created: boolean }> => {
      const r = adapt(await validationInput(version))
      if (!r.ok) throw new Error(`S2 adapter refused ${version}: ${r.stage} ${JSON.stringify(r.errors)}`)
      const row = await attestRpc(A.service, version, r.attestation)
      eq(row.binding_sha256, r.bindingSha256, 'DB binding_sha256 = S2 sha256Canonical(binding)')
      return { attestation: r.attestation as unknown as Json, bindingSha256: r.bindingSha256, id: row.attestation_id as string, created: row.created as boolean }
    }
    const pos = (who: Actor, key: string, i: number | null) =>
      one<Json>(who, `select * from public.story_record_position($1, $2)`, [key, i])
    const done = (who: Actor, key: string, i: number | null) =>
      one<Json>(who, `select * from public.story_complete_unit($1, $2)`, [key, i])
    const progressOf = async (who: Actor, key: string): Promise<Json | undefined> =>
      (await as<Json>(who, `select * from public.story_my_progress()`)).find((r) => r.release_key === key)
    const catalogHas = async (who: Actor, key: string): Promise<boolean> =>
      (await as<Json>(who, `select * from public.story_catalog()`)).some((r) => r.release_key === key)
    const bundle = async (version: string): Promise<Json> =>
      (await one<{ b: Json }>(A.admin, `select public.story_admin_get_bundle($1) as b`, [version])).b
    const releaseRow = async (key: string): Promise<Json> =>
      (await db.query<Json>(`select * from story.releases where release_key = $1`, [key])).rows[0]!

    /** 새 판본 자리 묶음 — 같은(또는 지정한) 원천에 편집 기준 id 만 다른 기준을 등록한다. */
    interface Lane { ctx: Ctx; sourceId: string; slots: Record<string, string> }
    const registerSource = async (snapshot: Json): Promise<string> =>
      (await one<Json>(A.producer, `select * from public.story_admin_register_source($1::jsonb)`, [JSON.stringify(snapshot)])).source_id as string
    const registerLane = async (src: string, snapshot: Json, pol: Json): Promise<Lane> => {
      const ctx = ctxFor(snapshot, pol)
      const rows = await as<Json>(A.producer, `select * from public.story_admin_register_policy($1, $2::jsonb)`, [src, JSON.stringify(pol)])
      const laneSlots: Record<string, string> = {}
      for (const r of rows) {
        eq(r.policy_sha256, ctx.policy.policy_sha256, `lane ${String(pol.policy_id)} policy sha`)
        laneSlots[r.edition_key as string] = r.slot_id as string
      }
      return { ctx, sourceId: src, slots: laneSlots }
    }
    /** 정상 판을 제출하고 독립 검수까지(증명 · 발행은 하지 않는다). */
    const readyVersion = async (lane: Lane, key: string, tag: string | null): Promise<{ id: string; art: Json; result: S.EditionResult }> => {
      const art = editionIn(lane.ctx, key, tag)
      const result = resultIn(lane.ctx, key, art)
      const id = (await submit(A.producer, lane.slots[key]!, art)).edition_version_id as string
      const rv = await submitReview(A.reviewer, id, reviewIn(lane.ctx, key, result))
      eq(rv.qualifies, true, `${key} ${String(tag)} review qualifies`)
      return { id, art, result }
    }
    /** 제출 → 검수 → 증명 → 발행. */
    const publishFlow = async (lane: Lane, key: string, tag: string | null): Promise<{ versionId: string; releaseKey: string; attestationId: string }> => {
      const v = await readyVersion(lane, key, tag)
      const a = await attestVersion(v.id)
      const rel = await publish(A.admin, v.id)
      return { versionId: v.id, releaseKey: rel.release_key as string, attestationId: a.id }
    }
    /**
     * 시험마다 따로 쓰는 원천 스냅숏(같은 작품 · 같은 본문, snapshot_id 만 다름) + source_text 권리 confirmed.
     * 살아 있는 발행본은 (원천, 판본 키)마다 하나라서(INTERFACE H2) 발행하는 시험끼리 원천을 나눠 쓰지 않는다.
     */
    const freshSource = async (tag: string): Promise<{ src: string; snap: Json }> => {
      const snap = snapshotVariant(`gull-rock-${tag}`)
      const src = await registerSource(snap)
      await rightsOn(A.admin, src, 'source_text', 'confirmed', 'test-only-human-evidence')
      return { src, snap }
    }
    const freshLane = async (tag: string, pol: Json = policyJson): Promise<Lane & { snap: Json }> => {
      const { src, snap } = await freshSource(tag)
      return { ...(await registerLane(src, snap, pol)), snap }
    }
    const ownerBinding = async (version: string): Promise<Json> =>
      (await one<{ b: Json }>(A.ownerNoClaims, `select story.attestation_binding($1) as b`, [version])).b
    const ALL_VALID = { snapshot: 'valid', policy: 'valid', edition: 'valid', reviews: 'valid' }

    let storyV1Id = ''
    await check('T09', '판본 제출: 낡은 결속(결속 칸 넷 각각 · 합성 원천에 묶인 결과물) · 합성 생산 출처 거부(사유별 정확한 오류), DB 판본 · 활동 해시 = S2, 재제출 멱등', async () => {
      // 결속만 낡음(출처는 정상) — 결속 검사가 빠지면 반드시 실패해야 하므로 오류 코드 하나만 받는다.
      for (const field of ['source_sha256', 'source_identity_sha256', 'policy_sha256', 'target_sha256']) {
        const art = structuredClone(storyV1)
        art.binding[field] = 'd'.repeat(64)
        await rejects(submit(A.producer, slots['story-b1']!, art), /^story:edition_binding_stale$/, `stale binding.${field}`)
      }
      // 합성 원천 판(S2 합성 고정물 그대로)의 결속은 실제 원천과 다르다.
      const synthetic = fixture('story-b1.edition.out')
      synthetic.produced_by = { ...synthetic.produced_by, provenance: 'ai_generated' }
      await rejects(submit(A.producer, slots['story-b1']!, synthetic), /^story:edition_binding_stale$/, 'binding of the synthetic source')
      // 출처만 합성(결속은 정상) — 생산 출처 검사가 따로 거부한다.
      const synthProv = structuredClone(storyV1)
      synthProv.produced_by.provenance = 'synthetic_fixture'
      await rejects(submit(A.producer, slots['story-b1']!, synthProv), /^story:producer_provenance$/, 'synthetic producer provenance')
      // 합성 고정물 원본(결속 · 출처 모두 합성) — 어느 쪽이든 거부(검사 순서에 기대지 않는 원래 시나리오).
      await rejects(submit(A.producer, slots['story-b1']!, fixture('story-b1.edition.out')), /^story:(edition_binding_stale|producer_provenance)$/, 'raw synthetic fixture')
      const r = await submit(A.producer, slots['story-b1']!, storyV1)
      eq(r.edition_sha256, storyV1Result.edition_sha256, 'edition sha')
      eq(r.activities_sha256, storyV1Result.activities_sha256, 'activities sha')
      storyV1Id = r.edition_version_id as string
      const again = await submit(A.reviewer, slots['story-b1']!, storyV1)
      eq(again.edition_version_id, storyV1Id, 'same version')
      eq(again.created, false, 'idempotent')
    })

    await check('T10', '검수 거부: 생산 계정 자기 검수 · 다른 판본 결속 · 모순 · 미래 시각 · 합성 출처 · 생산 세션 주장', async () => {
      await rejects(submitReview(A.producer, storyV1Id, review('story-b1', storyV1Result)), /story:self_review/, 'self account')
      await rejects(submitReview(A.reviewer, storyV1Id, review('easy-a2', easyV1Result)), /story:review_binding_mismatch/, 'other edition')
      const inconsistent = review('story-b1', storyV1Result)
      inconsistent.checks[0].verdict = 'fail'
      await rejects(submitReview(A.reviewer, storyV1Id, inconsistent), /story:review_inconsistent/, 'inconsistent')
      await rejects(submitReview(A.reviewer, storyV1Id, review('story-b1', storyV1Result, { reviewed_at: '2999-01-01T00:00:00Z' })),
        /story:time_in_future/, 'future')
      await rejects(submitReview(A.reviewer, storyV1Id, review('story-b1', storyV1Result, { provenance: 'synthetic_fixture' })),
        /story:review_provenance/, 'synthetic')
      await rejects(submitReview(A.reviewer, storyV1Id, review('story-b1', storyV1Result, {
        reviewer: { kind: 'ai_model', agent: 'claude-code', session_id: 'producer-session', role: '생산 세션' } })),
        /story:self_review_claim/, 'producer session claim')
    })

    let storyV2Id = ''
    let storyReviewSha = ''
    let storyReviewParsed: S.ReviewArtifact | null = null
    await check('T11', '검수 적격 판정 · 해시 = S2, 최신 판이 아니면 발행 거부', async () => {
      const r1 = await submitReview(A.reviewer, storyV1Id, review('story-b1', storyV1Result))
      eq(r1.qualifies, true, 'v1 qualifies')
      storyV2Id = (await submit(A.producer, slots['story-b1']!, storyV2)).edition_version_id as string
      await rejects(publish(A.admin, storyV1Id), /story:not_latest_version/, 'not latest')
      const rv = review('story-b1', storyV2Result)
      const r2 = await submitReview(A.reviewer, storyV2Id, rv)
      eq(r2.qualifies, true, 'v2 qualifies')
      const parsed = S.validateReview(rv, {
        edition_key: 'story-b1',
        current_binding: S.reviewBindingFor({ source, policy, edition_key: 'story-b1', task_id: `${WORK}:story-b1` }, storyV2Result),
        now: NOW,
      })
      if (!parsed.value) throw new Error(JSON.stringify(parsed.errors))
      eq(r2.review_sha256, parsed.value.review_sha256, 'review sha')
      storyReviewSha = parsed.value.review_sha256
      storyReviewParsed = parsed.value.review
    })

    await check('T12', '발행 거부: curator · 권리 미결정 · 보류 결정 · 자산 · 보류 검수(손으로 만든 발행 시도 포함) · 발행자 = 생산자', async () => {
      await rejects(publish(A.reviewer, storyV2Id), /story:admin_required/, 'curator publish')
      await rejects(rights(A.reviewer, 'source_text', 'confirmed', 'x'), /story:admin_required/, 'curator rights')
      await rejects(publish(A.admin, storyV2Id), /story:rights_unconfirmed/, 'no rights')
      await rights(A.admin, 'source_text', 'hold', null)
      await rejects(publish(A.admin, storyV2Id), /story:rights_unconfirmed/, 'rights hold')
      await rejects(rights(A.admin, 'source_text', 'confirmed', null), /rights_decisions_confirmed_evidence/, 'confirmed without evidence')
      await rights(A.admin, 'source_text', 'confirmed', 'test-only-human-evidence')
      const easy1 = (await submit(A.producer, slots['easy-a2']!, easyV1)).edition_version_id as string
      const held = await submitReview(A.reviewer, easy1, review('easy-a2', easyV1Result, { verdict: 'hold' }))
      eq(held.qualifies, false, 'hold review stored, not qualifying')
      await rejects(publish(A.admin, easy1), /story:review_not_qualifying/, 'held draft')
      const easy2 = (await submit(A.admin, slots['easy-a2']!, easyV2)).edition_version_id as string
      await submitReview(A.reviewer, easy2, review('easy-a2', easyV2Result))
      await rejects(publish(A.admin, easy2), /story:publisher_is_producer/, 'publisher is producer')
      const easy3 = (await submit(A.producer, slots['easy-a2']!, easyV3)).edition_version_id as string
      await submitReview(A.reviewer, easy3, review('easy-a2', easyV3Result))
      await rejects(publish(A.admin, easy3), /story:assets_not_supported/, 'assets')
    })

    await check('T13', '직접 행 조작 거부: authenticated · service_role · anon 이 story 표(증명 · 단위 완료 포함)에 쓰기/읽기 불가', async () => {
      for (const who of [A.admin, A.learner, A.service, A.anon]) {
        await rejects(as(who, `insert into story.releases (release_key) values ('lsr_${'0'.repeat(32)}')`), /permission denied/, `${who.role} insert`)
        await rejects(as(who, `select body from story.release_units`), /permission denied/, `${who.role} select units`)
        await rejects(as(who, `select body from story.sources`), /permission denied/, `${who.role} select sources`)
        // 증명을 표에 직접 써서 검증 증인을 건너뛰는 위조 — service_role 도 표 권한이 없다(RPC 만 문이다).
        await rejects(as(who, `insert into story.validation_attestations (edition_version_id, binding, binding_sha256, attestation)
                                values ($1, '{}'::jsonb, $2, '{}'::jsonb)`, [storyV2Id, 'a'.repeat(64)]), /permission denied/, `${who.role} insert attestation`)
        await rejects(as(who, `select * from story.validation_attestations`), /permission denied/, `${who.role} select attestations`)
        await rejects(as(who, `insert into story.reading_unit_completions (user_id, release_id, unit_index) values ($1, $1, 0)`, [U.learner]),
          /permission denied/, `${who.role} insert completion`)
        await rejects(as(who, `update story.reading_progress set completed_at = now()`), /permission denied/, `${who.role} update progress`)
      }
    })

    let releaseKey = ''
    await check('T14', '발행 성공: 증명 없으면 validation_attestation_missing → service_role 증명(S2 어댑터) → 발행, release_key = S2 decideEdition, 단위 본문 복사, 같은 자리 두 번째 발행 거부', async () => {
      await rejects(publish(A.admin, storyV2Id), /story:validation_attestation_missing/, 'publish without attestation')
      const att = await attestVersion(storyV2Id)
      eq(att.created, true, 'attestation created')
      const r = await publish(A.admin, storyV2Id)
      releaseKey = r.release_key as string
      const confirmedSource: S.SourceContext = {
        ...source,
        snapshot: {
          ...source.snapshot,
          rights: [{ asset: 'source_text', status: 'confirmed', basis: 'db', evidence_ref: 'db', checked_by: 'db', checked_at: '2026-10-25T00:00:00Z' }],
        },
      }
      const decision = S.decideEdition({
        source: confirmedSource,
        policy,
        edition_key: 'story-b1',
        edition_state: 'valid',
        edition: storyV2Result,
        reviews: [{ file: 'db', review: storyReviewParsed!, review_sha256: storyReviewSha, current: true }],
      })
      eq(decision.status, 'candidate', 'S2 decision')
      eq(releaseKey, decision.release!.release_key, 'release key parity')
      const rel = await releaseRow(releaseKey)
      eq(rel.validation_attestation_id, att.id, 'release bound to the attestation')
      eq(rel.published_by, U.admin, 'publisher = authenticated admin, not the service witness')
      const units = await db.query<{ n: number }>(
        `select count(*)::int as n from story.release_units u join story.releases r on r.id = u.release_id where r.release_key = $1`, [releaseKey])
      eq(units.rows[0]!.n, UNITS, 'units copied')
      // 살아 있는(철회 전) 발행본의 내용은 소유자도 못 고친다 — 철회 칸과 섞어도 마찬가지(guard_release_update 의 내용 비교 분기).
      await rejects(db.query(`update story.releases set title = 'owner edit' where release_key = $1`, [releaseKey]),
        /^story:release_content_immutable$/, 'owner edits live release title')
      await rejects(db.query(`update story.releases set title = 'owner edit', withdrawn_at = now(), withdrawn_by = $2, withdraw_reason = 'cover'
                               where release_key = $1`, [releaseKey, U.admin]),
        /^story:release_content_immutable$/, 'owner edits live release title together with withdraw fields')
      await rejects(db.query(`update story.releases set validation_attestation_id = validation_attestation_id, unit_count = unit_count + 1 where release_key = $1`, [releaseKey]),
        /^story:release_content_immutable$/, 'owner edits live release unit_count')
      await rejects(db.query(`update story.release_units set body = 'owner edit' where release_id = $1`, [rel.id]), /^story:immutable_row$/, 'owner edits live unit body')
      await rejects(db.query(`delete from story.releases where release_key = $1`, [releaseKey]), /^story:immutable_row$/, 'owner deletes live release')
      const still = await releaseRow(releaseKey)
      eq(still.title, storyV2.title, 'live release title unchanged')
      eq(still.withdrawn_at, null, 'live release still live')
      await rejects(publish(A.admin, storyV2Id), /story:live_release_exists/, 'second publish')
      // 동시 발행의 최종 방어: 살아 있는 발행본 유일 색인(INTERFACE H2 이후 (원천, 판본 키) 기준 — 이름이 아니라 정의로 확인).
      const idx = await db.query<{ n: number }>(
        `select count(*)::int as n from pg_indexes where schemaname = 'story' and tablename = 'releases'
            and indexdef ilike 'create unique index%(source_id, edition_key)%where (withdrawn_at is null)%'`)
      eq(idx.rows[0]!.n, 1, 'live unique index on (source_id, edition_key) where withdrawn_at is null')
    })

    await check('T15', '학습자: 서가는 anon 가능 · 본문은 로그인만 · 위치 기록(마지막 단위로 바로 건너뛰어도) 완료 아님 · 원문 완독 아님', async () => {
      const cat = (await as<Json>(A.anon, `select * from public.story_catalog()`)).filter((r) => r.release_key === releaseKey)
      eq(cat.length, 1, 'catalog row')
      eq(Object.prototype.hasOwnProperty.call(cat[0], 'body') || Object.prototype.hasOwnProperty.call(cat[0], 'unit_text'), false, 'no body in catalog')
      await rejects(as(A.anon, `select * from public.story_read_unit($1, 0)`, [releaseKey]), /permission denied/, 'anon read')
      await rejects(as(A.service, `select * from public.story_read_unit($1, 0)`, [releaseKey]), /permission denied/, 'service read')
      await rejects(as(A.noSub, `select * from public.story_read_unit($1, 0)`, [releaseKey]), /story:auth_required/, 'no-sub read')
      const unit = await one<Json>(A.learner, `select * from public.story_read_unit($1, 0)`, [releaseKey])
      eq(unit.unit_text, storyV2.units[0].text, 'unit text')
      await rejects(pos(A.learner, releaseKey, 99), /story:unit_not_found/, 'out of range')
      await rejects(pos(A.learner, releaseKey, -1), /story:unit_not_found/, 'negative')
      await rejects(pos(A.learner, releaseKey, null), /story:unit_not_found/, 'null')
      await rejects(as(A.anon, `select * from public.story_record_position($1, 0)`, [releaseKey]), /permission denied/, 'anon position')
      await rejects(pos(A.suspended, releaseKey, 0), /story:account_blocked/, 'suspended position')
      // 독립 재현(probe-s3)의 결함: 첫 기록이 마지막 단위면 완료가 됐다. 이제는 위치일 뿐이다.
      const jump = await pos(A.learner, releaseKey, UNITS - 1)
      eq(jump.completed, false, 'final-unit jump is not completion')
      eq(jump.completed_unit_count, 0, 'no unit completed by navigation')
      eq(jump.furthest_unit_index, UNITS - 1, 'furthest')
      eq(jump.last_unit_index, UNITS - 1, 'last')
      await pos(A.learner, releaseKey, 2)
      const back = await pos(A.learner, releaseKey, 1)
      eq(back.last_unit_index, 1, 'last moves back')
      eq(back.furthest_unit_index, UNITS - 1, 'furthest never decreases')
      eq(back.completed, false, 'still not completed')
      const mine = await progressOf(A.learner, releaseKey)
      if (!mine) throw new Error('my_progress row missing')
      eq(mine.counts_as_original_text_completion, false, 'not original text completion')
      eq(mine.release_available, true, 'available')
      eq(mine.furthest_unit_index, UNITS - 1, 'furthest')
      eq(mine.last_unit_index, 1, 'last')
      eq(mine.completed_unit_count, 0, 'completed units')
      eq(mine.completed_at, null, 'completed_at')
      eq(mine.unit_count, UNITS, 'unit count')
      const rows = await db.query<{ n: number }>(`select count(*)::int as n from story.reading_unit_completions`)
      eq(rows.rows[0]!.n, 0, 'navigation wrote no unit completions')
    })

    await check('T30', '단위 완료: 마지막 단위 먼저 → 미완료, 가운데 하나 빠짐 → 미완료, 순서 섞어 전부 → 마지막 표시에서 한 번만 완료, 위치만 → 미완료, 재표시 멱등 · completed_at 한 번', async () => {
      // 학습자 1: 마지막 단위를 먼저 표시
      const last = await done(A.learner, releaseKey, UNITS - 1)
      eq(last.completed, false, 'final-unit-first')
      eq(last.completed_unit_count, 1, 'count after final-first')
      eq(last.unit_index, UNITS - 1, 'unit index')
      const middle = 3
      for (let i = 0; i < UNITS - 1; i++) {
        if (i === middle) continue
        const r = await done(A.learner, releaseKey, i)
        eq(r.completed, false, `missing middle (after unit ${i})`)
      }
      const gap = await progressOf(A.learner, releaseKey)
      eq(gap?.completed_unit_count, UNITS - 1, 'count with middle missing')
      eq(gap?.completed_at, null, 'completed_at with middle missing')
      const full = await done(A.learner, releaseKey, middle)
      eq(full.completed, true, 'all units → completed')
      eq(full.completed_unit_count, UNITS, 'count')
      eq(full.completion_label, 'adapted_full_work', 'completion label')
      const at1 = iso((await progressOf(A.learner, releaseKey))?.completed_at)
      if (!at1) throw new Error('completed_at not set')
      const again = await done(A.learner, releaseKey, middle)
      eq(again.completed, true, 'idempotent re-mark stays completed')
      eq(again.completed_unit_count, UNITS, 'idempotent count')
      const nav = await pos(A.learner, releaseKey, 0)
      eq(nav.completed, true, 'navigation after completion keeps completion')
      eq(nav.last_unit_index, 0, 'position moves')
      eq(iso((await progressOf(A.learner, releaseKey))?.completed_at), at1, 'completed_at set once')
      // 학습자 2: 섞인 순서
      const order = [5, 0, 7, 2, 6, 1, 4, 3]
      const flags: boolean[] = []
      for (const i of order) flags.push((await done(A.learner2, releaseKey, i)).completed as boolean)
      eq(flags.map(String).join(','), [...Array(UNITS - 1).fill('false'), 'true'].join(','), 'unordered coverage completes exactly at the last missing unit')
      // 학습자 3: 위치만 끝까지
      for (let i = 0; i < UNITS; i++) {
        const r = await pos(A.learner3, releaseKey, i)
        eq(r.completed, false, `position-only ${i}`)
        eq(r.completed_unit_count, 0, `position-only count ${i}`)
      }
      const p3 = await progressOf(A.learner3, releaseKey)
      eq(p3?.completed_at, null, 'position-only completed_at')
      eq(p3?.furthest_unit_index, UNITS - 1, 'position-only furthest')
      const c3 = await db.query<{ n: number }>(`select count(*)::int as n from story.reading_unit_completions where user_id = $1`, [U.learner3])
      eq(c3.rows[0]!.n, 0, 'position-only wrote no completion rows')
      // complete_unit 이 위치도 옮긴다(계약 4) — 단, 완료는 단위 전부일 때만.
      const p2 = await progressOf(A.learner2, releaseKey)
      eq(p2?.last_unit_index, 3, 'complete_unit moves last position')
      eq(p2?.furthest_unit_index, UNITS - 1, 'complete_unit furthest = greatest')
      await rejects(done(A.learner2, releaseKey, UNITS), /story:unit_not_found/, 'complete out of range')
      await rejects(done(A.learner2, releaseKey, -1), /story:unit_not_found/, 'complete negative')
      await rejects(done(A.learner2, releaseKey, null), /story:unit_not_found/, 'complete null')
      await rejects(as(A.anon, `select * from public.story_complete_unit($1, 0)`, [releaseKey]), /permission denied/, 'anon complete')
      await rejects(as(A.service, `select * from public.story_complete_unit($1, 0)`, [releaseKey]), /permission denied/, 'service complete')
      await rejects(done(A.suspended, releaseKey, 0), /story:account_blocked/, 'suspended complete')
      for (const who of [A.learner, A.learner2, A.learner3]) {
        for (const r of await as<Json>(who, `select * from public.story_my_progress()`)) {
          eq(r.counts_as_original_text_completion, false, `${String(who.sub)} original-text completion`)
        }
      }
    })

    await check('T16', '철회: curator 거부 · 멱등 · 서가/본문/위치/완료 차단 · 진도 · 단위 완료 이력 보존 · 같은 내용 재발행은 새 검수 필요', async () => {
      await rejects(as(A.reviewer, `select * from public.story_admin_withdraw($1, 'x')`, [releaseKey]), /story:admin_required/, 'curator withdraw')
      await rejects(as(A.admin, `select * from public.story_admin_withdraw($1, ' ')`, [releaseKey]), /story:withdraw_reason_required/, 'reason')
      const counts = async () => (await db.query<{ c: string }>(
        `select (select count(*) from story.reading_progress) || '/' || (select count(*) from story.reading_unit_completions) as c`)).rows[0]!.c
      const before = await counts()
      const w = await one<Json>(A.admin, `select * from public.story_admin_withdraw($1, '격리 시험 철회')`, [releaseKey])
      eq(w.changed, true, 'changed')
      const w2 = await one<Json>(A.admin, `select * from public.story_admin_withdraw($1, '두 번째')`, [releaseKey])
      eq(w2.changed, false, 'idempotent')
      eq(await catalogHas(A.anon, releaseKey), false, 'catalog hides')
      await rejects(as(A.learner, `select * from public.story_read_unit($1, 0)`, [releaseKey]), /story:release_unavailable/, 'read blocked')
      await rejects(pos(A.learner, releaseKey, 0), /story:release_unavailable/, 'position blocked')
      await rejects(done(A.learner3, releaseKey, 0), /story:release_unavailable/, 'complete blocked')
      const mine = await progressOf(A.learner, releaseKey)
      eq(mine?.release_available, false, 'history shows withdrawn')
      eq(mine?.completed_unit_count, UNITS, 'completion history kept')
      eq(await counts(), before, 'progress + unit completions preserved')
      await rejects(publish(A.admin, storyV2Id), /story:release_key_exists/, 'republish same content')
    })

    await check('T17', '불변: 소유자라도 원천 · 발행본 · 증명 · 단위 완료 수정/삭제, 진도 후퇴 · 완료 수 위조 · 미완료 completed_at · 기록 TRUNCATE 거부', async () => {
      await rejects(db.query(`update story.sources set work_key = 'x' where id = $1`, [sourceId]), /story:immutable_row/, 'source update')
      await rejects(db.query(`delete from story.reviews`), /story:immutable_row/, 'review delete')
      await rejects(db.query(`update story.releases set title = 'x' where release_key = $1`, [releaseKey]), /story:already_withdrawn/, 'withdrawn release update')
      await rejects(db.query(`delete from story.reading_progress`), /story:immutable_row/, 'progress delete')
      await rejects(db.query(`update story.reading_progress set furthest_unit_index = 0, last_unit_index = 0`), /story:progress_regression/, 'progress regression')
      await rejects(db.query(`update story.reading_progress set completed_unit_count = 0 where completed_unit_count > 0`), /story:progress_regression/, 'completion count regression')
      await rejects(db.query(`update story.reading_progress set completed_unit_count = completed_unit_count + 1`), /story:progress_count_mismatch/, 'forged completion count')
      await rejects(db.query(`update story.reading_progress set completed_at = now() where completed_at is null`), /story:completion_incomplete/, 'completed_at without all units')
      const relId = (await releaseRow(releaseKey)).id as string
      await rejects(db.query(`insert into story.reading_progress (user_id, release_id, last_unit_index, furthest_unit_index, completed_unit_count)
                              values ('00000000-0000-4000-8000-0000000000ff', $1, 0, 0, 3)`, [relId]), /story:progress_invalid/, 'progress insert with completions')
      await rejects(db.query(`insert into story.reading_unit_completions (user_id, release_id, unit_index) values ($1, $2, 99)`, [U.learner, relId]),
        /foreign key/, 'completion for a unit that does not exist')
      await rejects(db.query(`delete from story.reading_unit_completions`), /story:immutable_row/, 'unit completion delete')
      await rejects(db.query(`update story.validation_attestations set binding_sha256 = $1`, ['c'.repeat(64)]), /story:immutable_row/, 'attestation update')
      await rejects(db.query(`delete from story.validation_attestations`), /story:immutable_row/, 'attestation delete')
      await rejects(db.query(`truncate story.validation_attestations cascade`), /story:immutable_row/, 'attestation truncate')
      await rejects(db.query(`update story.action_log set actor = null`), /story:immutable_row/, 'log update')
      await rejects(db.query(`truncate story.action_log`), /story:immutable_row/, 'truncate log')
    })

    // ── 검증 증인 분리 · 증명 위조/변조 ─────────────────────────────────────────
    let attKey = ''
    await check('T31', '검증 증인: 저장값 입력 = 제출값 · 관리자/학습자/anon 은 서비스 RPC 실행 불가(위조 증명 불가) · JWT 역할 주장 불일치 거부 · 변조 증명 거부 · 멱등 · 서비스는 행위자로 기록되지 않음', async () => {
      const attLane = await freshLane('attest', policyVariant('gull-rock-attest'))
      const v = await readyVersion(attLane, 'story-b1', 'attest')
      const other = await readyVersion(attLane, 'easy-a2', 'attest')
      // 1차 문: EXECUTE 는 service_role 만.
      for (const who of [A.admin, A.reviewer, A.producer, A.learner, A.anon]) {
        await rejects(validationInput(v.id, who), /permission denied/, `${String(who.sub ?? who.role)} validation_input`)
      }
      const input = await validationInput(v.id)
      eq(Object.keys(input).sort().join(','), 'artifact,edition_key,edition_version_id,policy,reviews,snapshot', 'input keys')
      eq(S.canonicalJson(input.artifact), S.canonicalJson(v.art), 'input artifact = stored submission')
      eq(S.canonicalJson(input.snapshot), S.canonicalJson(attLane.snap), 'input snapshot = registered snapshot (meta + text + text_sha256)')
      eq(S.canonicalJson(input.policy), S.canonicalJson(policyVariant('gull-rock-attest')), 'input policy = stored policy')
      eq((input.reviews as unknown[]).length, 1, 'input reviews')
      const r = adapt(input)
      if (!r.ok) throw new Error(`adapter refused a valid version: ${r.stage} ${JSON.stringify(r.errors)}`)
      const bad = S.buildValidationAttestation({ validationInput: input, now: new Date(Number.NaN) })
      eq(bad.ok === false && bad.stage === 'input' && bad.errors[0]?.code === 'invalid_clock', true, 'adapter rejects invalid clock')
      const att = r.attestation as unknown as Json
      for (const who of [A.admin, A.reviewer, A.producer, A.learner, A.anon]) {
        await rejects(attestRpc(who, v.id, att), /permission denied/, `${String(who.sub ?? who.role)} forged attestation`)
      }
      // 방어 겹(INTERFACE H1): service_role 연결이라도 JWT 역할 주장이 service_role 로 있어야 한다 — 다르거나 없으면 거부(전체 행렬은 T38).
      await rejects(validationInput(v.id, A.serviceUserClaim), /story:service_role_required/, 'service with authenticated claim (input)')
      await rejects(attestRpc(A.serviceUserClaim, v.id, att), /story:service_role_required/, 'service with authenticated claim (attest)')
      await rejects(validationInput(v.id, A.serviceNoClaim), /story:service_role_required/, 'service without any JWT claim (input)')
      // 증명 없이 직접 발행 — fail closed.
      await rejects(publish(A.admin, v.id), /story:validation_attestation_missing/, 'publish without attestation')
      const b0 = await bundle(v.id)
      eq(b0.validation?.attested, false, 'bundle attested=false before')
      eq(b0.validation?.binding_sha256, r.bindingSha256, 'bundle binding sha = S2')
      // 변조 증명(서비스 주체가 보내더라도) 거부.
      const tamper = (mut: (a: Json) => void): Json => { const a = structuredClone(att); mut(a); return a }
      const cases: Array<[string, Json | string, RegExp]> = [
        ['checks.edition invalid', tamper((a) => { a.checks.edition = 'invalid' }), /story:attestation_invalid/],
        ['checks missing', tamper((a) => { delete a.checks }), /story:attestation_invalid/],
        ['extra key', tamper((a) => { a.note = 'trust me' }), /story:attestation_invalid/],
        ['schema', tamper((a) => { a.schema = 'lcp-story/validation-attestation@2' }), /story:attestation_invalid/],
        ['validator', tamper((a) => { a.validator.name = 'hand-written' }), /story:attestation_invalid/],
        ['validated_at future', tamper((a) => { a.validated_at = '2999-01-01T00:00:00Z' }), /story:time_in_future/],
        ['validated_at no offset', tamper((a) => { a.validated_at = '2026-10-25T00:00:00' }), /story:attestation_invalid/],
        ['validated_at impossible date', tamper((a) => { a.validated_at = '2026-02-30T00:00:00Z' }), /story:attestation_invalid/],
        ['binding edition sha', tamper((a) => { a.binding.edition_sha256 = '0'.repeat(64) }), /story:attestation_binding_mismatch/],
        ['binding reviews empty', tamper((a) => { a.binding.review_sha256s = [] }), /story:attestation_binding_mismatch/],
        ['binding extra review', tamper((a) => { a.binding.review_sha256s = [...a.binding.review_sha256s, 'f'.repeat(64)] }), /story:attestation_binding_mismatch/],
        ['binding extra key', tamper((a) => { a.binding.validated = true }), /story:attestation_binding_mismatch/],
        ['not an object', 'attested', /story:attestation_invalid/],
      ]
      for (const [label, a, want] of cases) await rejects(attestRpc(A.service, v.id, a), want, label)
      await rejects(attestRpc(A.service, other.id, att), /story:attestation_binding_mismatch/, 'attestation of another version')
      const rows0 = await db.query<{ n: number }>(`select count(*)::int as n from story.validation_attestations where edition_version_id = $1`, [v.id])
      eq(rows0.rows[0]!.n, 0, 'no attestation row after refused attempts')
      // 정상 증명 · 멱등
      const ok1 = await attestRpc(A.service, v.id, att)
      eq(ok1.created, true, 'created')
      eq(ok1.binding_sha256, r.bindingSha256, 'binding sha parity')
      const ok2 = await attestRpc(A.service, v.id, att)
      eq(ok2.created, false, 'idempotent')
      eq(ok2.attestation_id, ok1.attestation_id, 'same row')
      const log = await db.query<{ k: string; a: string | null; n: number }>(
        `select actor_kind as k, actor as a, count(*) over ()::int as n from story.action_log where action = 'attest_validation' and target_id = $1`,
        [ok1.attestation_id])
      eq(log.rows[0]?.n, 1, 'one attest log row')
      eq(log.rows[0]?.k, 'service_validator', 'actor_kind')
      eq(log.rows[0]?.a, null, 'service witness has no user actor')
      const strays = await db.query<{ n: number }>(
        `select count(*)::int as n from story.action_log where (actor is null) <> (actor_kind = 'service_validator')`)
      eq(strays.rows[0]!.n, 0, 'only the service witness is actor-less')
      const rel = await publish(A.admin, v.id)
      attKey = rel.release_key as string
      const row = await releaseRow(attKey)
      eq(row.validation_attestation_id, ok1.attestation_id, 'release bound to attestation')
      eq(row.published_by, U.admin, 'publisher')
      const pubLog = await db.query<{ k: string; a: string }>(`select actor_kind as k, actor as a from story.action_log where action = 'publish' and target_id = $1`, [row.id])
      eq(pubLog.rows[0]?.k, 'user', 'publish logged as user act')
      eq(pubLog.rows[0]?.a, U.admin, 'publish actor')
      const b1 = await bundle(v.id)
      eq(b1.validation?.attested, true, 'bundle attested=true after')
      eq(b1.rights_ok, true, 'bundle rights_ok')
      eq(b1.releases?.[0]?.available, true, 'bundle release available')
    })

    // ── S2 가 거부하는 판본: 직접 authenticated RPC 로 올려도 발행되지 않는다 ────────────
    let heldLane: Lane | null = null
    try {
      heldLane = await freshLane('held', policyVariant('gull-rock-held'))
    } catch (e) {
      results.push({ id: 'T32-lane', title: '보류 시험용 판본 자리 등록', status: 'fail', detail: errMsg(e) })
    }
    const mutations: Array<{ id: string; title: string; mut: (a: Json) => void; s2Strips?: boolean }> = [
      { id: 'probe-repro', title: '독립 재현 그대로 — 첫 단위 source_anchors=[] + hook.spoiler_free=false', mut: (a) => { a.units[0].source_anchors = []; a.hook.spoiler_free = false } },
      { id: 'anchors-empty', title: '단위 원문 앵커 빈 배열', mut: (a) => { a.units[0].source_anchors = [] } },
      { id: 'anchors-missing', title: '단위 원문 앵커 필드 없음', mut: (a) => { delete a.units[1].source_anchors } },
      { id: 'hook-spoiler', title: '거짓 진입 장면(spoiler_free=false)', mut: (a) => { a.hook.spoiler_free = false } },
      { id: 'anchor-quote', title: '앵커 인용이 원문 구간과 다름', mut: (a) => { const x = a.units[2].source_anchors[0]; x.quote = `${String(x.quote).slice(0, -1)}X` } },
      { id: 'anchor-outside-paragraph', title: '앵커 구간이 선언한 문단 밖', mut: (a) => { a.units[2].source_anchors[0].paragraph = 3 } },
      { id: 'offset-out-of-range', title: '앵커 끝이 원문 길이 밖(UTF-16 범위 초과)', mut: (a) => { a.units[0].source_anchors[0].end = 1_000_000 } },
      {
        id: 'span-surrogate-split', title: '판본 구간이 서로게이트 쌍(한 글자)을 가름',
        mut: (a) => {
          const u = a.units[7]
          u.text = `${String(u.text)} \u{1F30A}`
          const ob = (a.activities as Json[]).find((x) => x.kind === 'original_bridge')!
          ob.edition_span = { unit_id: u.unit_id, start: (u.text as string).length - 1, end: (u.text as string).length, quote: '\u{1F30A}' }
        },
      },
      { id: 'lone-surrogate', title: '짝 없는 서로게이트가 든 본문(잘못된 UTF-16)', mut: (a) => { a.units[3].text = `${String(a.units[3].text)} \ud83c` } },
      { id: 'duplicate-unit-id', title: '단위 id 중복', mut: (a) => { a.units[1].unit_id = a.units[0].unit_id } },
      { id: 'duplicate-unit-text', title: '단위 본문 중복', mut: (a) => { a.units[6].text = a.units[5].text } },
      {
        id: 'alignment-gap', title: '한 문단에 대응하는 단위 없음(정렬 누락)',
        mut: (a) => { a.units.splice(6, 1); (a.units as Json[]).forEach((u, i) => { u.order = i + 1 }) },
      },
      { id: 'preserve-missing', title: '필수 보존 요소 누락', mut: (a) => { a.units[3].preserves = (a.units[3].preserves as string[]).filter((p) => p !== 'ev-gale-fall') } },
      { id: 'sensitive-changelog-missing', title: '민감 표현 처리 변경 기록 누락', mut: (a) => { a.change_log = (a.change_log as Json[]).filter((c) => c.sensitive_ref === null) } },
      { id: 'activity-missing', title: '제작 범위가 요청한 활동 누락', mut: (a) => { a.activities = (a.activities as Json[]).filter((x) => x.kind !== 'original_bridge') } },
      { id: 'unknown-extra-key', title: '검증기가 모르는 키에 숨긴 대체 본문', mut: (a) => { a.units[0].learner_text_override = 'Unvalidated replacement text.' }, s2Strips: true },
    ]
    for (const m of mutations) {
      await check(`T32-${m.id}`, `S2 거부 판본은 보관만 되고 발행 불가 — ${m.title}`, async () => {
        if (!heldLane) throw new Error('held lane not registered')
        const art = editionIn(heldLane.ctx, 'story-b1', `held-${m.id}`)
        m.mut(art)
        const local = S.validateEdition(art, { ...heldLane.ctx, edition_key: 'story-b1', task_id: `${WORK}:story-b1` })
        if (local.ok && !m.s2Strips) throw new Error('mutation is not S2-invalid — scenario would be meaningless')
        let stored: Json
        try {
          stored = await submit(A.producer, heldLane.slots['story-b1']!, art)
        } catch (e) {
          // DB 가 제출 단계에서 거부했다 — 판도 증명도 없으니 발행될 수 없다.
          const n = await db.query<{ n: number }>(`select count(*)::int as n from story.releases where slot_id = $1`, [heldLane.slots['story-b1']])
          eq(n.rows[0]!.n, 0, 'no release in held slot')
          return `DB 제출 단계 거부: ${errMsg(e).slice(0, 120)}`
        }
        const version = stored.edition_version_id as string
        const rv = await submitReview(A.reviewer, version, reviewOfStored(heldLane.ctx, 'story-b1', art, stored))
        eq(rv.qualifies, true, 'claimed approving review stored (draft may be held)')
        const r = adapt(await validationInput(version))
        let note: string
        if (r.ok) {
          if (!m.s2Strips) throw new Error('S2 adapter attested an S2-invalid artifact')
          // 검증기가 모르는 키를 버리고 통과시켰다면, 그 결속(버린 뒤 해시)은 DB 저장 해시와 달라 증명이 거부돼야 한다.
          await rejects(attestRpc(A.service, version, r.attestation), /story:attestation_binding_mismatch/, 'stripped-key attestation')
          note = 'S2 가 모르는 키를 버림 → DB 결속 불일치로 증명 거부'
        } else {
          eq(r.stage, 'edition', 'adapter refusal stage')
          note = `어댑터 거부 ${r.stage}: ${r.errors.map((x) => x.code).join(',')}`
        }
        await rejects(publish(A.admin, version), /story:validation_attestation_missing/, 'direct admin publish')
        const n = await db.query<{ a: number; r: number }>(
          `select (select count(*) from story.validation_attestations where edition_version_id = $1)::int as a,
                  (select count(*) from story.releases where slot_id = $2)::int as r`, [version, heldLane.slots['story-b1']])
        eq(n.rows[0]!.a, 0, 'no attestation')
        eq(n.rows[0]!.r, 0, 'no release')
        return note
      })
    }
    await check('T32-control', '대조: 같은 자리에 S2 정상 판을 올리면 같은 경로로 발행된다(위 거부가 자리 설정 탓이 아님) · 거부된 판은 초안으로 남는다', async () => {
      if (!heldLane) throw new Error('held lane not registered')
      const before = await db.query<{ n: number }>(`select count(*)::int as n from story.edition_versions where slot_id = $1`, [heldLane.slots['story-b1']])
      const f = await publishFlow(heldLane, 'story-b1', 'held-control')
      eq(await catalogHas(A.anon, f.releaseKey), true, 'control published')
      const after = await db.query<{ n: number }>(`select count(*)::int as n from story.edition_versions where slot_id = $1`, [heldLane.slots['story-b1']])
      eq(after.rows[0]!.n, before.rows[0]!.n + 1, 'held drafts kept')
      return `held drafts in slot: ${before.rows[0]!.n}`
    })

    let staleKey = ''
    await check('T33', '낡은 증명: 증명 뒤 검수 추가 → 발행 거부(validation_attestation_missing) → 재증명 → 발행(검수자 = 발행 admin 허용) · 발행본 검수 목록 = 새 증명 결속', async () => {
      const lane = await freshLane('stale', policyVariant('gull-rock-stale'))
      const v = await readyVersion(lane, 'story-b1', 'stale')
      const a1 = await attestVersion(v.id)
      const r2 = await submitReview(A.admin, v.id, reviewIn(lane.ctx, 'story-b1', v.result, { review_id: 'b', reviewer: ADMIN_REVIEWER_CLAIM }))
      eq(r2.qualifies, true, 'admin second review qualifies')
      await rejects(publish(A.admin, v.id), /story:validation_attestation_missing/, 'stale attestation')
      eq((await bundle(v.id)).validation?.attested, false, 'bundle shows stale')
      const a2 = await attestVersion(v.id)
      eq(a2.created, true, 're-attested')
      if (a2.bindingSha256 === a1.bindingSha256) throw new Error('binding did not change after a new review')
      eq((a2.attestation.binding.review_sha256s as string[]).length, 2, 'two reviews bound')
      const rel = await publish(A.admin, v.id)
      staleKey = rel.release_key as string
      const row = await releaseRow(staleKey)
      eq(row.validation_attestation_id, a2.id, 'release bound to the new attestation')
      eq(JSON.stringify(row.review_sha256s), JSON.stringify(a2.attestation.binding.review_sha256s), 'release review list = attested list')
      const hist = await db.query<{ n: number }>(`select count(*)::int as n from story.validation_attestations where edition_version_id = $1`, [v.id])
      eq(hist.rows[0]!.n, 2, 'old attestation kept as history')
    })

    await check('T34', '같은 작품 다른 발행본: 진도 · 단위 완료가 따로 쌓이고 승계되지 않는다 · 원문 완독 아님', async () => {
      if (!attKey || !staleKey) throw new Error('needs T31/T33 releases')
      const a = await releaseRow(attKey)
      const b = await releaseRow(staleKey)
      eq(a.work_key, b.work_key, 'same work')
      for (let i = 0; i < UNITS; i++) await done(A.learner4, attKey, i)
      const pa = await progressOf(A.learner4, attKey)
      eq(pa?.completed_unit_count, UNITS, 'release A complete')
      if (!pa?.completed_at) throw new Error('release A completed_at')
      eq(await progressOf(A.learner4, staleKey), undefined, 'release B has no inherited progress')
      const first = await done(A.learner4, staleKey, 0)
      eq(first.completed, false, 'release B not completed by release A')
      eq(first.completed_unit_count, 1, 'release B counts only its own unit')
      const pb = await progressOf(A.learner4, staleKey)
      eq(pb?.completed_at, null, 'release B completed_at')
      eq((await progressOf(A.learner4, attKey))?.completed_unit_count, UNITS, 'release A unchanged')
      for (const r of await as<Json>(A.learner4, `select * from public.story_my_progress()`)) {
        eq(r.counts_as_original_text_completion, false, 'original-text completion')
      }
    })

    await check('T35', '권리(발행 뒤): source_text hold → 서가 · 본문 · 위치 · 완료 닫힘, 내 진도 release_available=false, 발행본 · 진도 행 불변, 그 사이 발행 거부 → rejected 도 닫힘 → confirmed 로 다시 열림 · 쓰지 않는 오디오/삽화 보류는 막지 않음', async () => {
      const snap = snapshotVariant('gull-rock-rights')
      const src = await registerSource(snap)
      const lane = await registerLane(src, snap, policyJson)
      await rightsOn(A.admin, src, 'source_text', 'confirmed', 'test-only-human-evidence')
      const f = await publishFlow(lane, 'story-b1', null)
      const easy = await readyVersion(lane, 'easy-a2', null)
      await attestVersion(easy.id)
      await one(A.learner5, `select * from public.story_read_unit($1, 0)`, [f.releaseKey])
      await done(A.learner5, f.releaseKey, 0)
      await pos(A.learner5, f.releaseKey, 2)
      const snapshotRows = async () => (await db.query<{ c: string }>(
        `select (select count(*) from story.releases where source_id = $1) || '/' ||
                (select count(*) from story.release_units u join story.releases r on r.id = u.release_id where r.source_id = $1) || '/' ||
                (select count(*) from story.reading_progress p join story.releases r on r.id = p.release_id where r.source_id = $1) || '/' ||
                (select count(*) from story.reading_unit_completions c join story.releases r on r.id = c.release_id where r.source_id = $1) || '/' ||
                (select count(*) from story.releases where source_id = $1 and withdrawn_at is not null) as c`, [src])).rows[0]!.c
      const before = await snapshotRows()
      const closed = async (label: string) => {
        eq(await catalogHas(A.anon, f.releaseKey), false, `${label}: anon catalog hides`)
        eq(await catalogHas(A.learner5, f.releaseKey), false, `${label}: learner catalog hides`)
        await rejects(as(A.learner5, `select * from public.story_read_unit($1, 0)`, [f.releaseKey]), /story:release_unavailable/, `${label}: read`)
        await rejects(pos(A.learner5, f.releaseKey, 1), /story:release_unavailable/, `${label}: position`)
        await rejects(done(A.learner5, f.releaseKey, 1), /story:release_unavailable/, `${label}: complete`)
        const p = await progressOf(A.learner5, f.releaseKey)
        eq(p?.release_available, false, `${label}: my_progress unavailable`)
        eq(p?.completed_unit_count, 1, `${label}: progress history kept`)
        eq(await snapshotRows(), before, `${label}: release/progress rows unchanged`)
        const row = await releaseRow(f.releaseKey)
        eq(row.withdrawn_at, null, `${label}: release row not mutated`)
      }
      const open = async (label: string) => {
        eq(await catalogHas(A.anon, f.releaseKey), true, `${label}: catalog shows`)
        await one(A.learner5, `select * from public.story_read_unit($1, 0)`, [f.releaseKey])
        eq((await progressOf(A.learner5, f.releaseKey))?.release_available, true, `${label}: my_progress available`)
      }
      await rightsOn(A.admin, src, 'source_text', 'hold', null)
      await closed('hold')
      const b = await bundle(f.versionId)
      eq(b.rights_ok, false, 'bundle rights_ok=false')
      eq(b.releases?.[0]?.available, false, 'bundle release available=false')
      await rejects(publish(A.admin, easy.id), /story:rights_unconfirmed/, 'publish during hold (attested version)')
      await rightsOn(A.admin, src, 'source_text', 'rejected', null)
      await closed('rejected')
      await rightsOn(A.admin, src, 'source_text', 'confirmed', 'test-only-human-evidence-2')
      await open('re-confirmed')
      eq((await done(A.learner5, f.releaseKey, 1)).completed_unit_count, 2, 'progress resumes on the same history')
      await rightsOn(A.admin, src, 'audio', 'hold', null)
      await rightsOn(A.admin, src, 'illustration', 'rejected', null)
      await open('unused audio hold + illustration rejected')
      const easyRel = await publish(A.admin, easy.id)
      eq(await catalogHas(A.anon, easyRel.release_key as string), true, 'publish after re-confirm')
    })

    await check('T36', '번역 원천(원작 fr → 본문 en): translation 결정 없으면 발행 거부 → confirmed 로 발행 → translation hold 가 열람을 닫고 · 오디오/삽화 보류는 안 닫고 · 다시 confirmed 로 열림 · source_text 거부도 닫음', async () => {
      const snap = snapshotVariant('gull-rock-translation', (s) => {
        s.work.original_language = 'fr'
        s.edition.translator = 'Test Translator (fixture)'
        s.rights.push({ asset: 'translation', status: 'claimed_by_source', basis: '격리 시험용 번역 권리 주장 — 실제 권리 심사 아님', evidence_ref: 'test-only-evidence', checked_by: null, checked_at: null })
      })
      const src = await registerSource(snap)
      const lane = await registerLane(src, snap, policyJson)
      await rightsOn(A.admin, src, 'source_text', 'confirmed', 'test-only-human-evidence')
      const v = await readyVersion(lane, 'story-b1', null)
      await attestVersion(v.id)
      await rejects(publish(A.admin, v.id), /story:rights_unconfirmed/, 'translation decision missing')
      await rightsOn(A.admin, src, 'translation', 'confirmed', 'test-only-translation-evidence')
      const key = (await publish(A.admin, v.id)).release_key as string
      await pos(A.learner5, key, 0)
      const isOpen = async () => {
        try {
          await one(A.learner5, `select * from public.story_read_unit($1, 0)`, [key])
          return (await catalogHas(A.anon, key)) && (await progressOf(A.learner5, key))?.release_available === true
        } catch (e) {
          if (/story:release_unavailable/.test(errMsg(e))) return false
          throw e
        }
      }
      eq(await isOpen(), true, 'open after both confirmed')
      await rightsOn(A.admin, src, 'audio', 'hold', null)
      await rightsOn(A.admin, src, 'illustration', 'hold', null)
      eq(await isOpen(), true, 'unused media holds do not close text')
      await rightsOn(A.admin, src, 'translation', 'hold', null)
      eq(await isOpen(), false, 'translation hold closes')
      eq(await catalogHas(A.learner5, key), false, 'catalog hides on translation hold')
      await rejects(pos(A.learner5, key, 1), /story:release_unavailable/, 'position during translation hold')
      await rejects(done(A.learner5, key, 0), /story:release_unavailable/, 'complete during translation hold')
      await rightsOn(A.admin, src, 'translation', 'confirmed', 'test-only-translation-evidence-2')
      eq(await isOpen(), true, 'translation re-confirmed reopens')
      await rightsOn(A.admin, src, 'source_text', 'rejected', null)
      eq(await isOpen(), false, 'source_text rejected closes translated release')
      await rightsOn(A.admin, src, 'source_text', 'confirmed', 'test-only-human-evidence-2')
      eq(await isOpen(), true, 'source_text re-confirmed reopens')
    })

    await check('T37', '격리 수준: 발행 · 검증 증명은 REPEATABLE READ · SERIALIZABLE 에서 story:read_committed_required(기본 READ COMMITTED 만)', async () => {
      const lane = await freshLane('isolation', policyVariant('gull-rock-isolation'))
      const v = await readyVersion(lane, 'story-b1', 'isolation')
      const r = adapt(await validationInput(v.id))
      if (!r.ok) throw new Error('adapter refused')
      const attestSql = `select * from public.story_service_attest_validation($1, $2::jsonb)`
      for (const lvl of ['repeatable read', 'serializable']) {
        const a = await txAs(lvl, A.service, attestSql, [v.id, JSON.stringify(r.attestation)])
        if (!/story:read_committed_required/.test(a)) throw new Error(`attest under ${lvl}: ${a}`)
      }
      const okRc = await txAs('read committed', A.service, attestSql, [v.id, JSON.stringify(r.attestation)])
      eq(okRc, 'ok', 'attest under explicit read committed (rolled back)')
      await attestVersion(v.id)
      for (const lvl of ['repeatable read', 'serializable']) {
        const p = await txAs(lvl, A.admin, `select * from public.story_admin_publish($1)`, [v.id])
        if (!/story:read_committed_required/.test(p)) throw new Error(`publish under ${lvl}: ${p}`)
      }
      eq(await txAs('read committed', A.admin, `select * from public.story_admin_publish($1)`, [v.id]), 'ok', 'publish under read committed (rolled back)')
    })

    // ── 독립 검토 1회차 보강(INTERFACE H) ─────────────────────────────────────────
    await check('T38', 'H1 검증 증인 주장: JWT 주장 없는 소유자 세션이 DB 결속을 손으로 써서 S2 위반 판을 증명 · 발행시키지 못함(검토 F9) · 주장 없음/깨진 JSON/배열/역할 없음/역할 다름/두 주장 불일치 거부 · PostgREST 모양과 옛 GUC 단독 service_role 은 정상', async () => {
      // 살아 있는 발행본이 없는 새 원천 — 발행 거부 사유가 증명 없음 하나뿐이게 한다.
      const lane = await freshLane('h1-f9')
      const art = editionIn(lane.ctx, 'story-b1', 'h1-f9')
      art.units[0].source_anchors = []
      art.hook.spoiler_free = false
      if (S.validateEdition(art, { ...lane.ctx, edition_key: 'story-b1', task_id: `${WORK}:story-b1` }).ok) throw new Error('F9 artifact is not S2-invalid')
      const stored = await submit(A.producer, lane.slots['story-b1']!, art)
      const v = stored.edition_version_id as string
      await submitReview(A.reviewer, v, reviewOfStored(lane.ctx, 'story-b1', art, stored))
      const refused = adapt(await validationInput(v))
      eq(refused.ok, false, 'S2 adapter refuses the F9 artifact')
      // 소유자 세션(MCP execute_sql · SQL 편집기 모양): 결속을 DB 에서 읽어 S2 없이 증명을 손으로 만든다.
      const forged = { schema: S.ATTESTATION_SCHEMA, validator: S.ATTESTATION_VALIDATOR, binding: await ownerBinding(v), checks: ALL_VALID, validated_at: NOW.toISOString() }
      await rejects(validationInput(v, A.ownerNoClaims), /story:service_role_required/, 'owner without claims: validation input')
      await rejects(attestRpc(A.ownerNoClaims, v, forged), /story:service_role_required/, 'owner without claims: hand-written attestation (F9)')
      const deny: Array<[Actor, string]> = [
        [A.serviceNoClaim, 'service_role without any claim'],
        [A.serviceMalformedClaims, 'malformed request.jwt.claims'],
        [A.serviceArrayClaims, 'request.jwt.claims not an object'],
        [A.serviceClaimsNoRole, 'claims without role'],
        [A.serviceUserClaim, 'claims role authenticated'],
        [A.serviceConflictLegacy, 'claims service_role vs legacy claim.role authenticated'],
        [A.serviceConflictClaims, 'claims authenticated vs legacy claim.role service_role'],
      ]
      for (const [who, label] of deny) {
        await rejects(validationInput(v, who), /story:service_role_required/, `${label}: input`)
        await rejects(attestRpc(who, v, forged), /story:service_role_required/, `${label}: attest`)
      }
      await rejects(publish(A.admin, v), /story:validation_attestation_missing/, 'publish after the forged attempts')
      const n = await db.query<{ a: number; r: number }>(
        `select (select count(*) from story.validation_attestations where edition_version_id = $1)::int as a,
                (select count(*) from story.releases where edition_version_id = $1)::int as r`, [v])
      eq(n.rows[0]!.a, 0, 'no attestation row for the F9 artifact')
      eq(n.rows[0]!.r, 0, 'no release for the F9 artifact')
      // 정상 백엔드: PostgREST 모양(request.jwt.claims.role = service_role)과 옛 GUC 단독 service_role.
      const pgrst = await validationInput(v, A.service)
      eq(S.canonicalJson(await validationInput(v, A.serviceLegacyOnly)), S.canonicalJson(pgrst), 'legacy claim.role service_role reads the same input')
    })

    await check('T39', 'H2 살아 있는 발행본 = (원천, 판본 키)마다 하나: 제작 항목 하나 더한 두 번째 기준의 새 자리에서 발행 → live_release_exists · 첫째 철회 뒤 발행 · 같은 작품의 다른 원천 스냅숏은 따로 발행', async () => {
      const { src, snap } = await freshSource('h2')
      const lane1 = await registerLane(src, snap, policyJson)
      const lane2 = await registerLane(src, snap, policyWithExtraItem())
      if (!lane2.slots['story-b1'] || lane2.slots['story-b1'] === lane1.slots['story-b1']) throw new Error('second policy did not create a new story-b1 slot')
      eq(lane2.ctx.policy.policy_sha256, lane1.ctx.policy.policy_sha256, 'same policy core binding')
      const first = await publishFlow(lane1, 'story-b1', 'h2-first')
      const second = await readyVersion(lane2, 'story-b1', 'h2-second')
      await attestVersion(second.id)
      await rejects(publish(A.admin, second.id), /story:live_release_exists/, 'second slot, same source + edition_key, while the first is live')
      const live = async () => (await db.query<{ n: number }>(
        `select count(*)::int as n from story.releases where source_id = $1 and edition_key = 'story-b1' and withdrawn_at is null`, [src])).rows[0]!.n
      eq(await live(), 1, 'one live story-b1 for the source')
      await one(A.admin, `select * from public.story_admin_withdraw($1, 'H2 교체')`, [first.releaseKey])
      const repl = await publish(A.admin, second.id)
      eq(await live(), 1, 'replacement live after withdrawal')
      eq(await catalogHas(A.anon, repl.release_key as string), true, 'replacement in catalog')
      const other = await freshLane('h2-other')
      const o = await publishFlow(other, 'story-b1', 'h2-other')
      const both = await db.query<{ n: number }>(
        `select count(*)::int as n from story.releases where release_key in ($1, $2) and withdrawn_at is null`, [repl.release_key, o.releaseKey])
      eq(both.rows[0]!.n, 2, 'a different source snapshot of the same work keeps its own live release')
    })

    await check('T41', 'H3 시계 허용 오차: validated_at = DB 시각 + 5초는 받고 발행까지 되며, + 120초는 story:time_in_future', async () => {
      const lane = await freshLane('h3')
      const v = await readyVersion(lane, 'story-b1', 'h3')
      const r = adapt(await validationInput(v.id))
      if (!r.ok) throw new Error('adapter refused')
      const dbNow = Date.parse(iso((await db.query<{ t: unknown }>(`select clock_timestamp() as t`)).rows[0]!.t)!)
      const at = (ms: number) => ({ ...r.attestation, validated_at: new Date(dbNow + ms).toISOString() })
      await rejects(attestRpc(A.service, v.id, at(120_000)), /story:time_in_future/, 'validated_at +120s')
      const ok = await attestRpc(A.service, v.id, at(5_000))
      eq(ok.created, true, 'validated_at +5s accepted')
      await publish(A.admin, v.id)
    })

    await check('T42', 'H4 검증기 계약: 결속이 맞아도 다른 계약(lcp-story/s2@0)의 증명 행은 발행을 허락하지 않고(validation_attestation_missing), 현재 계약으로 다시 증명하면 새 행(created=true)으로 발행된다', async () => {
      const lane = await freshLane('h4')
      const v = await readyVersion(lane, 'story-b1', 'h4')
      const binding = await ownerBinding(v.id)
      const sha = (await db.query<{ s: string }>(`select story.canonical_sha256($1::jsonb) as s`, [JSON.stringify(binding)])).rows[0]!.s
      eq(sha, S.sha256Canonical(binding), 'binding sha parity')
      const oldValidator = { name: 'lcp-story-s2', contract: 'lcp-story/s2@0' }
      const oldAtt = { schema: S.ATTESTATION_SCHEMA, validator: oldValidator, binding, checks: ALL_VALID, validated_at: '2026-10-25T00:00:00Z' }
      const hasValidatorCol = (await db.query<{ n: number }>(
        `select count(*)::int as n from information_schema.columns
          where table_schema = 'story' and table_name = 'validation_attestations' and column_name = 'validator'`)).rows[0]!.n === 1
      // 소유자가 표에 직접 — 옛 계약으로 만든 증명(계약을 올린 뒤 남은 옛 행과 같은 모양).
      if (hasValidatorCol) {
        await db.query(`insert into story.validation_attestations (edition_version_id, binding, binding_sha256, attestation, validator)
                        values ($1, $2::jsonb, $3, $4::jsonb, $5::jsonb)`, [v.id, JSON.stringify(binding), sha, JSON.stringify(oldAtt), JSON.stringify(oldValidator)])
      } else {
        await db.query(`insert into story.validation_attestations (edition_version_id, binding, binding_sha256, attestation)
                        values ($1, $2::jsonb, $3, $4::jsonb)`, [v.id, JSON.stringify(binding), sha, JSON.stringify(oldAtt)])
      }
      await rejects(publish(A.admin, v.id), /story:validation_attestation_missing/, 'old-contract attestation authorizes nothing')
      const cur = await attestVersion(v.id)
      eq(cur.created, true, 'current-contract attestation is a new row (not blocked by the old-contract row)')
      const rel = await publish(A.admin, v.id)
      eq((await releaseRow(rel.release_key as string)).validation_attestation_id, cur.id, 'release bound to the current-contract attestation')
      const cv = (await one<{ v: Json }>(A.ownerNoClaims, `select story.current_validator() as v`)).v
      eq(S.canonicalJson(cv), S.canonicalJson(S.ATTESTATION_VALIDATOR), 'story.current_validator() = adapter validator')
    })

    if (engine.name === 'pg17') {
      const connect = engine.connect!
      const actorClient = async (who: Actor): Promise<PgClient> => {
        const c = await connect()
        await c.query(CLAIM_SQL(false), claimParams(who))
        if (who.role !== 'postgres') await c.query(`set role ${who.role}`)
        return c
      }
      const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms))
      const settle = (p: Promise<{ rows: Json[] }>): Promise<Outcome> =>
        p.then((r) => ({ ok: true, msg: 'ok', rows: r.rows }), (e: unknown) => ({ ok: false, msg: errMsg(e), rows: [] }))
      /** 두 번째 연결이 실제 Lock 대기에 들어갔는지(pg_stat_activity) — 끝나 버렸으면 대기 없이 끝난 것으로 본다. */
      const waitForLock = async (pid: number | undefined, finished: () => boolean): Promise<{ waited: boolean; evidence: string }> => {
        for (let i = 0; i < 400; i++) {
          const r = await db.query<{ w: string | null; e: string | null; b: number[] | null }>(
            `select wait_event_type as w, wait_event as e, pg_blocking_pids(pid) as b from pg_stat_activity where pid = $1`, [pid])
          const row = r.rows[0]
          if (row?.w === 'Lock') return { waited: true, evidence: `pid ${String(pid)} waited Lock/${String(row.e)} blocked_by [${(row.b ?? []).join(',')}]` }
          if (finished()) return { waited: false, evidence: `pid ${String(pid)} finished without a lock wait` }
          await sleep(25)
        }
        return { waited: false, evidence: `pid ${String(pid)} not in a Lock wait after 10s` }
      }
      interface Step { who: Actor; sql: string; params?: unknown[] }
      /** 첫째가 트랜잭션 안에서 끝난 뒤 둘째를 시작 → 둘째의 Lock 대기 확인 → 첫째 커밋 → 둘째 결과 · 커밋(실패면 롤백). 기본 격리(READ COMMITTED). */
      const race = async (first: Step, second: Step): Promise<{ first: Outcome; second: Outcome; waited: boolean; evidence: string }> => {
        const c1 = await actorClient(first.who)
        const c2 = await actorClient(second.who)
        try {
          await c1.query('begin')
          const f = await settle(c1.query<Json>(first.sql, first.params))
          if (!f.ok) {
            await c1.query('rollback')
            return { first: f, second: { ok: false, msg: 'not started', rows: [] }, waited: false, evidence: 'first step failed' }
          }
          await c2.query('begin')
          let finished = false
          const sp = settle(c2.query<Json>(second.sql, second.params)).then((o) => { finished = true; return o })
          const w = await waitForLock(c2.processID, () => finished)
          await c1.query('commit')
          const s = await sp
          await c2.query(s.ok ? 'commit' : 'rollback')
          return { first: f, second: s, waited: w.waited, evidence: w.evidence }
        } finally {
          await c1.end().catch(() => {})
          await c2.end().catch(() => {})
        }
      }
      const must2 = (r: { first: Outcome; second: Outcome; waited: boolean; evidence: string }, label: string): void => {
        if (!r.first.ok) throw new Error(`${label}: first step failed: ${r.first.msg}`)
        if (!r.waited) throw new Error(`${label}: second connection did not wait on a lock (${r.evidence}); second=${r.second.msg}`)
      }
      const PUBLISH = `select * from public.story_admin_publish($1)`
      const RIGHTS = `select public.story_admin_record_rights($1, $2, $3, $4, $5) as id`
      const SUBMIT = `select * from public.story_admin_submit_edition($1, $2::jsonb)`
      const REVIEW = `select * from public.story_admin_submit_review($1, $2::jsonb)`
      const ATTEST = `select * from public.story_service_attest_validation($1, $2::jsonb)`
      let liveKey = ''

      await check('T21', '실제 PG17 두 연결 동시 발행(증명 있음): 두 번째는 원천/자리 잠금을 기다린 뒤 live_release_exists — 살아 있는 발행본 1개', async () => {
        const v3 = (await submit(A.producer, slots['story-b1']!, storyV3)).edition_version_id as string
        await submitReview(A.reviewer, v3, review('story-b1', storyV3Result))
        await attestVersion(v3)
        const r = await race({ who: A.admin, sql: PUBLISH, params: [v3] }, { who: A.admin, sql: PUBLISH, params: [v3] })
        must2(r, 'publish vs publish')
        if (!/story:live_release_exists/.test(r.second.msg)) throw new Error(`second publish: ${r.second.msg}`)
        liveKey = r.first.rows[0]!.release_key as string
        const live = await db.query<{ n: number }>(`select count(*)::int as n from story.releases where slot_id = $1 and withdrawn_at is null`, [slots['story-b1']])
        eq(live.rows[0]!.n, 1, 'one live release')
        return `${r.evidence}; second → ${r.second.msg}`
      })

      await check('T22', '실제 PG17 같은 학습자 두 연결: 동시 첫 위치 기록은 가장 먼 위치로 합쳐지고, 마지막 두 단위를 동시에 완료 표시해도 발행본 완료가 정확히 한 번 찍힌다', async () => {
        if (!liveKey) throw new Error('needs T21 release')
        const p = await race({ who: A.learner, sql: `select * from public.story_record_position($1, 3)`, params: [liveKey] },
          { who: A.learner, sql: `select * from public.story_record_position($1, 5)`, params: [liveKey] })
        must2(p, 'position vs position')
        eq(p.second.ok, true, `second position (${p.second.msg})`)
        const r = await progressOf(A.learner, liveKey)
        eq(r?.furthest_unit_index, 5, 'greatest wins')
        eq(r?.completed_at, null, 'positions never complete')
        for (let i = 0; i < UNITS - 2; i++) await done(A.learner6, liveKey, i)
        const c = await race({ who: A.learner6, sql: `select * from public.story_complete_unit($1, $2)`, params: [liveKey, UNITS - 2] },
          { who: A.learner6, sql: `select * from public.story_complete_unit($1, $2)`, params: [liveKey, UNITS - 1] })
        must2(c, 'complete vs complete')
        eq(c.second.ok, true, `second complete (${c.second.msg})`)
        eq(c.first.rows[0]?.completed, false, 'first of the last two is not yet complete')
        eq(c.second.rows[0]?.completed, true, 'second sees the first commit and completes')
        const fin = await progressOf(A.learner6, liveKey)
        eq(fin?.completed_unit_count, UNITS, 'all units counted')
        if (!fin?.completed_at) throw new Error('completed_at not set after concurrent completion of the last units')
        return `${p.evidence}; ${c.evidence}`
      })

      await check('T23', '실제 PG17 두 관리자 동시 철회: 한 번만 바뀌고 두 번째는 멱등(changed=false) · 철회 기록 1건', async () => {
        if (!liveKey) throw new Error('needs T21 release')
        const W = `select * from public.story_admin_withdraw($1, $2)`
        const r = await race({ who: A.admin, sql: W, params: [liveKey, '동시 철회 1'] }, { who: A.admin, sql: W, params: [liveKey, '동시 철회 2'] })
        must2(r, 'withdraw vs withdraw')
        eq(r.first.rows[0]?.changed, true, 'first changed')
        eq(r.second.rows[0]?.changed, false, `second idempotent (${r.second.msg})`)
        const logs = await db.query<{ n: number }>(
          `select count(*)::int as n from story.action_log l join story.releases r on r.id = l.target_id where l.action = 'withdraw' and r.release_key = $1`, [liveKey])
        eq(logs.rows[0]!.n, 1, 'one withdraw log')
        return r.evidence
      })

      await check('T26', '실제 PG17 권리 보류 ↔ 발행: (가) 보류가 먼저면 발행은 원천 잠금을 기다린 뒤 rights_unconfirmed (나) 발행이 먼저면 보류는 기다린 뒤 기록되고 열람이 닫힌다', async () => {
        const snap = snapshotVariant('gull-rock-race-rights')
        const src = await registerSource(snap)
        const lane = await registerLane(src, snap, policyJson)
        await rightsOn(A.admin, src, 'source_text', 'confirmed', 'test-only-human-evidence')
        const v = await readyVersion(lane, 'story-b1', null)
        await attestVersion(v.id)
        const hold = { who: A.admin, sql: RIGHTS, params: [src, 'source_text', 'hold', '동시 보류', null] }
        const pub = { who: A.admin, sql: PUBLISH, params: [v.id] }
        const a = await race(hold, pub)
        must2(a, '(가) hold → publish')
        if (!/story:rights_unconfirmed/.test(a.second.msg)) throw new Error(`(가) publish after hold: ${a.second.msg}`)
        const none = await db.query<{ n: number }>(`select count(*)::int as n from story.releases where slot_id = $1`, [lane.slots['story-b1']])
        eq(none.rows[0]!.n, 0, '(가) nothing published')
        await rightsOn(A.admin, src, 'source_text', 'confirmed', 'test-only-human-evidence-2')
        const b = await race(pub, hold)
        must2(b, '(나) publish → hold')
        eq(b.second.ok, true, `(나) hold recorded (${b.second.msg})`)
        const key = b.first.rows[0]!.release_key as string
        eq(await catalogHas(A.anon, key), false, '(나) catalog closed after hold')
        await rejects(as(A.learner, `select * from public.story_read_unit($1, 0)`, [key]), /story:release_unavailable/, '(나) read closed')
        eq((await releaseRow(key)).withdrawn_at, null, '(나) release row kept')
        return `(가) ${a.evidence} → ${a.second.msg}; (나) ${b.evidence}`
      })

      await check('T27', '실제 PG17 새 판 제출 ↔ 이전 최신 판 발행: (가) 제출이 먼저면 발행은 기다린 뒤 not_latest_version (나) 발행이 먼저면 제출은 기다린 뒤 새 판이 되고 발행본은 그때의 최신 판', async () => {
        const lane = await freshLane('race-edition', policyVariant('gull-rock-race-edition'))
        const v1 = await readyVersion(lane, 'story-b1', 'race-ed-1')
        await attestVersion(v1.id)
        const v2art = editionIn(lane.ctx, 'story-b1', 'race-ed-2')
        const v2result = resultIn(lane.ctx, 'story-b1', v2art)
        const a = await race({ who: A.producer, sql: SUBMIT, params: [lane.slots['story-b1'], JSON.stringify(v2art)] },
          { who: A.admin, sql: PUBLISH, params: [v1.id] })
        must2(a, '(가) submit → publish')
        if (!/story:not_latest_version/.test(a.second.msg)) throw new Error(`(가) publish of previous latest: ${a.second.msg}`)
        const v2 = a.first.rows[0]!.edition_version_id as string
        await submitReview(A.reviewer, v2, reviewIn(lane.ctx, 'story-b1', v2result))
        await attestVersion(v2)
        const v3art = editionIn(lane.ctx, 'story-b1', 'race-ed-3')
        const b = await race({ who: A.admin, sql: PUBLISH, params: [v2] },
          { who: A.producer, sql: SUBMIT, params: [lane.slots['story-b1'], JSON.stringify(v3art)] })
        must2(b, '(나) publish → submit')
        eq(b.second.ok, true, `(나) submit after publish (${b.second.msg})`)
        const rel = await releaseRow(b.first.rows[0]!.release_key as string)
        eq(rel.edition_version_id, v2, '(나) published version')
        const seqs = await db.query<{ id: string }>(`select id from story.edition_versions where slot_id = $1 order by seq desc limit 1`, [lane.slots['story-b1']])
        eq(seqs.rows[0]!.id, b.second.rows[0]!.edition_version_id, '(나) the new submission is the latest afterwards')
        return `(가) ${a.evidence} → ${a.second.msg}; (나) ${b.evidence}`
      })

      await check('T28', '실제 PG17 새 검수 ↔ 발행: (가) 검수가 먼저면 발행은 기다린 뒤 validation_attestation_missing(증명 낡음) (나) 발행이 먼저면 검수는 기다린 뒤 저장되고 발행본 검수 목록 = 증명 결속', async () => {
        const lane = await freshLane('race-review', policyVariant('gull-rock-race-review'))
        const v = await readyVersion(lane, 'story-b1', 'race-rv')
        await attestVersion(v.id)
        const rvB = reviewIn(lane.ctx, 'story-b1', v.result, { review_id: 'b' })
        const a = await race({ who: A.reviewer, sql: REVIEW, params: [v.id, JSON.stringify(rvB)] }, { who: A.admin, sql: PUBLISH, params: [v.id] })
        must2(a, '(가) review → publish')
        if (!/story:validation_attestation_missing/.test(a.second.msg)) throw new Error(`(가) publish after new review: ${a.second.msg}`)
        const a2 = await attestVersion(v.id)
        const rvC = reviewIn(lane.ctx, 'story-b1', v.result, { review_id: 'c' })
        const b = await race({ who: A.admin, sql: PUBLISH, params: [v.id] }, { who: A.reviewer, sql: REVIEW, params: [v.id, JSON.stringify(rvC)] })
        must2(b, '(나) publish → review')
        eq(b.second.ok, true, `(나) review after publish (${b.second.msg})`)
        const rel = await releaseRow(b.first.rows[0]!.release_key as string)
        eq(JSON.stringify(rel.review_sha256s), JSON.stringify(a2.attestation.binding.review_sha256s), '(나) release reviews = attested reviews')
        eq(rel.validation_attestation_id, a2.id, '(나) release attestation')
        if ((rel.review_sha256s as string[]).includes(b.second.rows[0]!.review_sha256 as string)) throw new Error('(나) late review leaked into release')
        return `(가) ${a.evidence} → ${a.second.msg}; (나) ${b.evidence}`
      })

      await check('T29', '실제 PG17 검증 증명 ↔ 새 검수: (가) 검수가 먼저면 증명은 기다린 뒤 attestation_binding_mismatch (나) 증명이 먼저면 검수는 기다린 뒤 저장되고 그 증명은 발행에 낡음 → 재증명 뒤 발행', async () => {
        const lane = await freshLane('race-attest', policyVariant('gull-rock-race-attest'))
        const v = await readyVersion(lane, 'story-b1', 'race-at')
        const r1 = adapt(await validationInput(v.id))
        if (!r1.ok) throw new Error('adapter refused')
        const rvB = reviewIn(lane.ctx, 'story-b1', v.result, { review_id: 'b' })
        const a = await race({ who: A.reviewer, sql: REVIEW, params: [v.id, JSON.stringify(rvB)] },
          { who: A.service, sql: ATTEST, params: [v.id, JSON.stringify(r1.attestation)] })
        must2(a, '(가) review → attest')
        if (!/story:attestation_binding_mismatch/.test(a.second.msg)) throw new Error(`(가) attest after new review: ${a.second.msg}`)
        const r2 = adapt(await validationInput(v.id))
        if (!r2.ok) throw new Error('adapter refused (2 reviews)')
        const rvC = reviewIn(lane.ctx, 'story-b1', v.result, { review_id: 'c' })
        const b = await race({ who: A.service, sql: ATTEST, params: [v.id, JSON.stringify(r2.attestation)] },
          { who: A.reviewer, sql: REVIEW, params: [v.id, JSON.stringify(rvC)] })
        must2(b, '(나) attest → review')
        eq(b.second.ok, true, `(나) review after attest (${b.second.msg})`)
        await rejects(publish(A.admin, v.id), /story:validation_attestation_missing/, '(나) attestation stale after the late review')
        await attestVersion(v.id)
        const rel = await publish(A.admin, v.id)
        eq((await releaseRow(rel.release_key as string)).review_sha256s.length, 3, 'published with all three reviews')
        return `(가) ${a.evidence} → ${a.second.msg}; (나) ${b.evidence}`
      })

      await check('T40', '실제 PG17 H2: 같은 원천 · 같은 판본 키의 두 자리(기준 둘)를 동시에 발행 → 두 번째는 원천 잠금을 기다린 뒤 live_release_exists · 살아 있는 발행본 1개', async () => {
        const { src, snap } = await freshSource('h2-race')
        const lane1 = await registerLane(src, snap, policyJson)
        const lane2 = await registerLane(src, snap, policyWithExtraItem())
        const a = await readyVersion(lane1, 'story-b1', 'h2-race-1')
        await attestVersion(a.id)
        const b = await readyVersion(lane2, 'story-b1', 'h2-race-2')
        await attestVersion(b.id)
        const r = await race({ who: A.admin, sql: PUBLISH, params: [a.id] }, { who: A.admin, sql: PUBLISH, params: [b.id] })
        must2(r, 'publish slot1 vs publish slot2')
        if (!/story:live_release_exists/.test(r.second.msg)) throw new Error(`second slot publish: ${r.second.msg}`)
        const live = await db.query<{ n: number }>(
          `select count(*)::int as n from story.releases where source_id = $1 and edition_key = 'story-b1' and withdrawn_at is null`, [src])
        eq(live.rows[0]!.n, 1, 'one live story-b1 for the source')
        return `${r.evidence}; second → ${r.second.msg}`
      })

      await check('T43', '실제 PG17 H5: 같은 원천 스냅숏을 두 연결이 동시에 등록 → 두 번째는 기다린 뒤 created=false(23505 아님) · 같은 행 · 원천 행 1개', async () => {
        const snap = snapshotVariant('gull-rock-h5-race')
        const REG = `select * from public.story_admin_register_source($1::jsonb)`
        const r = await race({ who: A.producer, sql: REG, params: [JSON.stringify(snap)] }, { who: A.reviewer, sql: REG, params: [JSON.stringify(snap)] })
        must2(r, 'register vs register')
        eq(r.second.ok, true, `second register (${r.second.msg})`)
        eq(r.first.rows[0]?.created, true, 'first created')
        eq(r.second.rows[0]?.created, false, 'second created=false')
        eq(r.second.rows[0]?.source_id, r.first.rows[0]?.source_id, 'same source row')
        const n = await db.query<{ n: number }>(`select count(*)::int as n from story.sources where snapshot_id = 'gull-rock-h5-race'`)
        eq(n.rows[0]!.n, 1, 'one source row')
        return r.evidence
      })

      await check('T24', '러너: 이미 적용된 schema 재적용은 트랜잭션 안에서 DEPLOY_BLOCKED[already] 로 롤백', async () => {
        const r = await runner.applyStage(db, 'schema', { text: schemaSql, approvedBy })
        eq(r.ok, false, 'blocked')
        eq(r.outcome, 'rolled_back', 'outcome')
        if (!/DEPLOY_BLOCKED\[already\]/.test(r.error?.message ?? '')) throw new Error(r.error?.message ?? 'no error')
      })

      await check('T25', '러너: 본문이 원본 행을 바꾸면 원본 지문이 달라져 전체 롤백(story 스키마 · 이력 · 원본 모두 원래대로)', async () => {
        await engine.createDatabase!('lcp_story_impact')
        const c = await connect('lcp_story_impact')
        await c.query(BOOTSTRAP)
        const before = (await c.query<{ s: boolean }>(`select copyright_safe_in_kr as s from public.library_books where id = '10000000-0000-4000-8000-000000000002'`)).rows[0]!.s
        const tampered = `${schemaSql}\nupdate public.library_books set copyright_safe_in_kr = not copyright_safe_in_kr where id = '10000000-0000-4000-8000-000000000002';\n`
        const r = await runner.applyStage(c, 'schema', { text: tampered, approvedBy })
        eq(r.outcome, 'rolled_back', 'rolled back')
        if (!/DEPLOY_BLOCKED\[impact\]/.test(r.error?.message ?? '')) throw new Error(r.error?.message ?? 'no error')
        const after = await c.query<{ s: boolean; story: string | null; h: number }>(
          `select (select copyright_safe_in_kr from public.library_books where id = '10000000-0000-4000-8000-000000000002') as s,
                  to_regnamespace('story')::text as story,
                  (select count(*)::int from supabase_migrations.schema_migrations where version = $1) as h`, [runner.STAGES.schema!.version])
        eq(after.rows[0]!.s, before, 'legacy row restored')
        eq(after.rows[0]!.story, null, 'no story schema')
        eq(after.rows[0]!.h, 0, 'no history row')
      })
    }

    // ── 복구(격리) ────────────────────────────────────────────────────────────────
    const storyCounts = async () => (await db.query<{ c: string }>(
      `select (select count(*) from story.sources) || '/' || (select count(*) from story.releases) || '/'
           || (select count(*) from story.reading_progress) || '/' || (select count(*) from story.reading_unit_completions) || '/'
           || (select count(*) from story.validation_attestations) || '/' || (select count(*) from story.rights_decisions) || '/'
           || (select count(*) from story.action_log) as c`)).rows[0]!.c
    let countsBefore: string | null = null
    try { countsBefore = await storyCounts() } catch (e) { results.push({ id: 'T18-pre', title: '격리 전 행 수', status: 'fail', detail: errMsg(e) }) }
    let quarantinedByRunner = false
    if (engine.name === 'pg17') {
      await check('T18R', '러너 applyStage 로 quarantine 단계 적용(승인 SHA 고정 · 순서 검사) · 러너 사후 검증 통과', async () => {
        const problems: string[] = []
        const off = runner.offlineCheck('quarantine')
        if (off.blocks.length || !off.text) problems.push(`offlineCheck: ${off.blocks.join('; ')} (runner ${runner.STAGES.quarantine!.sha256} ≠ file ${sha256File(QUARANTINE_SQL)})`)
        const r = await runner.applyStage(db, 'quarantine', { text: quarantineSql, approvedBy })
        if (!r.ok) problems.push(`applyStage ${r.outcome}: ${r.error?.message ?? ''}`)
        else {
          quarantinedByRunner = true
          const v = await runner.runVerify(db, 'quarantine')
          if (!v.ok) problems.push(`quarantine verify: ${JSON.stringify(v.rows.filter((x) => !x.ok))}`)
        }
        if (problems.length) throw new Error(problems.join(' | '))
      })
    }
    await check('T18', '복구(격리) SQL: story RPC 16 실행 회수(서가 · 학습 · 관리 · 검증 증인 모두 닫힘) · 표 · 이력 · 증명 · 단위 완료 행 수 보존', async () => {
      let how = 'runner applyStage'
      if (!quarantinedByRunner) {
        // PGlite: 러너 없이 파일 바이트를 한 트랜잭션으로. pg17 에서 러너가 막았으면(T18R 실패) SQL 의미 시험만 이어 간다.
        await db.exec('begin')
        try { await db.exec(quarantineSql); await db.exec('commit') } catch (e) { await db.exec('rollback'); throw e }
        how = engine.name === 'pg17' ? 'direct (runner refused — see T18R)' : 'direct'
      }
      for (const [fn] of Object.entries(RPC)) {
        for (const role of ['public', 'anon', 'authenticated', 'service_role']) {
          const r = await db.query<{ p: boolean }>(`select has_function_privilege($1, $2, 'EXECUTE') as p`, [role, fn])
          eq(r.rows[0]!.p, false, `${role} ${fn} after quarantine`)
        }
      }
      for (const who of [A.anon, A.learner, A.admin]) {
        await rejects(as(who, `select * from public.story_catalog()`), /permission denied/, `${who.sub ?? who.role} catalog`)
      }
      await rejects(as(A.admin, `select * from public.story_admin_list_slots()`), /permission denied/, 'admin list')
      await rejects(as(A.learner, `select * from public.story_complete_unit($1, 0)`, [attKey]), /permission denied/, 'learner complete')
      await rejects(validationInput(storyV2Id), /permission denied/, 'service validation input')
      if (countsBefore === null) throw new Error('row counts before quarantine unavailable')
      eq(await storyCounts(), countsBefore, 'rows preserved')
      return `applied: ${how}`
    })

    await check('T19', '원본 도서 · 프로필 · texts · content_chunks · reading_sessions 는 전 과정 뒤에도 그대로다(학습 표 쓰기 없음)', async () => {
      eq(await legacyHash(), legacyBefore, 'legacy hash after all')
    })

    if (engine.name === 'pglite') {
      const why = 'PGlite 는 연결 하나뿐이라 두 트랜잭션을 동시에 돌릴 수 없다 — --engine pg17 --deps <dir> 에서 실제 PostgreSQL 17 두 연결로 돈다'
      notRun('T20', '러너 applyStage 실제 실행(T01 러너 경로 · T18R · T24 재적용 차단 · T25 지문 롤백)', 'PGlite 에는 러너 대상 pg 클라이언트 경로를 쓰지 않는다 — --engine pg17 에서 실행')
      notRun('T21', '동시 발행', why)
      notRun('T22', '동시 위치 · 마지막 단위 동시 완료', why)
      notRun('T23', '동시 철회', why)
      notRun('T26', '권리 보류 ↔ 발행 경합', why)
      notRun('T27', '새 판 제출 ↔ 발행 경합', why)
      notRun('T28', '새 검수 ↔ 발행 경합', why)
      notRun('T29', '검증 증명 ↔ 새 검수 경합', why)
      notRun('T40', 'H2 같은 원천 · 판본 키 두 자리 동시 발행 경합', why)
      notRun('T43', 'H5 같은 원천 스냅숏 동시 등록 경합', why)
    }

    const summary = {
      schema_sql: schemaPath === SCHEMA_SQL
        ? { path: 'supabase/migrations/_pending_lcp_story_s3_schema.sql', sha256: sha256File(SCHEMA_SQL) }
        : { path: schemaPath, sha256: sha256File(schemaPath), mutation_override: true },
      quarantine_sql: { path: 'supabase/migrations/_pending_lcp_story_s3_quarantine.sql', sha256: sha256File(QUARANTINE_SQL) },
      runner_stage_sha256: { schema: runner.STAGES.schema!.sha256, quarantine: runner.STAGES.quarantine!.sha256 },
      engine: engine.version,
      passed: results.filter((r) => r.status === 'pass').length,
      failed: results.filter((r) => r.status === 'fail').length,
      not_run: results.filter((r) => r.status === 'not_run').length,
      allow_not_run: ALLOW_NOT_RUN,
      exit_code: 0,
      results,
    }
    // 종료 코드: 실패 1 · 전부 통과지만 not_run 있음 3(--allow-not-run 이면 0) · 전부 통과하고 not_run 없음 0. 충돌 1.
    summary.exit_code = summary.failed > 0 ? 1 : summary.not_run > 0 && !ALLOW_NOT_RUN ? EXIT_NOT_RUN : 0
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
    process.exitCode = summary.exit_code
  } finally {
    await engine.stop()
  }
}

main().catch((e: unknown) => {
  process.stderr.write(`verify-isolated crashed: ${e instanceof Error ? e.stack ?? e.message : String(e)}\n`)
  process.exitCode = 1
})
