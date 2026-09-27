// apps/web/src/lib/search/__tests__/global.test.ts
// 전역 검색의 순수 부분 — 검색어 정리 · 단어 판별 · 화면 · 영상 맞추기.

import { describe, expect, it } from 'vitest'

import { cleanQuery, GROUP_LIMIT, isWordQuery, matchPages, matchVideos, QUERY_MAX } from '../global'
import type { ResolvedVideo } from '@/lib/video/catalog'

describe('cleanQuery — 사용자 입력이 필터 문법이 되지 않는다', () => {
  it('PostgREST or()/ilike 문법 글자를 지운다', () => {
    expect(cleanQuery('pride%,and(prejudice)*')).toBe('pride and prejudice')
    expect(cleanQuery(String.raw`a_b\c"d`)).toBe('a b c d')
  })
  it('공백을 접고 앞뒤를 자른다 · 비면 빈 문자열', () => {
    expect(cleanQuery('   ')).toBe('')
    expect(cleanQuery(null)).toBe('')
    expect(cleanQuery('  mr.   darcy ')).toBe('mr. darcy')
  })
  it(`${QUERY_MAX}자에서 자른다`, () => {
    expect(cleanQuery('x'.repeat(200))).toHaveLength(QUERY_MAX)
  })
})

describe('isWordQuery — 영어 낱말 모양일 때만 사전을 조회한다', () => {
  it.each(['cat', 'well-being', "don't", 'ice cream'])('%s → 낱말', (q) => expect(isWordQuery(q)).toBe(true))
  it.each(['단어', '123', '', 'a'.repeat(60)])('%s → 낱말 아님', (q) => expect(isWordQuery(q)).toBe(false))
})

describe('matchPages — 내비 데이터의 실재 경로만', () => {
  it('한국어 제목으로 찾는다', () => {
    const hits = matchPages('진단')
    expect(hits.some((h) => h.href === '/fit')).toBe(true)
  })
  it('같은 경로는 한 번만 · 묶음 상한을 지킨다', () => {
    const hits = matchPages('학습')
    const hrefs = hits.map((h) => h.href)
    expect(new Set(hrefs).size).toBe(hrefs.length)
    expect(hits.length).toBeLessThanOrEqual(GROUP_LIMIT)
    for (const h of hits) expect(h.href?.startsWith('/')).toBe(true)
  })
  it('빈 검색어는 빈 결과', () => expect(matchPages('')).toEqual([]))
})

describe('matchVideos', () => {
  const v = (id: string, title: string, subtitle = '') => ({ id, title, subtitle }) as unknown as ResolvedVideo
  it('제목·부제에서 대소문자 없이 찾고 편별 주소로 잇는다', () => {
    const hits = matchVideos([v('a', 'Vocaflow 소개'), v('b', '읽기', 'FSRS 복습')], 'fsrs')
    expect(hits).toEqual([{ href: '/video/b', title: '읽기', sub: 'FSRS 복습' }])
  })
})
