// apps/web/src/app/(main)/flashcard/page.tsx

import { FlashcardSession } from '@/components/flashcard/FlashcardSession'
import { MOCK_FLASHCARD_WORDS } from '@/components/flashcard/mock-data'

export default function FlashcardPage() {
  return <FlashcardSession initialWords={MOCK_FLASHCARD_WORDS} />
}
