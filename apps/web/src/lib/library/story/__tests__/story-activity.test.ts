// apps/web/src/lib/library/story/__tests__/story-activity.test.ts
//
// T-0228 근거 선택 활동(story_unit_activity) — 서버 액션 배선 · 입력 검사 · 응답 화이트리스트 · 예외 코드 · 함수 없음(MAY_BE_MISSING).
// DB 함수는 사용자 승인 전이라 dev 에 없다 — 전부 RPC 대역이며 실DB · 네트워크 · .env 값을 쓰지 않는다.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  log: [] as string[],
  args: [] as Array<Record<string, unknown>>,
  cookie: null as unknown,
  respond: null as null | ((args: Record<string, unknown>) => { data: unknown; error: unknown }),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => {
    h.log.push('createClient')
    return h.cookie
  }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => {
    h.log.push('createAdminClient')
    return {}
  }),
}))

import { loadStoryActivityAction, submitStoryActivityAction } from '@/app/(main)/library/stories/actions'

import { parseStoryActivity, parseStoryActivityResult } from '../activity'
import { mapStoryLearnerRpcError } from '../learner'

const UID = '66666666-6666-4666-8666-666666666666'
const UID_B = '77777777-7777-4777-8777-777777777777'
const RK = `lsr_${'a'.repeat(32)}`
const ACT = 'why-horner-is-safe'

const opt = (id: string, i: number) => ({ option_id: id, unit_index: 15, start: i * 10, end: i * 10 + 8, quote: `quote ${id}` })
const OPTIONS = ['case-collapses', 'too-frightened', 'opt-c', 'opt-d', 'opt-e'].map(opt)
const LOOKUP = { release_key: RK, activity_id: ACT, prompt: 'Why is Horner safe?', claim: 'Horner will go free.', options: OPTIONS, offset_unit: 'utf16_code_unit' }
const result = (choice: string) => ({
  release_key: RK,
  activity_id: ACT,
  choice,
  correct: choice === 'case-collapses',
  chosen: OPTIONS.find((o) => o.option_id === choice),
  registered_evidence: OPTIONS[0],
  offset_unit: 'utf16_code_unit',
})

function fakeCookie(user: { id: string } | null, profile: { status: string } | null = { status: 'active' }) {
  return {
    auth: { getUser: async () => (h.log.push('getUser'), { data: { user }, error: null }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => (h.log.push('profile'), { data: profile, error: null }) }) }) }),
    rpc: async (fn: string, args: Record<string, unknown>) => {
      h.log.push(`rpc:${fn}`)
      h.args.push(args)
      if (fn !== 'story_unit_activity' || !h.respond) return { data: null, error: { message: 'unexpected' } }
      return h.respond(args)
    },
  }
}

const LOAD = { releaseKey: RK, activityId: ACT, expectedViewerId: UID }
const rpcCalls = () => h.log.filter((x) => x.startsWith('rpc:'))

beforeEach(() => {
  h.log.length = 0
  h.args.length = 0
  h.cookie = fakeCookie({ id: UID })
  h.respond = (args) => ({ data: args.p_choice == null ? LOOKUP : result(String(args.p_choice)), error: null })
})

describe('조회', () => {
  it('정상: 쿠키 클라이언트 → 학습자 판정 → story_unit_activity(p_choice null) 1회 · 화이트리스트 키만 · 옵션 5 · 정답 없음', async () => {
    const r = await loadStoryActivityAction(LOAD)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.data).toMatchObject({ viewerId: UID, releaseKey: RK, activityId: ACT, prompt: LOOKUP.prompt, claim: LOOKUP.claim })
    expect(r.data.options).toHaveLength(5)
    expect(JSON.stringify(r.data)).not.toMatch(/correct|registered|answer/)
    expect(h.log).toEqual(['createClient', 'getUser', 'profile', 'rpc:story_unit_activity'])
    expect(h.args).toEqual([{ p_release_key: RK, p_activity_id: ACT, p_choice: null }])
  })

  it('조회 응답에 correct · registered_evidence · answer 가 섞이면 reader_data_invalid', async () => {
    for (const extra of [{ correct: true }, { registered_evidence: OPTIONS[0] }, { answer: ['case-collapses'] }]) {
      h.respond = () => ({ data: { ...LOOKUP, ...extra }, error: null })
      expect(await loadStoryActivityAction(LOAD)).toMatchObject({ ok: false, code: 'reader_data_invalid' })
    }
    // 선택지 안에 정답 키가 섞여도 닫는다
    h.respond = () => ({ data: { ...LOOKUP, options: [{ ...OPTIONS[0], correct: true }, ...OPTIONS.slice(1)] }, error: null })
    expect(await loadStoryActivityAction(LOAD)).toMatchObject({ ok: false, code: 'reader_data_invalid' })
  })

  it('다른 발행 키 · 다른 활동 · offset 단위 · 중복 선택지 · 빈 인용 → reader_data_invalid', () => {
    const exp = { releaseKey: RK, activityId: ACT }
    expect(parseStoryActivity(LOOKUP, exp)).not.toBeNull()
    expect(parseStoryActivity({ ...LOOKUP, release_key: `lsr_${'b'.repeat(32)}` }, exp)).toBeNull()
    expect(parseStoryActivity({ ...LOOKUP, activity_id: 'other' }, exp)).toBeNull()
    expect(parseStoryActivity({ ...LOOKUP, offset_unit: 'char' }, exp)).toBeNull()
    expect(parseStoryActivity({ ...LOOKUP, options: [OPTIONS[0], OPTIONS[0]] }, exp)).toBeNull()
    expect(parseStoryActivity({ ...LOOKUP, options: [{ ...OPTIONS[0], quote: ' ' }, OPTIONS[1]] }, exp)).toBeNull()
    expect(parseStoryActivity({ ...LOOKUP, options: [{ ...OPTIONS[0], start: 9, end: 9 }, OPTIONS[1]] }, exp)).toBeNull()
  })

  it('함수 없음(PGRST202 · 42883) → reader_not_ready', async () => {
    for (const error of [
      { code: 'PGRST202', message: 'Could not find the function public.story_unit_activity' },
      { code: '42883', message: 'function public.story_unit_activity(text, text, text) does not exist' },
    ]) {
      h.respond = () => ({ data: null, error })
      expect(await loadStoryActivityAction(LOAD)).toMatchObject({ ok: false, code: 'reader_not_ready' })
    }
  })

  it('예외 7코드 → 학습자 실패 코드(DB 원문 없음)', () => {
    const cases: Array<[string, string]> = [
      ['story:activity_locked', 'activity_locked'],
      ['story:activity_unsupported', 'activity_unavailable'],
      ['story:activity_not_found', 'activity_unavailable'],
      ['story:activity_mismatch', 'reader_data_invalid'],
      ['story:activity_bad_choice', 'invalid_input'],
      ['story:release_unavailable', 'release_unavailable'],
      ['story:auth_required', 'auth_required'],
      ['story:account_blocked', 'account_blocked'],
    ]
    for (const [msg, code] of cases) {
      const f = mapStoryLearnerRpcError({ message: msg, details: 'secret detail' }, 'story_unit_activity')
      expect(f).toMatchObject({ ok: false, code })
      expect(f.message).not.toContain('secret')
    }
  })

  it('expectedViewerId ≠ 쿠키 uid → viewer_changed · RPC 0', async () => {
    h.cookie = fakeCookie({ id: UID_B })
    expect(await loadStoryActivityAction(LOAD)).toMatchObject({ ok: false, code: 'viewer_changed' })
    expect(await submitStoryActivityAction({ ...LOAD, choice: 'case-collapses' })).toMatchObject({ ok: false, code: 'viewer_changed' })
    expect(rpcCalls()).toEqual([])
  })

  it('비로그인 · 정지 계정 → RPC 0', async () => {
    h.cookie = fakeCookie(null)
    expect(await loadStoryActivityAction(LOAD)).toMatchObject({ ok: false, code: 'auth_required' })
    h.cookie = fakeCookie({ id: UID }, { status: 'suspended' })
    expect(await loadStoryActivityAction(LOAD)).toMatchObject({ ok: false, code: 'account_blocked' })
    expect(rpcCalls()).toEqual([])
  })

  it('입력 검사: 빈 · 잘못된 releaseKey · activityId · choice → invalid_input · getUser · RPC 0', async () => {
    for (const bad of [{ ...LOAD, releaseKey: '' }, { ...LOAD, releaseKey: 'lsr_x' }, { ...LOAD, activityId: '' }, { ...LOAD, activityId: 'Bad Id' }, { ...LOAD, expectedViewerId: '' }, null]) {
      expect(await loadStoryActivityAction(bad)).toMatchObject({ ok: false, code: 'invalid_input' })
    }
    for (const choice of ['', ' ', 'X Y', 3, undefined]) {
      expect(await submitStoryActivityAction({ ...LOAD, choice })).toMatchObject({ ok: false, code: 'invalid_input' })
    }
    expect(h.log.filter((x) => x !== 'createClient')).toEqual([])
  })
})

describe('제출', () => {
  it('맞음(case-collapses): 고른 근거 = 등록 근거 · p_choice 전달', async () => {
    const r = await submitStoryActivityAction({ ...LOAD, choice: 'case-collapses' })
    expect(r).toMatchObject({ ok: true, data: { viewerId: UID, correct: true, choice: 'case-collapses', chosen: { optionId: 'case-collapses' }, registered: { optionId: 'case-collapses' } } })
    expect(h.args).toEqual([{ p_release_key: RK, p_activity_id: ACT, p_choice: 'case-collapses' }])
  })

  it('다름(too-frightened): 고른 근거와 등록 근거가 각각', async () => {
    const r = await submitStoryActivityAction({ ...LOAD, choice: 'too-frightened' })
    expect(r).toMatchObject({ ok: true, data: { correct: false, chosen: { optionId: 'too-frightened', quote: 'quote too-frightened' }, registered: { optionId: 'case-collapses' } } })
  })

  it('응답이 어긋나면 reader_data_invalid — 다른 선택 · 맞음 여부 모순 · 등록 근거 없음 · 키 더함', () => {
    const exp = { releaseKey: RK, activityId: ACT, choice: 'too-frightened' }
    expect(parseStoryActivityResult(result('too-frightened'), exp)).not.toBeNull()
    expect(parseStoryActivityResult(result('case-collapses'), exp)).toBeNull()
    expect(parseStoryActivityResult({ ...result('too-frightened'), correct: true }, exp)).toBeNull()
    expect(parseStoryActivityResult({ ...result('too-frightened'), registered_evidence: null }, exp)).toBeNull()
    expect(parseStoryActivityResult({ ...result('too-frightened'), explanation: 'x' }, exp)).toBeNull()
    expect(parseStoryActivityResult({ ...result('too-frightened'), chosen: { ...OPTIONS[1], unit_index: -1 } }, exp)).toBeNull()
  })

  it('잘못된 선택(서버 activity_bad_choice) → invalid_input', async () => {
    h.respond = () => ({ data: null, error: { message: 'story:activity_bad_choice' } })
    expect(await submitStoryActivityAction({ ...LOAD, choice: 'nope' })).toMatchObject({ ok: false, code: 'invalid_input' })
  })

  it('RPC 가 던지면 throw 대신 temporary · 서비스 주체 팩토리는 부르지 않는다', async () => {
    h.respond = () => {
      throw new Error('net')
    }
    expect(await submitStoryActivityAction({ ...LOAD, choice: 'case-collapses' })).toMatchObject({ ok: false, code: 'temporary', retryable: true })
    expect(h.log).not.toContain('createAdminClient')
  })
})
