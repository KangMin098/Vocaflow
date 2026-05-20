// apps/web/src/components/library/vocab/VocabSetCard.tsx
//
// 공용 단어장 세트 카드.
// 구독/해지 로직은 부모(VocabSetGrid)가 관리 — 토스트 통일을 위해 prop 으로 위임.

'use client'

import { Check, Eye, Loader2, Plus, X } from 'lucide-react'

import type { PublishedVocabSet } from '@/lib/library/vocab/queries'

import { VOCAB_CATEGORIES } from './categories'

interface VocabSetCardProps {
  set: PublishedVocabSet
  isSubscribed: boolean
  isPending: boolean
  errorMessage: string | null
  onToggle: (set: PublishedVocabSet) => void
  onPreview: (set: PublishedVocabSet) => void
}

export function VocabSetCard({
  set,
  isSubscribed,
  isPending,
  errorMessage,
  onToggle,
  onPreview,
}: VocabSetCardProps) {
  const cat = VOCAB_CATEGORIES.find((c) => c.id === set.category)

  return (
    <article className="flex h-full flex-col gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-5 shadow-[var(--sh-sm)] transition-shadow duration-[var(--dur-normal)] hover:shadow-[var(--sh-md)]">
      <header className="flex flex-col gap-2">
        <div className="flex items-start gap-2">
          {set.coverEmoji && (
            <span aria-hidden="true" className="text-[22px] leading-none">
              {set.coverEmoji}
            </span>
          )}
          <h3 className="line-clamp-2 flex-1 font-display text-[16px] font-[700] leading-snug text-[var(--t1)]">
            {set.title}
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {/* v06.25: categoryNode 우선 (566 트리, name_ko→name_en fallback). 미매핑 시 legacy chip. */}
          {set.categoryNode ? (
            <span className="inline-flex items-center gap-1 rounded-[var(--r-full)] bg-[#8B5CF6]/10 px-2 py-0.5 font-display text-[11px] font-[600] text-[#6D28D9]">
              {set.categoryNode.coverEmoji && (
                <span aria-hidden="true">{set.categoryNode.coverEmoji}</span>
              )}
              {set.categoryNode.nameKo ?? set.categoryNode.nameEn}
            </span>
          ) : (
            cat && (
              <span className="inline-flex items-center gap-1 rounded-[var(--r-full)] bg-[#8B5CF6]/10 px-2 py-0.5 font-display text-[11px] font-[600] text-[#6D28D9]">
                <span aria-hidden="true">{cat.emoji}</span>
                {cat.label}
              </span>
            )
          )}
          {set.cefrLevel && (
            <span className="inline-flex items-center rounded-[var(--r-full)] bg-[var(--bg3)] px-2 py-0.5 font-display text-[11px] font-[600] text-[var(--t2)]">
              CEFR {set.cefrLevel}
            </span>
          )}
        </div>
      </header>

      <div className="flex-1">
        <p className="font-display text-[20px] font-[800] tabular-nums leading-none text-[var(--t1)]">
          {set.wordCount.toLocaleString()}
          <span className="ml-1 font-display text-[12px] font-[600] text-[var(--t3)]">개 단어</span>
        </p>
        {set.description && (
          <p className="mt-2 line-clamp-2 font-body text-[13px] leading-relaxed text-[var(--t3)]">
            {set.description}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPreview(set)}
          className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-3 py-2 font-display text-[12px] font-[600] text-[var(--t2)] transition-colors duration-[var(--dur-normal)] hover:bg-[var(--bg2)] hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] focus-visible:ring-offset-1"
          aria-label={`${set.title} 미리보기`}
        >
          <Eye size={14} aria-hidden />
          미리보기
        </button>

        {isSubscribed ? (
          <button
            type="button"
            onClick={() => onToggle(set)}
            disabled={isPending}
            className="group inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-[var(--r-md)] border border-[var(--success)]/30 bg-[var(--success-light)] px-4 py-2 font-display text-[13px] font-[700] text-[#065f46] transition-colors duration-[var(--dur-normal)] hover:border-[var(--error)]/40 hover:bg-[var(--error-light)] hover:text-[#7f1d1d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--success)] focus-visible:ring-offset-2 disabled:opacity-60"
            aria-label={`${set.title} 구독 해지`}
          >
            {isPending ? (
              <Loader2 size={14} className="animate-spin" aria-hidden />
            ) : (
              <>
                <Check size={14} aria-hidden className="group-hover:hidden" />
                <X size={14} aria-hidden className="hidden group-hover:inline" />
              </>
            )}
            <span className="group-hover:hidden">추가됨</span>
            <span className="hidden group-hover:inline">해지</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onToggle(set)}
            disabled={isPending}
            className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-[var(--r-md)] bg-[#8B5CF6] px-4 py-2 font-display text-[13px] font-[700] text-white transition-colors duration-[var(--dur-normal)] hover:bg-[#7C3AED] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] focus-visible:ring-offset-2 disabled:opacity-60"
          >
            {isPending ? (
              <Loader2 size={14} className="animate-spin" aria-hidden />
            ) : (
              <Plus size={14} aria-hidden />
            )}
            {isPending ? '가져오는 중...' : '내 단어장에 추가'}
          </button>
        )}
      </div>

      {errorMessage && (
        <p role="alert" className="font-body text-[12px] text-[var(--error)]">
          {errorMessage}
        </p>
      )}
    </article>
  )
}
