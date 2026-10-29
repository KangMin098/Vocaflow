// apps/web/src/app/(main)/text/[id]/__tests__/reader-viewer-gate.test.tsx
// /text/[id] 읽기(기본 모드) — 레이아웃의 ReaderViewerGate 가 글을 읽은 주인과 브라우저 신원이 같을 때만 본문 · 제목을 그린다.
// 실제 WorkspacePage 를 서버 렌더로 그린다. layout(서버 · GET 부수효과)은 부르지 않는다 — 문맥은 합성 Provider 로 준다.
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
  usePathname: () => '/text/t1',
  useSearchParams: () => new URLSearchParams(''),
}))

import WorkspacePage from '../page'
import { ReaderViewerGate } from '../reader-viewer-gate'
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
          <ReaderViewerGate ownerId={owner ?? 'none'} textId="t1">
            <WorkspacePage params={{ id: 't1' }} />
          </ReaderViewerGate>
        </TextContentProvider>
      </ToastProvider>
    </StoryAuthSourceContext.Provider>,
  )

describe('읽기 화면 · 계정 경계(ReaderViewerGate)', () => {
  it('같은 주인이면 본문(개인 단어)을 그린다', () => {
    const html = render(OWNER, OWNER)
    expect(html).toContain('harvest')
    expect(html).not.toContain('data-reader-private')
  })

  it('다른 계정 브라우저면 본문 · 제목을 그리지 않고 다시 열기 안내', () => {
    const html = render(OWNER, 'someone-else')
    expect(html).not.toContain('harvest')
    expect(html).not.toContain('내 일기 제목')
    expect(html).toContain('data-reader-private="changed"')
    expect(html).toContain('href="/text/t1"')
  })
})
