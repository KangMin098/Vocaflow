// apps/web/src/lib/library/story/__tests__/story-server.test.ts
//
// LCP Story S4 서버 로직 회귀 — 가짜 쿠키 · 서비스 클라이언트(호출 기록) + 실제 S2 검증기 · 실제 증명 어댑터.
// 실제 Supabase · 네트워크 · .env 값은 쓰지 않는다(클라이언트는 전부 이 파일이 만든 가짜다).
// 다루는 것: 스태프 인증(무인증 · DEV_ADMIN_BYPASS · 정지 · 학습자 · curator 의 admin 동작) → 호출 0 · 업로드 크기(읽기 전) · UTF-8 · JSON ·
// 후보 재검증(합성 · fixture 거부 · hold 초안) · 등록 RPC 순서 · 정확한 인자 · source_url 바이트 보존 · 부분 성공 ·
// 검수 낡은 결속 · 권리 · 발행 · 철회 · story:* 오류 대응 · 검증 증인 순서 · 같은 참조 · 실제 어댑터 왕복 · 결속 불일치 · 서브패스 export.

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it, vi } from 'vitest'

import * as storyPkg from '@vocaflow/library-pipeline/story'
import {
  buildValidationAttestation,
  decideEdition,
  requiredChecks,
  reviewBindingFor,
  validateEdition,
  validatePolicy,
  validateReview,
  validateSnapshot,
  type AttestationResult,
  type EditionResult,
  type PolicyContext,
  type SourceContext,
} from '@vocaflow/library-pipeline/story'

import {
  checkStoryCandidate,
  listStorySlots,
  loadStoryBundle,
  mapStoryRpcError,
  prospectiveReleaseKey,
  publishStory,
  recordStoryRights,
  registerStoryCandidate,
  submitStoryReview,
  withdrawStory,
  type StoryDbError,
  type StoryDeps,
  type StoryFormLike,
  type StoryRpcClient,
  type StoryRpcResponse,
  type StoryServiceClient,
} from '../admin'
import { STORY_MESSAGES } from '../messages'
import { STORY_UPLOAD_MAX_BYTES, type StoryFailure, type StoryResult } from '../types'
import { attestStoryValidation, type StoryWitnessDeps } from '../witness'

type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '../../../../../../..')
const FIXTURES = resolve(ROOT, 'packages/library-pipeline/src/story/fixtures')
const MIGRATION = resolve(ROOT, 'supabase/migrations/20261025094450_lcp_story_s3_schema.sql')

const NOW = new Date('2026-10-25T12:00:00+09:00')
const WORK = 'gull-rock-r1'
const VERSION_ID = '11111111-1111-4111-8111-111111111111'
const SOURCE_ID = '22222222-2222-4222-8222-222222222222'
const POLICY_ID = '33333333-3333-4333-8333-333333333333'
const SLOT_B1 = '44444444-4444-4444-8444-444444444444'
const SLOT_A2 = '55555555-5555-4555-8555-555555555555'
const ADMIN_UID = '66666666-6666-4666-8666-666666666666'
const CURATOR_UID = '77777777-7777-4777-8777-777777777777'
const REVIEW_ID = '88888888-8888-4888-8888-888888888888'
const ATTEST_ID = '99999999-9999-4999-8999-999999999999'
const RELEASE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const DECISION_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const RELEASE_KEY = `lsr_${'c'.repeat(32)}`
const URL_WITH_QUERY = 'https://example.org/stories/gull-rock?rev=1&lang=en&q=a%20b#para-3'

// ── 시험 자료(합성 픽스처에서 「실제 원천 형태」를 만들고 해시를 다시 계산한다 — 시험 전용) ─────────────

function fixture(name: string): Json {
  return JSON.parse(readFileSync(resolve(FIXTURES, `gull-rock.${name}.json`), 'utf8')) as Json
}

function realSnapshot(sourceUrl: string | null = URL_WITH_QUERY): Json {
  const s = fixture('snapshot')
  s.synthetic = false
  s.edition.source_kind = 'external_file'
  s.edition.source_url = sourceUrl
  s.rights = [{ asset: 'source_text', status: 'claimed_by_source', basis: '시험 전용 주장', evidence_ref: 'test-only', checked_by: null, checked_at: null }]
  return s
}

interface World {
  snapshot: Json
  policy: Json
  source: SourceContext
  policyCtx: PolicyContext
  story: Json
  storyResult: EditionResult
}

function world(sourceUrl: string | null = URL_WITH_QUERY): World {
  const snapshot = realSnapshot(sourceUrl)
  const src = validateSnapshot(snapshot, NOW)
  if (!src.value) throw new Error(JSON.stringify(src.errors))
  const policy = fixture('policy')
  const pol = validatePolicy(policy, src.value)
  if (!pol.value) throw new Error(JSON.stringify(pol.errors))
  const story = produce(src.value, pol.value, fixture('story-b1.edition.out'))
  return { snapshot, policy, source: src.value, policyCtx: pol.value, story, storyResult: editionResult(src.value, pol.value, story) }
}

function produce(source: SourceContext, policy: PolicyContext, art: Json, key = 'story-b1'): Json {
  art.produced_by = { agent: 'claude-code', session_id: 'producer-session', provenance: 'ai_generated' }
  art.binding = {
    source_sha256: source.sha256,
    source_identity_sha256: source.identity_sha256,
    policy_sha256: policy.policy_sha256,
    target_sha256: policy.items.get(key)!.target_sha256,
  }
  return art
}

function editionResult(source: SourceContext, policy: PolicyContext, art: Json, key = 'story-b1'): EditionResult {
  const r = validateEdition(art, { source, policy, edition_key: key, task_id: `${WORK}:${key}` })
  if (!r.value) throw new Error(JSON.stringify(r.errors))
  return r.value
}

function review(w: World, result: EditionResult = w.storyResult, over: Json = {}): Json {
  return {
    schema: 'lcp-story/review@1',
    review_id: 'review-story-b1',
    binding: reviewBindingFor({ source: w.source, policy: w.policyCtx, edition_key: 'story-b1', task_id: `${WORK}:story-b1` }, result),
    reviewer: { kind: 'ai_model', agent: 'codex', session_id: 'reviewer-session', role: '독립 내용 검수(시험)' },
    provenance: 'ai_review',
    checks: requiredChecks(result.edition).map((check) => ({ check, verdict: 'pass', note: '시험 입력' })),
    issues: [],
    verdict: 'approve',
    reviewed_at: '2026-10-25T10:00:00+09:00',
    ...over,
  }
}

function storedMeta(snapshot: Json): Json {
  const meta = { ...snapshot }
  delete meta.text
  delete meta.text_sha256
  return meta
}

function bundleFor(w: World, artifact: Json = w.story, over: Json = {}): Json {
  const ed = editionResult(w.source, w.policyCtx, artifact)
  return {
    source: {
      id: SOURCE_ID,
      meta: storedMeta(w.snapshot),
      body: w.snapshot.text,
      text_sha256: w.snapshot.text_sha256,
      identity_sha256: w.source.identity_sha256,
      correspondence: 'not_library_book',
      library_book_id: null,
      registered_by: CURATOR_UID,
      registered_at: '2026-10-25T09:00:00+09:00',
    },
    policy: { id: POLICY_ID, policy: w.policy, policy_sha256: w.policyCtx.policy_sha256 },
    slot: { id: SLOT_B1, edition_key: 'story-b1', production: w.policy.production[0], target_sha256: w.policyCtx.items.get('story-b1')!.target_sha256 },
    version: {
      id: VERSION_ID,
      artifact,
      edition_sha256: ed.edition_sha256,
      activities_sha256: ed.activities_sha256,
      submitted_by: CURATOR_UID,
      submitted_at: '2026-10-25T09:30:00+09:00',
      is_latest: true,
    },
    reviews: [],
    validation: { binding: {}, binding_sha256: 'd'.repeat(64), attested: false },
    rights_ok: false,
    rights: [],
    releases: [],
    ...over,
  }
}

/** DB story_service_validation_input 모양. */
function validationInput(w: World, reviews: Json[], over: Json = {}): Json {
  return {
    edition_version_id: VERSION_ID,
    edition_key: 'story-b1',
    snapshot: { ...storedMeta(w.snapshot), text: w.snapshot.text, text_sha256: w.snapshot.text_sha256 },
    policy: w.policy,
    artifact: w.story,
    reviews,
    ...over,
  }
}

// ── 가짜 클라이언트(호출 기록) ────────────────────────────────────────────

interface Call {
  who: 'cookie' | 'service' | 'factory' | 'build'
  op: string
  args?: Record<string, unknown>
}

type Handler = (args: Record<string, unknown> | undefined) => StoryRpcResponse | Promise<StoryRpcResponse>

interface FakeOpts {
  user?: { id: string } | null
  userError?: unknown
  profile?: { role: unknown; status: unknown } | null
  profileError?: StoryDbError
  rpc?: Record<string, Handler>
}

function cookieClient(log: Call[], opts: FakeOpts = {}): StoryRpcClient {
  const user = opts.user === undefined ? { id: ADMIN_UID } : opts.user
  const profile = opts.profile === undefined ? { role: 'admin', status: 'active' } : opts.profile
  return {
    auth: {
      async getUser() {
        log.push({ who: 'cookie', op: 'getUser' })
        return { data: { user }, error: opts.userError ?? null }
      },
    },
    from(table) {
      return {
        select(columns) {
          return {
            eq(column, value) {
              return {
                async maybeSingle() {
                  log.push({ who: 'cookie', op: `profile:${table}:${columns}:${column}=${value}` })
                  return { data: profile, error: opts.profileError ?? null }
                },
              }
            },
          }
        },
      }
    },
    async rpc(fn, args) {
      log.push({ who: 'cookie', op: fn, args })
      const h = opts.rpc?.[fn]
      if (!h) throw new Error(`unexpected cookie rpc ${fn}`)
      return h(args)
    },
  }
}

function serviceClient(log: Call[], handlers: Record<string, Handler>): StoryServiceClient {
  return {
    async rpc(fn, args) {
      log.push({ who: 'service', op: fn, args })
      const h = handlers[fn]
      if (!h) throw new Error(`unexpected service rpc ${fn}`)
      return h(args)
    },
  }
}

function deps(client: StoryRpcClient): StoryDeps {
  return { client, now: () => NOW }
}

function ok(data: unknown): StoryRpcResponse {
  return { data, error: null }
}

function dbError(message: string, details: string | null = null): StoryRpcResponse {
  return { data: null, error: { message, code: 'P0001', details, hint: null } }
}

function jsonFile(value: unknown, name = 'file.json'): File {
  return new File([JSON.stringify(value)], name, { type: 'application/json' })
}

function form(fields: Record<string, string | Blob>): FormData {
  const f = new FormData()
  for (const [k, v] of Object.entries(fields)) f.append(k, v)
  return f
}

function expectFailure<T>(r: StoryResult<T>): StoryFailure {
  if (r.ok) throw new Error(`expected failure, got ${JSON.stringify(r.data)}`)
  return r
}

function expectOk<T>(r: StoryResult<T>): T {
  if (!r.ok) throw new Error(`expected ok, got ${JSON.stringify(r)}`)
  return r.data
}

function rpcCalls(log: Call[]): string[] {
  return log.filter((c) => c.who === 'cookie' && c.op.startsWith('story_')).map((c) => c.op)
}

const AUTH_OPS = ['getUser', `profile:user_profiles:role, status:user_id=${ADMIN_UID}`]

// ── 1. 스태프 인증 ───────────────────────────────────────────────────────

type Runner = (d: StoryDeps, factory: () => StoryServiceClient) => Promise<StoryResult<unknown>>

const W = world()
const ALL_ACTIONS: Array<[string, Runner]> = [
  ['list', (d) => listStorySlots(d)],
  ['bundle', (d) => loadStoryBundle(d, VERSION_ID)],
  ['check', (d) => checkStoryCandidate(d, form({ source: jsonFile(W.snapshot) }))],
  ['register', (d) => registerStoryCandidate(d, form({ step: 'source', source: jsonFile(W.snapshot) }))],
  ['review', (d) => submitStoryReview(d, form({ edition_version_id: VERSION_ID, review: jsonFile(review(W)) }))],
  ['rights', (d) => recordStoryRights(d, { source_id: SOURCE_ID, asset: 'source_text', status: 'confirmed', basis: 'b', evidence_ref: 'e' })],
  ['attest', (d, factory) => attestStoryValidation({ ...d, createServiceClient: factory }, VERSION_ID)],
  ['publish', (d) => publishStory(d, VERSION_ID)],
  ['withdraw', (d) => withdrawStory(d, RELEASE_KEY, '사유')],
]

describe('스태프 인증 — 실패하면 그 뒤 호출 0', () => {
  const savedBypass = process.env.DEV_ADMIN_BYPASS
  const savedUser = process.env.DEV_ADMIN_USER_ID
  afterEach(() => {
    if (savedBypass === undefined) delete process.env.DEV_ADMIN_BYPASS
    else process.env.DEV_ADMIN_BYPASS = savedBypass
    if (savedUser === undefined) delete process.env.DEV_ADMIN_USER_ID
    else process.env.DEV_ADMIN_USER_ID = savedUser
  })

  it.each(ALL_ACTIONS)('%s: 로그인 없음 → auth_required, 프로필 · RPC · 서비스 클라이언트 0', async (_name, run) => {
    const log: Call[] = []
    const factory = vi.fn(() => serviceClient(log, {}))
    const f = expectFailure(await run(deps(cookieClient(log, { user: null })), factory))
    expect(f.code).toBe('auth_required')
    expect(f.stage).toBe('auth')
    expect(log.map((c) => c.op)).toEqual(['getUser'])
    expect(factory).not.toHaveBeenCalled()
  })

  it.each(ALL_ACTIONS)('%s: DEV_ADMIN_BYPASS=1 이어도 익명 쿠키 세션은 권한이 없다', async (_name, run) => {
    process.env.DEV_ADMIN_BYPASS = '1'
    process.env.DEV_ADMIN_USER_ID = ADMIN_UID
    const log: Call[] = []
    const factory = vi.fn(() => serviceClient(log, {}))
    const f = expectFailure(await run(deps(cookieClient(log, { user: null })), factory))
    expect(f.code).toBe('auth_required')
    expect(log.map((c) => c.op)).toEqual(['getUser'])
    expect(factory).not.toHaveBeenCalled()
  })

  it('getUser 오류 · 던짐도 거부(던짐 = network_failed, 재시도 가능)', async () => {
    const log: Call[] = []
    const f1 = expectFailure(await listStorySlots(deps(cookieClient(log, { userError: { message: 'jwt expired' } }))))
    expect(f1.code).toBe('auth_required')
    const throwing: StoryRpcClient = { ...cookieClient(log), auth: { getUser: () => Promise.reject(new Error('boom')) } }
    const f2 = expectFailure(await listStorySlots(deps(throwing)))
    expect(f2.code).toBe('network_failed')
    expect(f2.retryable).toBe(true)
    expect(rpcCalls(log)).toEqual([])
  })

  it.each([
    ['정지', { role: 'admin', status: 'suspended' }, 'account_inactive'],
    ['상태 null(이 라인은 active 만)', { role: 'admin', status: null }, 'account_inactive'],
    ['삭제', { role: 'curator', status: 'deleted' }, 'account_inactive'],
    ['학습자', { role: 'learner', status: 'active' }, 'staff_required'],
    ['역할 null', { role: null, status: 'active' }, 'staff_required'],
  ])('%s → %s, RPC 0', async (_label, profile, code) => {
    for (const [, run] of ALL_ACTIONS) {
      const log: Call[] = []
      const factory = vi.fn(() => serviceClient(log, {}))
      const f = expectFailure(await run(deps(cookieClient(log, { profile })), factory))
      expect(f.code).toBe(code)
      expect(f.stage).toBe('auth')
      expect(log.map((c) => c.op)).toEqual(AUTH_OPS)
      expect(factory).not.toHaveBeenCalled()
    }
  })

  it('프로필 없음 → staff_required · 프로필 조회 오류 → profile_unavailable', async () => {
    const log: Call[] = []
    expect(expectFailure(await publishStory(deps(cookieClient(log, { profile: null })), VERSION_ID)).code).toBe('staff_required')
    expect(expectFailure(await publishStory(deps(cookieClient(log, { profileError: { message: 'x' } })), VERSION_ID)).code).toBe('profile_unavailable')
    expect(rpcCalls(log)).toEqual([])
  })

  it('curator 는 권리 · 발행 · 철회 거부(admin_required, RPC 0)', async () => {
    const curator = { user: { id: CURATOR_UID }, profile: { role: 'curator', status: 'active' } }
    const runs: Array<(d: StoryDeps) => Promise<StoryResult<unknown>>> = [
      (d: StoryDeps) => recordStoryRights(d, { source_id: SOURCE_ID, asset: 'source_text', status: 'confirmed', basis: 'b', evidence_ref: 'e' }),
      (d: StoryDeps) => publishStory(d, VERSION_ID),
      (d: StoryDeps) => withdrawStory(d, RELEASE_KEY, '사유'),
    ]
    for (const run of runs) {
      const log: Call[] = []
      const f = expectFailure(await run(deps(cookieClient(log, curator))))
      expect(f.code).toBe('admin_required')
      expect(rpcCalls(log)).toEqual([])
    }
  })

  it('curator 는 목록을 쓸 수 있고, viewer 는 표시용 uid · role 이다', async () => {
    const log: Call[] = []
    const client = cookieClient(log, { user: { id: CURATOR_UID }, profile: { role: 'curator', status: 'active' }, rpc: { story_admin_list_slots: () => ok([]) } })
    const r = await listStorySlots(deps(client))
    expect(r.ok && r.viewer).toEqual({ uid: CURATOR_UID, role: 'curator' })
  })
})

// ── 2. 업로드 ────────────────────────────────────────────────────────────

describe('업로드 재검증 — 크기(읽기 전) · UTF-8 · JSON', () => {
  function formLike(map: Record<string, unknown>): StoryFormLike {
    return { get: (name) => (name in map ? map[name] : null) }
  }

  it('합계가 한도를 넘으면 파일을 읽기 전에 거부하고 RPC 0', async () => {
    const read = vi.fn(async () => new ArrayBuffer(0))
    const big = { size: STORY_UPLOAD_MAX_BYTES - 10, arrayBuffer: read }
    const extra = { size: 11, arrayBuffer: read }
    const log: Call[] = []
    const f = expectFailure(await registerStoryCandidate(deps(cookieClient(log)), formLike({ step: 'policy', source: big, policy: extra })))
    expect(f.code).toBe('upload_too_large')
    expect(f.stage).toBe('upload')
    expect(read).not.toHaveBeenCalled()
    expect(rpcCalls(log)).toEqual([])
  })

  it('한도 정확히는 통과 대상(크기 검사만 — 이어서 JSON 검사)', async () => {
    const bytes = new Uint8Array(STORY_UPLOAD_MAX_BYTES).fill(0x20)
    const blob = new Blob([bytes])
    const log: Call[] = []
    const f = expectFailure(await checkStoryCandidate(deps(cookieClient(log)), formLike({ source: blob })))
    expect(f.code).toBe('upload_invalid_json')
  })

  it('UTF-8 이 아니면 upload_invalid_utf8', async () => {
    const log: Call[] = []
    const f = expectFailure(await checkStoryCandidate(deps(cookieClient(log)), form({ source: new File([new Uint8Array([0x7b, 0xff, 0xfe, 0x7d])], 's.json') })))
    expect(f.code).toBe('upload_invalid_utf8')
    expect(f.issues[0].path).toBe('source')
  })

  it('JSON 이 아니면 upload_invalid_json(파일 내용을 오류에 싣지 않는다)', async () => {
    const log: Call[] = []
    const f = expectFailure(await checkStoryCandidate(deps(cookieClient(log)), form({ source: new File(['{"secret body text'], 's.json') })))
    expect(f.code).toBe('upload_invalid_json')
    expect(JSON.stringify(f)).not.toContain('secret body text')
  })

  it('필수 파일이 없거나 빈 파일이면 upload_missing_file', async () => {
    const log: Call[] = []
    expect(expectFailure(await checkStoryCandidate(deps(cookieClient(log)), form({}))).code).toBe('upload_missing_file')
    expect(expectFailure(await checkStoryCandidate(deps(cookieClient(log)), form({ source: new File([], 'empty.json') }))).code).toBe('upload_missing_file')
    expect(expectFailure(await registerStoryCandidate(deps(cookieClient(log)), form({ step: 'edition', source: jsonFile(W.snapshot), policy: jsonFile(W.policy) }))).issues.map((i) => i.path)).toEqual(['edition'])
    expect(rpcCalls(log)).toEqual([])
  })
})

// ── 3. 후보 검사 · 등록 ──────────────────────────────────────────────────

function registerHandlers(w: World, over: Partial<Record<string, Handler>> = {}): Record<string, Handler> {
  return {
    story_admin_register_source: () => ok([{ source_id: SOURCE_ID, identity_sha256: w.source.identity_sha256, text_sha256: w.source.sha256, created: true }]),
    story_admin_register_policy: () =>
      ok(
        [['easy-a2', SLOT_A2], ['story-b1', SLOT_B1]].map(([key, slot]) => ({
          policy_id: POLICY_ID,
          policy_sha256: w.policyCtx.policy_sha256,
          slot_id: slot,
          edition_key: key,
          target_sha256: w.policyCtx.items.get(key)!.target_sha256,
          created: true,
        })),
      ),
    story_admin_submit_edition: () =>
      ok([{ edition_version_id: VERSION_ID, edition_sha256: w.storyResult.edition_sha256, activities_sha256: w.storyResult.activities_sha256, created: true }]),
    ...over,
  } as Record<string, Handler>
}

function fullForm(w: World, step: string): FormData {
  return form({ step, source: jsonFile(w.snapshot), policy: jsonFile(w.policy), edition: jsonFile(w.story) })
}

describe('후보 검사(DB 쓰기 없음)', () => {
  it('실제 원천 형태 + 기준 + 판본 → importable, plan 은 hold(권리 주장 · 검수 없음), RPC 0', async () => {
    const log: Call[] = []
    const data = expectOk(await checkStoryCandidate(deps(cookieClient(log)), form({ source: jsonFile(W.snapshot), policy: jsonFile(W.policy), edition: jsonFile(W.story) })))
    expect(data.importable).toBe(true)
    expect(data.files.map((f) => [f.file, f.ok])).toEqual([['source', true], ['policy', true], ['edition', true]])
    expect(data.source?.identity_sha256).toBe(W.source.identity_sha256)
    expect(data.source?.paragraph_count).toBe(W.source.paragraphs.length)
    expect(data.policy?.editions.map((e) => e.edition_key)).toEqual(['story-b1', 'easy-a2'])
    expect(data.edition?.plan_status).toBe('hold')
    expect(data.edition?.plan_reasons.map((r) => r.code)).toEqual(expect.arrayContaining(['rights_unconfirmed:source_text', 'review_missing']))
    expect(rpcCalls(log)).toEqual([])
  })

  it('합성 픽스처는 importable=false · 원천 파일에 synthetic_not_allowed', async () => {
    const log: Call[] = []
    const data = expectOk(await checkStoryCandidate(deps(cookieClient(log)), form({ source: jsonFile(fixture('snapshot')), policy: jsonFile(fixture('policy')), edition: jsonFile(fixture('story-b1.edition.out')) })))
    expect(data.importable).toBe(false)
    expect(data.source?.synthetic).toBe(true)
    expect(data.files[0].issues.map((i) => i.code)).toContain('synthetic_not_allowed')
  })

  it('원천이 깨지면 기준 · 판본은 검사하지 않음(not_checked)', async () => {
    const broken = realSnapshot()
    broken.text = `${broken.text as string} extra`
    const data = expectOk(await checkStoryCandidate(deps(cookieClient([])), form({ source: jsonFile(broken), policy: jsonFile(W.policy), edition: jsonFile(W.story) })))
    expect(data.importable).toBe(false)
    expect(data.files[0].issues.map((i) => i.code)).toContain('text_hash_mismatch')
    expect(data.files[1].issues.map((i) => i.code)).toEqual(['not_checked'])
    expect(data.files[2].issues.map((i) => i.code)).toEqual(['not_checked'])
  })
})

describe('후보 등록 — 매번 전체 재검증 후 멱등 RPC 순서대로', () => {
  it('합성 픽스처(fixture_only 대상)는 어느 단계에서도 RPC 0 으로 거부', async () => {
    for (const step of ['source', 'policy', 'edition']) {
      const log: Call[] = []
      const f = expectFailure(
        await registerStoryCandidate(
          deps(cookieClient(log)),
          form({ step, source: jsonFile(fixture('snapshot')), policy: jsonFile(fixture('policy')), edition: jsonFile(fixture('story-b1.edition.out')) }),
        ),
      )
      expect(f.code).toBe('synthetic_not_allowed')
      expect(rpcCalls(log)).toEqual([])
    }
  })

  it('실제 원천에 합성 판본을 붙이면 검증 실패(RPC 0)', async () => {
    const art = structuredClone(W.story)
    art.produced_by.provenance = 'synthetic_fixture'
    const log: Call[] = []
    const f = expectFailure(await registerStoryCandidate(deps(cookieClient(log)), form({ step: 'edition', source: jsonFile(W.snapshot), policy: jsonFile(W.policy), edition: jsonFile(art) })))
    expect(f.stage).toBe('edition')
    expect(f.issues.map((i) => i.code)).toContain('synthetic_mismatch')
    expect(rpcCalls(log)).toEqual([])
  })

  it.each([URL_WITH_QUERY, null])('step=edition: source → policy → edition 순서 · 정확한 인자 · source_url 보존(%s) · hold 초안', async (url) => {
    const w = world(url)
    const log: Call[] = []
    const data = expectOk(await registerStoryCandidate(deps(cookieClient(log, { rpc: registerHandlers(w) })), fullForm(w, 'edition')))
    expect(rpcCalls(log)).toEqual(['story_admin_register_source', 'story_admin_register_policy', 'story_admin_submit_edition'])
    const [src, pol, ed] = log.filter((c) => c.op.startsWith('story_'))
    expect(Object.keys(src.args!)).toEqual(['p_snapshot'])
    expect(src.args!.p_snapshot).toEqual(w.snapshot)
    expect((src.args!.p_snapshot as Json).edition.source_url).toBe(url)
    expect(pol.args).toEqual({ p_source_id: SOURCE_ID, p_policy: w.policy })
    expect(ed.args).toEqual({ p_slot_id: SLOT_B1, p_artifact: w.story })
    expect(data.step).toBe('edition')
    expect(data.source).toEqual({ source_id: SOURCE_ID, identity_sha256: w.source.identity_sha256, text_sha256: w.source.sha256, created: true })
    expect(data.policy?.slots.map((s) => s.edition_key)).toEqual(['easy-a2', 'story-b1'])
    expect(data.edition).toEqual({
      slot_id: SLOT_B1,
      edition_version_id: VERSION_ID,
      edition_sha256: w.storyResult.edition_sha256,
      activities_sha256: w.storyResult.activities_sha256,
      created: true,
      plan_status: 'hold',
    })
  })

  it('source_url 의 쿼리 · 프래그먼트가 바뀌면 원천 정체가 달라진다(그대로 보내야 하는 이유)', () => {
    expect(world(URL_WITH_QUERY).source.identity_sha256).not.toBe(world('https://example.org/stories/gull-rock').source.identity_sha256)
    expect(world(null).source.identity_sha256).not.toBe(world(URL_WITH_QUERY).source.identity_sha256)
  })

  it('step=source · step=policy 는 그 단계까지만 부른다', async () => {
    const log1: Call[] = []
    const r1 = expectOk(await registerStoryCandidate(deps(cookieClient(log1, { rpc: registerHandlers(W) })), form({ step: 'source', source: jsonFile(W.snapshot) })))
    expect(rpcCalls(log1)).toEqual(['story_admin_register_source'])
    expect(r1.policy).toBeNull()
    const log2: Call[] = []
    const r2 = expectOk(await registerStoryCandidate(deps(cookieClient(log2, { rpc: registerHandlers(W) })), form({ step: 'policy', source: jsonFile(W.snapshot), policy: jsonFile(W.policy) })))
    expect(rpcCalls(log2)).toEqual(['story_admin_register_source', 'story_admin_register_policy'])
    expect(r2.policy?.policy_id).toBe(POLICY_ID)
    expect(r2.edition).toBeNull()
  })

  it('재등록(이어 가기)은 created=false 를 그대로 보여 준다', async () => {
    const handlers = registerHandlers(W, {
      story_admin_register_source: () => ok([{ source_id: SOURCE_ID, identity_sha256: W.source.identity_sha256, text_sha256: W.source.sha256, created: false }]),
    })
    const data = expectOk(await registerStoryCandidate(deps(cookieClient([], { rpc: handlers })), form({ step: 'source', source: jsonFile(W.snapshot) })))
    expect(data.source.created).toBe(false)
  })

  it('첫 RPC 전에 함께 올린 파일 전부를 검증한다(step=source 라도 깨진 기준이면 RPC 0)', async () => {
    const badPolicy = structuredClone(W.policy)
    badPolicy.source_sha256 = 'f'.repeat(64)
    const log: Call[] = []
    const f = expectFailure(await registerStoryCandidate(deps(cookieClient(log, { rpc: registerHandlers(W) })), form({ step: 'source', source: jsonFile(W.snapshot), policy: jsonFile(badPolicy) })))
    expect(f.stage).toBe('policy')
    expect(f.issues.map((i) => i.code)).toContain('policy_source_stale')
    expect(rpcCalls(log)).toEqual([])
  })

  it('뒤 단계 실패는 앞 단계 결과를 partial 로 돌려준다(원자적 롤백 아님)', async () => {
    const log: Call[] = []
    const f = expectFailure(
      await registerStoryCandidate(
        deps(cookieClient(log, { rpc: registerHandlers(W, { story_admin_submit_edition: () => dbError('story:edition_binding_stale') }) })),
        fullForm(W, 'edition'),
      ),
    )
    expect(f.code).toBe('story:edition_binding_stale')
    expect(f.partial?.source?.source_id).toBe(SOURCE_ID)
    expect(f.partial?.policy?.policy_id).toBe(POLICY_ID)
    expect(f.partial?.edition).toBeUndefined()

    const f2 = expectFailure(
      await registerStoryCandidate(
        deps(cookieClient([], { rpc: registerHandlers(W, { story_admin_register_policy: () => dbError('story:policy_source_stale') }) })),
        fullForm(W, 'edition'),
      ),
    )
    expect(f2.code).toBe('story:policy_source_stale')
    expect(f2.partial).toEqual({ step: 'edition', source: { source_id: SOURCE_ID, identity_sha256: W.source.identity_sha256, text_sha256: W.source.sha256, created: true } })
  })

  it('판본 키의 자리가 기준에 없으면 제출하지 않는다', async () => {
    const handlers = registerHandlers(W, {
      story_admin_register_policy: () =>
        ok([{ policy_id: POLICY_ID, policy_sha256: W.policyCtx.policy_sha256, slot_id: SLOT_A2, edition_key: 'easy-a2', target_sha256: 'e'.repeat(64), created: false }]),
    })
    const log: Call[] = []
    const f = expectFailure(await registerStoryCandidate(deps(cookieClient(log, { rpc: handlers })), fullForm(W, 'edition')))
    expect(f.code).toBe('edition_slot_missing')
    expect(rpcCalls(log)).toEqual(['story_admin_register_source', 'story_admin_register_policy'])
  })

  it('DB 원천 정체가 서버 계산과 다르면 실패(앞 단계 결과 동봉)', async () => {
    const handlers = registerHandlers(W, {
      story_admin_register_source: () => ok([{ source_id: SOURCE_ID, identity_sha256: 'f'.repeat(64), text_sha256: W.source.sha256, created: true }]),
    })
    const log: Call[] = []
    const f = expectFailure(await registerStoryCandidate(deps(cookieClient(log, { rpc: handlers })), fullForm(W, 'edition')))
    expect(f.code).toBe('source_identity_mismatch')
    expect(f.partial?.source?.source_id).toBe(SOURCE_ID)
    expect(rpcCalls(log)).toEqual(['story_admin_register_source'])
  })

  it('자산 선언이 있는 판본은 글 판본만 받는 지금 받지 않는다(RPC 0)', async () => {
    const art = structuredClone(W.story)
    art.assets = [{ asset_id: 'audio-1', kind: 'audio', origin: 'newly_produced', unit_ids: [art.units[0].unit_id], rights_status: 'confirmed', rights_evidence_ref: 'x', alignment: 'verified' }]
    const log: Call[] = []
    const f = expectFailure(await registerStoryCandidate(deps(cookieClient(log)), form({ step: 'edition', source: jsonFile(W.snapshot), policy: jsonFile(W.policy), edition: jsonFile(art) })))
    expect(f.stage).toBe('edition')
    expect(rpcCalls(log)).toEqual([])
  })

  it('잘못된 step → invalid_step, RPC 0', async () => {
    const log: Call[] = []
    expect(expectFailure(await registerStoryCandidate(deps(cookieClient(log)), form({ step: 'publish', source: jsonFile(W.snapshot) }))).code).toBe('invalid_step')
    expect(rpcCalls(log)).toEqual([])
  })
})

// ── 4. 검수 제출 ─────────────────────────────────────────────────────────

describe('검수 제출 — 저장값으로 지금 결속을 다시 계산', () => {
  function reviewForm(r: Json): FormData {
    return form({ edition_version_id: VERSION_ID, review: jsonFile(r) })
  }

  it('현재 결속 검수는 get_bundle → submit_review(정확한 인자)', async () => {
    const log: Call[] = []
    const rv = review(W)
    const client = cookieClient(log, {
      rpc: {
        story_admin_get_bundle: () => ok(bundleFor(W)),
        story_admin_submit_review: () => ok([{ review_id: REVIEW_ID, review_sha256: 'a'.repeat(64), qualifies: true, created: true }]),
      },
    })
    const data = expectOk(await submitStoryReview(deps(client), reviewForm(rv)))
    expect(rpcCalls(log)).toEqual(['story_admin_get_bundle', 'story_admin_submit_review'])
    expect(log.find((c) => c.op === 'story_admin_get_bundle')!.args).toEqual({ p_edition_version_id: VERSION_ID })
    expect(log.find((c) => c.op === 'story_admin_submit_review')!.args).toEqual({ p_edition_version_id: VERSION_ID, p_review: rv })
    expect(data).toEqual({ review_id: REVIEW_ID, review_sha256: 'a'.repeat(64), qualifies: true, created: true })
  })

  it('저장된 판이 바뀐 뒤의(낡은) 검수는 RPC 전에 거부하고 다른 결속 필드를 알려 준다', async () => {
    const changed = structuredClone(W.story)
    changed.units[3].text = (changed.units[3].text as string).replace('could not get up', 'could not stand up')
    const log: Call[] = []
    const client = cookieClient(log, { rpc: { story_admin_get_bundle: () => ok(bundleFor(W, changed)) } })
    const f = expectFailure(await submitStoryReview(deps(client), reviewForm(review(W))))
    expect(f.code).toBe('review_binding_stale')
    expect(f.issues.map((i) => i.path)).toEqual(['review.binding.edition_sha256'])
    expect(rpcCalls(log)).toEqual(['story_admin_get_bundle'])
  })

  it('결속을 손으로 고친 검수도 낡은 검수로 거부', async () => {
    const rv = review(W)
    rv.binding.policy_sha256 = 'f'.repeat(64)
    const log: Call[] = []
    const f = expectFailure(await submitStoryReview(deps(cookieClient(log, { rpc: { story_admin_get_bundle: () => ok(bundleFor(W)) } })), reviewForm(rv)))
    expect(f.code).toBe('review_binding_stale')
    expect(f.issues.map((i) => i.path)).toEqual(['review.binding.policy_sha256'])
    expect(rpcCalls(log)).toEqual(['story_admin_get_bundle'])
  })

  it.each([
    ['합성 검수', { provenance: 'synthetic_fixture' }, 'synthetic_not_allowed'],
    ['생산 세션 자기 검수', { reviewer: { kind: 'ai_model', agent: 'claude-code', session_id: 'producer-session', role: '자기 검수' } }, 'self_review_claim'],
    ['미래 시각', { reviewed_at: '2026-10-26T00:00:00+09:00' }, 'validation_failed'],
  ])('%s → %s (RPC 는 get_bundle 뿐)', async (_label, over, code) => {
    const log: Call[] = []
    const f = expectFailure(await submitStoryReview(deps(cookieClient(log, { rpc: { story_admin_get_bundle: () => ok(bundleFor(W)) } })), reviewForm(review(W, W.storyResult, over))))
    expect(f.code).toBe(code)
    expect(rpcCalls(log)).toEqual(['story_admin_get_bundle'])
  })

  it('최신 판이 아니면 검수하지 않는다', async () => {
    const b = bundleFor(W)
    b.version.is_latest = false
    const f = expectFailure(await submitStoryReview(deps(cookieClient([], { rpc: { story_admin_get_bundle: () => ok(b) } })), reviewForm(review(W))))
    expect(f.code).toBe('not_latest_version')
  })

  it('저장값이 지금 검증기를 통과하지 못하면 stored_invalid', async () => {
    const b = bundleFor(W)
    b.source.body = `${b.source.body as string} tampered`
    const f = expectFailure(await submitStoryReview(deps(cookieClient([], { rpc: { story_admin_get_bundle: () => ok(b) } })), reviewForm(review(W))))
    expect(f.code).toBe('stored_invalid')
    expect(f.stage).toBe('snapshot')
  })

  it('DB 자기 검수(제출 계정 = 검수 계정)는 두 스태프 안내로 대응', async () => {
    const client = cookieClient([], {
      rpc: { story_admin_get_bundle: () => ok(bundleFor(W)), story_admin_submit_review: () => dbError('story:self_review') },
    })
    const f = expectFailure(await submitStoryReview(deps(client), reviewForm(review(W))))
    expect(f.code).toBe('story:self_review')
    expect(f.recovery).toContain('두 개')
    expect(f.retryable).toBe(false)
  })

  it('잘못된 판 id 는 RPC 0', async () => {
    const log: Call[] = []
    const f = expectFailure(await submitStoryReview(deps(cookieClient(log)), form({ edition_version_id: 'not-a-uuid', review: jsonFile(review(W)) })))
    expect(f.code).toBe('invalid_input')
    expect(rpcCalls(log)).toEqual([])
  })
})

// ── 5. 목록 · 번들 ───────────────────────────────────────────────────────

describe('목록 · 번들', () => {
  it('bigint 수(문자열)를 숫자로 · 판 없는 자리는 latest_version_id=null 그대로', async () => {
    const row = {
      slot_id: SLOT_B1, work_key: 'gull-rock', edition_key: 'story-b1', kind: 'story_edition', coverage: 'complete_work', source_id: SOURCE_ID, policy_id: POLICY_ID,
      latest_version_id: null, version_count: '0', review_count: 0, qualifying_review_count: '0', live_release_key: null, withdrawn_release_count: '2',
    }
    const log: Call[] = []
    const data = expectOk(await listStorySlots(deps(cookieClient(log, { rpc: { story_admin_list_slots: () => ok([row]) } }))))
    expect(data.slots).toEqual([{ ...row, version_count: 0, qualifying_review_count: 0, withdrawn_release_count: 2 }])
    expect(log.find((c) => c.op === 'story_admin_list_slots')!.args).toEqual({})
  })

  it('예상 밖 응답은 rpc_unexpected_response', async () => {
    const f = expectFailure(await listStorySlots(deps(cookieClient([], { rpc: { story_admin_list_slots: () => ok([{ slot_id: 'x' }]) } }))))
    expect(f.code).toBe('rpc_unexpected_response')
  })

  it.each([URL_WITH_QUERY, null])('번들은 원천 메타(source_url %s)를 바이트 그대로 돌려준다', async (url) => {
    const w = world(url)
    const raw = bundleFor(w)
    const data = expectOk(await loadStoryBundle(deps(cookieClient([], { rpc: { story_admin_get_bundle: () => ok(raw) } })), VERSION_ID))
    expect((data.source.meta as Json).edition.source_url).toBe(url)
    // DB 응답은 그대로 두고, 서버가 계산한 화면 안내용 키 하나만 더한다(검수가 없으면 null).
    expect(data).toEqual({ ...raw, prospective_release_key: null })
  })

  it('목록 · 번들은 권리 · 증명 · 발행을 부르지 않는다(읽기 RPC 하나뿐)', async () => {
    const log: Call[] = []
    await listStorySlots(deps(cookieClient(log, { rpc: { story_admin_list_slots: () => ok([]) } })))
    await loadStoryBundle(deps(cookieClient(log, { rpc: { story_admin_get_bundle: () => ok(bundleFor(W)) } })), VERSION_ID)
    expect(rpcCalls(log)).toEqual(['story_admin_list_slots', 'story_admin_get_bundle'])
  })
})

// ── 6. 권리 · 발행 · 철회 ────────────────────────────────────────────────

describe('권리 결정 · 발행 · 철회(admin)', () => {
  it('권리: 다듬은 근거 · 근거 자료로 정확히 호출 → decision_id', async () => {
    const log: Call[] = []
    const client = cookieClient(log, { rpc: { story_admin_record_rights: () => ok(DECISION_ID) } })
    const data = expectOk(await recordStoryRights(deps(client), { source_id: SOURCE_ID, asset: 'source_text', status: 'confirmed', basis: '  PD 확인  ', evidence_ref: ' doc-1 ' }))
    expect(data).toEqual({ decision_id: DECISION_ID })
    expect(log.find((c) => c.op === 'story_admin_record_rights')!.args).toEqual({
      p_source_id: SOURCE_ID, p_asset: 'source_text', p_status: 'confirmed', p_basis: 'PD 확인', p_evidence_ref: 'doc-1',
    })
  })

  it('권리: hold 는 근거 자료 없이 null 로', async () => {
    const log: Call[] = []
    await recordStoryRights(deps(cookieClient(log, { rpc: { story_admin_record_rights: () => ok(DECISION_ID) } })), { source_id: SOURCE_ID, asset: 'source_text', status: 'hold', basis: '확인 중', evidence_ref: '' })
    expect(log.find((c) => c.op === 'story_admin_record_rights')!.args!.p_evidence_ref).toBeNull()
  })

  it.each([
    ['확인인데 근거 자료 없음', { status: 'confirmed', evidence_ref: '  ' }, 'evidence_ref'],
    ['근거 비움', { basis: '   ' }, 'basis'],
    ['알 수 없는 자산', { asset: 'video' }, 'asset'],
    ['알 수 없는 결정', { status: 'claimed_by_source' }, 'status'],
    ['원천 id 형식', { source_id: '1' }, 'source_id'],
    ['근거 너무 김', { basis: 'x'.repeat(2001) }, 'basis'],
  ])('권리 입력 오류(%s) → invalid_input, RPC 0', async (_label, over, path) => {
    const log: Call[] = []
    const f = expectFailure(await recordStoryRights(deps(cookieClient(log)), { source_id: SOURCE_ID, asset: 'source_text', status: 'confirmed', basis: '근거', evidence_ref: 'doc', ...over }))
    expect(f.code).toBe('invalid_input')
    expect(f.issues.map((i) => i.path)).toContain(path)
    expect(rpcCalls(log)).toEqual([])
  })

  it('발행: 쿠키 세션 RPC 하나 · 정확한 인자', async () => {
    const log: Call[] = []
    const data = expectOk(await publishStory(deps(cookieClient(log, { rpc: { story_admin_publish: () => ok([{ release_id: RELEASE_ID, release_key: RELEASE_KEY }]) } })), VERSION_ID))
    expect(data).toEqual({ release_id: RELEASE_ID, release_key: RELEASE_KEY })
    expect(log.filter((c) => c.op.startsWith('story_'))).toEqual([{ who: 'cookie', op: 'story_admin_publish', args: { p_edition_version_id: VERSION_ID } }])
  })

  it('철회: 사유 없으면 RPC 0 · 있으면 다듬어 호출', async () => {
    const log: Call[] = []
    expect(expectFailure(await withdrawStory(deps(cookieClient(log)), RELEASE_KEY, '   ')).code).toBe('story:withdraw_reason_required')
    expect(expectFailure(await withdrawStory(deps(cookieClient(log)), 'lsr_bad', '사유')).code).toBe('invalid_input')
    expect(rpcCalls(log)).toEqual([])
    const client = cookieClient(log, { rpc: { story_admin_withdraw: () => ok([{ release_key: RELEASE_KEY, withdrawn_at: '2026-10-25T12:00:00+09:00', changed: true }]) } })
    const data = expectOk(await withdrawStory(deps(client), RELEASE_KEY, ' 권리 보류 '))
    expect(data.changed).toBe(true)
    expect(log.find((c) => c.op === 'story_admin_withdraw')!.args).toEqual({ p_release_key: RELEASE_KEY, p_reason: '권리 보류' })
  })
})

// ── 7. story:* 오류 대응 ────────────────────────────────────────────────

describe('DB 오류 → 이해 가능한 안내', () => {
  it.each([
    ['story:self_review', '두 개'],
    ['story:publisher_is_producer', '두 개'],
    ['story:not_latest_version', '최신 판'],
    ['story:rights_unconfirmed', '권리'],
    ['story:validation_attestation_missing', '검증 실행'],
    ['story:live_release_exists', '철회'],
    ['story:assets_not_supported', '글 판본'],
    ['story:read_committed_required', '다시'],
  ])('%s', async (code, phrase) => {
    const client = cookieClient([], { rpc: { story_admin_publish: () => dbError(code) } })
    const f = expectFailure(await publishStory(deps(client), VERSION_ID))
    expect(f.code).toBe(code)
    expect(f.stage).toBe('rpc')
    expect(f.message.length).toBeGreaterThan(0)
    expect(f.recovery).toContain(phrase)
  })

  it('권리 미확인 상세(자산별 상태)는 보여 주고, 다른 내부 상세는 싣지 않는다', () => {
    const f = mapStoryRpcError({ message: 'story:rights_unconfirmed', details: 'source_text:hold' })
    expect(f.issues).toEqual([{ code: 'story:rights_unconfirmed', path: 'detail', message: 'source_text:hold' }])
    const g = mapStoryRpcError({ message: 'story:validation_attestation_missing', details: 'f'.repeat(64) })
    expect(g.issues).toEqual([])
  })

  it('코드가 details 에만 있어도 찾고, 권한 코드는 auth 단계로', () => {
    expect(mapStoryRpcError({ message: 'P0001', details: 'story:live_release_exists' }).code).toBe('story:live_release_exists')
    expect(mapStoryRpcError({ message: 'story:admin_required', code: '42501' }).stage).toBe('auth')
  })

  it('네트워크 · 모르는 오류 · 던짐', async () => {
    expect(mapStoryRpcError({ message: 'TypeError: fetch failed' })).toMatchObject({ code: 'network_failed', retryable: true })
    expect(mapStoryRpcError({ message: 'Could not find the function' })).toMatchObject({ code: 'rpc_failed' })
    const throwing = cookieClient([], { rpc: { story_admin_publish: () => Promise.reject(new Error('socket')) } })
    expect(expectFailure(await publishStory(deps(throwing), VERSION_ID))).toMatchObject({ code: 'network_failed', retryable: true })
  })

  it('마이그레이션의 모든 story:* 코드에 안내가 있다', () => {
    const sql = readFileSync(MIGRATION, 'utf8')
    const codes = [...new Set(sql.match(/'story:[a-z_]+'/g)!.map((s) => s.slice(1, -1)))]
    expect(codes.length).toBeGreaterThan(50)
    expect(codes.filter((c) => !(c in STORY_MESSAGES))).toEqual([])
  })
})

// ── 8. 검증 증인 ─────────────────────────────────────────────────────────

describe('검증 증인 — 스태프 확인 → 서비스 입력 그대로 → 실제 어댑터 → 통과 시에만 기록', () => {
  function witnessSetup(opts: { input?: (args: Record<string, unknown> | undefined) => StoryRpcResponse; attestBinding?: (expected: string) => string; build?: StoryWitnessDeps['buildAttestation']; now?: () => Date } = {}) {
    const log: Call[] = []
    const data = validationInput(W, [review(W)])
    const attested: Json[] = []
    let lastExpected = ''
    const svc = serviceClient(log, {
      story_service_validation_input: opts.input ?? (() => ok(data)),
      story_service_attest_validation: (args) => {
        attested.push(args!.p_attestation as Json)
        const real = buildValidationAttestation({ validationInput: data, now: NOW })
        lastExpected = real.ok ? real.bindingSha256 : ''
        return ok([{ attestation_id: ATTEST_ID, binding_sha256: opts.attestBinding ? opts.attestBinding(lastExpected) : lastExpected, created: true }])
      },
    })
    const factory = vi.fn(() => {
      log.push({ who: 'factory', op: 'createServiceClient' })
      return svc
    })
    const d: StoryWitnessDeps = { client: cookieClient(log), now: opts.now ?? (() => NOW), createServiceClient: factory }
    if (opts.build) d.buildAttestation = opts.build
    return { log, data, attested, factory, d }
  }

  it('정확한 호출 순서와 같은 참조 · 주입 시각', async () => {
    const injected = new Date(NOW.getTime())
    const now = vi.fn(() => injected)
    const build = vi.fn((input: { validationInput: unknown; now: Date }): AttestationResult => {
      return buildValidationAttestation(input)
    })
    const { log, data, d } = witnessSetup({ build, now })
    const loggingBuild: StoryWitnessDeps['buildAttestation'] = (input) => {
      log.push({ who: 'build', op: 'buildAttestation' })
      return build(input)
    }
    d.buildAttestation = loggingBuild
    const before = structuredClone(data)
    expectOk(await attestStoryValidation(d, VERSION_ID))
    expect(log.map((c) => `${c.who}:${c.op}`)).toEqual([
      'cookie:getUser',
      `cookie:profile:user_profiles:role, status:user_id=${ADMIN_UID}`,
      'factory:createServiceClient',
      'service:story_service_validation_input',
      'build:buildAttestation',
      'service:story_service_attest_validation',
    ])
    expect(log[3].args).toEqual({ p_edition_version_id: VERSION_ID })
    expect(build).toHaveBeenCalledTimes(1)
    expect(build.mock.calls[0][0].validationInput).toBe(data)
    expect(build.mock.calls[0][0].now).toBe(injected)
    expect(now).toHaveBeenCalledTimes(1)
    expect(data).toEqual(before)
  })

  it('실제 buildValidationAttestation 왕복 — 기록 RPC 에 실제 증명 그대로 · 결속 해시 일치면 성공', async () => {
    const { log, data, attested, d } = witnessSetup()
    const result = expectOk(await attestStoryValidation(d, VERSION_ID))
    const real = buildValidationAttestation({ validationInput: structuredClone(data), now: NOW })
    if (!real.ok) throw new Error('expected ok')
    expect(attested).toEqual([real.attestation])
    expect(log.find((c) => c.op === 'story_service_attest_validation')!.args).toEqual({ p_edition_version_id: VERSION_ID, p_attestation: real.attestation })
    expect(result).toEqual({ attestation_id: ATTEST_ID, binding_sha256: real.bindingSha256, created: true })
    expect(rpcCalls(log)).toEqual([])
  })

  it('S2 검증 실패 → 단계 · 오류를 돌려주고 기록 RPC 0', async () => {
    const synthetic = { ...validationInput(W, [review(W)]), snapshot: { ...storedMeta(fixture('snapshot')), text: fixture('snapshot').text, text_sha256: fixture('snapshot').text_sha256 } }
    const { log, d } = witnessSetup({ input: () => ok(synthetic) })
    const f = expectFailure(await attestStoryValidation(d, VERSION_ID))
    expect(f.code).toBe('validation_failed')
    expect(f.stage).toBe('snapshot')
    expect(f.issues.length).toBeGreaterThan(0)
    expect(log.map((c) => c.op)).not.toContain('story_service_attest_validation')
  })

  it('저장된 검수가 낡았으면(reviews 단계) 기록하지 않는다', async () => {
    const changed = structuredClone(W.story)
    changed.units[3].text = (changed.units[3].text as string).replace('could not get up', 'could not stand up')
    const { log, d } = witnessSetup({ input: () => ok(validationInput(W, [review(W)], { artifact: changed })) })
    const f = expectFailure(await attestStoryValidation(d, VERSION_ID))
    expect(f.stage).toBe('reviews')
    expect(f.issues.map((i) => i.code)).toContain('review_not_current')
    expect(log.map((c) => c.op)).not.toContain('story_service_attest_validation')
  })

  it('DB 가 기록한 결속 해시가 다르면 성공이 아니다', async () => {
    const { d } = witnessSetup({ attestBinding: () => 'f'.repeat(64) })
    expect(expectFailure(await attestStoryValidation(d, VERSION_ID)).code).toBe('witness_binding_mismatch')
  })

  it('입력의 판 id 가 요청과 다르면 어댑터 · 기록 0', async () => {
    const build = vi.fn(buildValidationAttestation)
    const { log, d } = witnessSetup({ input: () => ok(validationInput(W, [review(W)], { edition_version_id: SOURCE_ID })), build })
    expect(expectFailure(await attestStoryValidation(d, VERSION_ID)).code).toBe('witness_input_mismatch')
    expect(build).not.toHaveBeenCalled()
    expect(log.map((c) => c.op)).not.toContain('story_service_attest_validation')
  })

  it('입력 RPC 오류는 그대로 대응하고 어댑터 0', async () => {
    const build = vi.fn(buildValidationAttestation)
    const { d } = witnessSetup({ input: () => dbError('story:edition_version_not_found'), build })
    expect(expectFailure(await attestStoryValidation(d, VERSION_ID)).code).toBe('story:edition_version_not_found')
    expect(build).not.toHaveBeenCalled()
  })

  it('서비스 클라이언트를 만들 수 없으면 witness_unavailable · 잘못된 id 는 팩토리 0', async () => {
    const log: Call[] = []
    const failing: StoryWitnessDeps = { client: cookieClient(log), now: () => NOW, createServiceClient: () => { throw new Error('env missing') } }
    expect(expectFailure(await attestStoryValidation(failing, VERSION_ID)).code).toBe('witness_unavailable')
    const factory = vi.fn(() => serviceClient(log, {}))
    expect(expectFailure(await attestStoryValidation({ client: cookieClient(log), now: () => NOW, createServiceClient: factory }, 'x')).code).toBe('invalid_input')
    expect(factory).not.toHaveBeenCalled()
  })
})

// ── 9. 패키지 서브패스 export ────────────────────────────────────────────

describe('@vocaflow/library-pipeline/story', () => {
  it('검증기 · plan · 증명 어댑터를 내보내고 작업 폴더 · CLI 는 내보내지 않는다', () => {
    const mod = storyPkg as unknown as Record<string, unknown>
    for (const name of ['validateSnapshot', 'validatePolicy', 'validateEdition', 'validateReview', 'decideEdition', 'buildValidationAttestation', 'snapshotFromStored', 'reviewBindingFor']) {
      expect(typeof mod[name]).toBe('function')
    }
    for (const name of ['openWorkDir', 'planWork', 'validateWork', 'writeNoClobber', 'runStoryCli', 'parseStoryArgs']) {
      expect(mod[name]).toBeUndefined()
    }
  })
})

describe('예상 발행 키 — DB 결속에서 계산한 키가 S2 decideEdition 의 발행 키와 정확히 같다', () => {
  function confirmedWorld(): World {
    const snapshot = realSnapshot()
    snapshot.rights = [
      { asset: 'source_text', status: 'confirmed', basis: '시험 전용 확인 기록', evidence_ref: 'test-only', checked_by: 'tester', checked_at: '2026-10-25T08:00:00+09:00' },
    ]
    const src = validateSnapshot(snapshot, NOW)
    if (!src.value) throw new Error(JSON.stringify(src.errors))
    const policy = fixture('policy')
    const pol = validatePolicy(policy, src.value)
    if (!pol.value) throw new Error(JSON.stringify(pol.errors))
    const story = produce(src.value, pol.value, fixture('story-b1.edition.out'))
    return { snapshot, policy, source: src.value, policyCtx: pol.value, story, storyResult: editionResult(src.value, pol.value, story) }
  }

  it('검수 두 건(정렬 전 순서 뒤집음)으로 계산한 키 = decideEdition release_key · 검수가 없으면 null', () => {
    const w = confirmedWorld()
    const ctx = { source: w.source, policy: w.policyCtx, edition_key: 'story-b1', task_id: `${WORK}:story-b1` }
    const current = reviewBindingFor(ctx, w.storyResult)
    const raws = [review(w), review(w, w.storyResult, { review_id: 'review-story-b1-2', reviewer: { kind: 'ai_model', agent: 'codex', session_id: 'reviewer-session-2', role: '독립 내용 검수(시험)' } })]
    const evidence = raws.map((raw, i) => {
      const r = validateReview(raw, { edition_key: 'story-b1', current_binding: current, now: NOW })
      if (!r.value) throw new Error(JSON.stringify(r.errors))
      return { file: `review-${i}.json`, review: r.value.review, review_sha256: r.value.review_sha256, current: r.value.current }
    })
    const decision = decideEdition({ source: w.source, policy: w.policyCtx, edition_key: 'story-b1', edition_state: 'valid', edition: w.storyResult, reviews: evidence })
    expect(decision.status).toBe('candidate')
    const sorted = evidence.map((e) => e.review_sha256).sort()
    const binding = {
      source_sha256: w.source.sha256,
      source_identity_sha256: w.source.identity_sha256,
      policy_sha256: w.policyCtx.policy_sha256,
      target_sha256: w.policyCtx.items.get('story-b1')!.target_sha256,
      edition_sha256: w.storyResult.edition_sha256,
      activities_sha256: w.storyResult.activities_sha256,
      // 뒤집어 넣어도 같은 키(정렬은 함수 안에서) — DB 는 "C" 순으로 준다.
      review_sha256s: [...sorted].reverse(),
    }
    const bundle = bundleFor(w, w.story, { validation: { binding, binding_sha256: 'd'.repeat(64), attested: true } }) as unknown as Parameters<typeof prospectiveReleaseKey>[0]
    expect(prospectiveReleaseKey(bundle)).toBe(decision.release!.release_key)
    const noReviews = bundleFor(w, w.story, { validation: { binding: { ...binding, review_sha256s: [] }, binding_sha256: 'd'.repeat(64), attested: false } }) as unknown as Parameters<typeof prospectiveReleaseKey>[0]
    expect(prospectiveReleaseKey(noReviews)).toBeNull()
  })

  it('loadStoryBundle 이 화면 안내용 prospective_release_key 를 붙인다(읽기 RPC 하나뿐)', async () => {
    const w = confirmedWorld()
    const log: Call[] = []
    const binding = {
      source_sha256: w.source.sha256,
      source_identity_sha256: w.source.identity_sha256,
      policy_sha256: w.policyCtx.policy_sha256,
      target_sha256: w.policyCtx.items.get('story-b1')!.target_sha256,
      edition_sha256: w.storyResult.edition_sha256,
      activities_sha256: w.storyResult.activities_sha256,
      review_sha256s: ['e'.repeat(64)],
    }
    const data = bundleFor(w, w.story, { validation: { binding, binding_sha256: 'd'.repeat(64), attested: false } })
    const client = cookieClient(log, { rpc: { story_admin_get_bundle: () => ok(data) } })
    const r = expectOk(await loadStoryBundle(deps(client), VERSION_ID))
    expect(r.prospective_release_key).toMatch(/^lsr_[0-9a-f]{32}$/)
    expect(rpcCalls(log)).toEqual(['story_admin_get_bundle'])
  })
})
