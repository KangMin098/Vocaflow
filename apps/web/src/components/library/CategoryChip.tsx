// apps/web/src/components/library/CategoryChip.tsx

import type { CategoryItem } from '@/types/library'

interface CategoryChipProps {
  category: CategoryItem
  onClick?: () => void
  isMore?: boolean
}

export function CategoryChip({ category, onClick, isMore = false }: CategoryChipProps) {
  return (
    <button
      onClick={onClick}
      className={`group inline-flex cursor-pointer items-center gap-2 rounded-[var(--r-full)] border border-[var(--bd)] px-4 py-2.5 font-display text-[13px] font-[600] transition-all duration-[var(--dur-normal)] ${
        isMore
          ? 'bg-[var(--bg2)] text-[var(--t2)] hover:bg-[var(--bg3)] hover:text-[var(--t1)]'
          : 'bg-[var(--bg)] text-[var(--t1)] hover:-translate-y-px hover:border-[var(--p)] hover:text-[var(--p)] hover:shadow-[var(--sh-sm)]'
      } `}
    >
      {!isMore && <span className="text-base leading-none">{category.emoji}</span>}
      <span>{category.label}</span>
      {!isMore && (
        <span className="inline-flex h-[18px] min-w-[32px] items-center justify-center rounded-[var(--r-full)] bg-[var(--bg3)] px-1.5 font-display text-[11px] font-[700] tabular-nums text-[var(--t2)] transition-colors duration-[var(--dur-normal)] group-hover:bg-[var(--p-light)] group-hover:text-[var(--on-p-tint)]">
          {formatCount(category.count)}
        </span>
      )}
    </button>
  )
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return n.toString()
}
