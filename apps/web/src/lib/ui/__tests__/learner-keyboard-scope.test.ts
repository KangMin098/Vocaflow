// apps/web/src/lib/ui/__tests__/learner-keyboard-scope.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { learnerModalOwnsKeyboard, nativeControlOwnsKey } from '../learner-keyboard-scope'

afterEach(() => { vi.unstubAllGlobals() })
describe('learning shortcuts behind a modal', () => {
  it.each([
    { desktop: true, learner: true, modal: true, owns: true },
    { desktop: true, learner: true, modal: false, owns: false },
    { desktop: true, learner: false, modal: true, owns: false },
    { desktop: false, learner: true, modal: true, owns: false },
  ])('owns=$owns for desktop=$desktop learner=$learner modal=$modal', ({ desktop, learner, modal, owns }) => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: desktop }) })
    vi.stubGlobal('document', { querySelector: (selector: string) => selector.includes('data-learner') ? learner : modal })
    expect(learnerModalOwnsKeyboard()).toBe(owns)
  })
})

describe('nativeControlOwnsKey — 포커스된 기본 조작부는 제 키를 쓴다', () => {
  // closest 를 흉내 내는 가짜 요소 — 자신 또는 조상 중 하나가 선택자에 맞으면 그 요소
  const el = (tag: string, opts: { role?: string; editable?: boolean; href?: boolean; parent?: unknown } = {}) => {
    const self = {
      tag, isContentEditable: !!opts.editable,
      matches(sel: string) {
        return sel.split(',').map((x) => x.trim()).some((x) =>
          x === tag || (x === 'a[href]' && tag === 'a' && !!opts.href) || (x === '[role="button"]' && opts.role === 'button'))
      },
      closest(sel: string): unknown {
        type Node = { matches: (s: string) => boolean; parent?: unknown }
        let cur = self as Node | undefined
        while (cur) { if (cur.matches(sel)) return cur; cur = cur.parent as Node | undefined }
        return null
      },
      parent: opts.parent,
    }
    return self as unknown as EventTarget
  }
  it.each([
    ['button(「전체 보기」)', el('button')],
    ['input', el('input')],
    ['textarea', el('textarea')],
    ['select', el('select')],
    ['a[href]', el('a', { href: true })],
    ['[role=button]', el('div', { role: 'button' })],
    ['contentEditable', el('div', { editable: true })],
    ['단추 안의 아이콘', el('svg', { parent: el('button') })],
  ])('%s → 전역 단축키가 먹지 않는다', (_n, t) => {
    expect(nativeControlOwnsKey(t)).toBe(true)
  })
  it.each([
    ['배경(body)', el('body')],
    ['목록 행 div', el('div', { parent: el('section') })],
    ['href 없는 a', el('a')],
    ['null', null],
  ])('%s → 전역 단축키(Space 듣기 · H/M 가리기) 유지', (_n, t) => {
    expect(nativeControlOwnsKey(t)).toBe(false)
  })
})
