// apps/web/src/components/pairflip/PairFlipGrid.tsx
// v3 — 모든 레벨 2줄 고정 + 좁은 viewport 가로 스크롤

'use client'

import { PairFlipCardView } from './PairFlipCard'
import { PF_DIMS } from './theme'
import type { PairFlipCard } from './types'

interface GridProps {
  cards: PairFlipCard[]
  gridCols: number
  onCardClick: (cardId: string) => void
}

// 카드 최소 너비 — 이보다 좁아지면 부모가 가로 스크롤
const MIN_CARD_WIDTH = 110

export function PairFlipGrid({ cards, gridCols, onCardClick }: GridProps) {
  return (
    <div
      className="mx-auto w-full overflow-x-auto pb-2 [scrollbar-width:thin]"
      role="region"
      aria-label="카드 영역 (좁은 화면에서 가로 스크롤)"
    >
      <div
        className="mx-auto grid"
        style={{
          maxWidth: `${PF_DIMS.gridMaxWidth}px`,
          gridTemplateColumns: `repeat(${gridCols}, minmax(${MIN_CARD_WIDTH}px, 1fr))`,
          gap: `${PF_DIMS.gridGap}px`,
        }}
        role="grid"
        aria-label="짝맞추기 카드 그리드"
      >
        {cards.map((card) => (
          <PairFlipCardView key={card.id} card={card} onClick={() => onCardClick(card.id)} />
        ))}
      </div>
    </div>
  )
}
