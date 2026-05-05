// apps/web/src/components/wordvault/hub/LearningDimensionSection.tsx
//
// LearningDimensionSection — 학습 단계를 3축으로 시각화 (v06.20)
//
// 근거:
//   - Generation Effect (Slamecka & Graf 1978):
//     생성 인출(SpellForge·Dictation)을 거친 단어 = 강한 부호화
//     → multichannel 그룹 가시화가 자기효능감 강화
//   - Triple Coding (Paivio):
//     시각·청각·운동 3채널 동시 = 장기 기억의 결정적 요인
//   - SDT 유능감:
//     "여러 채널로 익힌 단어" 수치 확인 = 학습 역량 시각화
//
// 3그룹 (module_history 기반 — lib/wordvault/mastery.ts):
//   - unmet         : 아직 안 만난 단어 (history 비어있음 / new)
//   - recognizing   : 익히는 중 (flashcard / wordblitz 만)
//   - multichannel  : 여러 채널로 익힌 (spellforge / dictation 포함)

'use client'

import { ArrowRight, Sparkles, Sprout, Telescope } from 'lucide-react'
import Link from 'next/link'

import type { MasteryGroup, MasteryStage } from '@/lib/wordvault/mastery'

interface LearningDimensionSectionProps {
  groups: MasteryGroup[]
}

const STAGE_META: Record<
  MasteryStage,
  {
    icon: typeof Sprout
    label: string
    subtitle: string
    color: string
    badgeClass: string
    href: string
  }
> = {
  unmet: {
    icon: Sprout,
    label: '아직 안 만난 단어',
    subtitle: 'Flashcard로 처음 만나보세요',
    color: 'var(--memory-new)',
    badgeClass: 'bg-[var(--bg3)] text-[var(--t2)]',
    href: '/wordvault?view=browse&mastery=unmet',
  },
  recognizing: {
    icon: Telescope,
    label: '익히는 중인 단어',
    subtitle: 'SpellForge로 철자를 다져보세요',
    color: 'var(--memory-shaky)',
    badgeClass: 'bg-[var(--warning-light)] text-[#92400E]',
    href: '/wordvault?view=browse&mastery=recognizing',
  },
  multichannel: {
    icon: Sparkles,
    label: '여러 채널로 익힌 단어',
    subtitle: 'ScriptQuiz로 원문에서 확인하세요',
    color: 'var(--memory-stable)',
    badgeClass: 'bg-[var(--success-light)] text-[#065F46]',
    href: '/wordvault?view=browse&mastery=multichannel',
  },
}

export function LearningDimensionSection({ groups }: LearningDimensionSectionProps) {
  const total = groups.reduce((sum, g) => sum + g.count, 0)
  if (total === 0) return null

  return (
    <section aria-label="학습 단계별 단어 현황">
      <header className="mb-3">
        <h2 className="font-display text-[14px] font-[700] text-[var(--t1)]">
          🎯 어떻게 익혔나요
        </h2>
        <p className="font-body text-[11px] text-[var(--t3)]">
          학습 채널 깊이로 본 내 단어
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {groups.map((g) => (
          <DimensionCard key={g.stage} group={g} />
        ))}
      </div>
    </section>
  )
}

function DimensionCard({ group }: { group: MasteryGroup }) {
  const meta = STAGE_META[group.stage]
  const Icon = meta.icon
  const isEmpty = group.count === 0

  const inner = (
    <>
      <div className="flex items-center justify-between">
        <span
          className={`inline-flex h-7 w-7 items-center justify-center rounded-[var(--r-md)] ${meta.badgeClass}`}
          aria-hidden="true"
        >
          <Icon size={15} strokeWidth={2} />
        </span>
        <span
          className="h-1.5 w-1.5 rounded-full"
          aria-hidden="true"
          style={{ backgroundColor: meta.color }}
        />
      </div>

      <div>
        <h3 className="font-display text-[14px] font-[700] text-[var(--t1)]">
          {meta.label}
        </h3>
        <p className="mt-0.5 line-clamp-1 font-body text-[12px] text-[var(--t3)]">
          {isEmpty ? '아직 없어요' : meta.subtitle}
        </p>
      </div>

      <div className="mt-auto flex items-end justify-between">
        <span className="font-display text-[28px] font-[800] tabular-nums leading-none text-[var(--t1)]">
          {group.count}
        </span>
        {!isEmpty && (
          <ArrowRight
            size={14}
            className="shrink-0 text-[var(--t3)] transition-transform duration-[var(--dur-normal)] group-hover:translate-x-0.5 group-hover:text-[var(--p)]"
            aria-hidden="true"
          />
        )}
      </div>
    </>
  )

  const baseClass =
    'flex min-h-[44px] flex-col gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-4 transition-all duration-[var(--dur-normal)] ease-[var(--ease)]'

  if (isEmpty) {
    return (
      <div
        aria-disabled="true"
        aria-label={`${meta.label} — 아직 없어요`}
        className={`${baseClass} pointer-events-none opacity-40`}
      >
        {inner}
      </div>
    )
  }

  return (
    <Link
      href={meta.href}
      aria-label={`${meta.label} ${group.count}개 — 단어 보기`}
      className={`group ${baseClass} hover:-translate-y-0.5 hover:shadow-[var(--sh-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2`}
    >
      {inner}
    </Link>
  )
}
