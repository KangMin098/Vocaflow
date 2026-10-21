// scripts/design/fixtures/workspace-popups.tsx — isolated real components, synthetic props, no account/DB.
import { useCallback, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { UnifiedHeader } from '../../../apps/web/src/components/workspace/UnifiedHeader'
import { InsightPanel } from '../../../apps/web/src/components/workspace/InsightPanel'
import type { LibraryText, ModeKey, ModeStatus } from '../../../apps/web/src/types/library'

const modes = ['listen', 'read', 'comic', 'shadow', 'words', 'flashcard', 'pairflip', 'dictation', 'spellforge', 'wordblitz', 'arcade', 'quiz'] as ModeKey[]
const modeStatus = Object.fromEntries(modes.map(mode => [mode, 'pending'])) as Record<ModeKey, ModeStatus>
const text = { id: 'fixture-chapter', title: 'Popup component fixture', author: 'Synthetic props', cefrLevel: 'B1', progressPercent: 20, coverGradient: { from: '#d3caff', to: '#aedac2' } } as LibraryText
const book = { id: 'fixture-book', title: 'Popup component fixture', author: 'Synthetic props', cefrLevel: 'B1' as const }
const chapters = Array.from({ length: 12 }, (_, index) => ({ textId: `fixture-chapter-${index + 1}`, chapterIdx: index + 1, chapterTitle: `Fixture chapter ${index + 1}`, status: 'completed' as const }))

function Fixture() {
  const [insight, setInsight] = useState(false)
  const closeInsight = useCallback(() => setInsight(false), [])
  return <>
    <p style={{ margin: '12px 32px', fontSize: 13 }}>격리 컴포넌트 검증 · 고정 자료 · 실제 계정/학습 본문 아님 · DB 연결 없음</p>
    <UnifiedHeader text={text} book={book} chapters={chapters} currentChapterIdx={5} currentTextId="fixture-chapter-5" currentChapterStatus="completed" bookWordSetStats={{ subscribed: 1, total: 3 }} isBookmarked={false} onToggleBookmark={() => {}} onToggleInsight={() => setInsight(true)} onToggleFocus={() => {}} isFocusMode={false} currentMode="read" modeStatus={modeStatus} wordsHref="#words" flashcardHref="#cards" wordblitzHref="#blitz" arcadeHref="#arcade" />
    <main style={{ maxWidth: 680, margin: '48px auto', padding: 24 }}>
      <h1 style={{ fontSize: 30 }}>Reader popup fixture</h1>
      <article className="reading-prose" style={{ fontSize: 'var(--reader-font-size, 15px)', lineHeight: 'var(--reader-line-height, 1.55)' }}>
        <p>These sentences are fixed browser test data. They do not represent a learner's saved text.</p>
        <p>The typography menu should preserve the current reading size when opened, and remember a deliberate choice on this device.</p>
      </article>
      <button id="outside" style={{ minHeight: 44, marginTop: 32, border: '1px solid var(--bd)', padding: '8px 16px' }}>팝업 밖 포커스 대상</button>
    </main>
    <InsightPanel isOpen={insight} onClose={closeInsight} bookmarks={[]} memoryStats={null} memoryHref="#words" />
  </>
}
createRoot(document.getElementById('root')!).render(<Fixture />)
