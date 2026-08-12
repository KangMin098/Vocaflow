// apps/web/src/components/layout/FlowNav.tsx
//
// FlowNav — 전역 상단 내비 + 모멘텀 배지
// CLAUDE.md §17.10 IA 원칙 + §"디자인 철학·학습 과학 원칙"
//
// 구성:
//   1) 모멘텀 배지 (좌측) — 연속일·어휘 4색·이번 주 실적. **실데이터**(서버 layout 주입)
//   2) 6단계 내비 — 이동 전용. 모바일에서는 **유일한 전역 내비**다(사이드바 `hidden md:flex`)
//   3) 툴팁 — 각 단계가 무엇을 하는 곳인지
//
// v08.5 — mock 제거. 이전에는 하드코딩 진척(%)·실적 문구·추천 글로우·여정 메리디안이 있었고,
// `RECOMMENDED_KEY`/`JOURNEY_PERCENT` 가 상수 배열에서 **모듈 로드 시점에** 계산돼
// **전 학습자가 항상 "Practice 추천 · 거의 다 왔어요 13%만 더!"** 를 봤다.
// 추천 정본은 Today(`prescribe_today`), 진척 정본은 Growth(대시보드)다 — 자세한 근거는
// STAGES 위 주석. 남은 학습 과학 적용은 Emotional Encoding(streak flame)과 Calm UI(무깜빡임)다.

'use client'

import {
  BookMarked,
  BookOpen,
  Compass,
  Flame,
  Mic,
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
  accent: string
  /** 툴팁 — 이 단계에서 무엇을 하는지 */
  tip: string
}

// ── 단계 — **내비게이션 전용** ──────────────────────────────────────
//
// v08.5 에서 `progress`·`stat` 을 제거했다. 이유 셋:
//
//   ① 값이 하드코딩이었고 `RECOMMENDED_KEY`·`JOURNEY_PERCENT` 가 **모듈 로드 시점에**
//      상수 배열에서 계산됐다 → **모든 학습자가 항상 Practice 를 추천받고
//      "거의 다 왔어요 — 13%만 더!" 를 봤다.** 3주가 아니라 처음부터 그랬다.
//   ② 프레임워크 Phase 0 이 처방 정본을 `prescribe_today` 하나로 정했다.
//      실데이터로 채워도 **경쟁하는 추천 표면이 둘**이 되어 그 결정이 무너진다.
//   ③ FlowNav 는 셸이라 모든 페이지에 렌더된다. 6단계 진척을 실시간 산출하면
//      페이지마다 쿼리가 붙는다. 게다가 Phase 3 에서 이 컴포넌트 자체가
//      하단 탭 4개로 재편될 예정이라 지금 붙이는 실데이터는 곧 버릴 것이다.
//
// 진짜 진척은 Growth(대시보드)와 Today(처방)가 실데이터로 보여준다.
// 여기 남은 것은 **이동**뿐이다 — 모바일에서는 이것이 유일한 전역 내비다
// (사이드바가 `hidden md:flex`).
//
// `momentum`(streak·mastery·weekDays)은 mock 이 아니다 — 서버 layout 이 주입하는 실데이터다.
const STAGES: StageConfig[] = [
  {
    key: 'discover',
    Icon: Compass,
    label: 'Library',
    subtitle: '발견',
    sessionHref: '/library',
    accent: '#A855F7',
    tip: '큐레이션된 원서를 골라 학습을 시작해요.',
  },
  {
    key: 'source',
    Icon: BookOpen,
    label: 'Scripts',
    subtitle: '읽고 듣기',
    sessionHref: '/text',
    accent: '#8B5CF6',
    tip: '원서를 읽고 들으며 맥락 속에서 단어를 만나요.',
  },
  {
    key: 'words',
    Icon: BookMarked,
    label: 'Words',
    subtitle: '학습 모드',
    sessionHref: '/wordvault?view=study',
    accent: '#6366F1',
    tip: '추출한 단어를 4색 기억 상태로 관리해요.',
  },
  {
    key: 'practice',
    Icon: Target,
    label: 'Practice',
    subtitle: '카드·게임',
    sessionHref: '/flashcard/play',
    accent: '#EC4899',
    tip: '플래시카드·게임으로 능동 회상을 훈련해요.',
  },
  {
    key: 'conquer',
    Icon: Trophy,
    label: 'Conquer',
    subtitle: '독해 퀴즈',
    sessionHref: '/scriptquiz/play',
    accent: '#F59E0B',
    tip: '스크립트 퀴즈로 텍스트 전체를 정복해요.',
  },
  {
    key: 'complete',
    Icon: Mic,
    label: 'Complete',
    subtitle: '받아쓰기',
    sessionHref: '/dictate/setup',
    accent: '#06B6D4',
    tip: '받아쓰기로 듣고 쓰며 학습을 완성해요.',
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

// JOURNEY_PERCENT · RECOMMENDED_KEY 는 제거했다(v08.5).
// 둘 다 하드코딩 상수 배열에서 **모듈 로드 시점에** 계산돼 전 학습자에게 동일했다.
// 추천은 Today(prescribe_today)가 정본이고, 진척은 Growth(대시보드)가 실데이터로 보여준다.

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
/**
 * 단계 아이콘을 감싸는 테두리 링.
 *
 * v08.5 까지는 `ProgressRing` 이었고 하드코딩 진척(%)만큼 액센트 호를 그렸다.
 * 그 값이 전 학습자에게 동일했으므로 호를 지우고 **테두리만** 남겼다 —
 * 아이콘의 시각적 그릇 역할은 그대로이고, 거짓 정보만 사라진다.
 */
function StageRing({
  size,
  radius,
  strokeWidth,
  isMeta,
}: {
  size: number
  radius: number
  strokeWidth: number
  isMeta: boolean
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="absolute inset-0"
      aria-hidden="true"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="var(--bd)"
        strokeWidth={strokeWidth}
        fill="none"
        opacity={isMeta ? 0.35 : 0.55}
      />
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
        aria-label={`전체 실적 — 연속 ${momentum.streak}일 · 대시보드 열기`}
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

          {/* 이번 주 실적 — 실데이터(daily_activity). 여정 % 배지는 v08.5 에서 제거했다. */}
          <div className="flex items-center justify-between border-t border-[var(--bd)] pt-2">
            <span className="font-body text-[11px] text-[var(--t2)]">
              이번 주{' '}
              <strong className="font-display font-[700] text-[var(--t1)]">{momentum.weekDays}일</strong>
              {' 학습'}
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
  align,
}: {
  stage: StageConfig
  isCurrent: boolean
  isMeta: boolean
  align: 'left' | 'center' | 'right'
}) {
  const Icon = stage.Icon
  const baseOpacity = isMeta && !isCurrent ? 'opacity-60' : ''
  const a11y = `${stage.label} — ${stage.subtitle}`

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
          <StageRing size={32} radius={13} strokeWidth={2} isMeta={isMeta} />
          <span
            className="relative z-10 inline-flex h-5 w-5 items-center justify-center rounded-full transition-colors duration-[var(--dur-normal)]"
            style={
              isCurrent
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
          <span
            className={`font-mono text-[9px] uppercase tracking-wider ${
              isCurrent ? 'text-[var(--t2)]' : 'text-[var(--t2)] opacity-60'
            }`}
          >
            {stage.subtitle}
          </span>
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
          </div>

          <div className="flex flex-col gap-2 px-3.5 pb-3 pt-2">
            <p className="font-body text-[11.5px] leading-relaxed text-[var(--t2)]">{stage.tip}</p>
            <span className="mt-0.5 font-body text-[10px] italic text-[var(--t2)]">
              클릭하면 바로 시작해요
            </span>
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
}: {
  stage: StageConfig
  isCurrent: boolean
  isMeta: boolean
}) {
  const Icon = stage.Icon
  const baseOpacity = isMeta && !isCurrent ? 'opacity-60' : ''
  const a11y = `${stage.label} — ${stage.subtitle}`
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
        <StageRing size={28} radius={11} strokeWidth={1.75} isMeta={isMeta} />
        <span
          className="relative z-10 inline-flex h-4 w-4 items-center justify-center rounded-full"
          style={
            isCurrent
              ? { backgroundColor: stage.accent, color: '#FFFFFF' }
              : { backgroundColor: 'transparent', color: 'var(--t3)' }
          }
          aria-hidden
        >
          <Icon width={9} height={9} strokeWidth={2.5} />
        </span>
      </span>
      {/* 라벨은 현재 단계에만 — 모바일 폭에서 6개를 다 쓰면 글자가 뭉갠다.
          이전에는 "추천" 단계에도 붙었지만 그 추천이 전 학습자 동일 상수였다. */}
      {isCurrent && (
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
              align={idx === 0 ? 'left' : idx === last ? 'right' : 'center'}
            />
            {idx < last && <Connector />}
          </span>
        ))}
        
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
          />
        ))}
      </div>
      {/* flowRecPulse keyframes 도 함께 제거했다 — 추천 글로우가 유일한 사용처였다. */}
    </nav>
  )
}
