// apps/web/src/app/(main)/flashcard/play/page.tsx
// Flashcard 학습 세션 — hub(/flashcard) 에서 진입

import { FlashcardSession } from '@/components/flashcard/FlashcardSession'
import { MOCK_FLASHCARD_WORDS } from '@/components/flashcard/mock-data'
import { ResourceContext } from '@/components/layout/ResourceContext'

export const metadata = {
  title: 'Flashcard 학습 · Vocaflow',
}

export default function FlashcardPlayPage() {
  return (
    <>
      <ResourceContext
        resource={{
          type: 'vocab',
          label: '내 단어 자산 · SRS 큐',
          position: `오늘 ${MOCK_FLASHCARD_WORDS.length}개`,
          href: '/wordvault',
        }}
        total={MOCK_FLASHCARD_WORDS.length}
      />
      <FlashcardSession initialWords={MOCK_FLASHCARD_WORDS} />
    </>
  )
}
