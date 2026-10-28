// apps/web/src/app/(main)/wordvault/__tests__/map-preparation.test.tsx
// T-0086 — /wordvault/browse RSC: 지도에서 온 경우만 복귀 막대 + 같은 문맥의 복습 링크 · 조회 실패 ≠ 0 · 일반 진입 · 도서 문맥 보존. DB 없음
import { renderToStaticMarkup, renderToString } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

let failVocab = false
let rows: Array<Record<string, unknown>> = []
vi.mock('next/navigation', () => ({ redirect: () => { throw new Error('redirect') }, useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }), useSearchParams: () => new URLSearchParams() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) } }) }))
vi.mock('@/lib/wordvault/browse-queries', async (orig) => ({
  ...(await orig<typeof import('@/lib/wordvault/browse-queries')>()),
  fetchUserVocabularies: async () => { if (failVocab) throw new Error('read failed'); return rows },
  fetchUserTextChips: async () => [],
  fetchUserSetChips: async () => [],
}))

import BrowsePage from '../browse/page'
import { StoryReader } from '@/components/library/story/StoryReader'
import { StoryWordSave } from '@/components/library/story/StoryWordSave'
import { StoryVaultReturnBar } from '@/components/library/story/StoryVaultReturn'
import { StoryAuthSourceContext, type StoryAuthSource } from '@/components/library/story/use-story-auth-guard'
import { WordVaultBrowseClient, WordVaultViewerGate } from '@/components/wordvault/WordVaultBrowseClient'
import { vocabRowToWord } from '@/lib/wordvault/browse-queries'
import { storyVaultHref } from '@/lib/library/story/return-context'
import type { WordLookup } from '@/lib/library/reader-queries'
import { KEY_A, VIEWER, readyState } from '@/components/library/story/__tests__/fixtures'

// Explicit browser identity for SSR cases: an authenticated server result alone is not a positive client identity.
const knownAuth = (userId: string | null | undefined): StoryAuthSource => ({ subscribe: () => () => {}, currentUserId: () => new Promise(() => {}), testOnlyKnownUserId: () => userId })


const sp = { from: 'map', map_task: 'v.core_meaning', ws: 'ws.vocab-context', map_ws: '11111111-2222-4333-8444-555555555555', map_plan: '3', map_goal: '7' }
const html = async (searchParams: Record<string, string>, auth: StoryAuthSource = knownAuth('u1')) => renderToStaticMarkup(<StoryAuthSourceContext.Provider value={auth}>{await BrowsePage({ searchParams })}</StoryAuthSourceContext.Provider>)
const review = (h: string) => [...h.matchAll(/href="([^"]*\/wordvault\/review[^"]*)"/g)].map((m) => m[1].replaceAll('&amp;', '&'))

beforeEach(() => {
  failVocab = false
  rows = []
})

describe('/wordvault/browse 지도 준비(T-0086)', () => {
  it('지도에서 온 목록 = 복귀 막대 + 같은 문맥의 복습 링크(수행 ID 버림)', async () => {
    const h = await html({ ...sp, map_item: 'authored:x', map_attempt: '42' })
    expect(h).toContain('data-testid="vocab-map-return"')
    const [r] = review(h)
    const u = new URL(r, 'http://x')
    expect(u.searchParams.get('map_task')).toBe('v.core_meaning')
    expect(u.searchParams.get('map_ws')).toBe(sp.map_ws)
    expect(r).not.toMatch(/map_item|map_attempt/)
    const back = h.match(/data-testid="vocab-map-return"[^>]*href="([^"]+)"|href="([^"]+)"[^>]*data-testid="vocab-map-return"/)!
    expect((back[1] ?? back[2]).replaceAll('&amp;', '&')).toContain('/csat/diagnosis?tab=map&view=full&map_task=v.core_meaning')
  })
  it('필터 · 도서 파라미터와 함께 와도 막대 유지(기존 파라미터 처리 보존)', async () => {
    expect(await html({ ...sp, filter: 'state:new', q: 'run', level: 'B1' })).toContain('vocab-map-return')
  })
  it('일반 진입 = 지도 안내 없음', async () => {
    const h = await html({ filter: 'all' })
    expect(h).not.toContain('vocab-map-bar')
    expect(h).not.toContain('학습 지도')
  })
  it('지도에서 온 조회 실패 = 실패 안내 + 돌아갈 길(빈 목록 아님) · 일반 진입 실패는 기존대로 throw', async () => {
    failVocab = true
    const h = await html(sp)
    expect(h).toContain('vocab-browse-load-failed')
    expect(h).toContain('vocab-map-return')
    expect(h).not.toContain('empty-vault')
    await expect(html({})).rejects.toThrow('read failed')
  })
})

describe('D5 — 선택 낱말 저장 조작 · 단어장 Story 복귀 줄', () => {
  const lookup = (over: Partial<WordLookup> = {}): WordLookup => ({
    found: true, surface: 'looked', resolvedWord: 'look', meaningKo: '보다', pos: 'verb', cefrLevel: 'A1', vLevel: 1, exampleEn: 'Look at this.',
    matchVia: 'inflection', wordRegister: null, collocations: null, exampleKo: null, derived: null, synonyms: null, antonyms: null, lang: 'en', ...over,
  })
  const noop = async () => ({ stale: true as const })
  const save = (l: WordLookup | null, surface = 'looked') =>
    renderToString(<StoryWordSave lookup={l} surface={surface} wordIndex={7} onSave={noop} vaultHref={`/wordvault/browse?story_release=${KEY_A}&story_unit=1`} />)

  it('확정 영어 표제어: 담을 표제어와 본문 낱말을 구분해 보이고 단추 하나 · 담기 전에는 단어장 링크 없음 · 상태 자리는 aria-live', () => {
    const html = save(lookup())
    expect(html).toContain('data-story-word-save="idle"')
    expect(html).toMatch(/담을 낱말 <strong lang="en">look<\/strong>/)
    expect(html).toContain('본문 <span lang="en">looked</span>의 사전 원형')
    expect(html).toMatch(/<button[^>]*data-story-word-save-button[^>]*>내 단어장에 담기<\/button>/)
    expect(html).toMatch(/role="status" aria-live="polite"[^>]*data-story-word-save-status/)
    expect(html).not.toContain('data-story-word-save-vault')
    // 같은 낱말이면 원형 안내 없음
    expect(save(lookup({ resolvedWord: 'looked' }))).not.toContain('사전 원형')
  })

  it('없음 · 유사어 추정 · 이름 · 외국어 · 뜻 없음 · 조회 결과 없음 → 단추 없이 「확정된 낱말만」 한 줄', () => {
    for (const l of [
      lookup({ found: false, resolvedWord: null, meaningKo: null, matchVia: 'not_found' }),
      lookup({ matchVia: 'suggestion' }),
      lookup({ found: false, matchVia: 'proper_noun', resolvedWord: null }),
      lookup({ lang: 'fr' }),
      lookup({ meaningKo: '' }),
      null,
    ]) {
      const html = save(l)
      expect(html, JSON.stringify(l)).toContain('data-story-word-save="unavailable"')
      expect(html).not.toContain('data-story-word-save-button')
      expect(html).toContain('사전에서 확정된 낱말만')
    }
  })

  it('복귀 줄: ok = 제목 · n번째 단위(0-based+1) · 단위 첫머리 안내 · 같은 발행본 단위로 · 다른 상태는 각각 안전한 한 줄', () => {
    const ok = renderToString(<StoryVaultReturnBar state={{ status: 'ok', releaseKey: KEY_A, unitIndex: 2, title: 'The Gull', unitCount: 3 }} />)
    expect(ok).toContain('data-story-vault-return="ok"')
    expect(ok).toContain('3<!-- -->번째 단위')
    expect(ok).toContain('이 탭에서 담았다면 그 문장으로, 아니면 단위 첫머리로')
    expect(ok).toContain(`href="/library/stories/${KEY_A}?unit=2"`)
    expect(ok).not.toMatch(/이 이야기 단어|Story 단어 목록/)
    const bad = renderToString(<StoryVaultReturnBar state={{ status: 'bad_unit', releaseKey: KEY_A, title: 'The Gull', unitCount: 3 }} />)
    expect(bad).toContain(`href="/library/stories/${KEY_A}"`)
    expect(bad).toContain('그 단위를 찾을 수 없어요')
    const gone = renderToString(<StoryVaultReturnBar state={{ status: 'unavailable' }} />)
    expect(gone).toContain('href="/library/stories"')
    expect(gone).not.toContain(KEY_A)
    const err = renderToString(<StoryVaultReturnBar state={{ status: 'error', releaseKey: KEY_A, unitIndex: 1 }} />)
    expect(err).toContain('확인하지 못했어요')
    expect(err).toContain(`href="/library/stories/${KEY_A}?unit=1"`)
    const mix = renderToString(<StoryVaultReturnBar state={{ status: 'conflict' }} />)
    expect(mix).toContain('data-story-vault-return="conflict"')
    expect(mix).not.toContain('href=')
  })

  it('단위 화면: 저장 액션이 있어도 렌더 자체는 아무것도 기록하지 않는다 · 액션이 없으면 저장 조작을 넘기지 않는다', () => {
    const saveWord = vi.fn()
    const html = renderToString(
      <StoryReader state={readyState()} releaseKey={KEY_A} actions={{ recordPosition: vi.fn(), completeUnit: vi.fn(), saveWord }} authGuard={knownAuth(VIEWER)} />,
    )
    expect(html).toContain('data-story-body')
    expect(saveWord).not.toHaveBeenCalled()
  })
})

// Same D5 integration: full private WordVault subtree, not only its Story return bar.
describe('D5 WordVault authenticated renderer integration', () => {
  const A = '11111111-1111-4111-8111-111111111111'
  const B = '22222222-2222-4222-8222-222222222222'
  const RK = `lsr_${'a'.repeat(32)}`
  const row = (id: string, word: string, meaning: string) =>
    ({ id, word, meaning, example_sentence: `The ${word} example.`, pronunciation: '', pos: 'noun', cefr_level: 'B1', difficulty: null, stability: null, last_review_at: null, next_review_at: null, module_history: [], review_count: 0, text_id: null, shared_set_id: 'set-1', created_at: '2026-10-27T00:00:00Z' }) as unknown as Parameters<typeof vocabRowToWord>[0]
  const words = [row('v1', 'privateword', '사적인뜻'), row('v2', 'secondword', '두번째뜻')].map((r, i) => vocabRowToWord(r, i))
  const known = (userId: string | null): StoryAuthSource => ({ subscribe: () => () => {}, currentUserId: async () => userId, testOnlyKnownUserId: () => userId })
  const pending: StoryAuthSource = { subscribe: () => () => {}, currentUserId: () => new Promise(() => {}) }
  const reopen = storyVaultHref({ releaseKey: RK, unitIndex: 2 })

  function render(source: StoryAuthSource) {
    return renderToStaticMarkup(
      <WordVaultViewerGate viewerId={A} reopenHref={reopen} authSource={source}>
        <WordVaultBrowseClient
          words={words}
          textChips={[{ id: 'text:t1', label: '사적인 본문 칩', count: 1 }]}
          setChips={[{ id: 'set:set-1', label: '사적인 세트 칩', count: 2 }]}
          storyReturn={<StoryVaultReturnBar state={{ status: 'ok', releaseKey: RK, unitIndex: 2, title: 'Gull Rock', unitCount: 3 }} />}
        />
      </WordVaultViewerGate>,
    )
  }
  const PRIVATE = ['privateword', '사적인뜻', 'secondword', '사적인 본문 칩', '사적인 세트 칩', 'data-story-vault-return', '단어장 도구']

  describe('WordVaultViewerGate — 서버 주인으로 긍정 확인될 때만 개인 내용', () => {
    it('브라우저 = 서버 주인(A): 실제 목록 · 칩 · 듣기 · Story 복귀 줄', () => {
      const html = render(known(A))
      expect(html).toContain('data-vault-private="shown"')
      for (const s of PRIVATE) expect(html, s).toContain(s)
      expect(html).not.toContain(A) // uid 는 비교에만
    })

    for (const [name, source, state] of [
      ['다른 계정(B)', known(B), 'changed'],
      ['로그아웃', known(null), 'changed'],
      ['확인 전(기준선 대기)', pending, 'checking'],
    ] as const) {
      it(`${name}: 목록 · 칩 · 듣기 · 복귀 줄 0 · ${state}`, () => {
        const html = render(source)
        expect(html).toContain(`data-vault-private="${state}"`)
        for (const s of PRIVATE) expect(html, s).not.toContain(s)
        expect(html).not.toContain(A)
        expect(html).not.toContain(B)
        expect(html).toContain('data-vault-reopen')
        expect(html.replaceAll('&amp;', '&')).toContain(`href="${reopen}"`)
        if (state === 'changed') {
          const login = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replaceAll('&amp;', '&')).find((h) => h.startsWith('/login'))
          expect(new URL(login!, 'http://x').searchParams.get('next')).toBe(reopen)
        } else {
          expect(html).not.toContain('data-vault-login')
        }
      })
    }

    it('기준선을 못 읽으면 same 으로 치지 않는다(checking 그대로)', () => {
      const failing: StoryAuthSource = { subscribe: () => () => {}, currentUserId: () => Promise.reject(new Error('storage')) }
      expect(render(failing)).toContain('data-vault-private="checking"')
    })
  })

})


describe('WordVault route identity before map preparation', () => {
  it('Checking does not expose map return or private list', async () => {
    const result = await html(sp, knownAuth(undefined))
    expect(result).toContain('data-vault-private="checking"')
    expect(result).not.toContain('data-testid="vocab-map-return"')
    expect(result).not.toContain('vocab-browse-load-failed')
  })
  it('A different browser identity cannot expose server-owner map or error state', async () => {
    failVocab = true
    const result = await html(sp, knownAuth('other-test-user'))
    expect(result).toContain('data-vault-private="changed"')
    expect(result).not.toContain('data-testid="vocab-map-return"')
    expect(result).not.toContain('vocab-browse-load-failed')
  })
})
