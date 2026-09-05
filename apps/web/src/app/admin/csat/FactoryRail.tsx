// apps/web/src/app/admin/csat/FactoryRail.tsx
//
// 공정 레일 — 두 레인을 가로로 편다. 현재 경로에 해당하는 칸이 켜진다.
//
// 아직 화면이 없는 공정(`href === null`)은 **링크가 아니라 글자**로 둔다. 죽은 링크를 걸면
// 관리자가 눌러 보고 "고장" 이라고 판단한다 — 없는 것은 없다고 보이는 편이 낫다.

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import type { StageDef } from '@/lib/csat/factory-model'

const LANE_KO = {
  lab: { label: '전략 연구소', hint: '무엇을 만들지 정한다' },
  line: { label: '생산 라인', hint: '정한 대로 찍는다' },
} as const

function Lane({ label, hint, stages, active }: { label: string; hint: string; stages: StageDef[]; active: string }) {
  return (
    <div className="min-w-0 flex-1">
      <h2 className="mb-1.5 flex items-baseline gap-2">
        <span className="font-display text-[10px] font-[700] uppercase tracking-[0.10em] text-[#8B5CF6]">
          {label}
        </span>
        <span className="font-body text-[11px] text-[var(--t3)]">{hint}</span>
      </h2>
      <ol className="flex flex-wrap gap-1.5">
        {stages.map((s) => {
          const on = s.href != null && (active === s.href || active.startsWith(s.href + '/'))
          const body = (
            <>
              <span className="font-mono text-[10px] text-[var(--t3)]">{s.ord}</span>
              <span className="truncate">{s.name}</span>
            </>
          )
          const base =
            'flex min-h-[44px] items-center gap-1.5 rounded-[var(--r-md)] border px-2.5 font-display text-[13px] transition-colors duration-[var(--dur-normal)] ease-[var(--ease)]'
          return (
            <li key={s.id}>
              {s.href ? (
                <Link
                  href={s.href}
                  aria-current={on ? 'page' : undefined}
                  title={s.question}
                  className={`${base} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8B5CF6] ${
                    on
                      ? 'border-[#8B5CF6] bg-[#8B5CF6]/10 font-[600] text-[var(--t1)]'
                      : 'border-[var(--bd)] text-[var(--t2)] hover:bg-[var(--bg2)] active:bg-[var(--bd)]'
                  }`}
                >
                  {body}
                </Link>
              ) : (
                <span
                  title={`${s.question} — 전용 화면은 아직 없다. 현황판 카드에서 본다.`}
                  className={`${base} border-dashed border-[var(--bd)] text-[var(--t3)]`}
                >
                  {body}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export function FactoryRail({ lab, line }: { lab: StageDef[]; line: StageDef[] }) {
  const pathname = usePathname() ?? ''
  return (
    <nav
      aria-label="교재 공정"
      className="flex flex-col gap-4 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-3 lg:flex-row lg:gap-6"
    >
      <Lane {...LANE_KO.lab} stages={lab} active={pathname} />
      <div className="hidden w-px shrink-0 bg-[var(--bd)] lg:block" aria-hidden />
      <Lane {...LANE_KO.line} stages={line} active={pathname} />
    </nav>
  )
}
