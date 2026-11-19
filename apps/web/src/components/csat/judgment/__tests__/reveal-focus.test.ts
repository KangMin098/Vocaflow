// apps/web/src/components/csat/judgment/__tests__/reveal-focus.test.ts
// T-0183 — 공개 직후 포커스: 해설 버튼이 사라진 커밋에서 곧바로(다음 프레임이 아니라) 상태 영역으로 옮기고, 학습자가 옮긴 포커스는 빼앗지 않는다.
// @vitest-environment node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { placeRevealFocus } from '../useReveal'

const body = { tag: 'body' }

function fakeTarget(attrs: Record<string, string> = {}) {
  const a = { ...attrs }
  return {
    attrs: a,
    isConnected: true,
    hasAttribute: (n: string) => n in a,
    setAttribute: (n: string, v: string) => { a[n] = v },
    focus: vi.fn(),
  }
}

function fakeRoot(map: Record<string, ReturnType<typeof fakeTarget>>) {
  return { isConnected: true, querySelector: (s: string) => map[s] ?? null }
}

describe('placeRevealFocus', () => {
  it('공개(shown): body 에 있던 포커스를 같은 호출 안에서 해설 영역으로 옮긴다 — 지연 없음', () => {
    const revealed = fakeTarget()
    const raf = vi.fn()
    vi.stubGlobal('requestAnimationFrame', raf)
    const moved = placeRevealFocus(fakeRoot({ '[data-revealed]': revealed }), 'shown', { activeElement: body, body })
    vi.unstubAllGlobals()
    expect(moved).toBe(true)
    expect(revealed.focus).toHaveBeenCalledTimes(1)
    expect(revealed.focus).toHaveBeenCalledWith({ preventScroll: true })
    expect(revealed.attrs.tabindex).toBe('-1')
    expect(raf).not.toHaveBeenCalled()
  })

  it('로딩·오류도 각 상태 영역으로, 대상이 없으면 다음 후보로', () => {
    const status = fakeTarget()
    expect(placeRevealFocus(fakeRoot({ '[data-reveal-status]': status }), 'loading', { activeElement: null, body })).toBe(true)
    expect(status.focus).toHaveBeenCalledTimes(1)
    const err = fakeTarget({ tabindex: '0' })
    expect(placeRevealFocus(fakeRoot({ '[data-reveal-error]': err }), 'error', { activeElement: body, body })).toBe(true)
    expect(err.attrs.tabindex).toBe('0')
  })

  it('학습자가 다른 요소로 옮긴 포커스는 빼앗지 않는다', () => {
    const revealed = fakeTarget()
    const elsewhere = { isConnected: true }
    expect(placeRevealFocus(fakeRoot({ '[data-revealed]': revealed }), 'shown', { activeElement: elsewhere, body })).toBe(false)
    expect(revealed.focus).not.toHaveBeenCalled()
  })

  it('hidden · 분리된 루트 · 대상 없음이면 아무것도 하지 않는다', () => {
    const t = fakeTarget()
    expect(placeRevealFocus(fakeRoot({ '[data-revealed]': t }), 'hidden', { activeElement: body, body })).toBe(false)
    expect(placeRevealFocus({ isConnected: false, querySelector: () => t }, 'shown', { activeElement: body, body })).toBe(false)
    expect(placeRevealFocus(fakeRoot({}), 'shown', { activeElement: body, body })).toBe(false)
    expect(placeRevealFocus(null, 'shown', { activeElement: body, body })).toBe(false)
    expect(t.focus).not.toHaveBeenCalled()
  })

  it('훅은 레이아웃 단계에서 동기로 부른다 — 다음 프레임 예약(requestAnimationFrame) 없음', () => {
    const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../useReveal.ts'), 'utf8')
    const code = src.replace(/\/\/.*$/gm, '')
    expect(code).toMatch(/useIsoLayoutEffect\(\(\) => \{\s*placeRevealFocus\(origin\.current, status, document\)\s*\}, \[status\]\)/)
    expect(code).not.toMatch(/requestAnimationFrame/)
  })
})
