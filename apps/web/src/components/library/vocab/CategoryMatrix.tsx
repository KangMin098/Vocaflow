// apps/web/src/components/library/vocab/CategoryMatrix.tsx
//
// 카테고리 매트릭스 — 유아~테마 학습자 단계 시각 그리드.
// 영감: Apple App Store categories · Duolingo course selector · iOS Settings grid.
// - 5×2 desktop / 2×5 mobile
// - active = dark fill / inactive = outline
// - 각 타일: emoji + 라벨 + 세트 개수 (Information scent, Pirolli)

'use client'

import { VOCAB_CATEGORIES, type VocabCategoryId } from './categories'

interface CategoryMatrixProps {
  active: VocabCategoryId
  onChange: (id: VocabCategoryId) => void
  /** category id → 세트 개수 매핑 (Information scent) */
  counts: Record<string, number>
  /** 전체 세트 수 — 'all' 타일에 표시 */
  totalCount: number
}

export function CategoryMatrix({
  active,
  onChange,
  counts,
  totalCount,
}: CategoryMatrixProps) {
  return (
    <nav
      aria-label="단어장 카테고리"
      className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5"
    >
      {VOCAB_CATEGORIES.map((cat) => {
        const isActive = active === cat.id
        const count = cat.id === 'all' ? totalCount : (counts[cat.id] ?? 0)
        const isEmpty = count === 0 && cat.id !== 'all'

        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onChange(cat.id)}
            aria-pressed={isActive}
            disabled={isEmpty}
            className={`group relative flex aspect-[5/4] flex-col items-center justify-center gap-1.5 rounded-[var(--r-lg)] border p-3 text-center transition-all duration-[var(--dur-normal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--t1)]/30 focus-visible:ring-offset-2 ${
              isActive
                ? 'border-[var(--t1)] bg-[var(--t1)] text-[var(--bg)] shadow-[var(--sh-md)]'
                : isEmpty
                  ? 'cursor-not-allowed border-[var(--bd)] bg-[var(--bg2)] opacity-50'
                  : 'border-[var(--bd)] bg-[var(--bg)] hover:-translate-y-0.5 hover:border-[var(--t1)] hover:shadow-[var(--sh-md)]'
            }`}
          >
            {/* Count 배지 — 우상단 */}
            <span
              className={`absolute right-2 top-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 font-mono text-[10px] font-[700] tabular-nums ${
                isActive
                  ? 'bg-[var(--bg)]/15 text-[var(--bg)]'
                  : isEmpty
                    ? 'text-[var(--t4)]'
                    : 'bg-[var(--bg3)] text-[var(--t2)]'
              }`}
            >
              {count}
            </span>

            {/* Emoji = visual anchor */}
            <span
              aria-hidden="true"
              className="text-[32px] leading-none transition-transform duration-[var(--dur-slow)] group-hover:scale-110"
            >
              {cat.emoji}
            </span>

            {/* 라벨 + 힌트 */}
            <div className="flex flex-col items-center gap-0.5">
              <span
                className={`font-display text-[13px] font-[700] leading-tight ${
                  isActive ? 'text-[var(--bg)]' : 'text-[var(--t1)]'
                }`}
              >
                {cat.label}
              </span>
              <span
                className={`font-body text-[10px] leading-tight ${
                  isActive
                    ? 'text-[var(--bg)]/70'
                    : isEmpty
                      ? 'text-[var(--t4)]'
                      : 'text-[var(--t3)]'
                }`}
              >
                {cat.hint}
              </span>
            </div>
          </button>
        )
      })}
    </nav>
  )
}
