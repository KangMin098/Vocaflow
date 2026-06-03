// apps/web/src/components/library/vocab/VocabSetCard.tsx
//
// Square poster tile — Are.na · Spotify · Linear 영감.
// - aspect-square 모노크롬 카드, emoji = 시각 anchor
// - 우상단 CEFR 배지 (단일 컬러 hint)
// - hover/focus 시 + 추가 액션 reveal
// - 카드 전체 = 미리보기 affordance

'use client'

import { Check, Loader2, Plus } from 'lucide-react'

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

// CEFR level → subtle tonal shift (A1 lightest → C2 darkest)
// 단일 모노크롬 척도로 난이도 시각 인코딩 (Dual Coding)
const LEVEL_TONE: Record<string, string> = {
  A1: 'bg-[#F8FAFC] text-[#475569] ring-[#E2E8F0]',
  A2: 'bg-[#F1F5F9] text-[#334155] ring-[#CBD5E1]',
  B1: 'bg-[#E2E8F0] text-[#1E293B] ring-[#94A3B8]',
  B2: 'bg-[#CBD5E1] text-[#0F172A] ring-[#64748B]',
  C1: 'bg-[#94A3B8] text-[#FFFFFF] ring-[#475569]',
  C2: 'bg-[#475569] text-[#FFFFFF] ring-[#1E293B]',
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
  const label = set.categoryNode
    ? (set.categoryNode.nameKo ?? set.categoryNode.nameEn)
    : (cat?.label ?? '')
  const levelTone = set.cefrLevel
    ? (LEVEL_TONE[set.cefrLevel] ?? LEVEL_TONE.B1)
    : 'bg-[var(--bg3)] text-[var(--t3)] ring-[var(--bd)]'

  function handleSubscribeClick(e: React.MouseEvent) {
    e.stopPropagation()
    onToggle(set)
  }

  return (
    <article id={`set-${set.id}`} className="group relative scroll-mt-24">
      <button
        type="button"
        onClick={() => onPreview(set)}
        aria-label={`${set.title} 미리보기 열기`}
        className="relative flex aspect-square w-full flex-col justify-between overflow-hidden rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-4 text-left transition-all duration-[var(--dur-normal)] hover:border-[var(--t1)] hover:shadow-[var(--sh-md)] target:border-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--t1)]/30 focus-visible:ring-offset-2"
      >
        {/* 상단: CEFR 배지 + 구독 상태 표시 */}
        <div className="flex items-start justify-between">
          {set.cefrLevel ? (
            <span
              className={`inline-flex h-6 items-center rounded-[var(--r-sm)] px-2 font-mono text-[10px] font-[700] uppercase tracking-wider ring-1 ${levelTone}`}
            >
              {set.cefrLevel}
            </span>
          ) : (
            <span className="h-6" />
          )}
          {isSubscribed && (
            <span
              aria-label="구독 중"
              className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--t1)] text-[var(--bg)]"
            >
              <Check size={12} strokeWidth={3} aria-hidden />
            </span>
          )}
        </div>

        {/* 중앙: emoji = 시각 anchor (poster style) */}
        <div className="flex flex-1 items-center justify-center py-2">
          {set.coverEmoji ? (
            <span
              aria-hidden="true"
              className="text-[64px] leading-none transition-transform duration-[var(--dur-slow)] group-hover:scale-110"
            >
              {set.coverEmoji}
            </span>
          ) : (
            <span
              aria-hidden="true"
              className="font-display text-[40px] font-[800] text-[var(--t4)]"
            >
              {set.title.slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>

        {/* 하단: 제목 + 메타 */}
        <div className="space-y-0.5">
          <h3 className="line-clamp-2 font-display text-[13px] font-[700] leading-tight text-[var(--t1)]">
            {set.title}
          </h3>
          <p className="truncate font-body text-[11px] text-[var(--t3)]">
            {label && <span>{label} · </span>}
            <span className="tabular-nums">
              {set.wordCount.toLocaleString()}단어
            </span>
          </p>
        </div>
      </button>

      {/* 빠른 추가 액션 — hover/focus 시 reveal */}
      <button
        type="button"
        onClick={handleSubscribeClick}
        disabled={isPending}
        aria-label={
          isSubscribed
            ? `${set.title} 구독 해지`
            : `${set.title} 내 단어장에 추가`
        }
        className={`absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full transition-all duration-[var(--dur-normal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60 ${
          isSubscribed
            ? 'pointer-events-none opacity-0'
            : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 bg-[var(--t1)] text-[var(--bg)] hover:scale-110 focus-visible:opacity-100 focus-visible:ring-[var(--t1)]/40'
        }`}
      >
        {isPending ? (
          <Loader2 size={14} className="animate-spin" aria-hidden />
        ) : (
          <Plus size={16} strokeWidth={2.5} aria-hidden />
        )}
      </button>

      {errorMessage && (
        <p
          role="alert"
          className="mt-2 font-body text-[11px] text-[var(--error)]"
        >
          {errorMessage}
        </p>
      )}
    </article>
  )
}
