// apps/web/src/components/csat/theater/__tests__/reveal-focus.test.ts
//
// T-0188 — 판단 장면 「정답 보기」 뒤 포커스 경합. 정답 블록이 첫 프레임 뒤에 그려져도 포커스는
// 대체 대상(판단 선택지)이 아니라 정답 근거 제목으로 가야 한다. 끝내 정답 블록이 없을 때만 대체한다.
// 노드 환경 — 프레임과 문서를 손으로 돌려 경합을 결정적으로 재현한다.
import { describe, expect, it } from 'vitest'
import { focusRevealedAnswer } from '../AnalysisTheater'

const ANSWER = '[data-block="analysis:answer"] h2'
const OPTIONS = '[data-testid="judgment-options"]'

function world() {
  let active: string | null = null
  const els = new Map<string, HTMLElement>()
  const mount = (sel: string, name: string) => {
    const el = { name, tabIndex: 0, focus() { active = name } } as unknown as HTMLElement
    els.set(sel, el)
    return el
  }
  const doc = { querySelector: (sel: string) => els.get(sel) ?? null } as unknown as Pick<Document, 'querySelector'>
  let q: Array<() => void> = []
  return {
    doc,
    mount,
    active: () => active,
    schedule: (cb: () => void) => { q.push(cb) },
    tick: () => { const run = q; q = []; run.forEach((f) => f()) },
    pending: () => q.length,
  }
}

describe('focusRevealedAnswer', () => {
  it('정답 블록이 첫 프레임 뒤에 그려져도 정답 근거 제목으로 간다(대체로 새지 않는다)', () => {
    const w = world()
    w.mount(OPTIONS, 'options')
    focusRevealedAnswer(w.doc, { schedule: w.schedule })
    w.tick() // 첫 프레임 — 정답 블록이 아직 없다(관찰된 경합)
    w.mount(ANSWER, 'answer')
    for (let i = 0; i < 5 && w.pending(); i++) w.tick()
    expect(w.active()).toBe('answer')
  })

  it('정답 블록이 이미 있으면 첫 프레임에 바로 옮긴다', () => {
    const w = world()
    w.mount(OPTIONS, 'options')
    const h = w.mount(ANSWER, 'answer')
    focusRevealedAnswer(w.doc, { schedule: w.schedule })
    w.tick()
    expect(w.active()).toBe('answer')
    expect(h.tabIndex).toBe(-1)
    expect(w.pending()).toBe(0)
  })

  it('정답 블록이 끝내 없을 때만 판단 선택지로 대체한다', () => {
    const w = world()
    w.mount(OPTIONS, 'options')
    focusRevealedAnswer(w.doc, { schedule: w.schedule, maxFrames: 4 })
    for (let i = 0; i < 3; i++) { w.tick(); expect(w.active()).toBeNull() }
    w.tick()
    expect(w.active()).toBe('options')
    expect(w.pending()).toBe(0)
  })
})
