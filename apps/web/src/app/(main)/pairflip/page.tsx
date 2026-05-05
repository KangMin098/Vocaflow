// apps/web/src/app/(main)/pairflip/page.tsx
// PairFlip Hub — Stats + StartScreen 통합 (Flashcard Hub 패턴 정합)

import { PairFlipHub } from '@/components/pairflip/PairFlipHub'

export const metadata = {
  title: 'PairFlip — 짝맞추기 카드 게임 · Vocaflow',
  description: '영단어와 한글 뜻을 짝지어 매칭하는 카드 게임',
}

export default function PairFlipHubPage() {
  return <PairFlipHub />
}
