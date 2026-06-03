// apps/web/src/components/library/books/BookDetailClient.tsx
//
// v06.31 H2 — Spec §4 정합 Primary + Supplementary Tier 시스템.
// - Primary 카드 (★ 추천): "도서 학습 단어장" 통합 (메타: N챕터 · M단어)
// - 카드 클릭 시 챕터별 grid 펼침 (Tier 1.5)
// - Supplementary 토글 (Phase 2 placeholder — 공용 단어장 매핑 시 활성)
// - 챕터 칩 클릭 → VocabSetPreviewModal (Tier 3)
//
// 도서 컨텍스트 안에서만 노출. 단어장 진입은 이 페이지에서만.

'use client'

import { useState, useTransition } from 'react'
import { BookOpen, CheckCircle2, ChevronDown, ChevronUp, Loader2, Sparkles } from 'lucide-react'

import { VocabSetPreviewModal } from '@/components/library/vocab/VocabSetPreviewModal'
import { subscribeSet, unsubscribeSet } from '@/app/(main)/library/vocab/actions'
import type { PublishedVocabSet } from '@/lib/library/vocab/queries'

export interface ChapterSet extends PublishedVocabSet {
  chapterIdx: number
  curationQuery: Record<string, unknown>
}

interface Props {
  bookId: string
  bookVLevel: number | null
  chapterSets: ChapterSet[]
  subscribedIds: string[]
  isLoggedIn: boolean
}

export function BookDetailClient({
  bookVLevel,
  chapterSets,
  subscribedIds,
  isLoggedIn,
}: Props) {
  const [primaryExpanded, setPrimaryExpanded] = useState(false)
  const [supplementaryExpanded, setSupplementaryExpanded] = useState(false)
  const [previewSet, setPreviewSet] = useState<PublishedVocabSet | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [localSubscribed, setLocalSubscribed] = useState<Set<string>>(
    () => new Set(subscribedIds),
  )
  const [, startTransition] = useTransition()

  function handleToggle(set: PublishedVocabSet) {
    if (!isLoggedIn) return
    const wasSubscribed = localSubscribed.has(set.id)
    setPendingId(set.id)
    startTransition(async () => {
      const res = wasSubscribed ? await unsubscribeSet(set.id) : await subscribeSet(set.id)
      if (res.ok) {
        setLocalSubscribed((prev) => {
          const next = new Set(prev)
          if (wasSubscribed) next.delete(set.id)
          else next.add(set.id)
          return next
        })
      }
      setPendingId(null)
    })
  }

  const totalWords = chapterSets.reduce((sum, s) => sum + s.wordCount, 0)
  const subscribedCount = chapterSets.filter((s) => localSubscribed.has(s.id)).length
  const cefrLevel = chapterSets[0]?.cefrLevel

  if (chapterSets.length === 0) return null

  return (
    <section aria-label="함께 학습할 단어장" className="flex flex-col gap-3">
      <header className="flex items-center gap-2.5">
        <span className="h-px w-4 bg-[var(--t3)]" aria-hidden />
        <h2 className="font-display text-[14px] font-[700] text-[var(--t1)]">
          📚 함께 학습할 단어장
        </h2>
      </header>

      {/* Tier 1 · Primary 통합 카드 (★ 추천) */}
      <article className="overflow-hidden rounded-[var(--r-lg)] border-2 border-[#FBBF24] bg-[var(--bg)] shadow-[var(--sh-sm)]">
        <button
          type="button"
          onClick={() => setPrimaryExpanded((v) => !v)}
          aria-expanded={primaryExpanded}
          className="flex w-full items-center gap-4 p-5 text-left transition-colors hover:bg-[#FEF3C7]/30"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--r-md)] bg-gradient-to-br from-[#FBBF24] to-[#D97706] text-[var(--ti)] shadow-[var(--sh-sm)]">
            <BookOpen size={22} strokeWidth={2} aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-2">
              <h3 className="font-display text-[15px] font-[700] text-[var(--t1)]">
                도서 학습 단어장
              </h3>
              <span className="inline-flex items-center gap-0.5 rounded-[var(--r-full)] bg-[#FBBF24] px-1.5 py-0.5 font-display text-[9px] font-[700] uppercase tracking-wider text-[#7C2D12]">
                <Sparkles size={9} aria-hidden /> 추천
              </span>
            </div>
            <p className="mt-1 font-body text-[12px] text-[var(--t3)]">
              도서에서 직접 추출된 핵심 어휘 · 챕터별로 학습할 수 있어요
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 font-body text-[11px] text-[var(--t3)]">
              <span className="font-display font-[700] text-[var(--t1)]">
                {chapterSets.length}챕터
              </span>
              <span>·</span>
              <span className="font-display font-[700] text-[var(--t1)]">
                {totalWords.toLocaleString()}단어
              </span>
              {bookVLevel != null && (
                <>
                  <span>·</span>
                  <span>V{bookVLevel}+</span>
                </>
              )}
              {cefrLevel && (
                <>
                  <span>·</span>
                  <span>{cefrLevel}</span>
                </>
              )}
              {subscribedCount > 0 && (
                <>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1 text-[var(--success)]">
                    <CheckCircle2 size={11} aria-hidden />
                    {subscribedCount}개 구독 중
                  </span>
                </>
              )}
            </div>
          </div>
          <ChevronDown
            size={18}
            className={`shrink-0 text-[var(--t3)] transition-transform duration-[var(--dur-normal)] ${primaryExpanded ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </button>

        {/* Tier 1.5 · 챕터별 grid (펼침 시) */}
        {primaryExpanded && (
          <div className="border-t border-[var(--bd)] bg-[var(--bg2)]/40 p-4">
            <p className="mb-3 font-body text-[11px] text-[var(--t3)]">
              챕터를 클릭하면 단어 미리보기 + 내 단어장에 추가할 수 있어요
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {chapterSets.map((set) => {
                const subscribed = localSubscribed.has(set.id)
                const pending = pendingId === set.id
                return (
                  <button
                    key={set.id}
                    type="button"
                    onClick={() => setPreviewSet(set)}
                    className={`group relative flex flex-col items-start gap-1 rounded-[var(--r-md)] border p-3 text-left shadow-[var(--sh-sm)] transition-all hover:-translate-y-0.5 hover:border-[#D97706] hover:shadow-[var(--sh-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D97706] ${subscribed ? 'border-[var(--success)]/40 bg-[var(--success-light)]/40' : 'border-[var(--bd)] bg-[var(--bg)]'}`}
                    aria-label={`Ch.${set.chapterIdx} — ${set.wordCount}단어 미리보기`}
                  >
                    <div className="flex w-full items-center justify-between gap-1">
                      <span className="font-display text-[13px] font-[700] text-[var(--t1)]">
                        Ch.{set.chapterIdx}
                      </span>
                      {pending ? (
                        <Loader2 size={11} className="animate-spin text-[var(--t3)]" />
                      ) : subscribed ? (
                        <CheckCircle2 size={12} className="text-[var(--success)]" aria-hidden />
                      ) : null}
                    </div>
                    <span className="font-display text-[18px] font-[800] tabular-nums leading-none text-[var(--t1)]">
                      {set.wordCount}
                      <span className="ml-1 font-display text-[10px] font-[600] text-[var(--t3)]">
                        단어
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </article>

      {/* Tier 2 · Supplementary 토글 (Phase 2 placeholder) */}
      <details
        className="rounded-[var(--r-md)] border border-dashed border-[var(--bd)] bg-[var(--bg2)]/40"
        onToggle={(e) => setSupplementaryExpanded(e.currentTarget.open)}
      >
        <summary className="flex cursor-pointer items-center justify-between px-4 py-3 font-body text-[12px] text-[var(--t3)] transition-colors hover:text-[var(--t1)]">
          <span>보조 단어장 (선택)</span>
          {supplementaryExpanded ? (
            <ChevronUp size={14} aria-hidden />
          ) : (
            <ChevronDown size={14} aria-hidden />
          )}
        </summary>
        <div className="border-t border-dashed border-[var(--bd)] px-4 py-3 font-body text-[11px] text-[var(--t3)]">
          이 도서와 연관된 추가 단어장은 아직 준비되지 않았어요. <br />
          공용 단어장은{' '}
          <a href="/library/vocab" className="font-display font-[700] text-[#8B5CF6] hover:underline">
            /library/vocab
          </a>{' '}
          에서 자유롭게 선택할 수 있어요.
        </div>
      </details>

      <VocabSetPreviewModal
        set={previewSet}
        isSubscribed={previewSet ? localSubscribed.has(previewSet.id) : false}
        isPending={previewSet ? pendingId === previewSet.id : false}
        onToggle={handleToggle}
        onClose={() => setPreviewSet(null)}
      />
    </section>
  )
}
