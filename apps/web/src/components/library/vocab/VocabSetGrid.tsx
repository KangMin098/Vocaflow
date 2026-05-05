// apps/web/src/components/library/vocab/VocabSetGrid.tsx
//
// CategoryFilter + VocabSetCard 그리드 wrapper.
// 1/2/3 열 반응형 (모바일/태블릿/데스크톱).
// 빈 상태 처리 — 카테고리 필터 결과 0개 시.

'use client'

import { useState } from 'react'

import { CategoryFilter } from './CategoryFilter'
import type { VocabCategoryId } from './categories'
import { MOCK_VOCAB_SETS } from './mock-data'
import { VocabSetCard } from './VocabSetCard'

export function VocabSetGrid() {
  const [active, setActive] = useState<VocabCategoryId>('all')

  const filtered =
    active === 'all'
      ? MOCK_VOCAB_SETS
      : MOCK_VOCAB_SETS.filter((s) => s.category === active)

  return (
    <div className="flex flex-col gap-5">
      <CategoryFilter active={active} onChange={setActive} />

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-[var(--r-lg)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] py-12 text-center">
          <p className="font-display text-[14px] font-[600] text-[var(--t2)]">
            곧 다양한 단어장이 추가될 예정이에요
          </p>
          <p className="font-body text-[12px] text-[var(--t3)]">
            원하는 카테고리가 있으면 설정에서 알려주세요
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((set) => (
            <VocabSetCard key={set.id} set={set} />
          ))}
        </div>
      )}
    </div>
  )
}
