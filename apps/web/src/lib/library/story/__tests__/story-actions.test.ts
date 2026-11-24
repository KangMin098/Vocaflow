// apps/web/src/lib/library/story/__tests__/story-actions.test.ts
//
// 서버 액션 배선 회귀(app/admin/curation/story-actions.ts) — 실제 Supabase 팩토리를 가짜로 바꿔(vi.mock) 확인한다:
// 관리 RPC 는 쿠키 클라이언트로만, 서비스 주체 팩토리(createAdminClient)는 검증 증인에서 스태프 확인을 통과한 뒤에만 부른다.
// 무인증 · DEV_ADMIN_BYPASS 에서는 어떤 액션도 RPC · 서비스 클라이언트를 만들지 않는다. 예외는 throw 대신 실패로 돌아온다.
// 네트워크 · .env 값은 쓰지 않는다.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  log: [] as string[],
  cookie: null as unknown,
  createClientError: null as Error | null,
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
    return {
      rpc: async (fn: string) => {
        h.log.push(`service:${fn}`)
        return { data: null, error: { message: 'story:edition_version_not_found' } }
      },
    }
  }),
}))

import {
  attestStoryValidationAction,
  checkStoryCandidateAction,
  listStorySlotsAction,
  loadStoryBundleAction,
  publishStoryAction,
  recordStoryRightsAction,
  registerStoryCandidateAction,
  submitStoryReviewAction,
  withdrawStoryAction,
} from '@/app/admin/curation/story-actions'
import { createAdminClient } from '@/lib/supabase/admin'

const VERSION_ID = '11111111-1111-4111-8111-111111111111'
const SOURCE_ID = '22222222-2222-4222-8222-222222222222'
const UID = '66666666-6666-4666-8666-666666666666'
const RELEASE_KEY = `lsr_${'c'.repeat(32)}`

function fakeCookie(user: { id: string } | null, profile: { role: string; status: string } | null = { role: 'admin', status: 'active' }) {
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
    rpc: async (fn: string) => {
      h.log.push(`cookie:${fn}`)
      if (fn === 'story_admin_list_slots') return { data: [], error: null }
      return { data: null, error: { message: 'story:edition_version_not_found' } }
    },
  }
}

function emptyForm(): FormData {
  const f = new FormData()
  f.append('step', 'source')
  f.append('edition_version_id', VERSION_ID)
  f.append('source', new File(['{}'], 's.json'))
  f.append('review', new File(['{}'], 'r.json'))
  return f
}

const ACTIONS: Array<[string, () => Promise<{ ok: boolean }>]> = [
  ['list', () => listStorySlotsAction()],
  ['bundle', () => loadStoryBundleAction(VERSION_ID)],
  ['check', () => checkStoryCandidateAction(emptyForm())],
  ['register', () => registerStoryCandidateAction(emptyForm())],
  ['review', () => submitStoryReviewAction(emptyForm())],
  ['rights', () => recordStoryRightsAction({ source_id: SOURCE_ID, asset: 'source_text', status: 'confirmed', basis: 'b', evidence_ref: 'e' })],
  ['attest', () => attestStoryValidationAction(VERSION_ID)],
  ['publish', () => publishStoryAction(VERSION_ID)],
  ['withdraw', () => withdrawStoryAction(RELEASE_KEY, '사유')],
]

describe('story-actions 배선', () => {
  const savedBypass = process.env.DEV_ADMIN_BYPASS
  beforeEach(() => {
    h.log.length = 0
    h.createClientError = null
    vi.mocked(createAdminClient).mockClear()
  })
  afterEach(() => {
    if (savedBypass === undefined) delete process.env.DEV_ADMIN_BYPASS
    else process.env.DEV_ADMIN_BYPASS = savedBypass
  })

  it.each(ACTIONS)('%s: 익명 쿠키 세션(DEV_ADMIN_BYPASS=1 포함) → auth_required, RPC · 서비스 클라이언트 0', async (_name, run) => {
    for (const bypass of ['0', '1']) {
      process.env.DEV_ADMIN_BYPASS = bypass
      h.log.length = 0
      h.cookie = fakeCookie(null)
      const r = await run()
      expect(r).toMatchObject({ ok: false, code: 'auth_required', stage: 'auth' })
      expect(h.log).toEqual(['createClient', 'getUser'])
      expect(createAdminClient).not.toHaveBeenCalled()
    }
  })

  it('관리 RPC 는 쿠키 클라이언트로만 부른다(서비스 클라이언트 0)', async () => {
    h.cookie = fakeCookie({ id: UID })
    await listStorySlotsAction()
    await loadStoryBundleAction(VERSION_ID)
    await publishStoryAction(VERSION_ID)
    expect(h.log.filter((x) => x.startsWith('cookie:'))).toEqual(['cookie:story_admin_list_slots', 'cookie:story_admin_get_bundle', 'cookie:story_admin_publish'])
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it('검증 증인만 스태프 확인 뒤 서비스 클라이언트를 만든다', async () => {
    h.cookie = fakeCookie({ id: UID }, { role: 'curator', status: 'active' })
    const r = await attestStoryValidationAction(VERSION_ID)
    expect(r).toMatchObject({ ok: false, code: 'story:edition_version_not_found' })
    expect(h.log).toEqual(['createClient', 'getUser', 'profile', 'createAdminClient', 'service:story_service_validation_input'])
  })

  it('정지 계정은 증인에서도 서비스 클라이언트 0', async () => {
    h.cookie = fakeCookie({ id: UID }, { role: 'admin', status: 'suspended' })
    expect(await attestStoryValidationAction(VERSION_ID)).toMatchObject({ ok: false, code: 'account_inactive' })
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it('쿠키 클라이언트 생성이 던져도 클라이언트로 throw 하지 않는다', async () => {
    h.createClientError = new Error('cookies unavailable')
    for (const [, run] of ACTIONS) {
      expect(await run()).toMatchObject({ ok: false, code: 'server_error', retryable: true })
    }
    expect(createAdminClient).not.toHaveBeenCalled()
  })
})
