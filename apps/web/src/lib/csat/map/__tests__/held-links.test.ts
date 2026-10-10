// apps/web/src/lib/csat/map/__tests__/held-links.test.ts
// 지도 확인 링크 · 확인 결과의 보류 관문 — 보류 문항은 빼고, 판정 실패면 전부 뺀다(Codex P1 · 2026-10-10)
import { describe, expect, it } from 'vitest'

import { withoutHeld } from '../load'

const link = (items: string[]) => ({ href: '', label: '', itemId: items[0], target: items[0], taskKey: 'evidence-locate', confirm: items.map((t) => ({ href: '/x', label: t, target: t, taskKey: 'evidence-locate' })) })

describe('withoutHeld', () => {
  it('보류 문항만 빠지고 첫 문항이 보류면 다음 문항이 대표가 된다', () => {
    const out = withoutHeld({ 'A5-4': link(['2026#31', '2026#32']) }, { held: new Set(['2026#31']), failed: false })
    expect(out['A5-4'].confirm.map((c) => c.target)).toEqual(['2026#32'])
    expect(out['A5-4'].target).toBe('2026#32')
  })
  it('확인 문항이 다 보류면 그 과제 링크가 없다', () => {
    expect(withoutHeld({ 'A5-4': link(['2026#31']) }, { held: new Set(['2026#31']), failed: false })).toEqual({})
  })
  it('판정 실패면 링크 전부 없음(fail-closed)', () => {
    expect(withoutHeld({ 'A5-4': link(['2026#31']) }, { held: new Set(), failed: true })).toEqual({})
  })
})
