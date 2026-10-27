// apps/web/src/app/(main)/flashcard/__tests__/reader-card-return.test.tsx
// 읽던 글 → 카드 → 같은 글로: 카드 링크는 학습 범위(set/text)를 그대로 두고 from 만 그 글로 싣는다.
// 카드 쪽은 내부 경로 from 만 받아 끝·빈 상태에서 그곳으로 돌려보낸다(외부·// 경로는 hub).
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

const scoped = vi.hoisted(() => ({ value: null as null | { title: string; subtitle: string; words: unknown[] } }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {} }), usePathname: () => '/text/t1', useSearchParams: () => new URLSearchParams() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) } }) }))
vi.mock('@/lib/flashcard/scoped-words', () => ({ fetchScopedFlashcardWords: async () => scoped.value }))

import FlashcardPlayPage from '../play/page'
import { ModePills } from '@/components/workspace/ModePills'
import { readerScopeQuery } from '@/lib/wordvault/source-filter'
import { resolveSessionReturnHref } from '@/lib/layout/session-return'

const TEXT = '11111111-1111-4111-8111-111111111111'
const SET = '22222222-2222-4222-8222-222222222222'

function cardHref(flashcardHref: string) {
  const html = renderToStaticMarkup(
    <ModePills textId={TEXT} currentMode="read" modeStatus={{} as never} isFocusMode={false} wordsHref="/wordvault/browse" flashcardHref={flashcardHref} wordblitzHref="/wordblitz" arcadeHref="/arcade" />,
  )
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&'))
  return hrefs.find((h) => h.startsWith('/flashcard')) ?? null
}

describe('읽던 글 → 카드 링크', () => {
  it.each([
    ['기사 set', { textId: TEXT, currentChapterWordSet: { id: SET } }, `/flashcard/play?set=${SET}`],
    ['도서 장 set', { textId: TEXT, libraryBookId: 'b1', chapterIdx: 2, currentChapterWordSet: { id: SET } }, `/flashcard/play?set=${SET}`],
    ['개인 글 text', { textId: TEXT }, `/flashcard/play?text=${TEXT}`],
  ])('%s: 범위는 그대로, from 은 그 글', (_n, ctx, scope) => {
    const q = readerScopeQuery(ctx as never)
    expect(`/flashcard/play${q}`).toBe(scope)
    const href = cardHref(`/flashcard/play${q}`)
    expect(href).toBe(`${scope}&from=${encodeURIComponent(`/text/${TEXT}`)}`)
    const u = new URL(href!, 'http://x')
    expect(u.searchParams.get('from')).toBe(`/text/${TEXT}`)
    expect(u.searchParams.get('set') ?? u.searchParams.get('text')).toBe(q!.split('=')[1])
  })
})

describe('카드 쪽 복귀', () => {
  it('내부 from 우선 · 외부/프로토콜 상대 from 은 버린다', () => {
    expect(resolveSessionReturnHref(`/text/${TEXT}`, null, '/flashcard')).toBe(`/text/${TEXT}`)
    expect(resolveSessionReturnHref('//evil.example', null, '/flashcard')).toBe('/flashcard')
    expect(resolveSessionReturnHref('https://evil.example', null, '/flashcard')).toBe('/flashcard')
    expect(resolveSessionReturnHref(null, null, '/flashcard')).toBe('/flashcard')
  })

  it('기사 set 이 비어 있으면 빈 상태가 읽던 글로 돌려보낸다(단어장은 보조)', async () => {
    scoped.value = { title: '기사 A', subtitle: '', words: [] }
    const html = renderToStaticMarkup(await FlashcardPlayPage({ searchParams: { set: SET, from: `/text/${TEXT}` } }))
    expect(html).toContain('data-testid="flashcard-empty-return"')
    expect(html).toContain(`href="/text/${TEXT}"`)
    expect(html).toContain('href="/wordvault"')
  })

  it('출처가 없거나 외부면 복귀 단추를 꾸미지 않는다', async () => {
    scoped.value = { title: '기사 A', subtitle: '', words: [] }
    for (const from of [undefined, '//evil.example']) {
      const html = renderToStaticMarkup(await FlashcardPlayPage({ searchParams: { set: SET, from } }))
      expect(html).not.toContain('flashcard-empty-return')
      expect(html).toContain('href="/wordvault"')
    }
  })
})
