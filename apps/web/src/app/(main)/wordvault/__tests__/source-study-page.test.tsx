// apps/web/src/app/(main)/wordvault/__tests__/source-study-page.test.tsx
// /wordvault/study 출처 세션 RSC + Browse 진입: 범위 · 0개 ≠ 실패 · 잘못된 주소 · 같은 목록 복귀 · 계정 guard · state: 경로 보존. DB 없음
import { renderToStaticMarkup, renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const TA = '00000000-0000-4000-8000-0000000000a1'
const SA = '00000000-0000-4000-8000-00000000000a'
const h = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  fail: false,
  membership: null as unknown,
  stateCalls: [] as unknown[],
  search: '',
  signedOut: false,
}))
vi.mock('next/navigation', () => ({
  redirect: (u: string) => { throw new Error(`redirect:${u}`) },
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
  useSearchParams: () => new URLSearchParams(h.search),
  usePathname: () => '/wordvault/study',
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: h.signedOut ? null : { id: 'u1' } } }) } }) }))
vi.mock('@/lib/wordvault/study-queries', () => ({
  STUDY_SESSION_CAP: 50,
  fetchAllStudyVocabulariesOrdered: async () => { if (h.fail) throw new Error('read failed'); return h.rows },
  fetchStudyVocabularies: async (_s: unknown, _u: unknown, key: unknown) => { h.stateCalls.push(key); return [] },
}))
vi.mock('@/lib/wordvault/set-membership-query', () => ({ loadArticleSetMembership: async () => h.membership }))
vi.mock('@/lib/wordvault/set-membership-actions', () => ({ fetchArticleSetMembership: async () => null }))

import StudyPage from '../study/page'
import { StoryAuthSourceContext, type StoryAuthSource } from '@/components/library/story/use-story-auth-guard'
import { WordVaultBrowseClient } from '@/components/wordvault/WordVaultBrowseClient'
import { vocabRowToWord } from '@/lib/wordvault/browse-queries'
import { parseStudyFilter, studyReopenHref } from '@/lib/wordvault/source-study'

const knownAs = (uid: string | null): StoryAuthSource => ({ subscribe: () => () => {}, currentUserId: async () => uid, testOnlyKnownUserId: () => uid })
const render = async (sp: Record<string, string | string[]>, uid: string | null = 'u1') =>
  renderToStaticMarkup(<StoryAuthSourceContext.Provider value={knownAs(uid)}>{await StudyPage({ searchParams: sp })}</StoryAuthSourceContext.Provider>)
const row = (id: string, word: string, text_id: string | null, shared_set_id: string | null) => ({ id, word, meaning: `${word}-뜻`, example_sentence: null, pronunciation: null, pos: 'n', cefr_level: 'B1', difficulty: null, stability: null, last_review_at: null, next_review_at: null, module_history: [], review_count: 0, text_id, shared_set_id, created_at: '2026-01-01' })
const back = `/wordvault/browse?filter=text%3A${TA}&q=zzz`

beforeEach(() => {
  h.rows = [row('r1', 'canyon', 'other', null), row('r2', 'orbit', TA, null), row('r3', 'flooding', null, SA), row('r4', 'harvest', null, 'setB')]
  h.fail = false
  h.membership = null
  h.stateCalls = []
  h.search = ''
})

describe('/wordvault/study 출처 세션', () => {
  it('글 범위의 내 단어만 · 자기 평가 안내', async () => {
    const html = await render({ filter: `text:${TA}`, from: back })
    expect(html).toContain('vocab-source-study-scope')
    expect(html).toContain('orbit')
    expect(html).not.toContain('canyon')
    expect(html).toContain('스스로 매기는 연습')
  })
  it('세트 A 는 다른 세트에서 먼저 가진 정본 낱말도 포함', async () => {
    h.membership = { setId: SA, words: ['flooding', 'harvest'] }
    const html = await render({ filter: `set:${SA}` })
    expect(html).toContain('flooding')
    expect(html).toContain('내 단어 2개') // flooding(origin) + harvest(다른 세트에서 먼저 가짐)
    expect(html).toContain('1 / 2')
    expect(html).not.toContain('orbit')
  })
  it('확인된 0개 = 빈 안내 + 같은 목록 복귀', async () => {
    const html = await render({ filter: `text:${TA}`, q: 'zzz', from: back })
    expect(html).toContain('vocab-source-study-empty')
    expect(html).toContain(`href="${back.replace('&', '&amp;')}"`)
  })
  it('membership 실패 · 단어 조회 실패 = 서로 다른 실패(0개 아님)', async () => {
    h.membership = { setId: SA, error: true }
    expect(await render({ filter: `set:${SA}` })).toContain('data-reason="membership"')
    h.membership = null
    h.fail = true
    const html = await render({ filter: `text:${TA}`, from: back })
    expect(html).toContain('data-reason="load"')
    expect(html).not.toContain('vocab-source-study-empty')
  })
  it.each([['text'], ['set:'], ['garbage'], ['text:not-a-uuid'], [[`text:${TA}`, `text:${TA}`]]])('잘못된 필터 %j = 실패 화면, 전체 단어 조회 안 함', async (filter) => {
    const html = await render({ filter })
    expect(html).toContain('data-reason="invalid"')
    expect(h.stateCalls).toEqual([])
    expect(html).not.toContain('canyon')
  })
  it('외부 from 은 버리고 그 출처 목록으로', async () => {
    h.fail = true
    const html = await render({ filter: `text:${TA}`, from: 'https://evil.example' })
    expect(html).toContain(`href="/wordvault/browse?filter=text%3A${TA}"`)
    expect(html).not.toContain('evil.example')
  })
  it('state: · 필터 없음 경로는 기존 그대로', async () => {
    await render({ filter: 'state:new' })
    await render({})
    expect(h.stateCalls).toEqual(['new', null])
  })
  it('계정이 바뀐 브라우저에서는 개인 단어를 그리지 않는다(기존 guard)', async () => {
    const html = renderToString(<StoryAuthSourceContext.Provider value={knownAs('u2')}>{await StudyPage({ searchParams: { filter: `text:${TA}` } })}</StoryAuthSourceContext.Provider>)
    expect(html).not.toContain('orbit')
    expect(html).not.toContain('vocab-source-study-scope')
  })
})

describe('로그인 전 · 다시 열기: 잘못된 요청은 잘못된 채로', () => {
  const nextOf = async (sp: Record<string, string | string[]>) => {
    h.signedOut = true
    const msg = await StudyPage({ searchParams: sp }).then(() => '', (e: Error) => e.message)
    h.signedOut = false
    expect(msg.startsWith('redirect:/login?next=')).toBe(true)
    return new URL(decodeURIComponent(msg.slice('redirect:/login?next='.length)), 'http://x')
  }
  it.each([
    [{ filter: [`text:${TA}`, `text:${SA}`] }],
    [{ filter: `text:${TA}`, q: ['a', 'b'] }],
    [{ filter: `text:${TA}`, level: ['a', 'b'] }],
  ])('%j → 로그인 뒤에도 invalid(전체 · 더 넓은 범위 아님)', async (sp) => {
    const u = await nextOf(sp)
    expect(u.pathname).toBe('/wordvault/study')
    expect(parseStudyFilter(u.searchParams.get('filter'), u.searchParams.get('q') ?? undefined, u.searchParams.get('level') ?? undefined).kind).toBe('invalid')
  })
  it('유효한 출처 · state · 없음의 next 는 그대로', async () => {
    const u = await nextOf({ filter: `text:${TA}`, q: 'orb', level: 'b' })
    expect(u.searchParams.get('filter')).toBe(`text:${TA}`)
    expect(u.searchParams.get('q')).toBe('orb')
    expect(u.searchParams.get('level')).toBe('b')
    expect((await nextOf({ filter: 'state:new' })).searchParams.get('filter')).toBe('state:new')
    expect((await nextOf({})).search).toBe('')
  })
  it('다시 열기 주소(계정 guard reopenHref) 빌더도 invalid 를 유지한다 — 직접 검사', () => {
    const cases: Array<[unknown, unknown, unknown]> = [[[`text:${TA}`, `text:${SA}`], undefined, undefined], [`text:${TA}`, ['a', 'b'], undefined], [`text:${TA}`, undefined, ['a', 'b']], ['garbage', undefined, undefined]]
    for (const [f, q, l] of cases) {
      const href = studyReopenHref(parseStudyFilter(f, q, l), f, l, '/wordvault/browse')
      const u = new URL(href, 'http://x')
      expect(u.pathname).toBe('/wordvault/study')
      expect(u.searchParams.get('filter')).toBe('invalid')
      expect(parseStudyFilter(u.searchParams.get('filter')).kind).toBe('invalid')
    }
    const ok = new URL(studyReopenHref(parseStudyFilter(`text:${TA}`, 'orb', 'b'), `text:${TA}`, 'b', null), 'http://x')
    expect([ok.searchParams.get('filter'), ok.searchParams.get('q'), ok.searchParams.get('level')]).toEqual([`text:${TA}`, 'orb', 'b'])
    expect(studyReopenHref(parseStudyFilter('state:new'), 'state:new', undefined, null)).toBe('/wordvault/study?filter=state%3Anew')
    expect(studyReopenHref(parseStudyFilter(undefined), undefined, undefined, null)).toBe('/wordvault/study')
  })
})

describe('Browse 출처 목록의 진입', () => {
  const words = () => h.rows.map((r, i) => vocabRowToWord(r as never, i))
  const browse = () => renderToStaticMarkup(<WordVaultBrowseClient words={words()} textChips={[{ id: `text:${TA}`, label: '글 A', count: 1 }]} setChips={[]} />)
  it('text: 목록 = 출처 · 검색 · 난이도 · 같은 목록 복귀를 실은 44px 진입', () => {
    h.search = `filter=text:${TA}&q=orb&level=b`
    const html = browse()
    const start = html.lastIndexOf('<a', html.indexOf('data-testid="vocab-source-recall-start"'))
    const tag = html.slice(start, html.indexOf('>', start))
    expect(tag).toContain('min-h-[44px]')
    expect(tag).toContain('focus-visible:outline')
    const u = new URL(tag.match(/href="([^"]+)"/)![1].replaceAll('&amp;', '&'), 'http://x')
    expect(u.pathname).toBe('/wordvault/study')
    expect(u.searchParams.get('filter')).toBe(`text:${TA}`)
    expect(u.searchParams.get('q')).toBe('orb')
    expect(u.searchParams.get('level')).toBe('b')
    expect(u.searchParams.get('from')).toBe(`/wordvault/browse?filter=text%3A${TA}&q=orb&level=b`)
  })
  it('전체 · state: 목록에는 진입 없음(기존 MemoryFilterBar 경로 보존)', () => {
    h.search = ''
    expect(browse()).not.toContain('vocab-source-recall')
    h.search = 'filter=state:new'
    expect(browse()).not.toContain('vocab-source-recall')
  })
})
