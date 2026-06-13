// apps/web/src/components/home/TodayFocus.tsx
//
// Hub Tier 2 — "지금 무엇을 할지" 1순위 액션 카드.
// 사용자 페르소나 (4시나리오 — §17 학습 모델 정합) 자동 분기:
//
//   ① 미진단     → V-Level 진단 5분 CTA (Compass · 보라 토널)
//   ② Cold        → 첫 학습 시작 CTA (단어 < 50)
//   ③ Warm-Risk  → risk 단어 N개 즉시 복습 (Flame · 위급 표시 X — 격려)
//   ④ Hot         → 정복 가능 텍스트 surface (ScriptQuiz CTA)
//
// 데이터: useHubData()
//   - vrl.isDiagnosed, vrl.currentVLevel, vrl.riskWordCount
//   - stats.totalWords, stats.reviewDueCount
//   - continueCard (이어하기 후보)
//
// Calm UI · Empathetic Feedback · SDT 자율성 — solid accent X, tonal tint + 1.5px border.

'use client'

import Link from 'next/link'
import {
  ArrowRight,
  BookOpen,
  Compass,
  type LucideIcon,
  Sparkles,
  Sprout,
  Target,
  Zap,
} from 'lucide-react'

import { useHubData } from '@/hooks/useHubData'

// ────────────────────────────────────────────────────────────
// 페르소나 분기 — §17.2 사용자 상태 축 정합
// ────────────────────────────────────────────────────────────
type Persona = 'undiagnosed' | 'cold' | 'warm-risk' | 'warm-progress' | 'hot'

function getPersona(args: {
  isDiagnosed: boolean
  totalWords: number
  riskWordCount: number
  streak: number
}): Persona {
  const { isDiagnosed, totalWords, riskWordCount, streak } = args

  if (!isDiagnosed) return 'undiagnosed'
  if (totalWords < 50) return 'cold'
  if (riskWordCount >= 3) return 'warm-risk'
  if (totalWords >= 500 || streak >= 30) return 'hot'
  return 'warm-progress'
}

// ────────────────────────────────────────────────────────────
// Focus card schema
// ────────────────────────────────────────────────────────────
interface FocusCard {
  eyebrow: string
  title: string
  description: string
  ctaLabel: string
  ctaHref: string
  icon: LucideIcon
  accent: string // hex (8% tint)
  accentTint: string // 12% tint (background)
  accentDeep: string // text/border
}

const PERSONA_CARDS: Record<Persona, (ctx: { vLevel: number | null; riskWordCount: number; continueTextId: string | null }) => FocusCard> = {
  undiagnosed: () => ({
    eyebrow: '시작 단계',
    title: '5분 V-Level 진단으로 시작하세요',
    description:
      '한국 학습자 12단계 V-Level 체계로 본인의 어휘 수준을 정확히 측정합니다. 진단 후 맞춤 단어장과 추천 학습 경로가 활성화돼요.',
    ctaLabel: '진단 시작',
    ctaHref: '/diagnostic',
    icon: Compass,
    accent: '#AF52DE',
    accentTint: '#F5F3FF',
    accentDeep: '#6D28D9',
  }),
  cold: ({ vLevel }) => ({
    eyebrow: '첫 학습',
    title: vLevel ? `V${vLevel} 추천 단어장으로 시작해보세요` : '첫 단어장으로 시작해보세요',
    description: vLevel
      ? `V-Level ${vLevel} 에 맞는 단어장을 추천해드려요. 50개 단어를 모으면 다음 단계가 열립니다.`
      : '단어장 또는 스크립트을 골라 처음 50단어를 만들어 보세요.',
    ctaLabel: '추천 단어장 보기',
    ctaHref: '/library/vocab',
    icon: Sprout,
    accent: '#5856D6',
    accentTint: '#EBEAFB',
    accentDeep: '#3C3AAB',
  }),
  'warm-risk': ({ riskWordCount }) => ({
    eyebrow: '오늘의 복습',
    title: `${riskWordCount}개 단어가 흐려지고 있어요`,
    description:
      'SRS 일정상 오늘 다시 만나야 하는 단어들입니다. 한 번만 만나도 기억이 강화됩니다 — 부담 없이 시작해 보세요.',
    ctaLabel: '플래시카드 시작',
    ctaHref: '/flashcard/play',
    icon: Target,
    accent: '#FF9500',
    accentTint: '#FFF1E5',
    accentDeep: '#C2410C',
  }),
  'warm-progress': ({ continueTextId }) => ({
    eyebrow: '오늘의 학습',
    title: '꾸준한 흐름을 이어가세요',
    description: continueTextId
      ? '최근 학습한 자료가 이어집니다. 1-2개 단어만 더 만나도 다음 V-Level 진입에 가까워져요.'
      : '추천 단어장을 골라 오늘 분량을 채워 보세요. Memory Decay 색이 바뀌는 걸 직접 볼 수 있어요.',
    ctaLabel: continueTextId ? '이어 학습하기' : '추천 보기',
    ctaHref: continueTextId ? `/text/${continueTextId}?mode=read` : '/library/vocab',
    icon: Zap,
    accent: '#5856D6',
    accentTint: '#EBEAFB',
    accentDeep: '#3C3AAB',
  }),
  hot: ({ continueTextId }) => ({
    eyebrow: '정복 도전',
    title: '스크립트 전체를 점검해볼 시간이에요',
    description:
      '쌓아온 어휘로 텍스트를 통째로 검증해 보세요. ScriptQuiz 4지선다로 의미 통합을 확인하고 Dictation 으로 마무리합니다.',
    ctaLabel: continueTextId ? '정복 도전' : '스크립트 고르기',
    ctaHref: continueTextId ? `/text/${continueTextId}?mode=quiz` : '/library/books',
    icon: Sparkles,
    accent: '#34C759',
    accentTint: '#D1FAE5',
    accentDeep: '#047857',
  }),
}

// ════════════════════════════════════════════════════════════
// TodayFocus
// ════════════════════════════════════════════════════════════
export function TodayFocus() {
  const { data, isLoading } = useHubData()

  if (isLoading || !data) {
    return (
      <div
        className="rounded-[var(--r-lg)] border p-5 animate-pulse"
        style={{ background: 'var(--bg)', borderColor: 'var(--bd)', height: 124 }}
        aria-hidden
      />
    )
  }

  const persona = getPersona({
    isDiagnosed: data.vrl.isDiagnosed,
    totalWords: data.stats.totalWords,
    riskWordCount: data.vrl.riskWordCount,
    streak: data.stats.streak,
  })

  const card = PERSONA_CARDS[persona]({
    vLevel: data.vrl.currentVLevel,
    riskWordCount: data.vrl.riskWordCount,
    continueTextId: data.continueCard?.textId ?? null,
  })

  const Icon = card.icon

  return (
    <section
      aria-label="오늘의 추천 액션"
      className="relative overflow-hidden rounded-[var(--r-lg)] border transition-all"
      style={{
        background: card.accentTint,
        borderColor: card.accent,
        borderWidth: 1,
      }}
    >
      {/* 좌측 accent strip */}
      <span
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ background: card.accent }}
        aria-hidden
      />

      <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:gap-6">
        {/* Icon + eyebrow + title + description */}
        <div className="flex flex-1 items-start gap-4 min-w-0">
          <span
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--r-md)]"
            style={{ background: 'rgba(255,255,255,0.7)' }}
            aria-hidden
          >
            <Icon size={20} strokeWidth={2} style={{ color: card.accent }} />
          </span>
          <div className="min-w-0 flex-1">
            <p
              className="font-mono text-[10.5px] font-[700] uppercase tracking-[0.10em]"
              style={{ color: card.accentDeep }}
            >
              {card.eyebrow}
            </p>
            <h2
              className="mt-0.5 font-display text-[16px] font-[700] leading-tight md:text-[17px]"
              style={{ color: 'var(--t1)' }}
            >
              {card.title}
            </h2>
            <p
              className="mt-1.5 font-body text-[13px] leading-relaxed"
              style={{ color: 'var(--t2)' }}
            >
              {card.description}
            </p>
          </div>
        </div>

        {/* CTA */}
        <Link
          href={card.ctaHref}
          className="inline-flex shrink-0 items-center gap-2 rounded-[var(--r-md)] px-4 py-2.5 font-display text-[13px] font-[600] transition-all hover:opacity-90"
          style={{
            background: card.accent,
            color: 'var(--ti)',
            boxShadow: 'var(--sh-xs)',
          }}
        >
          <span>{card.ctaLabel}</span>
          <ArrowRight size={14} aria-hidden />
        </Link>
      </div>
    </section>
  )
}

// ── 보조 export — 다른 곳에서도 같은 페르소나 분기 쓰고 싶을 때
export { getPersona }
export type { Persona }
