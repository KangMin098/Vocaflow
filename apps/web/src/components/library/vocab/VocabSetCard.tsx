// apps/web/src/components/library/vocab/VocabSetCard.tsx
//
// 공용 단어장 세트 카드.
// 헤더: 제목 + (카테고리 + CEFR 배지)
// 본문: 단어 수 + 한 줄 설명
// 푸터: "내 단어장에 추가" Primary 버튼 (구독 완료 시 disabled "추가됨")

'use client'

import { Check, Plus } from 'lucide-react'

import { VOCAB_CATEGORIES } from './categories'
import type { VocabSet } from './mock-data'

interface VocabSetCardProps {
  set: VocabSet
  onSubscribe?: (id: string) => void
}

export function VocabSetCard({ set, onSubscribe }: VocabSetCardProps) {
  const cat = VOCAB_CATEGORIES.find((c) => c.id === set.category)
  const isSubscribed = !!set.isSubscribed

  return (
    <article className="flex h-full flex-col gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-sm)] transition-shadow duration-[var(--dur-normal)] hover:shadow-[var(--sh-md)]">
      {/* 헤더: 제목 + 배지 */}
      <header className="flex flex-col gap-2">
        <h3 className="line-clamp-2 font-display text-[16px] font-[700] leading-snug text-[var(--t1)]">
          {set.title}
        </h3>
        <div className="flex flex-wrap items-center gap-1.5">
          {cat && (
            <span className="inline-flex items-center gap-1 rounded-[var(--r-full)] bg-[#8B5CF6]/10 px-2 py-0.5 font-display text-[11px] font-[600] text-[#6D28D9]">
              <span aria-hidden="true">{cat.emoji}</span>
              {cat.label}
            </span>
          )}
          <span className="inline-flex items-center rounded-[var(--r-full)] bg-[var(--bg3)] px-2 py-0.5 font-display text-[11px] font-[600] text-[var(--t2)]">
            CEFR {set.cefr}
          </span>
        </div>
      </header>

      {/* 본문: 단어 수 + 설명 */}
      <div className="flex-1">
        <p className="font-display text-[20px] font-[800] tabular-nums leading-none text-[var(--t1)]">
          {set.wordCount.toLocaleString()}
          <span className="ml-1 font-display text-[12px] font-[600] text-[var(--t3)]">개 단어</span>
        </p>
        <p className="mt-2 line-clamp-2 font-body text-[13px] leading-relaxed text-[var(--t3)]">
          {set.description}
        </p>
      </div>

      {/* CTA */}
      {isSubscribed ? (
        <button
          type="button"
          disabled
          className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-[var(--r-md)] bg-[var(--bg3)] px-4 py-2 font-display text-[13px] font-[600] text-[var(--t3)]"
        >
          <Check size={14} aria-hidden />
          추가됨
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onSubscribe?.(set.id)}
          className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-[var(--r-md)] bg-[#8B5CF6] px-4 py-2 font-display text-[13px] font-[700] text-white transition-colors duration-[var(--dur-normal)] hover:bg-[#7C3AED] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] focus-visible:ring-offset-2"
        >
          <Plus size={14} aria-hidden />내 단어장에 추가
        </button>
      )}
    </article>
  )
}
