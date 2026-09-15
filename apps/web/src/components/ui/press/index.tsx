// apps/web/src/components/ui/press/index.tsx
//
// 「주묵 판면」 프리미티브 — v07 디자인 방향의 어휘.
//
// ── 왜 새 키트인가 (실측 2026-09-16) ────────────────────────────────────────
// 기존 `components/ui/Card.tsx` 는 shadcn 형태 그대로였고(`rounded-lg`+`border`+`shadow-md`+
// Header/Title/Description/Content/Footer), **학습자 표면 447파일 중 5개만** 그것을 쓰고 있었다.
// 나머지 442개는 각자 `border-[var(--bd)] rounded-[...] bg-[var(--bg)]` 세 클래스를 손으로
// 다시 적었다 — `border-[var(--bd)]` 681회 · `rounded-[var(--r-md)]` 484회.
//
// 즉 **공유 시스템이 있어서 똑같았던 게 아니라, 없어서 각자 같은 기본값으로 수렴한 것**이다.
// 그래서 "더 예쁜 카드" 를 만드는 대신, 카드가 아닌 **지면의 어휘**를 만든다:
//   괘선(Rule) · 판면(Panel) · 표식(JuMark) · 붓 자국(Wash) · 망각 밑줄(DecayUnderline).
//
// ── 규칙 ───────────────────────────────────────────────────────────────────
// · 주묵(`--ju`)은 **앱이 지면에 남기는 표식**이다. 학습자의 오답을 칠하는 데 쓰지 않는다
//   (CLAUDE.md 「정답률 빨간 글씨 압박 금지」· 철학 3). 회귀가 잡는다.
// · 모션은 `--dur-fast`/`--dur-normal` 안에서 `transform`·`opacity` 만.
// · 터치 타깃 44px 하한. 4상태(hover/active/focus/disabled) 전부.

import type { ReactNode } from 'react'

import { cn } from '@/lib/utils/cn'

// ══════════════════════════════════════════════════════════════
// Rule — 섹션 괘선
//   지면에서 구획을 만드는 것은 상자가 아니라 선이다. 번호가 있으면 순서가 생긴다.
// ══════════════════════════════════════════════════════════════
export function Rule({
  n,
  label,
  right,
  className,
  tone = 'ink',
}: {
  /** 섹션 번호 — `01` `02` … 없으면 라벨만 그린다 */
  n?: string
  label?: ReactNode
  /** 오른쪽 끝에 붙는 보조 정보(개수·시각 등) */
  right?: ReactNode
  className?: string
  /** `ju` 는 그 절이 지금 주목해야 할 곳일 때만 — 한 화면에 하나 */
  tone?: 'ink' | 'ju'
}) {
  const accent = tone === 'ju' ? 'text-[var(--ju-ink)]' : 'text-[var(--t3)]'
  return (
    <div
      className={cn(
        'flex items-baseline gap-2 border-b border-[var(--bd)] pb-1.5',
        className,
      )}
    >
      {n && (
        <span className={cn('font-english text-[11px] tracking-[0.08em]', accent)}>{n}</span>
      )}
      {label && (
        <span className={cn('font-display text-[11.5px] tracking-[0.04em]', accent)}>{label}</span>
      )}
      {right && <span className="ml-auto font-mono text-[11px] text-[var(--t3)]">{right}</span>}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// Panel — 판면
//   카드가 아니다. 뜨지 않고 그어진다(그림자 토큰이 이미 헤어라인 링이다).
// ══════════════════════════════════════════════════════════════
export function Panel({
  children,
  className,
  as: As = 'section',
  tone = 'paper',
  pad = 'md',
}: {
  children: ReactNode
  className?: string
  as?: 'section' | 'div' | 'article' | 'li'
  /** `paper` 종이면 · `canvas` 캔버스와 같은 톤(경계만) · `ju` 주목 구획 */
  tone?: 'paper' | 'canvas' | 'ju'
  pad?: 'none' | 'sm' | 'md' | 'lg'
}) {
  const TONE = {
    paper: 'bg-[var(--bg)] border-[var(--bd)]',
    canvas: 'bg-transparent border-[var(--bd)]',
    ju: 'bg-[var(--ju-light)] border-[var(--ju)]',
  }[tone]
  const PAD = { none: '', sm: 'p-3', md: 'px-5 py-4', lg: 'px-6 py-5' }[pad]
  return <As className={cn('rounded-[var(--r-md)] border', TONE, PAD, className)}>{children}</As>
}

// ══════════════════════════════════════════════════════════════
// Wash — 붓 자국
//   숫자·낱말 뒤에 스치듯 남는 주묵. **강조는 색이 아니라 자국이다.**
//   `aria-hidden` 인 장식이므로 정보를 담지 않는다(색 단독 정보전달 금지).
// ══════════════════════════════════════════════════════════════
export function Wash({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('relative inline-block', className)}>
      <span
        aria-hidden
        className="absolute inset-x-[-3px] bottom-[2px] h-[46%] -skew-x-[9deg] bg-[var(--ju-wash)]"
      />
      <span className="relative">{children}</span>
    </span>
  )
}

// ══════════════════════════════════════════════════════════════
// JuMark — 표식
//   `dot` 권점(圈點, 눈여겨볼 것) · `check` 마친 것 · `now` 지금 할 것.
//   ⚠️ 셋 다 **앱이 남기는 표식**이다. 오답 표시에 쓰지 않는다.
// ══════════════════════════════════════════════════════════════
export function JuMark({
  kind,
  label,
  className,
}: {
  kind: 'dot' | 'check' | 'now'
  /** 스크린리더용 — 표식은 모양만으로 뜻이 전달되지 않는다 */
  label: string
  className?: string
}) {
  if (kind === 'now') {
    return (
      <span
        className={cn(
          'rounded-[var(--r-sm)] border border-[var(--ju)] px-1.5 py-[2px]',
          'font-display text-[10.5px] font-[600] text-[var(--ju-ink)]',
          className,
        )}
      >
        {label}
      </span>
    )
  }
  if (kind === 'check') {
    return (
      <span
        role="img"
        aria-label={label}
        className={cn(
          'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[var(--r-sm)]',
          'bg-[var(--ju)] font-display text-[10px] leading-none text-[var(--on-ju)]',
          className,
        )}
      >
        ✓
      </span>
    )
  }
  return (
    <span
      role="img"
      aria-label={label}
      className={cn(
        'inline-block h-[9px] w-[9px] shrink-0 rounded-full border-2 border-[var(--ju)]',
        className,
      )}
    />
  )
}

// ══════════════════════════════════════════════════════════════
// DecayUnderline — 망각 밑줄
//
//   이 키트에서 **유일하게 데이터가 직접 그리는 형태**다. 밑줄 두께가 R(t)를 말한다:
//     risk 3px · shaky 2px · stable 1px · new 점선
//   경쟁사가 폰트와 색을 베껴도 이 선은 못 베낀다 — `lib/srs/fsrs.ts` 가 있어야 그어진다.
//
//   ⚠️ **두께가 있어야 색맹 대응이 된다.** 색만으로 상태를 말하면 접근성 하한선 위반이다
//      (CLAUDE.md 「색상만으로 정보 전달 금지」). 그래서 색과 두께를 항상 같이 쓴다.
// ══════════════════════════════════════════════════════════════
export type MemoryState = 'stable' | 'shaky' | 'risk' | 'new'

const DECAY: Record<MemoryState, { px: number; style: string; color: string; ko: string }> = {
  risk: { px: 3, style: 'solid', color: 'var(--memory-risk)', ko: '흐릿해요' },
  shaky: { px: 2, style: 'solid', color: 'var(--memory-shaky)', ko: '익숙해요' },
  stable: { px: 1, style: 'solid', color: 'var(--memory-stable)', ko: '알아요' },
  new: { px: 2, style: 'dotted', color: 'var(--memory-new)', ko: '처음 만나요' },
}

/**
 * 밀린 일수 → 밑줄 띠.
 *
 * ⚠️ **R(t) 자체가 아니다.** 어떤 표면은 FSRS 상태를 들고 오지 않고 `overdueDays` 만 갖는다
 *    (`lib/learner/reading-room-actions.ts` 의 `ReadingRoomWord`). 그 화면에서 상태를 지어내지
 *    않으려고, **실제로 가진 값**(며칠 밀렸나)을 그대로 두께로 옮긴다. FSRS 상태를 가진
 *    표면은 `state` 를 직접 넘긴다 — 그쪽이 정본이다.
 *
 * 경계값 근거: 복습 간격이 하루 단위로 시작하므로 3일이면 한 번의 간격을 통째로 놓친 것이고,
 * 7일이면 주 단위 간격도 지난 것이다. 데이터가 쌓이면 실측으로 다시 잡는다.
 */
export function bandFromOverdue(overdueDays: number): MemoryState {
  if (overdueDays >= 7) return 'risk'
  if (overdueDays >= 3) return 'shaky'
  if (overdueDays >= 1) return 'stable'
  return 'new'
}

export function DecayUnderline({
  state,
  children,
  className,
}: {
  state: MemoryState
  children: ReactNode
  className?: string
}) {
  const d = DECAY[state]
  return (
    <span
      className={cn('whitespace-nowrap', className)}
      style={{
        borderBottom: `${d.px}px ${d.style} ${d.color}`,
        paddingBottom: 1,
      }}
      title={d.ko}
    >
      {children}
      <span className="sr-only"> — {d.ko}</span>
    </span>
  )
}

// ══════════════════════════════════════════════════════════════
// PressButton — 1차/2차/3차
//   1차는 주묵 채움(화면에 하나). 2차는 잉크 외곽. 3차는 글자만.
// ══════════════════════════════════════════════════════════════
export function PressButton({
  children,
  trailing,
  variant = 'primary',
  full,
  className,
  ...rest
}: {
  children: ReactNode
  /** 오른쪽 끝 보조 표기(개수·화살표) */
  trailing?: ReactNode
  variant?: 'primary' | 'secondary' | 'quiet'
  full?: boolean
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const VARIANT = {
    primary: [
      'bg-[var(--ju)] text-[var(--on-ju)] border border-[var(--ju)]',
      'hover:bg-[var(--ju-ink)] hover:border-[var(--ju-ink)]',
      'active:translate-y-[1px]',
    ].join(' '),
    secondary: [
      'bg-transparent text-[var(--t1)] border border-[var(--t1)]',
      'hover:bg-[var(--bg3)]',
      'active:translate-y-[1px]',
    ].join(' '),
    quiet: [
      'bg-transparent text-[var(--t2)] border border-transparent',
      'hover:text-[var(--t1)] hover:border-[var(--bd)]',
    ].join(' '),
  }[variant]

  return (
    <button
      {...rest}
      className={cn(
        'inline-flex min-h-[48px] items-center justify-between gap-3 rounded-[var(--r-md)] px-4',
        'font-display text-[15px] font-[600] tracking-[0.01em]',
        'transition-[background-color,border-color,color,transform] duration-[var(--dur-fast)] ease-[var(--ease)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ju)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]',
        'disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0',
        full && 'w-full',
        VARIANT,
        className,
      )}
    >
      <span>{children}</span>
      {trailing && <span className="font-english text-[13px] opacity-80">{trailing}</span>}
    </button>
  )
}

// ══════════════════════════════════════════════════════════════
// Eyebrow — 작은 라벨
//   ⚠️ 이전 `.hub-eyebrow` 는 **대문자 + 넓은 트래킹**이었다(템플릿 관용구이자, 한국어에는
//      대문자가 없어서 한글 라벨에서는 트래킹만 남아 읽기가 나빠진다). 소문자·좁은 트래킹으로 내린다.
// ══════════════════════════════════════════════════════════════
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('font-display text-[11px] tracking-[0.04em] text-[var(--t3)]', className)}>
      {children}
    </span>
  )
}
