// apps/web/src/components/layout/FlowNav.tsx
//
// FlowNav v3 — 학습 여정 + 모멘텀 헤더 (전역 상단)
// CLAUDE.md §17.10 IA 원칙 + §"디자인 철학·학습 과학 원칙"
//
// v3 핵심 (v2 → v3):
//   1) 모멘텀 배지 (좌측) — 연속일·어휘 자산·이번 주 실적 = "전체 실적" 한눈에 (Emotional Encoding)
//   2) 추천 단계 글로우 — goal-gradient(완료 임박 단계)로 "도전 효과" 유도 (학습 권장)
//   3) 리치 툴팁 — 각 요소 hover/focus 시 상세 카드 (단계 설명 + 내 진척 + 도전 한 줄)
//   4) 여정 메리디안 — 하단 2px 그라디언트 = 전체 여정 완성도 (Implicit Progress)
//
// 뇌과학·심리 적용:
//   - Implicit Progress: 링 + 하단 메리디안 (숫자만이 아닌 환경 변화)
//   - Goal-gradient: 완료 임박 단계 글로우 → "거의 다 왔어요" 당김
//   - Emotional Encoding: streak flame(따뜻), 보상색(보라·금), VR 보상 (과장 X)
//   - Calm UI: 빨강 압박 X · 깜빡임 X · 부드러운 펄스만
//   - Empathetic Feedback: 격려 카피, 비난 X
//
// ⚠ 데이터는 mock — Phase 2 에서 user_stats / learning_records 실데이터로 스왑 (아래 매핑 주석).

'use client'

import {
  BookMarked,
  BookOpen,
  Compass,
  Flame,
  Mic,
  Sparkles,
  Target,
  Trophy,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ComponentType, SVGProps } from 'react'

import { isFullScreenRoute } from '@/lib/layout/full-screen-routes'

// ── Stage definition ─────────────────────────────────────────────
export type FlowStage =
  | 'discover'
  | 'source'
  | 'words'
  | 'practice'
  | 'conquer'
  | 'complete'

interface StageConfig {
  key: FlowStage
  Icon: ComponentType<SVGProps<SVGSVGElement>>
  label: string
  subtitle: string
  sessionHref: string
  /** Mock progress 0~100 — Phase 2: DB 실시간 fetch */
  progress: number
  accent: string
  /** 툴팁 — 이 단계에서 무엇을 하는지 */
  tip: string
  /** 툴팁 — mock 실적 한 줄 (Phase 2: 실데이터) */
  stat: string
}

// ── Mock data ──────────────────────────────────────────────────────
//
// Phase 2 swap:
//   stage.progress  → §17.7 데이터 축 매핑 (source=AVG progress / words=stable% / practice=7d 정확도 …)
//   MOMENTUM        → user_stats(streak) + vocabularies(mastery) + learning_records(주간)
const STAGES: StageConfig[] = [
  {
    key: 'discover',
    Icon: Compass,
    label: 'Library',
    subtitle: '발견',
    sessionHref: '/library',
    progress: 0,
    accent: '#A855F7',
    tip: '큐레이션된 원서를 골라 학습을 시작해요.',
    stat: '이번 주 3권 탐색',
  },
  {
    key: 'source',
    Icon: BookOpen,
    label: 'Scripts',
    subtitle: '읽고 듣기',
    sessionHref: '/text/1',
    progress: 45,
    accent: '#8B5CF6',
    tip: '원서를 읽고 들으며 맥락 속에서 단어를 만나요.',
    stat: '진행 중 2권 · 정복 2권',
  },
  {
    key: 'words',
    Icon: BookMarked,
    label: 'Words',
    subtitle: '학습 모드',
    sessionHref: '/wordvault?view=study',
    progress: 35,
    accent: '#6366F1',
    tip: '추출한 단어를 4색 기억 상태로 관리해요.',
    stat: '안정 97 · 흔들림 28 · 신규 17',
  },
  {
    key: 'practice',
    Icon: Target,
    label: 'Practice',
    subtitle: '카드·게임',
    sessionHref: '/flashcard/play',
    progress: 87,
    accent: '#EC4899',
    tip: '플래시카드·게임으로 능동 회상을 훈련해요.',
    stat: '정확도 84% · 이번 주 +6%p',
  },
  {
    key: 'conquer',
    Icon: Trophy,
    label: 'Conquer',
    subtitle: '독해 퀴즈',
    sessionHref: '/scriptquiz/play',
    progress: 60,
    accent: '#F59E0B',
    tip: '스크립트 퀴즈로 텍스트 전체를 정복해요.',
    stat: '정복 3 텍스트 · 평균 82%',
  },
  {
    key: 'complete',
    Icon: Mic,
    label: 'Complete',
    subtitle: '받아쓰기',
    sessionHref: '/dictate/setup',
    progress: 25,
    accent: '#06B6D4',
    tip: '받아쓰기로 듣고 쓰며 학습을 완성해요.',
    stat: '평균 79% · 2 세션',
  },
]

// 어휘 4색 (Memory Decay — CLAUDE.md §"Memory Decay 색 체계")
const MASTERY_COLORS = {
  stable: '#22C55E',
  shaky: '#F59E0B',
  risk: '#EF4444',
  new: '#94A3B8',
} as const

// Momentum — 서버 layout 이 실데이터 주입 (user_stats.streak + vocabularies R(t) 4상태 + daily_activity 주간)
export interface FlowNavMomentum {
  streak: number
  mastery: { stable: number; shaky: number; risk: number; fresh: number }
  weekDays: number
}

const EMPTY_MOMENTUM: FlowNavMomentum = {
  streak: 0,
  mastery: { stable: 0, shaky: 0, risk: 0, fresh: 0 },
  weekDays: 0,
}

function masteryTotal(m: FlowNavMomentum['mastery']): number {
  return m.stable + m.shaky + m.risk + m.fresh
}

// 여정 완성도 — discover 제외 5단계 평균 (Implicit Progress 메리디안)
const JOURNEY_PERCENT = Math.round(
  STAGES.filter((s) => s.key !== 'discover').reduce((a, s) => a + s.progress, 0) /
    (STAGES.length - 1),
)

// 추천 단계 — goal-gradient: 완료 임박(0<p<100 중 최고)을 추천해 "거의 다 왔어요" 당김.
const RECOMMENDED_KEY: FlowStage = (() => {
  let best: FlowStage | null = null
  let bestP = -1
  for (const s of STAGES) {
    if (s.progress > 0 && s.progress < 100 && s.progress > bestP) {
      best = s.key
      bestP = s.progress
    }
  }
  return best ?? 'words'
})()

// ── URL → Stage 매핑 ──────────────────────────────────────────────
function getStageFromPathname(pathname: string): FlowStage | null {
  if (pathname === '/library' || pathname.startsWith('/library/')) return 'discover'
  if (pathname === '/text' || pathname.startsWith('/text/')) return 'source'
  if (pathname === '/wordvault' || pathname.startsWith('/wordvault/')) return 'words'
  if (
    pathname.startsWith('/flashcard') ||
    pathname.startsWith('/spellforge') ||
    pathname.startsWith('/wordblitz') ||
    pathname.startsWith('/pairflip') ||
    // 아케이드는 Sidebar Practice 그룹 소속(v07.4) — FlowNav 단계도 같이 맞춘다.
    pathname === '/arcade'
  )
    return 'practice'
  if (pathname === '/scriptquiz' || pathname.startsWith('/scriptquiz/')) return 'conquer'
  if (pathname === '/dictate' || pathname.startsWith('/dictate/')) return 'complete'
  return null
}

function shouldShowFlowNav(pathname: string): boolean {
  return !isFullScreenRoute(pathname)
}

// ── Progress Ring SVG ────────────────────────────────────────────
interface ProgressRingProps {
  size: number
  radius: number
  strokeWidth: number
  progress: number
  accent: string
  isActive: boolean
  isMeta: boolean
}

function ProgressRing({
  size,
  radius,
  strokeWidth,
  progress,
  accent,
  isActive,
  isMeta,
}: ProgressRingProps) {
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - Math.max(0, Math.min(100, progress)) / 100)
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="absolute inset-0 -rotate-90"
      aria-hidden="true"
    >
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        stroke="var(--bd)"
        strokeWidth={strokeWidth}
        fill="none"
        opacity={isMeta ? 0.35 : 0.55}
      />
      {progress > 0 && (
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={accent}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          opacity={isActive ? 1 : 0.6}
          style={{ transition: 'stroke-dashoffset 0.7s var(--ease-out), opacity 0.2s var(--ease)' }}
        />
      )}
    </svg>
  )
}

// ── Tooltip shell (hover/focus 시 표시, 데스크톱) ────────────────────
function Tip({
  children,
  align = 'center',
}: {
  children: React.ReactNode
  align?: 'left' | 'center' | 'right'
}) {
  const pos =
    align === 'left'
      ? 'left-0'
      : align === 'right'
        ? 'right-0'
        : 'left-1/2 -translate-x-1/2'
  return (
    <div
      role="tooltip"
      className={`pointer-events-none absolute top-[calc(100%+8px)] z-50 w-[240px] origin-top scale-[0.97] opacity-0 transition-all duration-150 ease-[var(--ease-out)] group-hover:scale-100 group-hover:opacity-100 group-focus-within:scale-100 group-focus-within:opacity-100 ${pos}`}
    >
      <div className="overflow-hidden rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] shadow-[var(--sh-lg)]">
        {children}
      </div>
    </div>
  )
}

// ── Momentum 배지 (전체 실적) ────────────────────────────────────────
function MomentumBadge({ momentum }: { momentum: FlowNavMomentum }) {
  return (
    <div className="group relative flex shrink-0 items-center">
      <Link
        href="/dashboard"
        aria-label={`전체 실적 — 연속 ${momentum.streak}일 · 여정 ${JOURNEY_PERCENT}% · 대시보드 열기`}
        className="flex h-[44px] items-center gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-gradient-to-br from-[#FFF7ED] to-[var(--bg)] px-2.5 transition-all hover:border-[#F59E0B]/40 hover:shadow-[var(--sh-sm)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B]/40 dark:from-[#3B2000]/40"
      >
        <span className="relative inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#FBBF24] to-[#F97316] text-white shadow-[0_2px_6px_rgba(249,115,22,0.4)]">
          <Flame size={14} strokeWidth={2.5} aria-hidden />
        </span>
        <span className="flex flex-col items-start leading-none">
          <span className="font-display text-[14px] font-[800] tabular-nums text-[var(--t1)]">
            {momentum.streak}
            <span className="ml-0.5 text-[10px] font-[700] text-[var(--t2)]">일</span>
          </span>
          <span className="mt-0.5 font-mono text-[9px] font-[600] uppercase tracking-wider text-[#D97706]">
            연속 학습
          </span>
        </span>
      </Link>

      {/* 전체 실적 툴팁 */}
      <Tip align="left">
        <div className="flex flex-col gap-2.5 p-3.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-[#FBBF24] to-[#F97316] text-white">
              <Flame size={12} strokeWidth={2.5} aria-hidden />
            </span>
            <div className="flex flex-col">
              <span className="font-display text-[13px] font-[800] text-[var(--t1)]">
                {momentum.streak > 0 ? `${momentum.streak}일 연속 학습 중` : '오늘부터 시작해요'}
              </span>
              <span className="font-body text-[11px] text-[var(--t2)]">
                {momentum.streak > 0 ? '오늘도 좋은 흐름이에요' : '한 걸음이면 충분해요'}
              </span>
            </div>
          </div>

          {/* 어휘 자산 — 4색 분포 */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-[9.5px] font-[700] uppercase tracking-wider text-[var(--t2)]">
                내 어휘 자산
              </span>
              <span className="font-display text-[12px] font-[800] tabular-nums text-[var(--t1)]">
                {masteryTotal(momentum.mastery)}
                <span className="ml-0.5 text-[9px] font-[600] text-[var(--t2)]">개</span>
              </span>
            </div>
            <MasteryBar mastery={momentum.mastery} />
            <div className="flex flex-wrap gap-x-2.5 gap-y-0.5">
              <MasteryLegend color={MASTERY_COLORS.stable} label="안정" n={momentum.mastery.stable} />
              <MasteryLegend color={MASTERY_COLORS.shaky} label="흔들림" n={momentum.mastery.shaky} />
              <MasteryLegend color={MASTERY_COLORS.risk} label="위급" n={momentum.mastery.risk} />
              <MasteryLegend color={MASTERY_COLORS.new} label="신규" n={momentum.mastery.fresh} />
            </div>
          </div>

          {/* 이번 주 + 여정 */}
          <div className="flex items-center justify-between border-t border-[var(--bd)] pt-2">
            <span className="font-body text-[11px] text-[var(--t2)]">
              이번 주{' '}
              <strong className="font-display font-[700] text-[var(--t1)]">{momentum.weekDays}일</strong>
              {' 학습'}
            </span>
            <span className="inline-flex items-center gap-1 rounded-[var(--r-full)] bg-[var(--p-light)] px-2 py-0.5 font-display text-[10px] font-[800] text-[var(--p)]">
              여정 {JOURNEY_PERCENT}%
            </span>
          </div>
        </div>
      </Tip>
    </div>
  )
}

function MasteryBar({ mastery }: { mastery: FlowNavMomentum['mastery'] }) {
  const total = masteryTotal(mastery)
  const segs = [
    { c: MASTERY_COLORS.stable, n: mastery.stable },
    { c: MASTERY_COLORS.shaky, n: mastery.shaky },
    { c: MASTERY_COLORS.risk, n: mastery.risk },
    { c: MASTERY_COLORS.new, n: mastery.fresh },
  ]
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-[var(--bg3)]" aria-hidden>
      {total > 0 &&
        segs.map((s, i) => (
          <span key={i} style={{ width: `${(s.n / total) * 100}%`, backgroundColor: s.c }} />
        ))}
    </div>
  )
}

function MasteryLegend({ color, label, n }: { color: string; label: string; n: number }) {
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[9.5px] text-[var(--t2)]">
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} aria-hidden />
      {label} <strong className="font-[700] text-[var(--t2)]">{n}</strong>
    </span>
  )
}

// ── Desktop stage ────────────────────────────────────────────────
function StageDesktop({
  stage,
  isCurrent,
  isMeta,
  isRecommended,
  align,
}: {
  stage: StageConfig
  isCurrent: boolean
  isMeta: boolean
  isRecommended: boolean
  align: 'left' | 'center' | 'right'
}) {
  const Icon = stage.Icon
  const baseOpacity = isMeta && !isCurrent ? 'opacity-60' : ''
  const progressLabel = stage.progress > 0 ? ` · ${stage.progress}% 익힘` : ''
  const a11y = `${stage.label} — ${stage.subtitle}${progressLabel}${isRecommended ? ' · 추천' : ''}`

  return (
    <div className="group relative flex min-w-0 flex-1">
      <Link
        href={stage.sessionHref}
        aria-current={isCurrent ? 'page' : undefined}
        aria-label={a11y}
        className={`flex min-h-[48px] w-full items-center justify-center gap-2.5 rounded-[var(--r-md)] px-2 py-1.5 transition-all duration-[var(--dur-normal)] ease-[var(--ease-spring)] hover:bg-[var(--bg2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-1 ${baseOpacity}`}
      >
        <span
          className={`relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-transform duration-[var(--dur-normal)] ${
            isCurrent ? 'scale-110' : 'group-hover:scale-105'
          }`}
        >
          {/* 추천 글로우 (goal-gradient) */}
          {isRecommended && (
            <span
              aria-hidden
              className="absolute inset-[-3px] rounded-full"
              style={{
                background: `radial-gradient(circle, ${stage.accent}55 0%, transparent 70%)`,
                animation: 'flowRecPulse 2.4s ease-in-out infinite',
              }}
            />
          )}
          <ProgressRing
            size={32}
            radius={13}
            strokeWidth={2}
            progress={stage.progress}
            accent={stage.accent}
            isActive={isCurrent || isRecommended}
            isMeta={isMeta}
          />
          <span
            className="relative z-10 inline-flex h-5 w-5 items-center justify-center rounded-full transition-colors duration-[var(--dur-normal)]"
            style={
              isCurrent || isRecommended
                ? { backgroundColor: stage.accent, color: '#FFFFFF' }
                : { backgroundColor: 'transparent', color: 'var(--t3)' }
            }
            aria-hidden
          >
            <Icon width={11} height={11} strokeWidth={2.5} />
          </span>
        </span>

        <span className="flex min-w-0 flex-col items-start">
          <span
            className={`truncate font-display text-[12px] font-[700] leading-tight tracking-tight transition-colors ${
              isCurrent ? 'text-[var(--t1)]' : 'text-[var(--t2)] group-hover:text-[var(--t1)]'
            }`}
          >
            {stage.label}
          </span>
          {isRecommended ? (
            <span
              className="inline-flex items-center gap-0.5 font-mono text-[9px] font-[700] uppercase tracking-wider"
              style={{ color: stage.accent }}
            >
              <Sparkles width={8} height={8} aria-hidden /> 추천
            </span>
          ) : (
            <span
              className={`font-mono text-[9px] uppercase tracking-wider tabular-nums ${
                isCurrent ? 'text-[var(--t2)]' : 'text-[var(--t2)] opacity-60'
              }`}
            >
              {stage.progress > 0 && !isMeta ? `${stage.progress}%` : stage.subtitle}
            </span>
          )}
        </span>
      </Link>

      {/* 단계 툴팁 */}
      <Tip align={align}>
        <div className="flex flex-col">
          <div
            className="flex items-center gap-2 px-3.5 py-2.5"
            style={{ background: `linear-gradient(90deg, ${stage.accent}1A, transparent)` }}
          >
            <span
              className="inline-flex h-6 w-6 items-center justify-center rounded-full text-white"
              style={{ backgroundColor: stage.accent }}
            >
              <Icon width={12} height={12} strokeWidth={2.5} aria-hidden />
            </span>
            <div className="flex flex-col leading-tight">
              <span className="font-display text-[13px] font-[800] text-[var(--t1)]">
                {stage.label}
              </span>
              <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--t2)]">
                {stage.subtitle}
              </span>
            </div>
            {stage.progress > 0 && (
              <span
                className="ml-auto font-display text-[15px] font-[800] tabular-nums"
                style={{ color: stage.accent }}
              >
                {stage.progress}%
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2 px-3.5 pb-3 pt-2">
            <p className="font-body text-[11.5px] leading-relaxed text-[var(--t2)]">{stage.tip}</p>
            {stage.progress > 0 && (
              <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg3)]" aria-hidden>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${stage.progress}%`, backgroundColor: stage.accent }}
                />
              </div>
            )}
            <span className="font-mono text-[10px] text-[var(--t2)]">{stage.stat}</span>

            {isRecommended ? (
              <span
                className="mt-0.5 inline-flex items-center gap-1 rounded-[var(--r-md)] px-2 py-1 font-display text-[11px] font-[700]"
                style={{ backgroundColor: `${stage.accent}1A`, color: stage.accent }}
              >
                <Sparkles width={11} height={11} aria-hidden />
                거의 다 왔어요 — {100 - stage.progress}%만 더!
              </span>
            ) : (
              <span className="mt-0.5 font-body text-[10px] italic text-[var(--t2)]">
                클릭하면 바로 시작해요
              </span>
            )}
          </div>
        </div>
      </Tip>
    </div>
  )
}

function Connector() {
  return (
    <span
      aria-hidden
      className="self-center"
      style={{
        width: '12px',
        height: '1px',
        flexShrink: 0,
        background: 'repeating-linear-gradient(to right, var(--bd) 0 3px, transparent 3px 6px)',
      }}
    />
  )
}

// ── Mobile stage ─────────────────────────────────────────────────
function StageMobile({
  stage,
  isCurrent,
  isMeta,
  isRecommended,
}: {
  stage: StageConfig
  isCurrent: boolean
  isMeta: boolean
  isRecommended: boolean
}) {
  const Icon = stage.Icon
  const baseOpacity = isMeta && !isCurrent ? 'opacity-60' : ''
  const a11y = `${stage.label} — ${stage.subtitle}${stage.progress > 0 ? ` · ${stage.progress}% 익힘` : ''}${isRecommended ? ' · 추천' : ''}`
  return (
    <Link
      href={stage.sessionHref}
      aria-current={isCurrent ? 'page' : undefined}
      aria-label={a11y}
      className={`flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-[var(--r-sm)] px-0.5 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] ${baseOpacity}`}
    >
      <span
        className={`relative inline-flex h-7 w-7 items-center justify-center rounded-full transition-transform ${
          isCurrent ? 'scale-110' : ''
        }`}
      >
        {isRecommended && (
          <span
            aria-hidden
            className="absolute inset-[-2px] rounded-full"
            style={{
              background: `radial-gradient(circle, ${stage.accent}55 0%, transparent 70%)`,
              animation: 'flowRecPulse 2.4s ease-in-out infinite',
            }}
          />
        )}
        <ProgressRing
          size={28}
          radius={11}
          strokeWidth={1.75}
          progress={stage.progress}
          accent={stage.accent}
          isActive={isCurrent || isRecommended}
          isMeta={isMeta}
        />
        <span
          className="relative z-10 inline-flex h-4 w-4 items-center justify-center rounded-full"
          style={
            isCurrent || isRecommended
              ? { backgroundColor: stage.accent, color: '#FFFFFF' }
              : { backgroundColor: 'transparent', color: 'var(--t3)' }
          }
          aria-hidden
        >
          <Icon width={9} height={9} strokeWidth={2.5} />
        </span>
      </span>
      {(isCurrent || isRecommended) && (
        <span className="font-display text-[8px] font-[700] leading-none tracking-tight text-[var(--t1)]">
          {stage.label}
        </span>
      )}
    </Link>
  )
}

// ── FlowNav main ─────────────────────────────────────────────────
export function FlowNav({ momentum: momentumProp }: { momentum?: FlowNavMomentum | null }) {
  const pathname = usePathname() ?? '/'
  const momentum = momentumProp ?? EMPTY_MOMENTUM
  if (!shouldShowFlowNav(pathname)) return null

  const currentStage = getStageFromPathname(pathname)
  const isMeta = currentStage === null
  const last = STAGES.length - 1

  return (
    <nav
      aria-label="학습 여정"
      // overflow-x:clip — 리치 툴팁(w-240px · opacity-0 이어도 레이아웃 점유)이 좁은 폭에서
      //   뷰포트를 넘어 **모든 (main) 페이지에 가로 스크롤바**를 만들던 결함 차단(실측 768px 39px).
      //   `clip` 은 `hidden` 과 달리 다른 축을 스크롤로 승격시키지 않아 툴팁이 아래로 펼쳐지는 건 그대로 유지된다.
      className="sticky top-0 z-30 w-full overflow-x-clip border-b border-[var(--bd)] bg-[var(--bg)]/95 backdrop-blur"
    >
      {/* Desktop */}
      <div className="relative mx-auto hidden max-w-6xl items-stretch gap-1 px-4 py-2.5 md:flex">
        <MomentumBadge momentum={momentum} />
        <Connector />
        {STAGES.map((stage, idx) => (
          <span key={stage.key} className="contents">
            <StageDesktop
              stage={stage}
              isCurrent={stage.key === currentStage}
              isMeta={isMeta}
              isRecommended={stage.key === RECOMMENDED_KEY}
              align={idx === 0 ? 'left' : idx === last ? 'right' : 'center'}
            />
            {idx < last && <Connector />}
          </span>
        ))}
        {/* 여정 메리디안 — 하단 그라디언트 진척 (Implicit Progress) */}
        <span
          aria-hidden
          className="absolute bottom-[-1px] left-0 h-[2px] rounded-full"
          style={{
            width: `${JOURNEY_PERCENT}%`,
            background:
              'linear-gradient(90deg, #A855F7, #8B5CF6, #6366F1, #EC4899, #F59E0B, #06B6D4)',
            transition: 'width 0.8s var(--ease-out)',
          }}
        />
      </div>

      {/* Mobile */}
      <div className="relative mx-auto flex max-w-5xl items-center gap-0.5 px-2 py-1.5 md:hidden">
        <span className="mr-0.5 inline-flex shrink-0 items-center gap-1 rounded-[var(--r-full)] bg-gradient-to-br from-[#FBBF24] to-[#F97316] px-2 py-1 text-white shadow-[0_1px_4px_rgba(249,115,22,0.35)]">
          <Flame size={11} strokeWidth={2.5} aria-hidden />
          <span className="font-display text-[11px] font-[800] tabular-nums">{momentum.streak}</span>
        </span>
        {STAGES.map((stage) => (
          <StageMobile
            key={stage.key}
            stage={stage}
            isCurrent={stage.key === currentStage}
            isMeta={isMeta}
            isRecommended={stage.key === RECOMMENDED_KEY}
          />
        ))}
        <span
          aria-hidden
          className="absolute bottom-[-1px] left-0 h-[2px] rounded-full"
          style={{
            width: `${JOURNEY_PERCENT}%`,
            background: 'linear-gradient(90deg, #A855F7, #6366F1, #EC4899, #06B6D4)',
            transition: 'width 0.8s var(--ease-out)',
          }}
        />
      </div>

      {/* 추천 글로우 펄스 keyframes — 모션 민감 사용자는 정적 (Calm UI · a11y) */}
      <style jsx global>{`
        @keyframes flowRecPulse {
          0%,
          100% {
            opacity: 0.35;
            transform: scale(1);
          }
          50% {
            opacity: 0.65;
            transform: scale(1.15);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*='flowRecPulse'] {
            animation: none !important;
            opacity: 0.45 !important;
          }
        }
      `}</style>
    </nav>
  )
}
