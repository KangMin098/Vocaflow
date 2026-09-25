// apps/web/src/components/csat/home/CsatContinueLine.tsx
'use client'

//
// **Today(`/hub`)의 「기출 이어서」 한 줄** — 앱의 다른 곳에서 기출분석공간으로 들어오는 길이 0이었다
// (ia-design §3 「(구조) 들어오는 길 없음」). 멈춘 세트나 오늘 복습이 **있을 때만** 선다 —
// 할 것이 없는데 줄을 세우면 홍보가 된다. 누르면 멈춘 자리가 바로 열린다(시나리오 C7 = 1클릭).

import Link from 'next/link'
import { ArrowRight, History } from 'lucide-react'

import { track } from '@/lib/analytics/client'
import { activeSet, dueNow } from '@/lib/csat/continuity'

import { useCsatRecord } from './useCsatRecord'

export function CsatContinueLine() {
  const rec = useCsatRecord()
  if (!rec) return null
  const set = activeSet(rec.record)
  const due = dueNow(rec.record, rec.now).length
  if (!set && due === 0) return null
  const href = set ? '/csat/dissect?resume=1' : '/csat/dissect'
  return (
    <Link
      href={href}
      data-testid="today-csat-continue"
      onClick={() => track({ name: 'csat_resume_clicked', props: { kind: set ? 'set' : 'review', from: 'today' } })}
      className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[var(--bd)] bg-[var(--bg)] px-4 text-[14px] text-[var(--t1)] transition-colors duration-[var(--dur-quick)] hover:border-[var(--t2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]"
    >
      <History size={15} aria-hidden />
      <span className="break-keep">
        기출 이어서 · {set ? `세트 ${set.index + 1}/${set.total} · 약 ${set.minutes}분` : `복습 ${due}개`}
      </span>
      <ArrowRight size={14} aria-hidden />
    </Link>
  )
}
