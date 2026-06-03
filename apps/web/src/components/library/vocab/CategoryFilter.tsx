// apps/web/src/components/library/vocab/CategoryFilter.tsx
//
// 가로 스크롤 카테고리 칩 필터.
// 활성 칩: 보라(#8B5CF6) 배경 + 흰색 텍스트.
// 비활성: bg-[var(--bg2)] + 텍스트 muted.

'use client'

import { VOCAB_CATEGORIES, type VocabCategoryId } from './categories'

interface CategoryFilterProps {
  active: VocabCategoryId
  onChange: (id: VocabCategoryId) => void
}

export function CategoryFilter({ active, onChange }: CategoryFilterProps) {
  return (
    <div
      role="tablist"
      aria-label="단어장 카테고리"
      className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {VOCAB_CATEGORIES.map((cat) => {
        const isActive = active === cat.id
        return (
          <button
            key={cat.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(cat.id)}
            className={`inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-[var(--r-full)] border px-3.5 py-1.5 font-display text-[13px] font-[600] transition-colors duration-[var(--dur-fast)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--t1)]/20 focus-visible:ring-offset-1 ${
              isActive
                ? 'border-[var(--t1)] bg-[var(--t1)] text-[var(--bg)]'
                : 'border-[var(--bd)] bg-[var(--bg)] text-[var(--t2)] hover:border-[var(--t3)] hover:text-[var(--t1)]'
            }`}
          >
            <span aria-hidden="true">{cat.emoji}</span>
            {cat.label}
          </button>
        )
      })}
    </div>
  )
}
