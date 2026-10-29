// apps/web/src/lib/wordvault/__tests__/source-study.test.ts
// 출처 목록 → 뜻 떠올리기 범위: 엄격한 필터 판정 · Browse 와 같은 범위 · 범위 뒤 상한 · 복귀 주소 검증. DB 없음
import { describe, expect, it } from 'vitest'

import { applySourceFilter, type SetMembership } from '@/lib/wordvault/source-filter'
import { currentBrowseHref, parseStudyFilter, scopeSourceStudyWords, sourceStudyHref, sourceStudyReturnHref } from '@/lib/wordvault/source-study'

const TA = '00000000-0000-4000-8000-0000000000a1'
const TB = '00000000-0000-4000-8000-0000000000b1'
const SA = '00000000-0000-4000-8000-00000000000a'
const SB = '00000000-0000-4000-8000-00000000000b'

type W = { id: number; word: string; meaning: string; setId: string | null; textId: string | null; level: 'A1' | 'B1' | 'C1'; levelClass: 'a' | 'b' | 'c' }
const w = (id: number, word: string, setId: string | null, textId: string | null, level: W['level'] = 'B1'): W => ({ id, word, meaning: `${word}-뜻`, setId, textId, level, levelClass: level[0].toLowerCase() as W['levelClass'] })

const WORDS: W[] = [
  w(1, 'flooding', SA, null),
  w(2, 'harvest', SB, null), // B 에서 먼저 가짐 · A 정본에도 있음
  w(3, 'drought', SB, null, 'C1'),
  w(4, 'satellite', null, TA, 'A1'),
  w(5, 'orbit', null, TA),
  w(6, 'canyon', null, TB),
]
const memA: SetMembership = { setId: SA, words: new Set(['flooding', 'harvest', 'soybean']) }
const src = (filter: string, query = '', level: null | { kind: 'class'; value: 'a' | 'b' | 'c' } = null) => ({ filter, query, level })
const ids = (r: ReturnType<typeof scopeSourceStudyWords<W>>) => (r.status === 'ok' ? r.words.map((x) => x.id) : r.status)

describe('parseStudyFilter', () => {
  it('없음 · 빈 값 · all · 지원 state: 는 기존 진입 그대로', () => {
    expect(parseStudyFilter(undefined)).toEqual({ kind: 'none' })
    expect(parseStudyFilter('')).toEqual({ kind: 'none' })
    expect(parseStudyFilter('all')).toEqual({ kind: 'none' })
    expect(parseStudyFilter('state:new')).toEqual({ kind: 'state', key: 'new' })
  })
  it.each(['text', 'set', 'text:', 'set:', 'garbage', 'text:not-a-uuid', 'set:123', 'state:bogus'])('명시했지만 틀린 값 %s = invalid(전체 앞 50 아님)', (v) => {
    expect(parseStudyFilter(v).kind).toBe('invalid')
  })
  it('반복 필터 · 반복 q/level · 모르는 level = invalid', () => {
    expect(parseStudyFilter([`text:${TA}`, `text:${TB}`]).kind).toBe('invalid')
    expect(parseStudyFilter(['state:new', 'state:new']).kind).toBe('invalid')
    expect(parseStudyFilter(`text:${TA}`, ['a', 'b']).kind).toBe('invalid')
    expect(parseStudyFilter(`text:${TA}`, undefined, ['a', 'b']).kind).toBe('invalid')
    expect(parseStudyFilter(`text:${TA}`, undefined, 'Z9').kind).toBe('invalid')
  })
  it('출처 + 검색 · 난이도 · 예전 uuid 링크', () => {
    expect(parseStudyFilter(`set:${SA}`, ' orb ', 'b')).toEqual({ kind: 'source', filter: `set:${SA}`, query: 'orb', level: { kind: 'class', value: 'b' } })
    expect(parseStudyFilter(TA)).toEqual({ kind: 'source', filter: `text:${TA}`, query: '', level: null })
    expect(parseStudyFilter(`text:${TA}`, undefined, 'all')).toMatchObject({ level: null })
  })
})

describe('scopeSourceStudyWords — Browse 와 같은 범위', () => {
  it('글 A vs 글 B', () => {
    expect(ids(scopeSourceStudyWords(WORDS, src(`text:${TA}`), null, 50))).toEqual([4, 5])
    expect(ids(scopeSourceStudyWords(WORDS, src(`text:${TB}`), null, 50))).toEqual([6])
  })
  it('세트 A = origin + 다른 출처에서 먼저 가진 정본 낱말 — Browse(applySourceFilter)와 같다', () => {
    const r = scopeSourceStudyWords(WORDS, src(`set:${SA}`), memA, 50)
    expect(ids(r)).toEqual([1, 2])
    expect(ids(r)).toEqual(applySourceFilter(WORDS, `set:${SA}`, memA).map((x) => x.id))
  })
  it('세트 B (A 의 membership 은 쓰지 않음)', () => {
    expect(ids(scopeSourceStudyWords(WORDS, src(`set:${SB}`), memA, 50))).toEqual([2, 3])
  })
  it('확인된 0개 ≠ membership 조회 실패', () => {
    expect(scopeSourceStudyWords(WORDS, src('text:00000000-0000-4000-8000-000000000999'), null, 50)).toEqual({ status: 'ok', words: [], total: 0 })
    expect(scopeSourceStudyWords(WORDS, src(`set:${SA}`), { setId: SA, error: true }, 50)).toEqual({ status: 'membership-error' })
  })
  it('검색 · 난이도 보존', () => {
    expect(ids(scopeSourceStudyWords(WORDS, src(`text:${TA}`, 'orb'), null, 50))).toEqual([5])
    expect(ids(scopeSourceStudyWords(WORDS, src(`set:${SB}`, '', { kind: 'class', value: 'c' }), null, 50))).toEqual([3])
  })
  it('상한은 범위 뒤 — 앞 60개가 다른 출처여도 이 출처 단어가 세션을 채운다', () => {
    const many = [...Array.from({ length: 60 }, (_, i) => w(100 + i, `other${i}`, null, TB)), ...Array.from({ length: 55 }, (_, i) => w(200 + i, `mine${i}`, null, TA))]
    const r = scopeSourceStudyWords(many, src(`text:${TA}`), null, 50)
    if (r.status !== 'ok') throw new Error('status')
    expect(r.words.length).toBe(50)
    expect(r.total).toBe(55)
    expect(r.words.every((x) => x.textId === TA)).toBe(true)
    expect(r.words[0].id).toBe(200) // 순서(due 우선) 유지
  })
})

describe('복귀 · 진입 주소', () => {
  it('검증된 내부 Browse 주소만, 아니면 그 출처 목록', () => {
    const back = `/wordvault/browse?filter=text%3A${TA}&q=orb`
    expect(sourceStudyReturnHref(back, `text:${TA}`)).toBe(back)
    for (const bad of ['https://evil.example/x', '//evil.example', '/\\evil.example', '/dashboard', undefined, ['/wordvault/browse']]) {
      expect(sourceStudyReturnHref(bad, `text:${TA}`)).toBe(`/wordvault/browse?filter=text%3A${TA}`)
    }
    expect(sourceStudyReturnHref(undefined, '')).toBe('/wordvault/browse')
  })
  it('진입 주소는 출처 · 검색 · 난이도 · 목록을 싣고, 다시 해석하면 같은 범위', () => {
    const from = currentBrowseHref(new URLSearchParams(`filter=set:${SB}&book=b1&chapter=2&q=old`), { filter: `set:${SA}`, query: 'har', level: 'b' })
    expect(from).toBe(`/wordvault/browse?filter=set%3A${SA}&book=b1&chapter=2&q=har&level=b`)
    const u = new URL(sourceStudyHref({ filter: `set:${SA}`, query: 'har', level: 'b', from }), 'http://x')
    expect(u.pathname).toBe('/wordvault/study')
    expect(parseStudyFilter(u.searchParams.get('filter'), u.searchParams.get('q') ?? undefined, u.searchParams.get('level') ?? undefined)).toMatchObject({ kind: 'source', filter: `set:${SA}`, query: 'har' })
    expect(sourceStudyReturnHref(u.searchParams.get('from'), `set:${SA}`)).toBe(from)
    expect(new URL(sourceStudyHref({ filter: `text:${TA}`, level: 'all', from: '/wordvault/browse' }), 'http://x').searchParams.has('level')).toBe(false)
  })
})
