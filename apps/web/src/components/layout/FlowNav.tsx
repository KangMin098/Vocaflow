// apps/web/src/components/layout/FlowNav.tsx
//
// FlowNav v2 — 전역 학습 흐름 네비게이션 (v06.14)
// CLAUDE.md §17.10 IA 원칙
//
// v2 핵심 변경:
//   1) 6단계 (라이브러리 분리) — L0 Discover 와 L1 Acquire 시각 구분
//   2) 진척도 ring — 각 단계 익힘 정도를 SVG 원형 게이지로 노출
//   3) 세션 라우팅 — 클릭 시 허브 X, 활동 진입점(session)으로 직행
//
// 6단계 매핑:
//   📚 라이브러리 → 📖 스크립트 → 📝 단어 → 🎯 익히기 → 🏆 정복 → 🎙 완성
//   /library      /text/[id]    /wordvault  /flashcard  /scriptquiz /dictate
//                              ?view=study  /play       /play       /setup
//
// 진척도 게이지:
//   - background ring (var(--bd) 0.6 opacity)
//   - foreground arc (stage accent · 진척%)
//   - 활성 단계는 accent solid · scale-110
//
// 5관점:
//   - 뇌과학: 진척 시각화 (Implicit Progress) + Levels of Processing 9계층 정합
//   - 심리: 자기효능감 (능력감) + 자율성 (양방향)
//   - 디자인: SVG ring + 6색 accent + 압축 모바일
//   - 접근성: aria-label 익힘% 포함, 44×44 터치, ring 색맹 대비
//   - 실용: 세션 직진 (1클릭 활동), 페이지별 자동 숨김

'use client'

import { BookMarked, BookOpen, Compass, Mic, Target, Trophy } from 'lucide-react'
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
  /** Inactive 부제 (subtitle when not showing progress) */
  subtitle: string
  /** Click target — 활동 진입점 (허브 X, 세션 직행) */
  sessionHref: string
  /** Mock progress 0~100 — Phase 2: DB 실시간 fetch */
  progress: number
  /** Visual identity — hardcoded per CLAUDE.md §13 game-color exception */
  accent: string
}

// ── Mock progress ─────────────────────────────────────────────────
//
// Phase 2 swap 매핑:
//   discover  → /library 큐레이션 카드 클릭 횟수 (UX 따뜻함, 진척 의미 X)
//   source    → AVG(texts.progress_percent) WHERE state='in_progress'
//   words     → COUNT(state='stable') / COUNT(*)
//   practice  → 7일 평균 정확도 (learning_records WHERE module IN flashcard|spellforge|wordblitz)
//   conquer   → COUNT(scores WHERE accuracy >= 0.7) / COUNT(distinct text_id)
//   complete  → AVG(dictation_sessions.totalAccuracy) 7일
const STAGES: StageConfig[] = [
  {
    key: 'discover',
    Icon: Compass,
    label: '라이브러리',
    subtitle: '발견',
    sessionHref: '/library',
    progress: 0,
    accent: '#A855F7', // violet
  },
  {
    key: 'source',
    Icon: BookOpen,
    label: '스크립트',
    subtitle: '읽고 듣기',
    sessionHref: '/text/1', // mock: most-recent in-progress text
    progress: 45,
    accent: '#8B5CF6', // purple
  },
  {
    key: 'words',
    Icon: BookMarked,
    label: '단어',
    subtitle: '학습 모드',
    sessionHref: '/wordvault?view=study',
    progress: 35,
    accent: '#6366F1', // indigo
  },
  {
    key: 'practice',
    Icon: Target,
    label: '익히기',
    subtitle: '카드 시작',
    sessionHref: '/flashcard/play',
    progress: 87,
    accent: '#EC4899', // pink
  },
  {
    key: 'conquer',
    Icon: Trophy,
    label: '정복',
    subtitle: '퀴즈 시작',
    sessionHref: '/scriptquiz/play',
    progress: 60,
    accent: '#F59E0B', // amber
  },
  {
    key: 'complete',
    Icon: Mic,
    label: '완성',
    subtitle: '받아쓰기',
    sessionHref: '/dictate/setup',
    progress: 25,
    accent: '#06B6D4', // cyan
  },
]

// ── URL → Stage 매핑 ──────────────────────────────────────────────
function getStageFromPathname(pathname: string): FlowStage | null {
  if (pathname === '/library' || pathname.startsWith('/library/')) {
    return 'discover'
  }
  if (pathname === '/text' || pathname.startsWith('/text/')) {
    return 'source'
  }
  if (pathname === '/wordvault' || pathname.startsWith('/wordvault/')) {
    return 'words'
  }
  if (
    pathname === '/flashcard' ||
    pathname.startsWith('/flashcard/') ||
    pathname === '/spellforge' ||
    pathname.startsWith('/spellforge/') ||
    pathname === '/wordblitz' ||
    pathname.startsWith('/wordblitz/') ||
    pathname === '/pairflip' ||
    pathname.startsWith('/pairflip/')
  ) {
    return 'practice'
  }
  if (pathname === '/scriptquiz' || pathname.startsWith('/scriptquiz/')) {
    return 'conquer'
  }
  if (pathname === '/dictate' || pathname.startsWith('/dictate/')) {
    return 'complete'
  }
  return null
}

// ── 페이지별 표시 정책 ────────────────────────────────────────────
//
// 게임 play / Dictation session 중에는 working memory 보호를 위해 자동 숨김.
// 판정 로직은 lib/layout/full-screen-routes.ts (Sidebar 와 공유).
function shouldShowFlowNav(pathname: string): boolean {
  return !isFullScreenRoute(pathname)
}

// ── Progress Ring SVG ────────────────────────────────────────────
//
// 32×32 컨테이너에 r=12 ring (background) + arc (progress).
// 진척도 0% → arc 미렌더 (배경 ring 만 표시).
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
      {/* Background ring */}
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        stroke="var(--bd)"
        strokeWidth={strokeWidth}
        fill="none"
        opacity={isMeta ? 0.35 : 0.55}
      />
      {/* Progress arc */}
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
          opacity={isActive ? 1 : 0.55}
          style={{
            transition:
              'stroke-dashoffset 0.6s var(--ease-out), opacity 0.2s var(--ease)',
          }}
        />
      )}
    </svg>
  )
}

// ── Desktop stage button ─────────────────────────────────────────
interface DesktopProps {
  stage: StageConfig
  isCurrent: boolean
  isMeta: boolean
  isLast: boolean
}

function StageButtonDesktop({ stage, isCurrent, isMeta, isLast }: DesktopProps) {
  const Icon = stage.Icon
  const baseOpacity = isMeta ? 'opacity-60' : ''
  const progressLabel = stage.progress > 0 ? ` · ${stage.progress}% 익힘` : ''
  const a11yLabel = `${stage.label} — ${stage.subtitle}${progressLabel}`

  return (
    <>
      <Link
        href={stage.sessionHref}
        aria-current={isCurrent ? 'page' : undefined}
        aria-label={a11yLabel}
        title={a11yLabel}
        className={`group flex min-h-[48px] flex-1 items-center justify-center gap-2.5 rounded-[var(--r-md)] px-2.5 py-1.5 transition-all duration-[var(--dur-normal)] ease-[var(--ease-spring)] hover:bg-[var(--bg2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-1 ${baseOpacity}`}
      >
        {/* Dot + progress ring */}
        <span
          className={`relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-transform duration-[var(--dur-normal)] ${
            isCurrent ? 'scale-110' : 'group-hover:scale-105'
          }`}
        >
          <ProgressRing
            size={32}
            radius={13}
            strokeWidth={2}
            progress={stage.progress}
            accent={stage.accent}
            isActive={isCurrent}
            isMeta={isMeta}
          />
          <span
            className="relative z-10 inline-flex h-5 w-5 items-center justify-center rounded-full transition-colors duration-[var(--dur-normal)]"
            style={
              isCurrent
                ? { backgroundColor: stage.accent, color: '#FFFFFF' }
                : { backgroundColor: 'transparent', color: 'var(--t3)' }
            }
            aria-hidden="true"
          >
            <Icon width={11} height={11} strokeWidth={2.5} />
          </span>
        </span>

        {/* Label + progress / subtitle */}
        <span className="flex flex-col items-start">
          <span
            className={`font-display text-[12px] font-[700] leading-tight tracking-tight transition-colors duration-[var(--dur-normal)] ${
              isCurrent ? 'text-[var(--t1)]' : 'text-[var(--t3)] group-hover:text-[var(--t1)]'
            }`}
          >
            {stage.label}
          </span>
          <span
            className={`font-mono text-[9px] uppercase tracking-wider tabular-nums transition-colors duration-[var(--dur-normal)] ${
              isCurrent ? 'text-[var(--t2)]' : 'text-[var(--t3)] opacity-60'
            }`}
          >
            {stage.progress > 0 && !isMeta ? `${stage.progress}%` : stage.subtitle}
          </span>
        </span>
      </Link>

      {/* Dotted connector — recommended flow, not enforced */}
      {!isLast && (
        <span
          aria-hidden="true"
          className="self-center"
          style={{
            width: '10px',
            height: '1px',
            background:
              'repeating-linear-gradient(to right, var(--bd) 0 3px, transparent 3px 6px)',
          }}
        />
      )}
    </>
  )
}

// ── Mobile stage button ──────────────────────────────────────────
interface MobileProps {
  stage: StageConfig
  isCurrent: boolean
  isMeta: boolean
}

function StageButtonMobile({ stage, isCurrent, isMeta }: MobileProps) {
  const Icon = stage.Icon
  const baseOpacity = isMeta ? 'opacity-60' : ''
  const progressLabel = stage.progress > 0 ? ` · ${stage.progress}% 익힘` : ''
  const a11yLabel = `${stage.label} — ${stage.subtitle}${progressLabel}`

  return (
    <Link
      href={stage.sessionHref}
      aria-current={isCurrent ? 'page' : undefined}
      aria-label={a11yLabel}
      className={`flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-[var(--r-sm)] px-0.5 py-1 transition-colors duration-[var(--dur-normal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-1 ${baseOpacity}`}
    >
      <span
        className={`relative inline-flex h-7 w-7 items-center justify-center rounded-full transition-transform duration-[var(--dur-normal)] ${
          isCurrent ? 'scale-110' : ''
        }`}
      >
        <ProgressRing
          size={28}
          radius={11}
          strokeWidth={1.75}
          progress={stage.progress}
          accent={stage.accent}
          isActive={isCurrent}
          isMeta={isMeta}
        />
        <span
          className="relative z-10 inline-flex h-4 w-4 items-center justify-center rounded-full"
          style={
            isCurrent
              ? { backgroundColor: stage.accent, color: '#FFFFFF' }
              : { backgroundColor: 'transparent', color: 'var(--t3)' }
          }
          aria-hidden="true"
        >
          <Icon width={9} height={9} strokeWidth={2.5} />
        </span>
      </span>
      {isCurrent && (
        <span className="font-display text-[8px] font-[700] leading-none tracking-tight text-[var(--t1)]">
          {stage.label}
        </span>
      )}
    </Link>
  )
}

// ── FlowNav main ─────────────────────────────────────────────────
export function FlowNav() {
  const pathname = usePathname() ?? '/'

  if (!shouldShowFlowNav(pathname)) {
    return null
  }

  const currentStage = getStageFromPathname(pathname)
  const isMeta = currentStage === null

  return (
    <nav
      aria-label="학습 흐름"
      className="sticky top-0 z-30 w-full border-b border-[var(--bd)] bg-[var(--bg)]/95 backdrop-blur"
    >
      {/* Desktop layout */}
      <div className="mx-auto hidden max-w-5xl items-stretch gap-1 px-4 py-2.5 md:flex">
        {STAGES.map((stage, idx) => (
          <StageButtonDesktop
            key={stage.key}
            stage={stage}
            isCurrent={stage.key === currentStage}
            isMeta={isMeta}
            isLast={idx === STAGES.length - 1}
          />
        ))}
      </div>

      {/* Mobile layout — 6 dots compact */}
      <div className="mx-auto flex max-w-5xl items-center gap-0.5 px-2 py-1.5 md:hidden">
        {STAGES.map((stage) => (
          <StageButtonMobile
            key={stage.key}
            stage={stage}
            isCurrent={stage.key === currentStage}
            isMeta={isMeta}
          />
        ))}
      </div>
    </nav>
  )
}
