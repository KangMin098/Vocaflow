// apps/web/src/lib/wordvault/__tests__/state-scoped-study.test.ts
// 기억 상태 목록 + 검색 · 난이도 → 뜻 떠올리기: 상태(주입 시각) → 검색 → 난이도 → 상한 순 · 판정 · 다시 열기. DB 없음
import { describe, expect, it } from 'vitest'

import type { VocabRow } from '@/lib/wordvault/browse-queries'
import { parseStudyFilter, sourceStudyHref, studyReopenHref } from '@/lib/wordvault/source-study'
import { filterRowsByState, scopeStateStudyRows, STUDY_SESSION_CAP } from '@/lib/wordvault/study-queries'

const NOW = new Date('2026-10-28T00:00:00Z')
const DAY = 86_400_000
const row = (id: string, word: string, cefr: string, over: Partial<VocabRow> = {}): VocabRow =>
  ({ id, word, meaning: `${word}-뜻`, example_sentence: null, pronunciation: null, pos: 'n', cefr_level: cefr, difficulty: null, stability: null, last_review_at: null, next_review_at: null, module_history: [], review_count: 0, text_id: null, shared_set_id: null, created_at: '2026-01-01', ...over }) as VocabRow
const reviewed = (id: string, word: string, daysAgo: number, stability = 1) =>
  row(id, word, 'B1', { last_review_at: new Date(NOW.getTime() - daysAgo * DAY).toISOString(), stability, review_count: 1 })

describe('parseStudyFilter — 기억 상태 + 조건', () => {
  it('state:new + q/level = state-scoped · 조건 없으면 기존 state 그대로', () => {
    expect(parseStudyFilter('state:new', 'orb', 'b')).toEqual({ kind: 'state-scoped', key: 'new', query: 'orb', level: { kind: 'class', value: 'b' } })
    expect(parseStudyFilter('state:new')).toEqual({ kind: 'state', key: 'new' })
    expect(parseStudyFilter('state:new', '', 'all')).toEqual({ kind: 'state', key: 'new' })
  })
  it('반복 · 모르는 q/level = invalid(조건을 버려 넓히지 않는다)', () => {
    expect(parseStudyFilter('state:new', ['orb', 'x']).kind).toBe('invalid')
    expect(parseStudyFilter('state:new', undefined, ['b', 'c']).kind).toBe('invalid')
    expect(parseStudyFilter('state:new', undefined, 'Z9').kind).toBe('invalid')
  })
  it('다시 열기 · 로그인 주소는 상태 · 조건을 싣고, invalid 는 invalid 로', () => {
    const p = parseStudyFilter('state:new', 'orb', 'b')
    const u = new URL(studyReopenHref(p, 'state:new', 'b', '/wordvault/browse?filter=state%3Anew&q=orb&level=b'), 'http://x')
    expect([u.searchParams.get('filter'), u.searchParams.get('q'), u.searchParams.get('level'), u.searchParams.get('from')]).toEqual(['state:new', 'orb', 'b', '/wordvault/browse?filter=state%3Anew&q=orb&level=b'])
    expect(new URL(studyReopenHref(parseStudyFilter('state:new', ['a', 'b']), 'state:new', undefined, null), 'http://x').searchParams.get('filter')).toBe('invalid')
  })
  it('Browse 진입 주소를 다시 해석하면 같은 조건', () => {
    const u = new URL(sourceStudyHref({ filter: 'state:new', query: 'orb', level: 'b', from: '/wordvault/browse?filter=state%3Anew&q=orb&level=b' }), 'http://x')
    expect(parseStudyFilter(u.searchParams.get('filter'), u.searchParams.get('q') ?? undefined, u.searchParams.get('level') ?? undefined)).toMatchObject({ kind: 'state-scoped', key: 'new', query: 'orb' })
  })
})

describe('scopeStateStudyRows', () => {
  const scope = (query: string, level: null | { kind: 'class'; value: 'a' | 'b' | 'c' }) => ({ query, level })
  it('state:new · q=orb · level=b → orbit 만(다른 상태 · 다른 난이도 · 검색 불일치 제외)', () => {
    const rows = [row('1', 'canyon', 'B1'), row('2', 'orbit', 'B1'), row('3', 'orbiter', 'C1'), reviewed('4', 'orbital', 0)]
    const r = scopeStateStudyRows(rows, 'new', scope('orb', { kind: 'class', value: 'b' }), STUDY_SESSION_CAP, NOW)
    expect(r.words.map((w) => w.word)).toEqual(['orbit'])
    expect(r.total).toBe(1)
  })
  it('상한은 맨 뒤 — 앞 60개가 검색 불일치여도 뒤의 적격 단어를 찾는다(정렬 유지)', () => {
    const rows = [...Array.from({ length: 60 }, (_, i) => row(`x${i}`, `canyon${i}`, 'B1')), ...Array.from({ length: 55 }, (_, i) => row(`o${i}`, `orb${i}`, 'B1'))]
    const r = scopeStateStudyRows(rows, 'new', scope('orb', null), 50, NOW)
    expect(r.words.length).toBe(50)
    expect(r.total).toBe(55)
    expect(r.words[0].word).toBe('orb0')
    expect(r.words.every((w) => w.word.startsWith('orb'))).toBe(true)
  })
  it('0개 = 빈 결과(오류 아님)', () => {
    expect(scopeStateStudyRows([row('1', 'canyon', 'B1')], 'new', scope('zzz', null), 50, NOW)).toEqual({ words: [], total: 0 })
  })
  it('상태는 주입한 한 시각으로 — 시계를 읽지 않는다', () => {
    const rows = [reviewed('1', 'orbit', 0, 1)]
    expect(scopeStateStudyRows(rows, 'stable', scope('orb', null), 50, NOW).total).toBe(1)
    const later = new Date(NOW.getTime() + 30 * DAY)
    expect(scopeStateStudyRows(rows, 'stable', scope('orb', null), 50, later).total).toBe(0)
    expect(scopeStateStudyRows(rows, 'risk', scope('orb', null), 50, later).total).toBe(1)
    // 조건이 없으면 기존 state 경로(filterRowsByState → 상한)와 같은 단어
    expect(scopeStateStudyRows(rows, 'risk', scope('', null), 50, later).words.map((w) => w.dbId)).toEqual(filterRowsByState(rows, 'risk', later).slice(0, 50).map((r) => r.id))
  })
})
