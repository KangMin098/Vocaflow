// apps/web/src/lib/library/story/__tests__/story-learner.test.ts
//
// LCP Story S5 학습자 서버 로직 회귀 — 이 파일이 만든 가짜 쿠키 클라이언트(호출 기록)만 쓴다. 실제 Supabase · 네트워크 · .env 없음.
// 다루는 것: 학습자 판정(무인증 · 정지 · 삭제 · 프로필 없음 · 프로필 오류) → 학습자 RPC 0 · GET 로더는 위치 · 완료를 부르지 않음 ·
// 위치 ≠ 완료 · 응답 결속(발행 키 · 단위) · 입력 형식 거부(RPC 전) · 읽기 문맥 미적용 → reader_not_ready · 불일치 → reader_data_invalid ·
// 서가 실패 ≠ 빈 서가 · 진도 실패에도 서가 유지 · 다른 판본(자기 제외 · 실패 null) · 응답 검사기(모양 거부 · 해시 제거) ·
// 이용 불가 코드 대응 · source_url 바이트 보존 · viewerId = 쿠키 세션 uid · 서비스 주체 import 없음.

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  STORY_LEARNER_MESSAGES,
  completeStoryUnit,
  loadStoryCatalogPage,
  loadStoryReaderPage,
  mapStoryLearnerRpcError,
  parseStoryCatalog,
  parseStoryContextNotes,
  parseStoryGuidance,
  parseStoryProgress,
  parseStoryReaderContext,
  parseStoryUnitBody,
  parseStoryUnitCompletion,
  parseStoryUnitParam,
  recordStoryPosition,
  resolveStoryLearner,
  type StoryLearnerClient,
  type StoryLearnerRpcResponse,
} from '../learner'
import type { StoryLearnerFailureCode } from '../learner-types'

type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const HERE = dirname(fileURLToPath(import.meta.url))

const UID = '66666666-6666-4666-8666-666666666666'
const RK = `lsr_${'a'.repeat(32)}`
const RK_SIB = `lsr_${'b'.repeat(32)}`
const RK_OTHER = `lsr_${'c'.repeat(32)}`
const WORK = 'gull-rock'
const SHA_A = 'a'.repeat(64)
const SHA_B = 'b'.repeat(64)
const URL_WITH_QUERY = 'https://example.org/stories/gull-rock?rev=1&lang=en&q=a%20b#para-3 '
const BODY = 'The gull sat on the rock.\nIt looked at the sea.  '

// ── 자료 ────────────────────────────────────────────────────────────

function catalogRow(releaseKey: string, workKey = WORK, editionKey = 'b1'): Json {
  return {
    release_key: releaseKey,
    work_key: workKey,
    edition_key: editionKey,
    kind: 'story_edition',
    coverage: 'complete_work',
    completion_label: 'adapted_full_work',
    title: 'The Gull and the Rock',
    hook_text: 'A gull waits for something.',
    unit_count: 3,
    target_cefr: 'B1',
    published_at: '2026-10-25T03:00:00+00:00',
  }
}

const CATALOG = [catalogRow(RK), catalogRow(RK_SIB, WORK, 'a2'), catalogRow(RK_OTHER, 'other-work', 'b1')]

const CAUTIONS = ['동물을 해치는 장면이 짧게 나온다(합성)', '인물이 우는 장면(합성)']

function guidanceRow(releaseKey: string, overrides: Json = {}): Json {
  return { release_key: releaseKey, target_cefr: 'B1', cognitive_demand: 'high', background_load: 'moderate', cautions: releaseKey === RK ? CAUTIONS : [], ...overrides }
}

const GUIDANCE = CATALOG.map((r) => guidanceRow(r.release_key))

function progressRow(overrides: Json = {}): Json {
  return {
    release_key: RK,
    work_key: WORK,
    edition_key: 'b1',
    completion_label: 'adapted_full_work',
    counts_as_work_completion: true,
    counts_as_original_text_completion: false,
    last_unit_index: 1,
    furthest_unit_index: 2,
    completed_unit_count: 1,
    unit_count: 3,
    completed_at: null,
    release_available: true,
    ...overrides,
  }
}

function contextData(unitIndex = 0, overrides: Json = {}): Json {
  return {
    release_key: RK,
    work_key: WORK,
    edition_key: 'b1',
    kind: 'story_edition',
    coverage: 'complete_work',
    completion_label: 'adapted_full_work',
    counts_as_work_completion: true,
    counts_as_original_text_completion: false,
    title: 'The Gull and the Rock',
    unit_count: 3,
    progress: { last_unit_index: 1, furthest_unit_index: 1, completed_unit_count: 1, completed: false },
    toc: [
      { unit_index: 0, unit_title: 'Morning', completed: true },
      { unit_index: 1, unit_title: null, completed: false },
      { unit_index: 2, unit_title: 'Night', completed: false },
    ],
    unit: {
      unit_index: unitIndex,
      unit_title: [`Morning`, null, 'Night'][unitIndex],
      anchors: [
        { paragraph: 0, start: 0, end: 12, quote: 'A gull stood' },
        { paragraph: 2, start: 40, end: 58, quote: 'looked at the sea' },
      ],
      offset_unit: 'utf16_code_unit',
    },
    source: {
      identity_sha256: SHA_A,
      text_sha256: SHA_B,
      title: 'The Gull',
      author: 'A. Writer',
      original_language: 'en',
      text_language: 'en',
      translator: null,
      edition_label: 'First edition (1901)',
      coverage: 'complete_work',
      source_url: URL_WITH_QUERY,
    },
    ...overrides,
  }
}

function unitRow(unitIndex = 1, overrides: Json = {}): Json[] {
  return [{ release_key: RK, unit_index: unitIndex, unit_count: 3, unit_title: [`Morning`, null, 'Night'][unitIndex], unit_text: BODY, ...overrides }]
}

// ── 가짜 쿠키 클라이언트 ──────────────────────────────────────────────

type RpcHandler = (args: Record<string, unknown> | undefined) => StoryLearnerRpcResponse | Promise<StoryLearnerRpcResponse>

interface FakeOptions {
  user?: { id: string } | null
  userError?: unknown
  getUserThrows?: boolean
  profile?: { status?: unknown } | null
  profileError?: { message: string } | null
  profileThrows?: boolean
  rpc?: Partial<Record<string, RpcHandler>>
}

interface Fake {
  client: StoryLearnerClient
  log: string[]
  rpcCalls: Array<{ fn: string; args: Record<string, unknown> | undefined }>
  profileQueries: Array<{ table: string; columns: string; column: string; value: string }>
}

function ok(data: unknown): StoryLearnerRpcResponse {
  return { data, error: null }
}

function dbError(message: string, code?: string): StoryLearnerRpcResponse {
  return { data: null, error: { message, code, details: null, hint: null } }
}

const DEFAULT_RPC: Record<string, RpcHandler> = {
  story_catalog: () => ok(CATALOG),
  story_release_guidance: (args) => ok(args?.p_release_key ? GUIDANCE.filter((g) => g.release_key === args.p_release_key) : GUIDANCE),
  story_my_progress: () => ok([progressRow()]),
  story_reader_context: (args) => ok(contextData(Number(args?.p_unit_index ?? 0))),
  story_read_unit: (args) => ok(unitRow(Number(args?.p_unit_index))),
  story_unit_context_notes: (args) => ok({ release_key: args?.p_release_key, unit_index: args?.p_unit_index, notes: [] }),
  story_record_position: (args) =>
    ok([
      {
        release_key: args?.p_release_key,
        last_unit_index: args?.p_unit_index,
        furthest_unit_index: 2,
        completed_unit_count: 1,
        unit_count: 3,
        completed: false,
      },
    ]),
  story_complete_unit: (args) =>
    ok([
      {
        release_key: args?.p_release_key,
        unit_index: args?.p_unit_index,
        completed_unit_count: 2,
        unit_count: 3,
        completed: false,
        completion_label: 'adapted_full_work',
      },
    ]),
}

function fake(opts: FakeOptions = {}): Fake {
  const log: string[] = []
  const rpcCalls: Fake['rpcCalls'] = []
  const profileQueries: Fake['profileQueries'] = []
  const user = opts.user === undefined ? { id: UID } : opts.user
  const client: StoryLearnerClient = {
    auth: {
      getUser: async () => {
        log.push('getUser')
        if (opts.getUserThrows) throw new Error('fetch failed')
        return { data: { user }, error: opts.userError ?? null }
      },
    },
    from: (table) => ({
      select: (columns) => ({
        eq: (column, value) => ({
          maybeSingle: async () => {
            log.push('profile')
            profileQueries.push({ table, columns, column, value })
            if (opts.profileThrows) throw new Error('network')
            if (opts.profileError) return { data: null, error: opts.profileError }
            return { data: opts.profile === undefined ? { status: 'active' } : opts.profile, error: null }
          },
        }),
      }),
    }),
    rpc: async (fn, args) => {
      log.push(`rpc:${fn}`)
      rpcCalls.push({ fn, args })
      const handler = opts.rpc?.[fn] ?? DEFAULT_RPC[fn]
      if (!handler) return dbError(`unexpected rpc ${fn}`)
      return handler(args)
    },
  }
  return { client, log, rpcCalls, profileQueries }
}

const LEARNER_RPCS = ['story_my_progress', 'story_reader_context', 'story_read_unit', 'story_record_position', 'story_complete_unit']
const WRITE_RPCS = ['story_record_position', 'story_complete_unit']

function rpcNames(f: Fake): string[] {
  return f.rpcCalls.map((c) => c.fn)
}

function reader(f: Fake, unitParam: string | string[] | undefined = undefined, releaseKey = RK) {
  const returnPath = unitParam === undefined ? `/library/stories/${releaseKey}` : `/library/stories/${releaseKey}?unit=${String(unitParam)}`
  return loadStoryReaderPage({ client: f.client }, { releaseKey, unitParam, returnPath })
}

const UID_B = '77777777-7777-4777-8777-777777777777'
const POS = { releaseKey: RK, unitIndex: 1, reason: 'navigate' as const, expectedViewerId: UID }
const DONE = { releaseKey: RK, unitIndex: 1, expectedViewerId: UID }
const MUTATION_RPCS = ['story_record_position', 'story_complete_unit']

// ── 학습자 판정 ──────────────────────────────────────────────────────

describe('resolveStoryLearner — DB story.require_learner 와 같은 정책', () => {
  it('세션 없음 → auth_required, 프로필 조회조차 없음', async () => {
    const f = fake({ user: null })
    expect(await resolveStoryLearner(f.client)).toMatchObject({ ok: false, code: 'auth_required', retryable: false })
    expect(f.log).toEqual(['getUser'])
  })

  it('getUser 오류(세션 없음)는 auth_required · 인증 서버에 못 닿은 오류는 temporary', async () => {
    expect(await resolveStoryLearner(fake({ user: null, userError: { name: 'AuthSessionMissingError', status: 400 } }).client)).toMatchObject({
      code: 'auth_required',
    })
    expect(await resolveStoryLearner(fake({ user: null, userError: { name: 'AuthRetryableFetchError', status: 0 } }).client)).toMatchObject({
      code: 'temporary',
      retryable: true,
    })
    expect(await resolveStoryLearner(fake({ getUserThrows: true }).client)).toMatchObject({ code: 'temporary' })
  })

  it.each(['suspended', 'deleted'])('%s → account_blocked', async (status) => {
    expect(await resolveStoryLearner(fake({ profile: { status } }).client)).toMatchObject({ ok: false, code: 'account_blocked' })
  })

  it('프로필 행 없음 · active · 스태프 아닌 상태값은 통과(스태프 판정을 쓰지 않는다)', async () => {
    for (const profile of [null, { status: 'active' }, { status: null }, {}]) {
      expect(await resolveStoryLearner(fake({ profile }).client)).toEqual({ ok: true, userId: UID })
    }
  })

  it('프로필 조회 오류 · 예외는 닫는다(temporary)', async () => {
    expect(await resolveStoryLearner(fake({ profileError: { message: 'boom' } }).client)).toMatchObject({ ok: false, code: 'temporary' })
    expect(await resolveStoryLearner(fake({ profileThrows: true }).client)).toMatchObject({ ok: false, code: 'temporary' })
  })

  it('프로필은 쿠키 세션 uid 로만 status 열을 조회한다', async () => {
    const f = fake()
    await resolveStoryLearner(f.client)
    expect(f.profileQueries).toEqual([{ table: 'user_profiles', columns: 'status', column: 'user_id', value: UID }])
  })
})

// ── 서가 ───────────────────────────────────────────────────────────

describe('loadStoryCatalogPage', () => {
  it('비로그인: 서가는 보이고 진도 RPC 없음 · viewerId null', async () => {
    const f = fake({ user: null })
    const s = await loadStoryCatalogPage({ client: f.client })
    expect(s).toMatchObject({ status: 'ready', signedIn: false, viewerId: null, progress: null, progressError: null })
    if (s.status !== 'ready') throw new Error('ready expected')
    expect(s.releases.map((r) => r.releaseKey)).toEqual([RK, RK_SIB, RK_OTHER])
    expect(rpcNames(f)).toEqual(['story_catalog', 'story_release_guidance'])
  })

  it('로그인: 본인 진도 · viewerId = 쿠키 세션 uid · 위치 · 완료 RPC 없음', async () => {
    const f = fake()
    const s = await loadStoryCatalogPage({ client: f.client })
    expect(s).toMatchObject({ status: 'ready', signedIn: true, viewerId: UID, progressError: null })
    if (s.status !== 'ready') throw new Error('ready expected')
    expect(s.progress).toEqual([
      {
        releaseKey: RK,
        workKey: WORK,
        editionKey: 'b1',
        completionLabel: 'adapted_full_work',
        countsAsWorkCompletion: true,
        countsAsOriginalTextCompletion: false,
        lastUnitIndex: 1,
        furthestUnitIndex: 2,
        completedUnitCount: 1,
        unitCount: 3,
        completedAt: null,
        releaseAvailable: true,
      },
    ])
    expect(rpcNames(f)).toEqual(['story_catalog', 'story_release_guidance', 'story_my_progress'])
    expect(f.rpcCalls.every((c) => !c.args || !Object.values(c.args).includes(UID))).toBe(true)
  })

  it('서가 실패는 error(빈 서가가 아니다) · 진도도 부르지 않는다', async () => {
    const f = fake({ rpc: { story_catalog: () => dbError('fetch failed') } })
    expect(await loadStoryCatalogPage({ client: f.client })).toMatchObject({ status: 'error', failure: { code: 'temporary', retryable: true } })
    expect(rpcNames(f)).toEqual(['story_catalog'])
    const g = fake({ rpc: { story_catalog: () => ok(null) } })
    expect(await loadStoryCatalogPage({ client: g.client })).toMatchObject({ status: 'error', failure: { code: 'reader_data_invalid' } })
    const h = fake({ rpc: { story_catalog: () => { throw new Error('socket hang up') } } })
    expect(await loadStoryCatalogPage({ client: h.client })).toMatchObject({ status: 'error', failure: { code: 'temporary' } })
  })

  it('빈 서가는 실패가 아니다', async () => {
    const f = fake({ user: null, rpc: { story_catalog: () => ok([]) } })
    expect(await loadStoryCatalogPage({ client: f.client })).toMatchObject({ status: 'ready', releases: [] })
  })

  it('진도 실패 · 모양 불일치 → progress null + progressError, 서가는 그대로', async () => {
    for (const [handler, code] of [
      [() => dbError('timeout'), 'temporary'],
      [() => ok([progressRow({ counts_as_original_text_completion: true })]), 'reader_data_invalid'],
    ] as Array<[RpcHandler, StoryLearnerFailureCode]>) {
      const f = fake({ rpc: { story_my_progress: handler } })
      const s = await loadStoryCatalogPage({ client: f.client })
      expect(s).toMatchObject({ status: 'ready', signedIn: true, viewerId: UID, progress: null, progressError: { code } })
      if (s.status === 'ready') expect(s.releases).toHaveLength(3)
    }
  })

  it('정지 계정: signedIn true · 진도 RPC 없음 · progressError=account_blocked', async () => {
    const f = fake({ profile: { status: 'suspended' } })
    expect(await loadStoryCatalogPage({ client: f.client })).toMatchObject({
      status: 'ready',
      signedIn: true,
      viewerId: UID,
      progress: null,
      progressError: { code: 'account_blocked' },
    })
    expect(rpcNames(f)).toEqual(['story_catalog', 'story_release_guidance'])
  })

  it('프로필 오류: 진도 RPC 없음 · progressError=temporary', async () => {
    const f = fake({ profileError: { message: 'x' } })
    expect(await loadStoryCatalogPage({ client: f.client })).toMatchObject({ status: 'ready', progress: null, progressError: { code: 'temporary' } })
    expect(rpcNames(f)).toEqual(['story_catalog', 'story_release_guidance'])
  })
})

// ── 독서 화면 ────────────────────────────────────────────────────────

describe('loadStoryReaderPage', () => {
  it('입구(?unit 없음): 읽기 문맥(unit 0)만 · 본문 RPC 없음 · 다른 판본은 같은 작품 · 자기 제외', async () => {
    const f = fake()
    const s = await reader(f)
    expect(rpcNames(f)).toEqual(['story_reader_context', 'story_catalog', 'story_release_guidance'])
    expect(f.rpcCalls[0].args).toEqual({ p_release_key: RK, p_unit_index: 0 })
    expect(s).toMatchObject({ status: 'ready', viewerId: UID, unit: null })
    if (s.status !== 'ready') throw new Error('ready expected')
    expect(s.siblings?.map((r) => r.releaseKey)).toEqual([RK_SIB])
    // 이 발행본의 서가 메타(HOOK · 목표 CEFR)를 허용 목록 그대로 싣는다
    expect(s.release).toEqual({
      releaseKey: RK,
      workKey: WORK,
      editionKey: 'b1',
      kind: 'story_edition',
      coverage: 'complete_work',
      completionLabel: 'adapted_full_work',
      title: 'The Gull and the Rock',
      hookText: 'A gull waits for something.',
      unitCount: 3,
      targetCefr: 'B1',
      publishedAt: '2026-10-25T03:00:00+00:00',
    })
  })

  it('?unit=1: 문맥 · 본문 모두 같은 발행 키 · 단위 · 본문은 저장값 그대로', async () => {
    const f = fake()
    const s = await reader(f, '1')
    expect(rpcNames(f)).toEqual(['story_reader_context', 'story_read_unit', 'story_unit_context_notes', 'story_catalog'])
    expect(f.rpcCalls[0].args).toEqual({ p_release_key: RK, p_unit_index: 1 })
    expect(f.rpcCalls[1].args).toEqual({ p_release_key: RK, p_unit_index: 1 })
    expect(f.rpcCalls[2].args).toEqual({ p_release_key: RK, p_unit_index: 1 })
    if (s.status !== 'ready') throw new Error('ready expected')
    expect(s.unit).toEqual({ releaseKey: RK, unitIndex: 1, unitCount: 3, unitTitle: null, text: BODY })
    expect(s.context.unit.unitIndex).toBe(1)
  })

  it('GET 로더는 어떤 경우에도 위치 기록 · 단위 완료를 부르지 않는다', async () => {
    const cases: Array<[FakeOptions, string | undefined]> = [
      [{}, undefined],
      [{}, '0'],
      [{}, '2'],
      [{ user: null }, '1'],
      [{ profile: { status: 'deleted' } }, '1'],
      [{ rpc: { story_read_unit: () => dbError('story:unit_not_found') } }, '1'],
    ]
    for (const [opts, unit] of cases) {
      const f = fake(opts)
      await reader(f, unit)
      expect(rpcNames(f).filter((n) => WRITE_RPCS.includes(n))).toEqual([])
    }
    const c = fake()
    await loadStoryCatalogPage({ client: c.client })
    expect(rpcNames(c).filter((n) => WRITE_RPCS.includes(n))).toEqual([])
  })

  it('비로그인: signed_out + 로그인 복귀 URL + 서가 메타만(본문 · 문맥 RPC 없음)', async () => {
    const f = fake({ user: null })
    const s = await reader(f, '2')
    expect(s).toEqual({
      status: 'signed_out',
      loginHref: `/login?next=${encodeURIComponent(`/library/stories/${RK}?unit=2`)}`,
      release: expect.objectContaining({ releaseKey: RK, hookText: 'A gull waits for something.' }),
      guidance: { status: 'ready', guidance: { releaseKey: RK, targetCefr: 'B1', cognitiveDemand: 'high', backgroundLoad: 'moderate', cautions: CAUTIONS } },
    })
    expect(rpcNames(f)).toEqual(['story_catalog', 'story_release_guidance'])
    expect(JSON.stringify(s)).not.toContain(BODY)
  })

  it('비로그인 + 서가 실패 · 서가에 없는 키 → release null', async () => {
    const f = fake({ user: null, rpc: { story_catalog: () => dbError('fetch failed') } })
    expect(await reader(f)).toMatchObject({ status: 'signed_out', release: null })
    const g = fake({ user: null, rpc: { story_catalog: () => ok([catalogRow(RK_OTHER)]) } })
    expect(await reader(g)).toMatchObject({ status: 'signed_out', release: null })
  })

  it('안전하지 않은 복귀 경로는 /login 으로만', async () => {
    const f = fake({ user: null })
    const s = await loadStoryReaderPage({ client: f.client }, { releaseKey: RK, unitParam: undefined, returnPath: '//evil.example' })
    expect(s).toMatchObject({ status: 'signed_out', loginHref: '/login' })
  })

  it.each(['suspended', 'deleted'])('%s → blocked, 학습자 RPC 0', async (status) => {
    const f = fake({ profile: { status } })
    expect(await reader(f, '1')).toEqual({ status: 'blocked' })
    expect(rpcNames(f)).toEqual([])
  })

  it('프로필 오류 → unavailable(temporary), 학습자 RPC 0', async () => {
    const f = fake({ profileError: { message: 'x' } })
    expect(await reader(f, '1')).toMatchObject({ status: 'unavailable', failure: { code: 'temporary', retryable: true } })
    expect(rpcNames(f)).toEqual([])
  })

  it('잘못된 발행 키 · 단위 번호는 RPC · getUser 전에 invalid_input', async () => {
    const badKeys = ['', 'lsr_', `lsr_${'A'.repeat(32)}`, `lsr_${'a'.repeat(31)}`, `lsr_${'a'.repeat(33)}`, `xsr_${'a'.repeat(32)}`, `${RK}/x`]
    for (const key of badKeys) {
      const f = fake()
      expect(await reader(f, undefined, key)).toMatchObject({ status: 'unavailable', failure: { code: 'invalid_input' } })
      expect(f.log).toEqual([])
    }
    const badUnits: Array<string | string[]> = ['', '-1', '01', '1.0', ' 1', '1 ', '+1', '1e2', '10000', '99999', 'abc', '0x1', ['1', '2'], ['1']]
    for (const u of badUnits) {
      const f = fake()
      expect(await reader(f, u)).toMatchObject({ status: 'unavailable', failure: { code: 'invalid_input' } })
      expect(f.log).toEqual([])
    }
  })

  it('단위 번호 경계: 0 · 9999 는 형식상 통과', () => {
    expect(parseStoryUnitParam('0')).toEqual({ ok: true, unit: 0 })
    expect(parseStoryUnitParam('9999')).toEqual({ ok: true, unit: 9999 })
    expect(parseStoryUnitParam(undefined)).toEqual({ ok: true, unit: null })
  })

  it('읽기 문맥 RPC 가 없으면(S5 SQL 미적용) reader_not_ready — 본문 · 목차를 꾸며 내지 않는다', async () => {
    const missing: StoryLearnerRpcResponse[] = [
      dbError('Could not find the function public.story_reader_context(p_release_key, p_unit_index) in the schema cache', 'PGRST202'),
      dbError('function public.story_reader_context(text, integer) does not exist', '42883'),
      dbError('Could not find the function public.story_reader_context in the schema cache'),
    ]
    for (const res of missing) {
      const f = fake({ rpc: { story_reader_context: () => res } })
      const s = await reader(f, '1')
      expect(s).toEqual({ status: 'unavailable', failure: { ok: false, code: 'reader_not_ready', message: STORY_LEARNER_MESSAGES.reader_not_ready, retryable: false } })
      expect(rpcNames(f)).toEqual(['story_reader_context'])
    }
  })

  it('story:reader_context_mismatch → reader_data_invalid', async () => {
    const f = fake({ rpc: { story_reader_context: () => ({ data: null, error: { message: 'story:reader_context_mismatch', details: 'anchors' } }) } })
    expect(await reader(f, '1')).toMatchObject({ status: 'unavailable', failure: { code: 'reader_data_invalid', retryable: false } })
    expect(rpcNames(f)).toEqual(['story_reader_context'])
  })

  it('문맥 응답의 발행 키 · 단위가 요청과 다르면 reader_data_invalid(본문을 읽지 않는다)', async () => {
    for (const data of [contextData(1, { release_key: RK_SIB }), contextData(2)]) {
      const f = fake({ rpc: { story_reader_context: () => ok(data) } })
      expect(await reader(f, '1')).toMatchObject({ status: 'unavailable', failure: { code: 'reader_data_invalid' } })
      expect(rpcNames(f)).toEqual(['story_reader_context'])
    }
  })

  it('본문 응답이 문맥과 결속되지 않으면 reader_data_invalid', async () => {
    const bad: Json[][] = [
      unitRow(1, { release_key: RK_SIB }),
      unitRow(1, { unit_index: 2 }),
      unitRow(1, { unit_count: 4 }),
      unitRow(1, { unit_title: 'Other' }),
      unitRow(1, { unit_text: '' }),
      [],
      [...unitRow(1), ...unitRow(1)],
    ]
    for (const rows of bad) {
      const f = fake({ rpc: { story_read_unit: () => ok(rows) } })
      expect(await reader(f, '1')).toMatchObject({ status: 'unavailable', failure: { code: 'reader_data_invalid' } })
    }
  })

  it('서가 조회 실패 → release · siblings 모두 null(「없음」과 구분) · 본문은 그대로', async () => {
    const f = fake({ rpc: { story_catalog: () => dbError('fetch failed') } })
    const s = await reader(f, '1')
    expect(s).toMatchObject({ status: 'ready', release: null, siblings: null, unit: { text: BODY } })
    const g = fake({ rpc: { story_catalog: () => ok({ not: 'an array' }) } })
    expect(await reader(g)).toMatchObject({ status: 'ready', release: null, siblings: null })
  })

  it('같은 작품이 자기뿐이면 siblings [] · release 는 자기 행', async () => {
    const g = fake({ rpc: { story_catalog: () => ok([catalogRow(RK), catalogRow(RK_OTHER, 'other-work')]) } })
    expect(await reader(g)).toMatchObject({ status: 'ready', siblings: [], release: { releaseKey: RK } })
  })

  it('본문을 읽은 뒤 서가 재관찰에서 이 발행본이 사라졌으면(철회 · 보류) unavailable · 본문을 싣지 않는다', async () => {
    for (const unit of ['1', undefined]) {
      const f = fake({ rpc: { story_catalog: () => ok([catalogRow(RK_SIB, WORK, 'a2'), catalogRow(RK_OTHER, 'other-work')]) } })
      const s = await reader(f, unit)
      expect(s).toEqual({ status: 'unavailable', failure: { ok: false, code: 'release_unavailable', message: STORY_LEARNER_MESSAGES.release_unavailable, retryable: false } })
      expect(JSON.stringify(s)).not.toContain(BODY)
      expect(JSON.stringify(s)).not.toContain('A gull stood')
    }
  })

  it('서가 행이 읽기 문맥과 다른 발행본을 말하면 reader_data_invalid', async () => {
    for (const o of [{ title: 'Other' }, { unit_count: 4 }, { edition_key: 'a2' }, { completion_label: 'adapted_partial' }]) {
      const f = fake({ rpc: { story_catalog: () => ok([{ ...catalogRow(RK), ...o }]) } })
      expect(await reader(f, '1')).toMatchObject({ status: 'unavailable', failure: { code: 'reader_data_invalid' } })
    }
  })

  it('RPC 도중 세션 만료(story:auth_required) → signed_out · 차단(story:account_blocked) → blocked', async () => {
    const f = fake({ rpc: { story_reader_context: () => dbError('story:auth_required', '42501') } })
    expect(await reader(f, '1')).toMatchObject({ status: 'signed_out' })
    const g = fake({ rpc: { story_read_unit: () => dbError('story:account_blocked', '42501') } })
    expect(await reader(g, '1')).toEqual({ status: 'blocked' })
  })

  it('클라이언트가 던져도 throw 하지 않는다', async () => {
    const f = fake({ rpc: { story_reader_context: () => { throw new Error('ECONNRESET') } } })
    expect(await reader(f, '1')).toMatchObject({ status: 'unavailable', failure: { code: 'temporary' } })
  })
})

// ── 이용 불가 코드 대응(서가 · 직접 링크 · 본문 · 위치 · 완료 · 문맥) ─────────────────────────

describe('미발행 · 철회 · 권리 보류 = story:release_unavailable', () => {
  const unavailable = () => dbError('story:release_unavailable')

  it('서가: DB 가 목록에서 뺀 발행본은 직접 링크 비로그인 메타에도 없다', async () => {
    const f = fake({ user: null, rpc: { story_catalog: () => ok([catalogRow(RK_OTHER, 'other-work')]) } })
    expect(await reader(f)).toMatchObject({ status: 'signed_out', release: null })
  })

  it('직접 링크(문맥) · 본문 → unavailable(release_unavailable)', async () => {
    const a = fake({ rpc: { story_reader_context: unavailable } })
    expect(await reader(a)).toMatchObject({ status: 'unavailable', failure: { code: 'release_unavailable', retryable: false } })
    const b = fake({ rpc: { story_read_unit: unavailable } })
    expect(await reader(b, '1')).toMatchObject({ status: 'unavailable', failure: { code: 'release_unavailable' } })
    const c = fake({ rpc: { story_read_unit: () => dbError('story:unit_not_found') } })
    expect(await reader(c, '1')).toMatchObject({ status: 'unavailable', failure: { code: 'unit_not_found' } })
  })

  it('위치 · 완료 → release_unavailable · unit_not_found', async () => {
    const f = fake({ rpc: { story_record_position: unavailable, story_complete_unit: unavailable } })
    expect(await recordStoryPosition({ client: f.client }, POS)).toMatchObject({ ok: false, code: 'release_unavailable' })
    expect(await completeStoryUnit({ client: f.client }, DONE)).toMatchObject({ ok: false, code: 'release_unavailable' })
    const g = fake({ rpc: { story_record_position: () => dbError('story:unit_not_found'), story_complete_unit: () => dbError('story:unit_not_found') } })
    expect(await recordStoryPosition({ client: g.client }, POS)).toMatchObject({ ok: false, code: 'unit_not_found' })
    expect(await completeStoryUnit({ client: g.client }, DONE)).toMatchObject({ ok: false, code: 'unit_not_found' })
  })

  it('철회 · 보류된 발행본도 내 진도 이력으로 남는다(releaseAvailable=false)', async () => {
    const f = fake({ rpc: { story_my_progress: () => ok([progressRow({ release_available: false })]) } })
    const s = await loadStoryCatalogPage({ client: f.client })
    if (s.status !== 'ready') throw new Error('ready expected')
    expect(s.progress?.[0].releaseAvailable).toBe(false)
  })
})

// ── 명시적 행동 ──────────────────────────────────────────────────────

describe('recordStoryPosition · completeStoryUnit', () => {
  it('위치 기록: 읽기 문맥 확인 → story_record_position(완료 RPC 없음) · viewerId = 쿠키 세션 uid', async () => {
    const f = fake()
    const r = await recordStoryPosition({ client: f.client }, POS)
    expect(r).toEqual({
      ok: true,
      data: { viewerId: UID, releaseKey: RK, lastUnitIndex: 1, furthestUnitIndex: 2, completedUnitCount: 1, unitCount: 3, completed: false },
    })
    expect(rpcNames(f)).toEqual(['story_reader_context', 'story_record_position'])
    expect(f.rpcCalls.map((c) => c.args)).toEqual([
      { p_release_key: RK, p_unit_index: 1 },
      { p_release_key: RK, p_unit_index: 1 },
    ])
  })

  it('단위 완료: 읽기 문맥 확인 → story_complete_unit(위치 RPC 없음)', async () => {
    const f = fake()
    const r = await completeStoryUnit({ client: f.client }, DONE)
    expect(r).toEqual({
      ok: true,
      data: { viewerId: UID, releaseKey: RK, unitIndex: 1, completedUnitCount: 2, unitCount: 3, completed: false, completionLabel: 'adapted_full_work' },
    })
    expect(rpcNames(f)).toEqual(['story_reader_context', 'story_complete_unit'])
  })

  it('같은 단위 완료 재호출은 DB 결과 그대로(멱등은 DB 가 보장)', async () => {
    const f = fake()
    const a = await completeStoryUnit({ client: f.client }, DONE)
    const b = await completeStoryUnit({ client: f.client }, DONE)
    expect(a).toEqual(b)
    expect(rpcNames(f)).toEqual(['story_reader_context', 'story_complete_unit', 'story_reader_context', 'story_complete_unit'])
  })

  it('호출마다 학습자 판정 → 읽기 문맥 → 저장 순서로 다시 한다', async () => {
    const f = fake()
    await recordStoryPosition({ client: f.client }, POS)
    await completeStoryUnit({ client: f.client }, DONE)
    expect(f.log).toEqual([
      'getUser',
      'profile',
      'rpc:story_reader_context',
      'rpc:story_record_position',
      'getUser',
      'profile',
      'rpc:story_reader_context',
      'rpc:story_complete_unit',
    ])
  })

  it('전제 본인(A) ≠ 지금 쿠키 세션(B) → viewer_changed · 문맥 · 저장 RPC 0(두 액션)', async () => {
    const f = fake({ user: { id: UID_B } })
    const pos = await recordStoryPosition({ client: f.client }, POS)
    const done = await completeStoryUnit({ client: f.client }, DONE)
    for (const r of [pos, done]) {
      expect(r).toEqual({ ok: false, code: 'viewer_changed', message: STORY_LEARNER_MESSAGES.viewer_changed, retryable: false })
      expect(JSON.stringify(r)).not.toContain(UID)
      expect(JSON.stringify(r)).not.toContain(UID_B)
    }
    expect(f.log).toEqual(['getUser', 'profile', 'getUser', 'profile'])
    expect(rpcNames(f)).toEqual([])
  })

  it('전제 uid 는 대소문자까지 정확히 같아야 한다(다르면 저장 없음)', async () => {
    const lower = 'abcdef00-1111-4111-8111-abcdefabcdef'
    const f = fake({ user: { id: lower } })
    expect(await recordStoryPosition({ client: f.client }, { ...POS, expectedViewerId: lower.toUpperCase() })).toMatchObject({
      code: 'viewer_changed',
    })
    expect(rpcNames(f)).toEqual([])
    expect(await recordStoryPosition({ client: f.client }, { ...POS, expectedViewerId: lower })).toMatchObject({ ok: true, data: { viewerId: lower } })
  })

  it('저장 전 읽기 문맥이 없으면(S5 SQL 미적용) reader_not_ready · 저장 RPC 0', async () => {
    const f = fake({ rpc: { story_reader_context: () => dbError('Could not find the function public.story_reader_context', 'PGRST202') } })
    expect(await recordStoryPosition({ client: f.client }, POS)).toMatchObject({ ok: false, code: 'reader_not_ready', retryable: false })
    expect(await completeStoryUnit({ client: f.client }, DONE)).toMatchObject({ ok: false, code: 'reader_not_ready' })
    expect(rpcNames(f)).toEqual(['story_reader_context', 'story_reader_context'])
  })

  it('저장 전 읽기 문맥 거부 · 불일치 · 모양 불일치 → 대응 실패 · 저장 RPC 0', async () => {
    const cases: Array<[RpcHandler, StoryLearnerFailureCode]> = [
      [() => dbError('story:release_unavailable'), 'release_unavailable'],
      [() => dbError('story:unit_not_found'), 'unit_not_found'],
      [() => dbError('story:account_blocked', '42501'), 'account_blocked'],
      [() => dbError('story:auth_required', '42501'), 'auth_required'],
      [() => ({ data: null, error: { message: 'story:reader_context_mismatch', details: 'toc' } }), 'reader_data_invalid'],
      [() => ok(contextData(2)), 'reader_data_invalid'],
      [() => ok(contextData(1, { release_key: RK_SIB })), 'reader_data_invalid'],
      [() => ok(contextData(1, { counts_as_original_text_completion: true })), 'reader_data_invalid'],
      [() => ok(null), 'reader_data_invalid'],
      [() => dbError('fetch failed'), 'temporary'],
    ]
    for (const [handler, code] of cases) {
      const f = fake({ rpc: { story_reader_context: handler } })
      expect(await recordStoryPosition({ client: f.client }, POS)).toMatchObject({ ok: false, code })
      expect(await completeStoryUnit({ client: f.client }, DONE)).toMatchObject({ ok: false, code })
      expect(rpcNames(f).filter((n) => MUTATION_RPCS.includes(n))).toEqual([])
    }
  })

  it('무인증 · 정지 · 삭제 · 프로필 오류 → 학습자 RPC 0', async () => {
    const cases: Array<[FakeOptions, StoryLearnerFailureCode]> = [
      [{ user: null }, 'auth_required'],
      [{ profile: { status: 'suspended' } }, 'account_blocked'],
      [{ profile: { status: 'deleted' } }, 'account_blocked'],
      [{ profileError: { message: 'x' } }, 'temporary'],
      [{ getUserThrows: true }, 'temporary'],
    ]
    for (const [opts, code] of cases) {
      const f = fake(opts)
      expect(await recordStoryPosition({ client: f.client }, POS)).toMatchObject({ ok: false, code })
      expect(await completeStoryUnit({ client: f.client }, DONE)).toMatchObject({ ok: false, code })
      expect(rpcNames(f).filter((n) => LEARNER_RPCS.includes(n))).toEqual([])
    }
  })

  it('형식이 틀린 입력은 getUser · RPC 전에 invalid_input', async () => {
    const badPos: unknown[] = [
      null,
      'x',
      [],
      {},
      { ...POS, releaseKey: 'lsr_x' },
      { ...POS, unitIndex: -1 },
      { ...POS, unitIndex: 1.5 },
      { ...POS, unitIndex: '1' },
      { ...POS, unitIndex: 10000 },
      { ...POS, unitIndex: Number.NaN },
      { ...POS, reason: 'render' },
      { ...POS, reason: undefined },
      { releaseKey: RK, unitIndex: 1, reason: 'navigate' },
      { ...POS, expectedViewerId: undefined },
      { ...POS, expectedViewerId: null },
      { ...POS, expectedViewerId: '' },
      { ...POS, expectedViewerId: 'abc' },
      { ...POS, expectedViewerId: 123 },
      { ...POS, expectedViewerId: `${UID}x` },
      { ...POS, expectedViewerId: ` ${UID}` },
    ]
    for (const input of badPos) {
      const f = fake()
      expect(await recordStoryPosition({ client: f.client }, input)).toMatchObject({ ok: false, code: 'invalid_input' })
      expect(f.log).toEqual([])
    }
    const badDone: unknown[] = [
      null,
      {},
      { ...DONE, unitIndex: -1 },
      { ...DONE, unitIndex: '1' },
      { ...DONE, releaseKey: RK.toUpperCase() },
      { releaseKey: RK, unitIndex: 1 },
      { ...DONE, expectedViewerId: 'not-a-uuid' },
      { ...DONE, expectedViewerId: [UID] },
    ]
    for (const input of badDone) {
      const f = fake()
      expect(await completeStoryUnit({ client: f.client }, input)).toMatchObject({ ok: false, code: 'invalid_input' })
      expect(f.log).toEqual([])
    }
  })

  it('expectedViewerId · 여분 키(사용자 id 등)는 어떤 RPC 로도 넘기지 않는다', async () => {
    const f = fake()
    await recordStoryPosition({ client: f.client }, { ...POS, userId: 'attacker', p_user_id: 'attacker' })
    await completeStoryUnit({ client: f.client }, { ...DONE, userId: 'attacker' })
    expect(f.rpcCalls.map((c) => c.args)).toEqual([
      { p_release_key: RK, p_unit_index: 1 },
      { p_release_key: RK, p_unit_index: 1 },
      { p_release_key: RK, p_unit_index: 1 },
      { p_release_key: RK, p_unit_index: 1 },
    ])
    expect(JSON.stringify(f.rpcCalls)).not.toContain(UID)
  })

  it('응답 결속: 다른 발행 키 · 다른 단위 · 모양 불일치 → reader_data_invalid', async () => {
    const posBad: unknown[] = [
      [{ release_key: RK_SIB, last_unit_index: 1, furthest_unit_index: 2, completed_unit_count: 1, unit_count: 3, completed: false }],
      [{ release_key: RK, last_unit_index: 2, furthest_unit_index: 2, completed_unit_count: 1, unit_count: 3, completed: false }],
      [{ release_key: RK, last_unit_index: 1, furthest_unit_index: 0, completed_unit_count: 1, unit_count: 3, completed: false }],
      [{ release_key: RK, last_unit_index: 1, furthest_unit_index: 2, completed_unit_count: 1, unit_count: 3, completed: true }],
      [{ release_key: RK, last_unit_index: 1, furthest_unit_index: 3, completed_unit_count: 1, unit_count: 3, completed: false }],
      [],
      null,
    ]
    for (const data of posBad) {
      const f = fake({ rpc: { story_record_position: () => ok(data) } })
      expect(await recordStoryPosition({ client: f.client }, POS)).toMatchObject({ ok: false, code: 'reader_data_invalid' })
    }
    const doneBad: unknown[] = [
      [{ release_key: RK_SIB, unit_index: 1, completed_unit_count: 2, unit_count: 3, completed: false, completion_label: 'adapted_full_work' }],
      [{ release_key: RK, unit_index: 0, completed_unit_count: 2, unit_count: 3, completed: false, completion_label: 'adapted_full_work' }],
      [{ release_key: RK, unit_index: 1, completed_unit_count: 0, unit_count: 3, completed: false, completion_label: 'adapted_full_work' }],
      [{ release_key: RK, unit_index: 1, completed_unit_count: 2, unit_count: 3, completed: true, completion_label: 'adapted_full_work' }],
      [{ release_key: RK, unit_index: 1, completed_unit_count: 2, unit_count: 3, completed: false, completion_label: 'original_full_text' }],
      [{ release_key: RK, unit_index: 1, completed_unit_count: 2.5, unit_count: 3, completed: false, completion_label: 'adapted_partial' }],
    ]
    for (const data of doneBad) {
      const f = fake({ rpc: { story_complete_unit: () => ok(data) } })
      expect(await completeStoryUnit({ client: f.client }, DONE)).toMatchObject({ ok: false, code: 'reader_data_invalid' })
    }
  })

  it('전 단위 완료 결과(completed=true)는 그대로 통과', async () => {
    const f = fake({
      rpc: {
        story_complete_unit: () =>
          ok([{ release_key: RK, unit_index: 1, completed_unit_count: 3, unit_count: 3, completed: true, completion_label: 'adapted_partial' }]),
      },
    })
    expect(await completeStoryUnit({ client: f.client }, DONE)).toMatchObject({ ok: true, data: { completed: true, completionLabel: 'adapted_partial' } })
  })

  it('네트워크 · 알 수 없는 DB 오류 · 예외 → temporary(retryable) · DB 원문을 싣지 않는다', async () => {
    const f = fake({ rpc: { story_record_position: () => dbError('permission denied for table secret_x', '42501') } })
    const r = await recordStoryPosition({ client: f.client }, POS)
    expect(r).toEqual({ ok: false, code: 'temporary', message: STORY_LEARNER_MESSAGES.temporary, retryable: true })
    expect(JSON.stringify(r)).not.toContain('secret_x')
    const g = fake({ rpc: { story_complete_unit: () => { throw new Error('ECONNREFUSED') } } })
    expect(await completeStoryUnit({ client: g.client }, DONE)).toMatchObject({ ok: false, code: 'temporary', retryable: true })
  })
})

// ── 오류 대응 ────────────────────────────────────────────────────────

describe('mapStoryLearnerRpcError', () => {
  it('story:* 코드 대응 · 함수 없음은 읽기 문맥만 reader_not_ready', () => {
    const cases: Array<[string, StoryLearnerFailureCode]> = [
      ['story:auth_required', 'auth_required'],
      ['story:account_blocked', 'account_blocked'],
      ['story:release_unavailable', 'release_unavailable'],
      ['story:unit_not_found', 'unit_not_found'],
      ['story:reader_context_mismatch', 'reader_data_invalid'],
      ['story:something_new', 'temporary'],
    ]
    for (const [message, code] of cases) expect(mapStoryLearnerRpcError({ message }, 'story_read_unit').code).toBe(code)
    const missing = { message: 'Could not find the function', code: 'PGRST202' }
    expect(mapStoryLearnerRpcError(missing, 'story_reader_context').code).toBe('reader_not_ready')
    expect(mapStoryLearnerRpcError(missing, 'story_read_unit').code).toBe('temporary')
    expect(mapStoryLearnerRpcError({ message: 'relation "x" does not exist', code: '42P01' }, 'story_reader_context').code).toBe('temporary')
    expect(mapStoryLearnerRpcError({ message: 'x', details: 'story:unit_not_found' }, 'story_reader_context').code).toBe('unit_not_found')
  })

  it('모든 실패 문구는 한국어 한 줄 · 내부 용어 없음', () => {
    for (const msg of Object.values(STORY_LEARNER_MESSAGES)) {
      expect(msg).toMatch(/[가-힣]/)
      expect(msg).not.toMatch(/\n|rpc|sha|hash|story_|PGRST|해시/i)
    }
  })
})

// ── 응답 검사기 ──────────────────────────────────────────────────────

describe('parseStoryReaderContext', () => {
  const EXP = { releaseKey: RK, unitIndex: 0 }

  it('허용 목록만 · 해시 · offset_unit · 모르는 키를 버린다 · source_url 은 바이트 그대로', () => {
    const raw = contextData(0, { secret_internal_id: 'x', rights: [{ asset: 'source_text' }] })
    raw.source.extra = 'drop-me'
    raw.unit.anchors[0].source_sha256 = SHA_B
    const ctx = parseStoryReaderContext(raw, EXP)
    expect(ctx).not.toBeNull()
    const text = JSON.stringify(ctx)
    for (const leaked of [SHA_A, SHA_B, 'identity_sha256', 'text_sha256', 'offset_unit', 'secret_internal_id', 'rights', 'drop-me']) {
      expect(text).not.toContain(leaked)
    }
    expect(ctx?.source).toEqual({
      title: 'The Gull',
      author: 'A. Writer',
      originalLanguage: 'en',
      textLanguage: 'en',
      translator: null,
      editionLabel: 'First edition (1901)',
      coverage: 'complete_work',
      sourceUrl: URL_WITH_QUERY,
    })
    expect(ctx?.unit.anchors).toEqual([
      { paragraph: 0, start: 0, end: 12, quote: 'A gull stood' },
      { paragraph: 2, start: 40, end: 58, quote: 'looked at the sea' },
    ])
    expect(ctx?.countsAsOriginalTextCompletion).toBe(false)
    expect(ctx?.toc.map((t) => t.unitIndex)).toEqual([0, 1, 2])
  })

  it('source_url 은 javascript: 등도 손대지 않고 넘긴다(링크 안전은 화면 책임)', () => {
    for (const url of ['javascript:alert(1)', 'HTTP://Example.org/A%2F?x=1', null]) {
      const raw = contextData(0)
      raw.source.source_url = url
      expect(parseStoryReaderContext(raw, EXP)?.source.sourceUrl).toBe(url)
    }
  })

  it('진도 없음(null)은 허용 · 목차 완료가 있으면 거부', () => {
    const raw = contextData(0, { progress: null })
    expect(parseStoryReaderContext(raw, EXP)).toBeNull()
    raw.toc[0].completed = false
    expect(parseStoryReaderContext(raw, EXP)?.progress).toBeNull()
  })

  it('번역본: 원작 언어 ≠ 본문 언어면 번역자가 있어야 한다', () => {
    const raw = contextData(0)
    raw.source.original_language = 'fr'
    expect(parseStoryReaderContext(raw, EXP)).toBeNull()
    raw.source.translator = 'T. Ranslator'
    expect(parseStoryReaderContext(raw, EXP)?.source).toMatchObject({ originalLanguage: 'fr', translator: 'T. Ranslator' })
  })

  const mutations: Array<[string, (d: Json) => void]> = [
    ['not an object', (d) => Object.keys(d).forEach((k) => delete d[k])],
    ['kind unknown', (d) => (d.kind = 'comic')],
    ['coverage unknown', (d) => (d.coverage = 'abridged')],
    ['completion_label unknown', (d) => (d.completion_label = 'original_full_text')],
    ['label/work completion mismatch', (d) => (d.counts_as_work_completion = false)],
    ['original text completion true', (d) => (d.counts_as_original_text_completion = true)],
    ['original text completion missing', (d) => delete d.counts_as_original_text_completion],
    ['unit_count string', (d) => (d.unit_count = '3')],
    ['unit_count 0', (d) => (d.unit_count = 0)],
    ['title empty', (d) => (d.title = '')],
    ['toc short', (d) => d.toc.pop()],
    ['toc out of order', (d) => d.toc.reverse()],
    ['toc gap', (d) => (d.toc[1].unit_index = 5)],
    ['toc completed non-boolean', (d) => (d.toc[1].completed = 'no')],
    ['progress negative', (d) => (d.progress.last_unit_index = -1)],
    ['progress last > furthest', (d) => (d.progress.last_unit_index = 2)],
    ['progress furthest out of range', (d) => (d.progress.furthest_unit_index = 3)],
    ['progress fractional', (d) => (d.progress.completed_unit_count = 1.5)],
    ['progress count ≠ toc completions', (d) => (d.progress.completed_unit_count = 2)],
    ['progress completed but not all units', (d) => (d.progress.completed = true)],
    ['unit missing', (d) => delete d.unit],
    ['unit title ≠ toc', (d) => (d.unit.unit_title = 'Evening')],
    ['offset_unit missing', (d) => delete d.unit.offset_unit],
    ['anchors empty', (d) => (d.unit.anchors = [])],
    ['anchor start >= end', (d) => (d.unit.anchors[0].end = 0)],
    ['anchor negative', (d) => (d.unit.anchors[0].paragraph = -1)],
    ['anchor non-integer', (d) => (d.unit.anchors[0].start = 0.5)],
    ['anchor string number', (d) => (d.unit.anchors[0].end = '12')],
    ['anchor empty quote', (d) => (d.unit.anchors[0].quote = '')],
    ['source missing', (d) => delete d.source],
    ['source title missing', (d) => delete d.source.title],
    ['source edition_label missing', (d) => delete d.source.edition_label],
    ['source url missing', (d) => delete d.source.source_url],
    ['source url non-string', (d) => (d.source.source_url = 42)],
    ['source coverage episode', (d) => (d.source.coverage = 'episode')],
    ['source hash missing', (d) => delete d.source.text_sha256],
    ['source language bad', (d) => (d.source.text_language = 'EN')],
  ]

  it.each(mutations)('거부: %s', (_name, mutate) => {
    const raw = contextData(0)
    mutate(raw)
    expect(parseStoryReaderContext(raw, EXP)).toBeNull()
  })

  it('요청과 다른 발행 키 · 단위는 거부', () => {
    expect(parseStoryReaderContext(contextData(0), { releaseKey: RK_SIB, unitIndex: 0 })).toBeNull()
    expect(parseStoryReaderContext(contextData(0), { releaseKey: RK, unitIndex: 1 })).toBeNull()
    expect(parseStoryReaderContext(null, EXP)).toBeNull()
    expect(parseStoryReaderContext([contextData(0)], EXP)).toBeNull()
  })
})

describe('기타 응답 검사기', () => {
  it('서가: 행 하나라도 틀리면 전체 거부 · 중복 키 거부 · 허용 목록만', () => {
    expect(parseStoryCatalog([{ ...catalogRow(RK), source_id: 'x', body: 'leak' }])).toEqual([
      {
        releaseKey: RK,
        workKey: WORK,
        editionKey: 'b1',
        kind: 'story_edition',
        coverage: 'complete_work',
        completionLabel: 'adapted_full_work',
        title: 'The Gull and the Rock',
        hookText: 'A gull waits for something.',
        unitCount: 3,
        targetCefr: 'B1',
        publishedAt: '2026-10-25T03:00:00+00:00',
      },
    ])
    expect(parseStoryCatalog([catalogRow(RK), catalogRow(RK)])).toBeNull()
    expect(parseStoryCatalog([catalogRow(RK), { ...catalogRow(RK_SIB), kind: 'comic' }])).toBeNull()
    expect(parseStoryCatalog([{ ...catalogRow(RK), unit_count: -1 }])).toBeNull()
    expect(parseStoryCatalog([{ ...catalogRow(RK), release_key: 'lsr_bad' }])).toBeNull()
    expect(parseStoryCatalog({})).toBeNull()
  })

  it('내 진도: 원문 완독 true · 범위 밖 · 완료 시각인데 단위 미완 · 라벨 불일치 거부', () => {
    expect(parseStoryProgress([progressRow()])).toHaveLength(1)
    for (const o of [
      { counts_as_original_text_completion: true },
      { furthest_unit_index: 3 },
      { last_unit_index: 2, furthest_unit_index: 1 },
      { completed_at: '2026-10-25T00:00:00Z' },
      { counts_as_work_completion: false },
      { release_available: 'yes' },
      { completed_unit_count: 4 },
    ]) {
      expect(parseStoryProgress([progressRow(o)])).toBeNull()
    }
    expect(parseStoryProgress([progressRow({ completed_at: '2026-10-25T00:00:00Z', completed_unit_count: 3 })])?.[0].completedAt).toBe(
      '2026-10-25T00:00:00Z',
    )
  })

  it('본문: 저장값 그대로(앞뒤 공백 · 줄바꿈 · HTML 같은 글자도 손대지 않는다)', () => {
    const text = '  <b>not html</b>\n\nline two  '
    expect(parseStoryUnitBody([{ release_key: RK, unit_index: 0, unit_count: 1, unit_title: null, unit_text: text }])?.text).toBe(text)
    expect(parseStoryUnitBody([{ release_key: RK, unit_index: 1, unit_count: 1, unit_title: null, unit_text: 'x' }])).toBeNull()
  })

  it('완료: 라벨 허용 목록', () => {
    expect(parseStoryUnitCompletion([{ release_key: RK, unit_index: 0, completed_unit_count: 1, unit_count: 2, completed: false, completion_label: 'adapted_partial' }])).not.toBeNull()
    expect(parseStoryUnitCompletion([{ release_key: RK, unit_index: 0, completed_unit_count: 1, unit_count: 2, completed: false, completion_label: null }])).toBeNull()
  })
})

// ── 정적 경계(보조) ──────────────────────────────────────────────────

describe('정적 경계', () => {
  const learnerSrc = readFileSync(resolve(HERE, '../learner.ts'), 'utf8')
  const actionsSrc = readFileSync(resolve(HERE, '../../../../app/(main)/library/stories/actions.ts'), 'utf8')
  const saveWordSrc = readFileSync(resolve(HERE, '../save-word.ts'), 'utf8')

  it('서비스 주체 · DEV 우회 · 관리 RPC 를 쓰지 않는다', () => {
    for (const src of [learnerSrc, actionsSrc, saveWordSrc]) {
      expect(src).not.toMatch(/createAdminClient|supabase\/admin|service_role_key|SERVICE_ROLE|devAdminBypass|dev-bypass/i)
      expect(src).not.toMatch(/story_admin_|story_service_/)
      expect(src).not.toMatch(/console\.|funnel|track\(|analytics/)
    }
  })

  it('learner.ts 는 server-only · 시계를 읽지 않는다 · actions 는 use server + 쿠키 클라이언트', () => {
    expect(learnerSrc).toMatch(/^import 'server-only'$/m)
    expect(learnerSrc).not.toMatch(/Date\.now\(|new Date\(/)
    expect(actionsSrc).toMatch(/^'use server'$/m)
    expect(actionsSrc).toMatch(/from '@\/lib\/supabase\/server'/)
    // 위치 기록 · 단위 완료 · (D5-I01) 선택 낱말 저장 — 세 액션뿐
    expect(actionsSrc.match(/^export /gm)).toHaveLength(3)
    expect(saveWordSrc).toMatch(/^import 'server-only'$/m)
    expect(saveWordSrc).not.toMatch(/Date\.now\(|new Date\(/)
  })
})

// ── 시작 전 선택 안내(U1 · story_release_guidance — 제안 SQL 미적용 환경 포함) ─────────

describe('선택 안내 — 공개 읽기 · 실패는 「주의 없음」이 아니다', () => {
  const READY_A = { releaseKey: RK, targetCefr: 'B1', cognitiveDemand: 'high', backgroundLoad: 'moderate', cautions: CAUTIONS }

  it('서가: 이용 가능한 전부를 인자 없이 한 번(N+1 없음) · 비로그인 · 정지 계정에도 · 쓰기 RPC 없음', async () => {
    for (const opts of [{ user: null }, {}, { profile: { status: 'suspended' } }] as FakeOptions[]) {
      const f = fake(opts)
      const s = await loadStoryCatalogPage({ client: f.client })
      expect(f.rpcCalls.filter((c) => c.fn === 'story_release_guidance')).toEqual([{ fn: 'story_release_guidance', args: {} }])
      if (s.status !== 'ready' || s.guidance.status !== 'ready') throw new Error('ready expected')
      expect(Object.keys(s.guidance.byRelease).sort()).toEqual([RK, RK_SIB, RK_OTHER].sort())
      expect(s.guidance.byRelease[RK]).toEqual(READY_A)
      expect(s.guidance.byRelease[RK_SIB].cautions).toEqual([])
      expect(rpcNames(f).filter((n) => WRITE_RPCS.includes(n))).toEqual([])
    }
  })

  it('빈 서가는 안내를 부르지 않는다(ready · 빈 목록)', async () => {
    const f = fake({ user: null, rpc: { story_catalog: () => ok([]) } })
    expect(await loadStoryCatalogPage({ client: f.client })).toMatchObject({ guidance: { status: 'ready', byRelease: {} } })
    expect(rpcNames(f)).toEqual(['story_catalog'])
  })

  it('함수 없음(SQL 미적용 · PGRST202 · 42883) → not_ready · 결속 거부 → invalid · 일시 오류 → temporary — 서가 · 진도는 그대로', async () => {
    const cases: Array<[RpcHandler, string]> = [
      [() => dbError('Could not find the function public.story_release_guidance without parameters in the schema cache', 'PGRST202'), 'not_ready'],
      [() => dbError('function public.story_release_guidance() does not exist', '42883'), 'not_ready'],
      [() => dbError('story:guidance_mismatch'), 'invalid'],
      [() => dbError('timeout'), 'temporary'],
      [
        () => {
          throw new Error('socket hang up')
        },
        'temporary',
      ],
    ]
    for (const [handler, reason] of cases) {
      const f = fake({ rpc: { story_release_guidance: handler } })
      const s = await loadStoryCatalogPage({ client: f.client })
      expect(s, reason).toMatchObject({ status: 'ready', progressError: null, guidance: { status: 'unavailable', reason } })
      if (s.status === 'ready') expect(s.releases).toHaveLength(3)
    }
  })

  it('응답 모양 · 범위가 하나라도 틀리면 invalid(주의 없음으로 바꾸지 않는다) · 서가 CEFR 와 다르면 invalid', async () => {
    const bad: Json[][] = [
      [guidanceRow(RK, { cognitive_demand: 'extreme' })],
      [guidanceRow(RK, { background_load: null })],
      [guidanceRow(RK, { target_cefr: 'B3' })],
      [guidanceRow(RK, { cautions: 'x' })],
      [guidanceRow(RK, { cautions: [1] })],
      [guidanceRow(RK, { cautions: ['   '] })],
      [guidanceRow(RK, { cautions: ['　\t'] })],
      [guidanceRow(RK, { cautions: [''] })],
      [guidanceRow(RK), guidanceRow(RK)],
      [guidanceRow(RK, { release_key: 'lsr_x' })],
      [guidanceRow(RK, { target_cefr: 'B2' })],
    ]
    for (const rows of bad) {
      const f = fake({ rpc: { story_release_guidance: () => ok(rows) } })
      expect(await loadStoryCatalogPage({ client: f.client }), JSON.stringify(rows).slice(0, 80)).toMatchObject({
        status: 'ready',
        guidance: { status: 'unavailable', reason: 'invalid' },
      })
    }
    const g = fake({ rpc: { story_release_guidance: () => ok(null) } })
    expect(await loadStoryCatalogPage({ client: g.client })).toMatchObject({ guidance: { status: 'unavailable', reason: 'invalid' } })
  })

  it('S2 Text 계약에 없는 상한을 두지 않는다 — 501자 · 2,000자 · 21개 · 유니코드(서로게이트 쌍 · 결합 · ZWJ · NBSP · 탭 · 따옴표 · 줄바꿈)를 그대로 받는다', () => {
    const cautions = [
      '가'.repeat(501),
      `${'A'.repeat(1999)}🌊`,
      ...Array.from({ length: 19 }, (_, i) => `주의 문장 ${i + 1}`),
      '이모지 🌊👋🏽 · é 결합 · ZWJ 👩‍💻 · NBSP  · 탭\t · 따옴표 " 역슬래시 \\ 줄바꿈\n있음',
    ]
    expect(cautions.length).toBe(22)
    const rows = parseStoryGuidance([guidanceRow(RK, { cautions })])
    expect(rows).toHaveLength(1)
    expect(rows![0].cautions).toEqual(cautions)
    expect([...rows![0].cautions[0]].length).toBe(501)
  })

  it('허용 목록만 새로 만든다 — 여분 키(줄거리 설명 · 목표 · 지원 의도 · 해시 · id)는 버린다', () => {
    const rows = parseStoryGuidance([
      guidanceRow(RK, {
        note: 'PLOT-SPOILER',
        goals: ['GOAL'],
        supports: ['SUPPORT'],
        target_sha256: SHA_A,
        slot_id: UID,
      }),
    ])
    expect(rows).toHaveLength(1)
    expect(Object.keys(rows![0]).sort()).toEqual(['backgroundLoad', 'cautions', 'cognitiveDemand', 'releaseKey', 'targetCefr'])
    expect(rows![0].cautions).toEqual(CAUTIONS)
    const text = JSON.stringify(rows)
    expect(text).not.toMatch(/PLOT-SPOILER|GOAL|SUPPORT/)
    expect(text).not.toContain(SHA_A)
    expect(text).not.toContain(UID)
  })

  it('서가에 없는 행(두 조회 사이 바뀜)은 버린다', async () => {
    const f = fake({ rpc: { story_release_guidance: () => ok([guidanceRow(RK), guidanceRow(`lsr_${'d'.repeat(32)}`)]) } })
    const s = await loadStoryCatalogPage({ client: f.client })
    if (s.status !== 'ready' || s.guidance.status !== 'ready') throw new Error('ready expected')
    expect(Object.keys(s.guidance.byRelease)).toEqual([RK])
  })

  it('독서 입구: 이 발행본 키로만 조회 · 결과는 그 판본 안내 · 단위 화면은 부르지 않는다', async () => {
    const f = fake()
    const s = await reader(f)
    expect(f.rpcCalls.at(-1)).toEqual({ fn: 'story_release_guidance', args: { p_release_key: RK } })
    expect(s).toMatchObject({ status: 'ready', guidance: { status: 'ready', guidance: READY_A } })
    const u = fake()
    await reader(u, '1')
    expect(rpcNames(u)).not.toContain('story_release_guidance')
  })

  it('독서 입구: 안내 실패 · 다른 키 응답 · 빈 응답에도 독서는 ready · 안내만 unavailable', async () => {
    const cases: Array<[RpcHandler, string]> = [
      [() => dbError('Could not find the function', 'PGRST202'), 'not_ready'],
      [() => ok([guidanceRow(RK_SIB)]), 'invalid'],
      [() => ok([]), 'temporary'],
    ]
    for (const [handler, reason] of cases) {
      const f = fake({ rpc: { story_release_guidance: handler } })
      expect(await reader(f), reason).toMatchObject({ status: 'ready', viewerId: UID, guidance: { status: 'unavailable', reason } })
    }
  })

  it('비로그인 판본 화면: 서가에 없는 키 · 서가 실패면 안내를 부르지 않는다', async () => {
    const f = fake({ user: null, rpc: { story_catalog: () => ok([catalogRow(RK_SIB)]) } })
    expect(await reader(f)).toMatchObject({ status: 'signed_out', release: null, guidance: { status: 'unavailable' } })
    expect(rpcNames(f)).toEqual(['story_catalog'])
    const g = fake({ user: null, rpc: { story_catalog: () => dbError('down') } })
    await reader(g)
    expect(rpcNames(g)).toEqual(['story_catalog'])
  })

  it('함수 없음은 안내 RPC 도 reader_not_ready(읽기 문맥과 같은 대응) · 다른 RPC 는 temporary 그대로', () => {
    const missing = { message: 'Could not find the function', code: 'PGRST202' }
    expect(mapStoryLearnerRpcError(missing, 'story_release_guidance')).toMatchObject({ code: 'reader_not_ready' })
    expect(mapStoryLearnerRpcError(missing, 'story_catalog')).toMatchObject({ code: 'temporary' })
    expect(mapStoryLearnerRpcError({ message: 'story:guidance_mismatch' }, 'story_release_guidance')).toMatchObject({ code: 'reader_data_invalid' })
  })
})

// ── 단위 시대적 맥락 설명(T-0189 W2 · story_unit_context_notes — 제안 SQL 미적용 환경 포함) ─────────

describe('맥락 설명 — 단위 화면 · 본문 뒤 · 실패는 「설명 없음」이 아니다', () => {
  const NOTES = [
    { id: 'note-head-size', text: '머리 크기로 지능을 짐작하는 것은 이 시대의 생각이에요.' },
    { id: 'note-wife-affection', text: '이 시대 소설의 부부 묘사예요.' },
  ]
  const notesData = (unitIndex: number, notes: unknown = NOTES, over: Json = {}) => ({ release_key: RK, unit_index: unitIndex, notes, ...over })

  it('?unit=N: 본문 RPC 뒤에 같은 발행 키 · 단위로 한 번 · 결과는 저장값 그대로 · 입구에서는 부르지 않는다(null)', async () => {
    const f = fake({ rpc: { story_unit_context_notes: (args) => ok(notesData(Number(args?.p_unit_index))) } })
    const s = await reader(f, '2')
    expect(rpcNames(f).indexOf('story_unit_context_notes')).toBe(rpcNames(f).indexOf('story_read_unit') + 1)
    expect(f.rpcCalls.find((c) => c.fn === 'story_unit_context_notes')?.args).toEqual({ p_release_key: RK, p_unit_index: 2 })
    expect(s).toMatchObject({ status: 'ready', contextNotes: { status: 'ready', releaseKey: RK, unitIndex: 2, notes: NOTES } })
    const e = fake()
    expect(await reader(e)).toMatchObject({ status: 'ready', unit: null, contextNotes: null })
    expect(rpcNames(e)).not.toContain('story_unit_context_notes')
  })

  it('빈 배열 = 이 단위 설명 없음(ready · notes [])', async () => {
    const s = await reader(fake(), '0')
    expect(s).toMatchObject({ status: 'ready', contextNotes: { status: 'ready', unitIndex: 0, notes: [] } })
  })

  it('함수 없음 → not_ready · 결속 거부 → invalid · 일시 오류 · 세션 만료 · 예외 → temporary — 본문 · 진도 · 서가는 그대로', async () => {
    const cases: Array<[RpcHandler, string]> = [
      [() => dbError('Could not find the function public.story_unit_context_notes(p_release_key, p_unit_index) in the schema cache', 'PGRST202'), 'not_ready'],
      [() => dbError('function public.story_unit_context_notes(text, integer) does not exist', '42883'), 'not_ready'],
      [() => dbError('story:context_notes_mismatch'), 'invalid'],
      [() => dbError('canceling statement due to statement timeout', '57014'), 'temporary'],
      [() => dbError('story:auth_required'), 'temporary'],
      [() => dbError('story:release_unavailable'), 'temporary'],
      [() => Promise.reject(new Error('fetch failed')), 'temporary'],
    ]
    for (const [handler, reason] of cases) {
      const f = fake({ rpc: { story_unit_context_notes: handler } })
      const s = await reader(f, '1')
      expect(s, reason).toMatchObject({ status: 'ready', viewerId: UID, unit: { unitIndex: 1, text: BODY }, contextNotes: { status: 'unavailable', reason } })
      expect(rpcNames(f).filter((n) => WRITE_RPCS.includes(n))).toEqual([])
    }
  })

  it('본문 실패면 맥락 설명을 부르지 않는다', async () => {
    const f = fake({ rpc: { story_read_unit: () => dbError('story:unit_not_found') } })
    expect(await reader(f, '1')).toMatchObject({ status: 'unavailable', failure: { code: 'unit_not_found' } })
    expect(rpcNames(f)).not.toContain('story_unit_context_notes')
  })

  it('다른 발행 키 · 다른 단위(늦은 응답 · 결속 어긋남) · 모양 불일치 → invalid(다른 단위 설명을 싣지 않는다)', async () => {
    const bad: unknown[] = [
      null,
      [],
      notesData(2),
      { ...notesData(1), release_key: RK_SIB },
      { ...notesData(1), unit_index: '1' },
      notesData(1, null),
      notesData(1, {}),
      notesData(1, [{ id: '', text: 'x' }]),
      notesData(1, [{ id: 'a', text: '   \n\t' }]),
      notesData(1, [{ id: 'a', text: 'x' }, { id: 'a', text: 'y' }]),
      notesData(1, [{ id: 7, text: 'x' }]),
      notesData(1, [{ id: 'a', text: null }]),
      notesData(1, ['text only']),
    ]
    for (const data of bad) {
      const f = fake({ rpc: { story_unit_context_notes: () => ok(data) } })
      const s = await reader(f, '1')
      expect(s, JSON.stringify(data)).toMatchObject({ status: 'ready', contextNotes: { status: 'unavailable', reason: 'invalid' } })
    }
  })

  it('S2 Text 계약에 없는 상한을 두지 않는다 — 긴 문장 · 많은 개수 · 유니코드를 그대로 받고 허용 목록(id · text)만 만든다', () => {
    const long = `${'가'.repeat(2000)} 👩‍👩‍👧 é "q"\n끝`
    const many = Array.from({ length: 25 }, (_, i) => ({ id: `n-${i}`, text: `설명 ${i}`, sensitive_ref: 'leak', rationale: 'leak' }))
    const parsed = parseStoryContextNotes(notesData(3, [{ id: 'n-long', text: long }, ...many], { change_log: 'leak' }), { releaseKey: RK, unitIndex: 3 })
    expect(parsed?.notes).toHaveLength(26)
    expect(parsed?.notes[0]).toEqual({ id: 'n-long', text: long })
    expect(Object.keys(parsed?.notes[1] ?? {})).toEqual(['id', 'text'])
    expect(Object.keys(parsed ?? {})).toEqual(['releaseKey', 'unitIndex', 'notes'])
  })

  it('함수 없음 · 결속 거부 대응은 읽기 문맥 · 안내와 같다', () => {
    const missing = { message: 'Could not find the function', code: 'PGRST202' }
    expect(mapStoryLearnerRpcError(missing, 'story_unit_context_notes')).toMatchObject({ code: 'reader_not_ready' })
    expect(mapStoryLearnerRpcError({ message: 'story:context_notes_mismatch' }, 'story_unit_context_notes')).toMatchObject({ code: 'reader_data_invalid' })
  })
})

// ── D4-UX04 완료 뒤 다음 행동의 공급(같은 서가 행에서 센 다른 작품 수 — 새 조회 · 추천 없음) ─────────

describe('otherWorks — 같은 요청의 서가 행에서 이 작품 말고 열 수 있는 작품 수', () => {
  it('서로 다른 workKey 만 센다(같은 작품의 다른 판본 · 자기 자신 제외) · 입구 · 단위 화면 모두 · 새 RPC 없음', async () => {
    for (const unit of [undefined, '1']) {
      const f = fake()
      const s = await reader(f, unit)
      expect(s).toMatchObject({ status: 'ready', otherWorks: 1 })
      expect(rpcNames(f).filter((n) => n === 'story_catalog')).toHaveLength(1)
    }
    const only = fake({ rpc: { story_catalog: () => ok([catalogRow(RK), catalogRow(RK_SIB, WORK, 'a2')]) } })
    expect(await reader(only)).toMatchObject({ status: 'ready', otherWorks: 0 })
    const many = fake({ rpc: { story_catalog: () => ok([...CATALOG, catalogRow(`lsr_${'d'.repeat(32)}`, 'third-work'), catalogRow(`lsr_${'e'.repeat(32)}`, 'third-work', 'a2')]) } })
    expect(await reader(many)).toMatchObject({ status: 'ready', otherWorks: 2 })
  })

  it('서가 조회 실패면 null(「다른 작품 없음」과 구분)', async () => {
    const f = fake({ rpc: { story_catalog: () => dbError('down') } })
    expect(await reader(f, '1')).toMatchObject({ status: 'ready', siblings: null, otherWorks: null })
  })
})
