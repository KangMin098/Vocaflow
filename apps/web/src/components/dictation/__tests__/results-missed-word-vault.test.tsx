// apps/web/src/components/dictation/__tests__/results-missed-word-vault.test.tsx
// @vitest-environment node
// DIC-VOC-01(T-0221 다음 T-0219) — 받아쓰기 결과의 놓친 낱말 → 「내 단어장에서 이 낱말 찾기」.
// 실제 DictationResultsClient 의 ready 분기를 그린다: 놓친 0/1/여러 개 · 맞음+놓침 중복은 놓침으로 한 번 · 주인 확인(same)일 때만 · 실제 WordVault q 파서와 일치.
import { renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  seeded: [] as unknown[],
  search: new URLSearchParams(),
  auth: 'same' as 'same' | 'checking' | 'changed',
  calls: 0,
}))

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  return {
    ...actual,
    useState: (init: unknown) => (h.seeded.length > 0 ? [h.seeded.shift(), () => {}] : actual.useState(init)),
  }
})
// next/link 의 prefetch 값을 그대로 드러내는 대역(나머지 속성·href 는 실제 Link 처럼 a 에 넘긴다)
vi.mock('next/link', async () => {
  const React = await vi.importActual<typeof import('react')>('react')
  return {
    default: ({ href, prefetch, children, ...rest }: { href: string; prefetch?: boolean; children?: React.ReactNode }) =>
      React.createElement('a', { href, 'data-prefetch': String(prefetch), ...rest }, children),
  }
})
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => h.search,
}))
// 추가 네트워크 0 — 결과 화면이 클라이언트를 만들거나 조회하면 센다
vi.mock('@/lib/supabase/client', () => ({ createClient: () => { h.calls++; return {} } }))
vi.mock('@/lib/recommend/use-next-action', () => ({ useNextAction: () => null }))
vi.mock('@/components/recommend/NextActionCard', () => ({ NextActionCard: () => null }))
vi.mock('@/lib/dictation/persist', () => ({ fetchDictationSessionDetail: vi.fn(async () => { h.calls++; return null }) }))
vi.mock('@/components/library/story/use-story-auth-guard', async () => {
  const actual = await vi.importActual<typeof import('@/components/library/story/use-story-auth-guard')>(
    '@/components/library/story/use-story-auth-guard',
  )
  return {
    ...actual,
    useStoryAuthGuard: (owner: string | null) => {
      const guard = new actual.StoryAuthGuard(owner)
      if (owner && h.auth === 'same') guard.observe({ event: 'KNOWN', userId: owner })
      if (owner && h.auth === 'changed') guard.observe({ event: 'KNOWN', userId: 'someone-else' })
      return { guard, status: guard.status }
    },
  }
})

import type { SessionDetail } from '@/lib/dictation/persist'
import { normalizeQuery, matchesQuery } from '@/lib/wordvault/list-params'
import { wordVaultSearchHref, WORD_VAULT_BROWSE_PATH } from '@/lib/dictation/word-vault-link'
import { DictationResultsClient } from '../DictationResultsClient'

type Row = { targetWords: string[]; targetHits: string[] }
function snap(rows: Row[]): SessionDetail {
  return {
    session: {
      id: 'sess-a', title: 'T', sourceKind: 'custom', avgAccuracy: 50, completedItems: rows.length, totalItems: rows.length,
      completedAt: '2026-10-29T00:00:00Z', startedAt: '2026-10-29T00:00:00Z', totalHints: 0, durationMs: 1000, longestPerfectWords: 0,
      textId: null, sharedSetId: null, chapterIdx: null, userId: 'user-a',
    },
    attempts: rows.map((r, i) => ({
      itemIdx: i, expected: `Sentence number ${i} is here.`, userInput: 'typed', accuracy: 50, hintsUsed: 0, replayCount: 0,
      skipped: false, wordResults: [], errorTags: [], targetWords: r.targetWords, targetHits: r.targetHits,
    })),
  } as SessionDetail
}
function render(d: SessionDetail) {
  h.seeded = [d, 'ready']
  h.search = new URLSearchParams({ sessionId: 'sess-a' })
  return renderToString(<DictationResultsClient />)
}
const links = (html: string) =>
  [...html.matchAll(/<a[^>]*data-testid="missed-word-vault-link"[^>]*>/g)].map((m) => ({
    href: m[0].match(/href="([^"]*)"/)?.[1].replace(/&amp;/g, '&') ?? '',
    label: m[0].match(/aria-label="([^"]*)"/)?.[1] ?? '',
    tag: m[0],
  }))

beforeEach(() => {
  h.seeded = []
  h.auth = 'same'
  h.calls = 0
})

describe('wordVaultSearchHref — 실제 WordVault q 파서와 일치', () => {
  const words = ['harvest', 'Harvest', "don't", 'self-made', 'café', 'rock & roll', 'a+b=c', '100%', '  spaced  ', '#tag?x=1']
  for (const w of words) {
    it(`왕복: ${JSON.stringify(w)}`, () => {
      const href = wordVaultSearchHref(w)!
      const u = new URL(href, 'https://x.test')
      expect(u.pathname).toBe(WORD_VAULT_BROWSE_PATH)
      expect([...u.searchParams.keys()]).toEqual(['q'])
      // WordVaultBrowseClient: normalizeQuery(searchParams.get('q'))
      expect(normalizeQuery(u.searchParams.get('q'))).toBe(w.trim())
      // 대소문자 무관 검색 — 내 단어장 항목과 만난다
      expect(matchesQuery({ word: w.trim().toLowerCase(), meaning: '' }, normalizeQuery(u.searchParams.get('q')))).toBe(true)
      expect(href).not.toMatch(/user|uid|session/i)
    })
  }
  it('빈 낱말 · 공백만은 링크를 만들지 않는다', () => {
    expect(wordVaultSearchHref('')).toBeNull()
    expect(wordVaultSearchHref('   ')).toBeNull()
  })
})

describe('결과 화면 — 놓친 낱말 링크', () => {
  it('놓친 0개(모두 맞힘)면 링크 영역이 없다', () => {
    const html = render(snap([{ targetWords: ['harvest'], targetHits: ['harvest'] }]))
    expect(html).toContain('✓ <!-- -->harvest')
    expect(html).not.toContain('missed-word-vault')
  })
  it('놓친 1개 — 링크 하나 · 44px · 초점 링 · 이름 「내 단어장에서 … 찾기」', () => {
    const html = render(snap([{ targetWords: ['harvest', 'drought'], targetHits: ['harvest'] }]))
    expect(html).toContain('내 단어장에서 이 낱말 찾기')
    const l = links(html)
    expect(l.map((x) => x.href)).toEqual(['/wordvault/browse?q=drought'])
    expect(l[0].label).toBe('내 단어장에서 drought 찾기')
    expect(l[0].tag).toContain('min-h-[44px]')
    expect(l[0].tag).toContain('focus-visible:ring-2')
  })
  it('여러 개 · 맞음+놓침 중복은 놓침으로 한 번 · 특수문자 인코딩', () => {
    const html = render(snap([
      { targetWords: ['harvest', "don't"], targetHits: ['harvest'] },
      { targetWords: ['harvest', 'rock & roll'], targetHits: [] },
    ]))
    const l = links(html)
    expect(l.map((x) => new URL(x.href, 'https://x.test').searchParams.get('q'))).toEqual(["don't", 'harvest', 'rock & roll'])
    expect(html).not.toContain('✓ <!-- -->harvest')
  })
  it('주인 확인 중(checking)에는 결과 대신 불러오는 중 — 링크 없음', () => {
    h.auth = 'checking'
    const html = render(snap([{ targetWords: ['drought'], targetHits: [] }]))
    expect(html).not.toContain('missed-word-vault')
  })
  it('계정이 바뀌면(changed) 링크 없음', () => {
    h.auth = 'changed'
    const html = render(snap([{ targetWords: ['drought'], targetHits: [] }]))
    expect(html).not.toContain('missed-word-vault-link')
  })
  it('놓친 낱말 링크는 prefetch 하지 않는다 — 누르기 전 요청 0(리뷰 P2)', () => {
    const l = links(render(snap([{ targetWords: ['drought', 'flood'], targetHits: [] }])))
    expect(l).toHaveLength(2)
    for (const x of l) expect(x.tag).toContain('data-prefetch="false"')
  })
  it('링크를 그리는 데 추가 조회·클라이언트 생성 0', () => {
    render(snap([{ targetWords: ['drought', 'flood'], targetHits: [] }]))
    expect(h.calls).toBe(0)
  })
})
