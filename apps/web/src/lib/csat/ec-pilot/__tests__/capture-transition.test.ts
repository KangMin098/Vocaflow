// apps/web/src/lib/csat/ec-pilot/__tests__/capture-transition.test.ts
//
// 수집 상태 전이 배선 — 화면을 열면 held → collecting(capture_open), 마치면 collecting → completed(capture_finish).
// 2026-10-06 Track B 리뷰 에스컬레이션: 앱이 두 RPC 를 부르지 않아 수집을 마쳐도 결과가 계속 423 이었다.
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({}) }))

const { finishCapture } = await import('../server')

const SID = '11111111-1111-1111-1111-111111111111'
const UID = '22222222-2222-2222-2222-222222222222'

function ctx(capStatus: string | null, finish: unknown) {
  const calls: string[] = []
  const rls = {
    rpc: vi.fn(async (fn: string) => {
      calls.push(fn)
      if (fn === 'csat_ec_my_capture_state') return { data: capStatus ? { status: capStatus, targets: [1, 2] } : null, error: null }
      if (fn === 'csat_ec_capture_open') return { data: 'collecting', error: null }
      if (fn === 'csat_ec_capture_finish') return { data: finish, error: null }
      return { data: null, error: { message: `unexpected ${fn}` } }
    }),
  }
  const admin = {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: SID, user_id: UID, mode: 'live', exam_id: 'E' }, error: null }) }) }) }),
  }
  return { c: { userId: UID, rls, admin } as never, calls }
}

describe('finishCapture', () => {
  it('collecting → completed 를 그대로 돌려준다', async () => {
    const { c, calls } = ctx('collecting', { status: 'completed', remaining: [] })
    expect(await finishCapture(c, SID)).toEqual({ status: 'completed' })
    expect(calls).toEqual(['csat_ec_my_capture_state', 'csat_ec_capture_finish'])
  })
  it('held 면 먼저 연 뒤 끝낸다(open → finish 순서)', async () => {
    const { c, calls } = ctx('held', { status: 'completed', remaining: [] })
    expect(await finishCapture(c, SID)).toEqual({ status: 'completed' })
    expect(calls).toEqual(['csat_ec_my_capture_state', 'csat_ec_capture_open', 'csat_ec_capture_finish'])
  })
  it('해석이 빠졌으면 끝내지 않고 남은 대상 번호만 돌려준다', async () => {
    const { c } = ctx('collecting', { status: 'collecting', missing: 'interpretation', remaining: [2] })
    expect(await finishCapture(c, SID)).toEqual({ status: 'collecting', missing: 'interpretation', remaining: [2] })
  })
  it('확인이 빠졌으면 confirmation', async () => {
    const { c } = ctx('collecting', { status: 'collecting', missing: 'confirmation' })
    expect(await finishCapture(c, SID)).toEqual({ status: 'collecting', missing: 'confirmation' })
  })
  it('수집 대상이 아닌 기록은 none — RPC 를 더 부르지 않는다', async () => {
    const { c, calls } = ctx(null, null)
    expect(await finishCapture(c, SID)).toEqual({ status: 'none' })
    expect(calls).toEqual(['csat_ec_my_capture_state'])
  })
  it('이미 끝난 수집은 멱등(completed)', async () => {
    const { c } = ctx('completed', { status: 'completed', remaining: [] })
    expect(await finishCapture(c, SID)).toEqual({ status: 'completed' })
  })
  it('응답에 정오 필드를 담지 않는다', async () => {
    const { c } = ctx('collecting', { status: 'collecting', missing: 'interpretation', remaining: [1], is_correct: false })
    expect(JSON.stringify(await finishCapture(c, SID))).not.toMatch(/correct|answer/)
  })
})
