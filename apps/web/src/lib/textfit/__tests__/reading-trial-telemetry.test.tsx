// apps/web/src/lib/textfit/__tests__/reading-trial-telemetry.test.tsx
// @vitest-environment node
// /fit 체험 계측 2종의 경계 — 직접 열기에서만 opened · 채점 성공에서만 answered · 속성 {} · 렌더 · 목표 토글 · 닫기 · 다시 보기는 0
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  seeded: [] as unknown[],
  setters: [] as Array<(v: unknown) => void>,
  dcp: [] as Array<Record<string, unknown>>,
  buttons: new Map<string, Record<string, unknown>>(),
  track: vi.fn(),
}))
vi.mock('@/lib/analytics/client', () => ({ track: h.track }))
vi.mock('@/lib/learner/dcp-actions', () => ({ gradeDcpItem: vi.fn(), recordDcpErrorCause: vi.fn() }))
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  return {
    ...actual,
    useState: (init: unknown) => {
      const setter = vi.fn()
      h.setters.push(setter)
      return h.seeded.length > 0 ? [h.seeded.shift(), setter] : [typeof init === 'function' ? (init as () => unknown)() : init, setter]
    },
  }
})
// data-testid 가 있는 요소의 props(onClick 등)를 붙잡는다 — DOM 없이 실제 핸들러를 부른다
vi.mock('react/jsx-runtime', async () => {
  const actual = await vi.importActual<typeof import('react/jsx-runtime')>('react/jsx-runtime')
  const wrap = (fn: typeof actual.jsx) => (type: unknown, props: Record<string, unknown>, key?: unknown) => {
    const id = props?.['data-testid']
    if (typeof id === 'string') h.buttons.set(id, props)
    return fn(type as never, props as never, key as never)
  }
  return { ...actual, jsx: wrap(actual.jsx), jsxs: wrap(actual.jsxs) }
})
vi.mock('react/jsx-dev-runtime', async () => {
  const actual = await vi.importActual<typeof import('react/jsx-dev-runtime')>('react/jsx-dev-runtime')
  const wrap = (fn: typeof actual.jsxDEV) => (type: unknown, props: Record<string, unknown>, ...rest: unknown[]) => {
    const id = props?.['data-testid']
    if (typeof id === 'string') h.buttons.set(id, props)
    return (fn as (...a: unknown[]) => unknown)(type, props, ...rest) as ReturnType<typeof actual.jsxDEV>
  }
  return { ...actual, jsxDEV: wrap(actual.jsxDEV) }
})
vi.mock('@/components/practice/DcpPlayer', () => ({
  DcpPlayer: (p: Record<string, unknown>) => {
    h.dcp.push(p)
    return null
  },
}))

import { ReadingTrial } from '@/components/textfit/ReadingTrial'
import { ALLOWED_EVENTS, isSafeProps } from '@/lib/analytics/events'

const render = (open: boolean, goal = false) => {
  h.seeded = [open, goal]
  h.setters = []
  h.buttons.clear()
  h.dcp = []
  renderToString(<ReadingTrial />)
}
const click = (id: string) => (h.buttons.get(id)?.onClick as (() => void) | undefined)?.()

beforeEach(() => h.track.mockClear())

describe('fit_trial_opened', () => {
  it('렌더(닫힘 · 열림)만으로는 보내지 않는다', () => {
    render(false)
    render(true)
    expect(h.track).not.toHaveBeenCalled()
  })
  it('닫힌 → 열기 버튼을 누르면 한 번 · 속성 {}', () => {
    render(false)
    click('fit-trial-open')
    expect(h.track).toHaveBeenCalledTimes(1)
    expect(h.track).toHaveBeenCalledWith({ name: 'fit_trial_opened', props: {} })
    expect(h.setters[0]).toHaveBeenCalledWith(true)
  })
  it('목표 토글 · 닫기는 보내지 않는다', () => {
    render(false)
    click('fit-trial-goal-toggle')
    render(true)
    click('fit-trial-goal-toggle')
    ;(globalThis as { requestAnimationFrame?: unknown }).requestAnimationFrame = () => 0
    click('fit-trial-close')
    expect(h.track).not.toHaveBeenCalled()
  })
})

describe('fit_trial_answered', () => {
  it('DcpPlayer 의 onGraded(채점 성공 콜백)에서만 · 속성 {} · 결과를 싣지 않는다', () => {
    render(true)
    const p = h.dcp[0]
    expect(typeof p.onGraded).toBe('function')
    ;(p.onGraded as (item: unknown, res: unknown) => void)({ id: 'x' }, { ok: true, correct: false, attemptId: null, answerKey: 1 })
    expect(h.track).toHaveBeenCalledTimes(1)
    expect(h.track).toHaveBeenCalledWith({ name: 'fit_trial_answered', props: {} })
  })
  it('채점 실패 · 다시 보기 · 원인 기록은 onGraded 를 거치지 않는다(DcpPlayer 계약) — 다른 콜백이 계측을 부르지 않는다', () => {
    render(true)
    const p = h.dcp[0]
    void (p.recordCause as (a: string, c: string) => unknown)('a', 'vocab')
    ;(p.onBack as () => void)?.()
    expect(h.track).not.toHaveBeenCalled()
    expect(p.items).toBeDefined()
    expect(p.causeChips).toBe(false)
  })
})

describe('이벤트 등록', () => {
  it('두 이름이 허용 목록에 있고 {} 는 안전 속성', () => {
    expect(ALLOWED_EVENTS).toContain('fit_trial_opened')
    expect(ALLOWED_EVENTS).toContain('fit_trial_answered')
    expect(isSafeProps({})).toBe(true)
  })
})
