// apps/web/src/lib/library/story/__tests__/story-learner-actions.test.ts
//
// 학습자 서버 액션 배선 회귀(app/(main)/library/stories/actions.ts) — 실제 Supabase 팩토리를 가짜로 바꿔(vi.mock) 확인한다:
// 쿠키 클라이언트(createClient)로만 부르고 서비스 주체 팩토리는 부르지 않는다 · 매 호출 학습자 판정 · 위치 ≠ 완료 ·
// 무인증 · 정지 → RPC 0 · 팩토리가 던져도 throw 대신 temporary. 네트워크 · .env 값은 쓰지 않는다.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  log: [] as string[],
  cookie: null as unknown,
  createClientError: null as Error | null,
  contextMissing: false,
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => {
    h.log.push('createClient')
    if (h.createClientError) throw h.createClientError
    return h.cookie
  }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => {
    h.log.push('createAdminClient')
    return {}
  }),
}))

import { completeStoryUnitAction, recordStoryPositionAction } from '@/app/(main)/library/stories/actions'
import { createAdminClient } from '@/lib/supabase/admin'

const UID = '66666666-6666-4666-8666-666666666666'
const UID_B = '77777777-7777-4777-8777-777777777777'
const RK = `lsr_${'a'.repeat(32)}`

function readerContext(unitIndex: number) {
  return {
    release_key: RK,
    work_key: 'gull-rock',
    edition_key: 'b1',
    kind: 'easy_reader',
    coverage: 'episode',
    completion_label: 'adapted_partial',
    counts_as_work_completion: false,
    counts_as_original_text_completion: false,
    title: 'The Gull',
    unit_count: 3,
    progress: null,
    toc: [0, 1, 2].map((i) => ({ unit_index: i, unit_title: null, completed: false })),
    unit: { unit_index: unitIndex, unit_title: null, anchors: [{ paragraph: 0, start: 0, end: 4, quote: 'Gull' }], offset_unit: 'utf16_code_unit' },
    source: {
      identity_sha256: 'a'.repeat(64),
      text_sha256: 'b'.repeat(64),
      title: 'The Gull',
      author: null,
      original_language: 'en',
      text_language: 'en',
      translator: null,
      edition_label: 'Test edition',
      coverage: 'complete_work',
      source_url: null,
    },
  }
}

function fakeCookie(user: { id: string } | null, profile: { status: string } | null = { status: 'active' }) {
  return {
    auth: {
      getUser: async () => {
        h.log.push('getUser')
        return { data: { user }, error: null }
      },
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            h.log.push('profile')
            return { data: profile, error: null }
          },
        }),
      }),
    }),
    rpc: async (fn: string, args: Record<string, unknown>) => {
      h.log.push(`rpc:${fn}`)
      if (fn === 'story_reader_context') {
        if (h.contextMissing) return { data: null, error: { message: 'Could not find the function public.story_reader_context', code: 'PGRST202' } }
        return { data: readerContext(Number(args.p_unit_index)), error: null }
      }
      if (fn === 'story_record_position') {
        return {
          data: [{ release_key: args.p_release_key, last_unit_index: args.p_unit_index, furthest_unit_index: 2, completed_unit_count: 0, unit_count: 3, completed: false }],
          error: null,
        }
      }
      if (fn === 'story_complete_unit') {
        return {
          data: [{ release_key: args.p_release_key, unit_index: args.p_unit_index, completed_unit_count: 1, unit_count: 3, completed: false, completion_label: 'adapted_partial' }],
          error: null,
        }
      }
      return { data: null, error: { message: 'unexpected' } }
    },
  }
}

const POS = { releaseKey: RK, unitIndex: 1, reason: 'resume' as const, expectedViewerId: UID }
const DONE = { releaseKey: RK, unitIndex: 2, expectedViewerId: UID }

describe('stories/actions 배선', () => {
  beforeEach(() => {
    h.log.length = 0
    h.createClientError = null
    h.contextMissing = false
    vi.mocked(createAdminClient).mockClear()
  })

  it('위치 기록: 쿠키 클라이언트 → 학습자 판정 → 읽기 문맥 → story_record_position', async () => {
    h.cookie = fakeCookie({ id: UID })
    const r = await recordStoryPositionAction(POS)
    expect(r).toMatchObject({ ok: true, data: { viewerId: UID, releaseKey: RK, lastUnitIndex: 1, completed: false } })
    expect(h.log).toEqual(['createClient', 'getUser', 'profile', 'rpc:story_reader_context', 'rpc:story_record_position'])
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it('단위 완료: 읽기 문맥 → story_complete_unit', async () => {
    h.cookie = fakeCookie({ id: UID })
    const r = await completeStoryUnitAction(DONE)
    expect(r).toMatchObject({ ok: true, data: { viewerId: UID, unitIndex: 2, completedUnitCount: 1 } })
    expect(h.log).toEqual(['createClient', 'getUser', 'profile', 'rpc:story_reader_context', 'rpc:story_complete_unit'])
  })

  it('화면의 본인(A) ≠ 지금 세션(B) → viewer_changed · RPC 0(두 액션)', async () => {
    h.cookie = fakeCookie({ id: UID_B })
    expect(await recordStoryPositionAction(POS)).toMatchObject({ ok: false, code: 'viewer_changed', retryable: false })
    expect(await completeStoryUnitAction(DONE)).toMatchObject({ ok: false, code: 'viewer_changed', retryable: false })
    expect(h.log.filter((x) => x.startsWith('rpc:'))).toEqual([])
  })

  it('읽기 문맥 미적용 → reader_not_ready · 저장 RPC 0', async () => {
    h.cookie = fakeCookie({ id: UID })
    h.contextMissing = true
    expect(await recordStoryPositionAction(POS)).toMatchObject({ ok: false, code: 'reader_not_ready' })
    expect(await completeStoryUnitAction(DONE)).toMatchObject({ ok: false, code: 'reader_not_ready' })
    expect(h.log.filter((x) => x.startsWith('rpc:'))).toEqual(['rpc:story_reader_context', 'rpc:story_reader_context'])
  })

  it('무인증 · 정지 → RPC 0', async () => {
    h.cookie = fakeCookie(null)
    expect(await recordStoryPositionAction(POS)).toMatchObject({ ok: false, code: 'auth_required' })
    h.cookie = fakeCookie({ id: UID }, { status: 'suspended' })
    expect(await completeStoryUnitAction(DONE)).toMatchObject({ ok: false, code: 'account_blocked' })
    expect(h.log.filter((x) => x.startsWith('rpc:'))).toEqual([])
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it('잘못된 입력 · expectedViewerId 없음 → invalid_input, getUser · RPC 0', async () => {
    h.cookie = fakeCookie({ id: UID })
    expect(await recordStoryPositionAction({ ...POS, reason: 'render' })).toMatchObject({ ok: false, code: 'invalid_input' })
    expect(await recordStoryPositionAction({ releaseKey: RK, unitIndex: 1, reason: 'start' })).toMatchObject({ ok: false, code: 'invalid_input' })
    expect(await completeStoryUnitAction({ releaseKey: RK, unitIndex: 1 })).toMatchObject({ ok: false, code: 'invalid_input' })
    expect(await completeStoryUnitAction('lsr_x')).toMatchObject({ ok: false, code: 'invalid_input' })
    expect(h.log).toEqual(['createClient', 'createClient', 'createClient', 'createClient'])
  })

  it('쿠키 클라이언트 생성이 던져도 throw 하지 않는다(temporary)', async () => {
    h.createClientError = new Error('cookies unavailable')
    expect(await recordStoryPositionAction(POS)).toMatchObject({ ok: false, code: 'temporary', retryable: true })
    expect(await completeStoryUnitAction(DONE)).toMatchObject({ ok: false, code: 'temporary', retryable: true })
    expect(createAdminClient).not.toHaveBeenCalled()
  })
})

