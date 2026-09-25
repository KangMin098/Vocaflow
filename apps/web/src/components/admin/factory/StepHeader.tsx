// apps/web/src/components/admin/factory/StepHeader.tsx
//
// **단계 화면 머리띠 — 「지금 몇 번째 걸음이고, 무엇이 들어와 무엇이 나가는가」.**
//
// 모든 걸음 화면이 같은 모양으로 시작한다:
//   · 어디 있나    공장 지도 ← · 「걸음 4 / 8」
//   · 무엇을 하나  이름 + 항상 보이는 한 줄
//   · 흐름         들어오는 것 → 이 걸음 → 나가는 것
//   · 누가         자동 / Claude / 사람 · 사람이 정할 것
//   · 낱말         점선 밑줄 용어(올리면 설명)
//   · 예시         「예시 보기」 전/후
//   · 앞뒤         앞 걸음 · 다음 걸음
//
// ⚠️ 여덟 걸음 **전체 목록을 다시 그리지 않는다.** 2026-09-05 에 같은 8칸이 사이드바 · 레일 ·
//   현황판 세 곳에 그려져 「복잡하다」의 큰 몫이 됐고 레일을 걷어냈다(`admin/csat/layout.tsx`).
//   여기는 앞뒤 한 칸씩만 보여 준다 — 전체 순서는 사이드바와 지도가 말한다.

import { ArrowLeft, ArrowRight, Map as MapIcon } from 'lucide-react'
import Link from 'next/link'

import type { StageStatus } from '@/lib/csat/factory-model'
import { PLAIN_STEPS, neighbours, type PlainLab, type PlainStep } from '@/lib/csat/factory-plain'

import { ExampleToggle } from './ExampleToggle'
import { FactoryTerm } from './FactoryTerm'
import { WhoChip } from './WhoChip'
import { PlainStatusBadge } from './PlainStatusBadge'

const TOTAL = PLAIN_STEPS.filter((s) => s.no != null).length

const linkCls =
  'inline-flex min-h-[44px] items-center gap-1 rounded-[var(--r-sm)] px-1 font-display text-[12.5px] font-[700] text-[var(--admin)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin)]'

export function StepHeader({
  step,
  status,
  help,
}: {
  step: PlainStep
  status?: StageStatus | null
  /** 자세한 도움말 단추(`<AdminScreenHelp …/>`). */
  help?: React.ReactNode
}) {
  const { prev, next } = neighbours(step)
  return (
    <header className="flex flex-col gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <nav aria-label="공장 안 위치" className="flex flex-wrap items-center gap-x-2">
          <Link href="/admin/csat" className={linkCls}>
            <MapIcon size={14} strokeWidth={2} aria-hidden />
            공장 지도
          </Link>
          <span aria-hidden className="text-[var(--t3)]">›</span>
          <span className="font-display text-[12.5px] font-[700] text-[var(--t2)]">
            {step.no != null ? `걸음 ${step.no} / ${TOTAL}` : '낸 뒤 — 다음 주문으로 돌아가는 고리'}
          </span>
        </nav>
        {help}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="break-keep font-display text-[20px] font-[800] text-[var(--t1)]">{step.name}</h2>
          {status ? <PlainStatusBadge status={status} /> : null}
        </div>
        <p className="break-keep font-body text-[14px] leading-relaxed text-[var(--t1)]">{step.says}</p>
      </div>

      {/* 들어오는 것 → 이 걸음 → 나가는 것 */}
      {/* 화살표는 CSS 가상 요소로 그린다 — 칸마다 요소를 하나씩 더 두면 밀집도 예산을 화살표가 먹는다. */}
      <ol
        aria-label="이 걸음의 흐름"
        className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch sm:gap-7"
      >
        <li className="relative break-keep rounded-[var(--r-md)] bg-[var(--bg2)] px-3 py-2 font-body text-[13px] text-[var(--t1)] sm:after:absolute sm:after:-right-5 sm:after:top-1/2 sm:after:-translate-y-1/2 sm:after:text-[var(--t3)] sm:after:content-['→']">
          <b className="block font-display text-[11px] font-[700] text-[var(--t3)]">들어오는 것</b>
          {step.takes}
        </li>
        <li className="relative flex items-center justify-center rounded-[var(--r-md)] border border-[color-mix(in_srgb,var(--admin)_50%,transparent)] px-3 py-2 font-display text-[13px] font-[800] text-[var(--admin)] sm:after:absolute sm:after:-right-5 sm:after:top-1/2 sm:after:-translate-y-1/2 sm:after:font-[400] sm:after:text-[var(--t3)] sm:after:content-['→']">
          {step.name}
        </li>
        <li className="break-keep rounded-[var(--r-md)] bg-[var(--bg2)] px-3 py-2 font-body text-[13px] text-[var(--t1)]">
          <b className="block font-display text-[11px] font-[700] text-[var(--t3)]">나가는 것</b>
          {step.gives}
        </li>
      </ol>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <WhoChip who={step.who} />
        {step.decides ? (
          <span className="break-keep font-body text-[12px] text-[var(--t1)]">
            <strong className="font-display font-[700]">사람이 정할 것</strong> · {step.decides}
          </span>
        ) : null}
      </div>

      {step.terms.length ? (
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-body text-[12.5px] text-[var(--t2)]">
          <span className="font-display text-[11.5px] font-[700] text-[var(--t3)]">이 화면의 낱말</span>
          {step.terms.map((t) => (
            <FactoryTerm key={t} id={t} />
          ))}
          <Link href="/admin/csat/help" className={linkCls}>
            용어집 전체
          </Link>
        </p>
      ) : null}

      {step.example ? <ExampleToggle example={step.example} /> : null}

      <nav aria-label="앞뒤 걸음" className="flex flex-wrap justify-between gap-2 border-t border-[var(--bd)] pt-2">
        {prev ? (
          <Link href={prev.href} className={linkCls}>
            <ArrowLeft size={14} strokeWidth={2} aria-hidden />
            앞 걸음 · {prev.name}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link href={next.href} className={linkCls}>
            {step.no == null ? '처음으로 · ' : '다음 걸음 · '}
            {next.name}
            <ArrowRight size={14} strokeWidth={2} aria-hidden />
          </Link>
        ) : null}
      </nav>
    </header>
  )
}

/** 기준을 세우는 곳(연구 칸)의 머리띠 — 걸음 번호가 없고, 흐름 대신 「왜 옆줄인가」를 말한다. */
export function LabHeader({
  lab,
  status,
  help,
}: {
  lab: PlainLab
  status?: StageStatus | null
  help?: React.ReactNode
}) {
  return (
    <header className="flex flex-col gap-2.5 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <nav aria-label="공장 안 위치" className="flex flex-wrap items-center gap-x-2">
          <Link href="/admin/csat" className={linkCls}>
            <MapIcon size={14} strokeWidth={2} aria-hidden />
            공장 지도
          </Link>
          <span aria-hidden className="text-[var(--t3)]">›</span>
          <span className="font-display text-[12.5px] font-[700] text-[var(--t2)]">기준을 세우는 곳</span>
        </nav>
        {help}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="break-keep font-display text-[20px] font-[800] text-[var(--t1)]">{lab.name}</h2>
        {status ? <PlainStatusBadge status={status} /> : null}
      </div>
      <p className="break-keep font-body text-[14px] leading-relaxed text-[var(--t1)]">{lab.says}</p>
      <p className="break-keep font-body text-[12.5px] text-[var(--t2)]">
        글감이 거쳐 가는 걸음은 아니에요 — 여기가 멈춰도 여덟 걸음은 계속 돌아요.
      </p>
    </header>
  )
}
