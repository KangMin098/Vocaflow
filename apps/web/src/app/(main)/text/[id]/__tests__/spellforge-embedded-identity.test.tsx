// apps/web/src/app/(main)/text/[id]/__tests__/spellforge-embedded-identity.test.tsx
// /text/[id]?mode=spellforge — 글 안에서 여는 철자 연습도 그 글을 읽은 주인(ctx.ownerId)에 결속한다(/spellforge/play 와 같은 경계).
// 실제 WorkspacePage 를 서버 렌더로 그린다. layout(서버 · GET 부수효과)은 부르지 않는다 — 문맥은 합성 Provider 로 준다.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
  usePathname: () => '/text/t1',
  useSearchParams: () => new URLSearchParams('mode=spellforge'),
}))

import WorkspacePage from '../page'
import { TextContentProvider, type TextContentData } from '../text-content-context'
import { StoryAuthSourceContext, type StoryAuthSource } from '@/components/library/story/use-story-auth-guard'
import { ToastProvider } from '@/components/ui/Toast'

const OWNER = 'owner-a'
const word = { id: 'w1', text: 'harvest', meaning: '내글전용뜻', pronunciation: '', pos: 'n.', status: 'new', exampleSentence: '' }

function ctx(ownerId: string | null | undefined): TextContentData {
  return {
    textId: 't1',
    ownerId,
    libraryBookId: null,
    chapterIdx: null,
    chapters: [],
    book: null,
    currentChapterStatus: 'in_progress',
    bookWordSetStats: null,
    currentChapterWordSet: null,
    allChapterWordSets: [],
    chapterAudio: null,
    illustrations: null,
    text: { title: '내 일기 제목' },
    paragraphs: [{ id: 'p1', sentences: [{ id: 's1', parts: [{ text: 'harvest', word }] }] }],
  } as unknown as TextContentData
}
const knownAs = (uid: string | null): StoryAuthSource => ({ subscribe: () => () => {}, currentUserId: async () => uid, testOnlyKnownUserId: () => uid })
const render = (owner: string | null | undefined, browser: string | null) =>
  renderToStaticMarkup(
    <StoryAuthSourceContext.Provider value={knownAs(browser)}>
      <ToastProvider>
        <TextContentProvider value={ctx(owner)}>
          <WorkspacePage params={{ id: 't1' }} />
        </TextContentProvider>
      </ToastProvider>
    </StoryAuthSourceContext.Provider>,
  )

describe('글 안의 철자 연습 · 계정 경계', () => {
  it('같은 주인이면 연습(개인 단어 뜻)을 그린다', () => {
    const html = render(OWNER, OWNER)
    expect(html).toContain('내글전용뜻')
    expect(html).not.toContain('data-game-private')
  })

  it('다른 계정 브라우저면 개인 단어 · 제목을 그리지 않고 안내', () => {
    const html = render(OWNER, 'someone-else')
    expect(html).not.toContain('내글전용뜻')
    expect(html).not.toContain('내 일기 제목')
    expect(html).toContain('data-game-private="changed"')
  })

  it('문맥에 주인이 없으면(추측 금지) 로그인한 브라우저에 그리지 않는다', () => {
    const html = render(undefined, OWNER)
    expect(html).not.toContain('내글전용뜻')
  })
})
