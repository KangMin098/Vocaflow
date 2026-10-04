// apps/web/src/components/ui/PageIntro.tsx
//
// **기능형 화면 머리** — 학습자 화면의 두 머리 중 하나(2026-10-04).
//   ① 발견형(Landing)  = `ModuleHero` 의 솔루션형 가운데 히어로 — 복습카드 · SpellForge · PairFlip · 내 책장
//   ② 기능형(Functional) = 여기 — 대시보드 · 학습 계획 · 주간 리포트 · V-Level 기록 · 설정처럼 「일하는 화면」
//
// 관찰(참조 /webinars 목록 · /customers · /solutions 둘째 띠): 일하는 화면의 머리는 가운데 큰 히어로가 아니라
// **왼쪽 정렬 · 보라 세리프 제목 · 짧은 설명 · 오른쪽 작은 그림/행동 · 아래 가는 선**으로 내용과 갈린다.
// 해석: 화면마다 따로 짜던 눈썹 · 제목 크기 · 그림 자리 · 여백을 이 한 곳에서 정한다(화면별 스킨 덮어쓰기 금지).
// 모바일은 디자인 범위 밖이라 크기만 줄여 그대로 읽히게 둔다.

import type { ReactNode } from 'react'

export interface PageIntroProps {
  /** 모노 대문자 눈썹 — 구역 · 날짜처럼 제목 위의 맥락 한 줄 */
  kicker?: ReactNode
  title: ReactNode
  description?: ReactNode
  /** 제목 위 — 되돌아가는 링크처럼 이 화면의 유일한 앞길 */
  lead?: ReactNode
  /** 오른쪽 — 화면의 주 행동(새로고침 · 시작 등) */
  actions?: ReactNode
  /** 오른쪽 그림 — 장식(aria-hidden 은 그림 쪽 책임) */
  art?: ReactNode
  className?: string
  /** 낮은 변형 — 머리 바로 아래 큰 블록이 첫 화면 안에 있어야 하는 고르기 화면(예: /practice). 여백 · 제목을 줄인다. */
  compact?: boolean
}

export function PageIntro({ kicker, title, description, lead, actions, art, className = '', compact = false }: PageIntroProps) {
  return (
    <header className={`page-intro flex flex-col gap-6 border-b border-[var(--bd)] pb-8 md:flex-row md:items-end md:justify-between md:gap-10 ${compact ? 'md:pb-6' : 'md:pb-10'} ${className}`}>
      <div className="min-w-0 max-w-[46rem]">
        {lead}
        {kicker && (
          <p className={`${lead ? 'mt-4' : ''} font-mono text-[12px] font-[700] uppercase tracking-[0.08em] text-[var(--ju)]`}>{kicker}</p>
        )}
        <h1 className={`${compact ? 'mt-2' : 'mt-3'} break-keep font-serif text-[34px] font-[400] leading-[1.08] tracking-[-0.02em] text-[var(--ju)] ${compact ? 'md:text-[40px]' : 'md:text-[48px]'}`}>{title}</h1>
        {description && (
          <p className="mt-4 max-w-[60ch] break-keep font-body text-[15px] leading-[1.6] text-[var(--ju)] md:text-[16px]">{description}</p>
        )}
      </div>
      {(art || actions) && (
        <div className="flex shrink-0 items-end gap-6">
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
          {art && <div className="page-intro-art hidden w-[200px] md:block">{art}</div>}
        </div>
      )}
    </header>
  )
}
