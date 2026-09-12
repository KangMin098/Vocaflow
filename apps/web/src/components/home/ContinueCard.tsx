// apps/web/src/components/home/ContinueCard.tsx
//
// Hub 의 "이어하기" 카드 — Phase 3-3 Supabase 연동.
//   - useHubData().continueCard 자가 페치
//   - 데이터 없으면 빈 상태 (Empathetic Feedback — 격려형 안내 + Primary CTA)

'use client'

import { ArrowRight, BookPlus, Sparkles } from 'lucide-react'
import Link from 'next/link'

import { useHubData, type ModuleId } from '@/hooks/useHubData'

// 모듈 라벨 매핑 — continueCard.lastModule 표시용
const MODULE_LABEL: Partial<Record<ModuleId, string>> = {
  textviewer: '스크립트',
  wordvault: '단어장',
  flashcard: '플래시카드',
  spellforge: 'SpellForge',
  wordblitz: 'WordBlitz',
  pairflip: 'PairFlip',
  scriptquiz: 'ScriptQuiz',
  dictation: 'Dictation',
  workspace: '워크스페이스',
  pirate_quest: 'Pirate Quest',
}

export function ContinueCard() {
  const { data, isLoading } = useHubData()

  // 로딩 — 깜빡임 방지 placeholder
  if (isLoading) {
    return (
      <div
        aria-hidden
        className="h-[148px] animate-pulse rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)]"
      />
    )
  }

  const cc = data?.continueCard

  // ── 빈 상태 ──
  if (!cc) {
    return (
      <Link
        href="/text/new"
        aria-label="첫 스크립트 추가하기"
        className="group flex flex-col items-center justify-center gap-3 rounded-[var(--r-lg)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] p-8 text-center transition-all duration-[var(--dur-normal)] hover:border-[var(--p)] hover:bg-[var(--bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2"
      >
        <span
          aria-hidden
          className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--r-full)] bg-[var(--p-light)] text-[var(--on-p-tint)]"
        >
          <Sparkles size={18} />
        </span>
        <div className="flex flex-col gap-1">
          <span className="font-display text-[15px] font-[600] text-[var(--t1)]">
            아직 학습한 스크립트이 없어요
          </span>
          <span className="font-body text-[13px] text-[var(--t2)]">
            첫 스크립트를 추가하고 학습을 시작해보세요
          </span>
        </div>
        <span className="mt-1 inline-flex items-center gap-2 rounded-[var(--r-md)] bg-[var(--p)] px-4 py-2 font-display text-[13px] font-[700] text-[var(--on-p)] shadow-[var(--sh-sm)] transition-all duration-[var(--dur-normal)] group-hover:bg-[var(--p-hover)]">
          <BookPlus size={14} aria-hidden="true" />
          <span>스크립트 추가</span>
        </span>
      </Link>
    )
  }

  // ── 데이터 표시 ──
  const isComplete = cc.progressPercent >= 100
  const moduleLabel = MODULE_LABEL[cc.lastModule] ?? '스크립트'

  return (
    <Link
      href={`/text/${cc.textId}`}
      aria-label={`${cc.title} 이어서 학습 (${cc.progressPercent}% 진행)`}
      className="group flex flex-col gap-0 rounded-ios-2xl bg-[var(--bg)] p-6 shadow-ios-2 motion-safe:transition-all motion-safe:duration-[var(--dur-ios-normal)] motion-safe:ease-ios-emphasized motion-safe:hover:shadow-ios-3 motion-safe:hover:-translate-y-0.5 motion-safe:active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2"
    >
      {/* 제목 (Lora) — cover emoji 있으면 prefix */}
      <h3 className="mb-2 flex items-baseline gap-2 font-english text-[20px] font-[600] leading-tight text-[var(--t1)]">
        {cc.coverEmoji && (
          <span aria-hidden="true" className="text-[22px] leading-none">
            {cc.coverEmoji}
          </span>
        )}
        <span className="line-clamp-1">{cc.title}</span>
      </h3>

      {/* 메타 — 시간 · 마지막 모듈 */}
      <div className="mb-5 flex items-center gap-2 font-body text-[12px] text-[var(--t2)]">
        <span>{cc.relativeTime || '최근'}</span>
        <span aria-hidden="true">·</span>
        <span>{moduleLabel}</span>
      </div>

      {/* 진행률 */}
      <div className="mb-5 flex items-center gap-3">
        <div
          role="progressbar"
          aria-valuenow={cc.progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`진행률 ${cc.progressPercent}%`}
          className="h-1.5 flex-1 overflow-hidden rounded-[var(--r-full)] bg-[var(--bg3)]"
        >
          <div
            className={`h-full rounded-[var(--r-full)] transition-[width] duration-[var(--dur-slow)] ease-out ${isComplete ? 'bg-[var(--success)]' : 'bg-[var(--p)]'}`}
            style={{ width: `${cc.progressPercent}%` }}
          />
        </div>
        <span
          className={`shrink-0 font-display text-[13px] font-[600] tabular-nums ${isComplete ? 'text-[var(--success)]' : 'text-[var(--p)]'}`}
        >
          {cc.progressPercent}%
        </span>
      </div>

      {/* CTA */}
      <div className="flex justify-end">
        <span className="inline-flex items-center gap-1 font-display text-[13px] font-[600] text-[var(--p)] transition-all duration-[var(--dur-normal)] group-hover:gap-2">
          {isComplete ? '복습하기' : '이어하기'}
          <ArrowRight size={14} aria-hidden="true" />
        </span>
      </div>
    </Link>
  )
}
