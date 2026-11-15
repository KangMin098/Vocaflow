// apps/web/src/lib/recommend/__tests__/reason.test.tsx
// @vitest-environment node
// 추천 근거(설명용 코드) — 결정 우선순위 · 목적지 · 라벨 불변, 근거 대응, 조회 오류 · 예외 한계, 계정 전환 개인정보 경계, 카드 표시
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  user: { id: 'user-a' } as { id: string } | null,
  results: {} as Record<string, { data?: unknown; count?: number | null; error?: unknown }>,
  throwOn: null as string | null,
}))

/** 체인 끝을 await 하면 그 표의 결과를 돌려주는 최소 질의 빌더 */
function chain(table: string, kind: string) {
  const res = () => {
    if (db.throwOn === table) throw new Error('boom')
    return db.results[`${table}:${kind}`] ?? db.results[table] ?? { data: null, count: 0, error: null }
  }
  const p: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'is', 'or', 'not', 'order', 'range', 'lte']) {
    p[m] = (...args: unknown[]) => {
      if (m === 'lte') return chain(table, 'due')
      if (m === 'select' && (args[1] as { head?: boolean } | undefined)?.head) return chain(table, kind === 'due' ? 'due' : 'total')
      return p
    }
  }
  p.maybeSingle = async () => res()
  p.then = (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => {
    try {
      return Promise.resolve(res()).then(ok, bad)
    } catch (e) {
      return Promise.reject(e).then(ok, bad)
    }
  }
  return p
}
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: db.user } }) },
    from: (t: string) => chain(t, 'total'),
  }),
}))

import { NextActionCard, GENERIC_REASON, LIMIT_NOTE, REASON_COPY } from '@/components/recommend/NextActionCard'
import { decideNextAction, markUnconfirmed } from '../decide'
import { getNextActionForUser } from '../get-next-action'
import { visibleNextAction } from '../use-next-action'
import { actionToHref } from '../next-action.mock'
import type { RecommendedAction } from '../types'

const strip = (a: RecommendedAction) => {
  const { reason: _r, ...rest } = a
  void _r
  return rest
}

describe('decideNextAction — 기존 결정 불변 + 근거', () => {
  const cases: Array<[Parameters<typeof decideNextAction>[0], Omit<RecommendedAction, 'reason'>, RecommendedAction['reason'], string]> = [
    [{ masteryLevel: 'hot', urgentWordCount: 5, inProgressTextTitle: 'T', inProgressTextId: 't1' }, { module: 'flashcard', strategy: 'blocked', label: '위급 단어 5개 다시 만나기' }, 'due_review', '/flashcard?mode=review'],
    [{ masteryLevel: 'hot', urgentWordCount: 2, inProgressTextTitle: 'T', inProgressTextId: 't1' }, { module: 'workspace', label: 'T 이어 보기', textId: 't1' }, 'resume_text', '/text/t1'],
    [{ masteryLevel: 'cold', urgentWordCount: 0 }, { module: 'flashcard', strategy: 'blocked', label: '익히기 시작 — 단어 만나보기' }, 'practice_flow', '/flashcard?mode=review'],
    [{ masteryLevel: 'warm', urgentWordCount: 0 }, { module: 'spellforge', strategy: 'hybrid', label: '단어를 정확하게 — 철자로 다지기' }, 'practice_flow', '/spellforge'],
    [{ masteryLevel: 'hot', urgentWordCount: 0 }, { module: 'scriptquiz', strategy: 'interleaved', label: '정복 도전 — 스크립트 안에서 확인' }, 'practice_flow', '/scriptquiz'],
    [{ masteryLevel: 'unknown' as never, urgentWordCount: 0 }, { module: 'library', label: '새 스크립트를 만나보세요' }, 'explore', '/library'],
  ]
  for (const [ctx, expected, reason, href] of cases) {
    it(`${expected.label} → ${reason}`, () => {
      const a = decideNextAction(ctx)
      expect(strip(a)).toEqual(expected)
      expect(a.reason).toBe(reason)
      expect(actionToHref(a)).toBe(href)
    })
  }
  it('markUnconfirmed 는 근거만 바꾸고 결정은 그대로', () => {
    const a = decideNextAction({ masteryLevel: 'warm', urgentWordCount: 0 })
    expect(markUnconfirmed(a, false)).toBe(a)
    const u = markUnconfirmed(a, true)
    expect(strip(u)).toEqual(strip(a))
    expect(u.reason).toBe('unconfirmed')
  })
})

describe('getNextActionForUser — 조회 오류 · 예외의 한계 표시', () => {
  beforeEach(() => {
    db.user = { id: 'user-a' }
    db.results = {
      'vocabularies:total': { count: 400, error: null },
      'vocabularies:due': { count: 0, error: null },
      user_stats: { data: { mastery_level: 'warm' }, error: null },
      texts: { data: [], error: null },
    }
    db.throwOn = null
  })
  it('정상 조회면 결정 분기의 근거', async () => {
    const r = await getNextActionForUser()
    expect(r.action.reason).toBe('practice_flow')
    expect(r.action.module).toBe('spellforge')
  })
  for (const key of ['vocabularies:due', 'user_stats', 'texts'] as const) {
    it(`${key} 오류 → 같은 결정 · 근거 unconfirmed(낮은 능력으로 바꾸지 않음)`, async () => {
      db.results[key] = { data: null, count: null, error: { message: 'x' } }
      const r = await getNextActionForUser()
      expect(r.action.reason).toBe('unconfirmed')
      expect(r.fallback.reason).toBe('unconfirmed')
      expect(r.personal).toBe(false)
    })
  }
  for (const key of ['vocabularies:total', 'vocabularies:due'] as const) {
    it(`${key} count 가 null(오류 없음) → 확인된 0 이 아니다 · 근거 unconfirmed`, async () => {
      db.results[key] = { data: null, count: null, error: null }
      const r = await getNextActionForUser()
      expect(r.action.reason).toBe('unconfirmed')
      expect(r.fallback.reason).toBe('unconfirmed')
    })
  }
  it('예외 → 기존 cold 목적지 · 라벨 그대로, 근거 unconfirmed, 계정 정보 없음', async () => {
    db.throwOn = 'user_stats'
    const r = await getNextActionForUser()
    expect(strip(r.action)).toEqual({ module: 'library', label: '새 스크립트를 만나보세요' })
    expect(r.action.reason).toBe('unconfirmed')
    expect(r.ownerId).toBeNull()
  })
  it('비로그인 → 기존 cold(explore)', async () => {
    db.user = null
    const r = await getNextActionForUser()
    expect(r.action.reason).toBe('explore')
  })
})

describe('계정 전환 — 개인 글 근거 · 제목은 신원 확인 때만', () => {
  const res = {
    action: { module: 'workspace' as const, label: 'Secret Essay 이어 보기', textId: 'secret-t', reason: 'resume_text' as const },
    fallback: { module: 'spellforge' as const, strategy: 'hybrid' as const, label: '단어를 정확하게 — 철자로 다지기', reason: 'practice_flow' as const },
    personal: true,
    ownerId: 'user-a',
  }
  for (const st of ['checking', 'changed'] as const) {
    it(`${st}: fallback 만 · 개인 글 제목 · id · resume 근거가 카드에 없다`, () => {
      const v = visibleNextAction(res, st)
      expect(v).toBe(res.fallback)
      const html = renderToStaticMarkup(<NextActionCard recommendation={v} />)
      expect(html).not.toContain('Secret Essay')
      expect(html).not.toContain('secret-t')
      expect(html).not.toContain(REASON_COPY.resume_text)
      expect(html).not.toContain('user-a')
    })
  }
  it('same: 본인 글 추천과 그 근거', () => {
    const html = renderToStaticMarkup(<NextActionCard recommendation={visibleNextAction(res, 'same')} />)
    expect(html).toContain(REASON_COPY.resume_text)
  })
  it('응답 전 초기값은 근거 확인 전(unconfirmed)', () => {
    expect(visibleNextAction(null, 'checking').reason).toBe('unconfirmed')
  })
})

describe('NextActionCard 표시', () => {
  const hrefs = (h: string) => [...h.matchAll(/href="([^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, '&'))
  it('근거 · 한계 문구 · 다른 자료 고르기(/library) · 44px · focus', () => {
    const html = renderToStaticMarkup(<NextActionCard recommendation={decideNextAction({ masteryLevel: 'warm', urgentWordCount: 0 })} />)
    expect(html).toContain(REASON_COPY.practice_flow)
    expect(html).toContain(LIMIT_NOTE)
    expect(hrefs(html)).toEqual(['/spellforge', '/library'])
    expect(html).toContain('다른 자료 고르기')
    expect((html.match(/min-h-\[44px\]/g) ?? []).length).toBe(2)
    expect((html.match(/focus-visible:ring-2/g) ?? []).length).toBe(2)
  })
  it('주 목적지가 /library 면 다른 자료 고르기를 겹치지 않는다', () => {
    const html = renderToStaticMarkup(<NextActionCard recommendation={{ module: 'library', label: '새 스크립트를 만나보세요', reason: 'explore' }} />)
    expect(hrefs(html)).toEqual(['/library'])
    expect(html).not.toContain('다른 자료 고르기')
  })
  it('근거 없는 기존 수동 객체 → 구체 근거를 지어내지 않는 일반 문구', () => {
    const html = renderToStaticMarkup(<NextActionCard recommendation={{ module: 'dictation', label: '받아쓰기' }} />)
    expect(html).toContain(GENERIC_REASON)
    for (const c of Object.values(REASON_COPY)) expect(html).not.toContain(c)
    expect(html).toContain(LIMIT_NOTE)
  })
  it('조회 실패 근거는 낮은 능력 표현을 쓰지 않는다', () => {
    const html = renderToStaticMarkup(<NextActionCard recommendation={{ module: 'library', label: 'x', reason: 'unconfirmed' }} />)
    expect(html).toContain(REASON_COPY.unconfirmed)
    expect(html).not.toMatch(/부족|낮|못해요|실패했/)
  })
})
