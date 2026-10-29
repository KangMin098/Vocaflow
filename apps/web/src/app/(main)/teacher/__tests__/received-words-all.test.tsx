// apps/web/src/app/(main)/teacher/__tests__/received-words-all.test.tsx
// T-0234 — 학생이 받은 과제 카드: 24개 뒤의 단어 · 뜻까지 「전체 보기」로. 실제 props → ReceivedAssignments.
// 0/24/25/200개 · 긴 뜻 · 뜻 없음 · 잘못된 행(「전체」라 부르지 않음) · 카드 독립 · 담기/기록/조회 호출 0.
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ calls: 0 }))
vi.mock('@/lib/teacher/assignment-actions', () => ({
  markAssignmentCollected: vi.fn(async () => { h.calls++; return { ok: true } }),
}))

import type { ClassAssignment } from '@/lib/teacher/assignment-actions'
import { ReceivedAssignments, readReceivedWords, RECEIVED_PREVIEW } from '@/components/teacher/ReceivedAssignments'

const words = (n: number, meaning = (i: number) => `뜻 ${i}`) => Array.from({ length: n }, (_, i) => ({ w: `word${i}`, m: meaning(i) }))
const card = (id: string, ws: unknown): ClassAssignment => ({ id, classId: 'c', className: '1반', title: `과제 ${id}`, words: ws as ClassAssignment['words'], createdAt: '2026-10-29T00:00:00Z' })
const render = (as: ClassAssignment[]) => renderToString(<ReceivedAssignments assignments={as} />)
const count = (html: string, re: RegExp) => (html.match(re) ?? []).length
const cardHtml = (html: string, id: string) => {
  const start = html.indexOf(`과제 ${id}<`)
  const next = html.indexOf('<li class="flex flex-col gap-3', start + 1)
  return html.slice(start, next < 0 ? undefined : next)
}

beforeEach(() => { h.calls = 0 })

describe('readReceivedWords', () => {
  it('정상 · 빈 배열 · 뜻 없음(null)', () => {
    expect(readReceivedWords([])).toEqual({ ok: true, words: [] })
    expect(readReceivedWords([{ w: 'a', m: '' }, { w: 'b' }, { w: 'c', m: '씨' }])).toEqual({ ok: true, words: [{ w: 'a', m: null }, { w: 'b', m: null }, { w: 'c', m: '씨' }] })
  })
  it('잘못된 행이 하나라도 있으면 ok:false — 일부만 골라 「전체」라 부르지 않는다', () => {
    for (const bad of [null, 'x', {}, [{ w: 'a' }, null], [{ w: '' }], [{ w: 'a', m: 3 }], [{ m: '뜻' }], [{ w: 'a' }, 'b']]) expect(readReceivedWords(bad).ok).toBe(false)
  })
})

describe('ReceivedAssignments — 카드 단어', () => {
  it('0개 — 「받은 단어가 없어요」 · 토글 없음', () => {
    const html = render([card('a', [])])
    expect(html).toContain('received-words-empty')
    expect(html).toContain('단어 0개')
    expect(html).not.toContain('received-words-toggle')
  })
  it('24개 — 전부 보이고 토글 없음', () => {
    const html = render([card('a', words(24))])
    expect(count(html, /data-testid="received-word"/g)).toBe(24)
    expect(html).not.toContain('received-words-toggle')
    expect(html).not.toContain('외 0개')
  })
  it('25개 — 처음 24 · 토글(aria-expanded=false · aria-controls · 44px · 링) 「전체 25개 보기 · 외 1개」', () => {
    const html = render([card('a', words(25))])
    expect(RECEIVED_PREVIEW).toBe(24)
    expect(count(html, /data-testid="received-word"/g)).toBe(24)
    const btn = /<button[^>]*data-testid="received-words-toggle"[^>]*>/.exec(html)?.[0] ?? ''
    expect(btn).toContain('aria-expanded="false"')
    const ctl = /aria-controls="([^"]+)"/.exec(btn)?.[1]
    expect(ctl && html.includes(`id="${ctl}"`)).toBe(true)
    expect(btn).toContain('min-h-11')
    expect(btn).toContain('focus-visible:ring-2')
    expect(html).toContain('전체 25개 보기 · 외 1개')
    expect(html).not.toContain('word24<')
  })
  it('200개 — 헤더 「단어 200개」 · 처음 24 · 「외 176개」', () => {
    const html = render([card('a', words(200))])
    expect(html).toContain('단어 200개')
    expect(count(html, /data-testid="received-word"/g)).toBe(24)
    expect(html).toContain('전체 200개 보기 · 외 176개')
  })
  it('뜻 없는 단어는 뜻 없이 그대로 · 긴 뜻은 줄바꿈 클래스', () => {
    const long = '아주 긴 뜻 '.repeat(20)
    const html = render([card('a', [{ w: 'bare', m: '' }, { w: 'long', m: long }])])
    expect(html).toContain('>bare</span></li>')
    expect(html).toContain(long)
    expect(html).toContain('break-keep')
  })
  it('잘못된 행 — 목록 대신 「확인할 수 없어요」 · 헤더도 개수 대신 「단어 목록 확인 불가」', () => {
    const html = render([card('a', [{ w: 'ok', m: '뜻' }, { m: 'no word' }])])
    expect(html).toContain('received-words-invalid')
    expect(html).toContain('단어 목록 확인 불가')
    expect(html).not.toContain('data-testid="received-word"')
    expect(html).not.toMatch(/단어 <!-- -->\d/)
  })
  it('카드 여러 개 — 각자 자기 단어 · 자기 토글(id 다름)', () => {
    const html = render([card('a', words(30)), card('b', words(3)), card('c', words(26))])
    expect(count(cardHtml(html, 'a'), /data-testid="received-word"/g)).toBe(24)
    expect(count(cardHtml(html, 'b'), /data-testid="received-word"/g)).toBe(3)
    expect(cardHtml(html, 'b')).not.toContain('received-words-toggle')
    const ids = [...html.matchAll(/aria-controls="([^"]+)"/g)].map((m) => m[1])
    expect(ids).toHaveLength(2)
    expect(new Set(ids).size).toBe(2)
  })
  it('그리는 데 담기 · 기록 · 조회 호출 0', () => {
    render([card('a', words(200)), card('b', words(25))])
    expect(h.calls).toBe(0)
  })
})
