// apps/web/src/components/pairflip/PairFlipNextActionCard.tsx
// 결과 카드 하단 추천 액션 3개 — SDT 자율성 (강제 X · 제안만)

'use client'

import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

interface ActionItem {
  label: string
  description: string
  href: string
  emoji: string
}

interface NextActionCardProps {
  accuracy: number
}

function getActions(accuracy: number): ActionItem[] {
  // accuracy 기반 분기 — cold/warm/hot 추천 정합 (CLAUDE.md §17.5)
  if (accuracy >= 80) {
    return [
      {
        label: '한 번 더',
        description: '같은 난이도로 다시',
        href: '/pairflip/play',
        emoji: '🔁',
      },
      {
        label: '난이도 올리기',
        description: '더 도전적인 단계로',
        href: '/pairflip',
        emoji: '🚀',
      },
      {
        label: 'WordVault',
        description: '단어 더 추가하기',
        href: '/wordvault',
        emoji: '📚',
      },
    ]
  }
  if (accuracy >= 40) {
    return [
      {
        label: '한 번 더',
        description: '익숙해질 때까지',
        href: '/pairflip/play',
        emoji: '🔁',
      },
      {
        label: 'Flashcard',
        description: '차분히 익혀보기',
        href: '/flashcard',
        emoji: '🎯',
      },
      {
        label: '난이도 변경',
        description: '다른 단계 시도',
        href: '/pairflip',
        emoji: '🎚️',
      },
    ]
  }
  // cold — 격려 + 가벼운 모드 권장
  return [
    {
      label: 'Flashcard',
      description: '차분히 익혀보기',
      href: '/flashcard',
      emoji: '🎯',
    },
    {
      label: 'Easy 도전',
      description: '4장으로 가볍게',
      href: '/pairflip',
      emoji: '🌱',
    },
    {
      label: 'WordVault',
      description: '단어 살펴보기',
      href: '/wordvault',
      emoji: '📚',
    },
  ]
}

export function PairFlipNextActionCard({ accuracy }: NextActionCardProps) {
  const actions = getActions(accuracy)

  return (
    <section
      aria-label="다음 학습 추천"
      className="grid grid-cols-1 gap-2 sm:grid-cols-3"
    >
      {actions.map((a) => (
        <Link
          key={a.label}
          href={a.href}
          className="group flex min-h-[64px] items-center gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-3 transition-all duration-[var(--dur-normal)] hover:-translate-y-0.5 hover:border-[#F59E0B]/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B]"
          aria-label={`${a.label} — ${a.description}`}
        >
          <span className="text-[24px] leading-none" aria-hidden="true">
            {a.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[13px] font-[700] text-[var(--t1)]">
              {a.label}
            </p>
            <p className="truncate font-body text-[11px] text-[var(--t3)]">
              {a.description}
            </p>
          </div>
          <ArrowRight
            size={14}
            className="shrink-0 text-[var(--t3)] transition-transform duration-[var(--dur-normal)] group-hover:translate-x-0.5 group-hover:text-[#F59E0B]"
            aria-hidden
          />
        </Link>
      ))}
    </section>
  )
}
