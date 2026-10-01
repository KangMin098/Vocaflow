// apps/web/src/components/csat/diagnosis/HabitButtons.tsx
//
// 습관 신호에 「맞아요 / 아니에요」 — 습관은 추정이라 틀릴 수 있다. 응답은 판정 규칙을 고치는 데이터가 된다.

'use client'

import { useState } from 'react'

import { track } from '@/lib/analytics/client'

const btn =
  'inline-flex min-h-[44px] items-center rounded-[var(--r-md)] border px-4 font-display text-[13px] font-[700] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--p)] disabled:opacity-50'

export function HabitButtons({ snapshotId, habitCode, initial }: { snapshotId: string; habitCode: string; initial?: boolean }) {
  const [agreed, setAgreed] = useState<boolean | undefined>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  const answer = async (v: boolean) => {
    setBusy(true)
    setError(false)
    try {
      const res = await fetch('/api/csat/diagnosis/habit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ snapshotId, habitCode, agreed: v }),
      })
      if (!res.ok) throw new Error()
      setAgreed(v)
      track({ name: 'csat_dx_habit_answered', props: { agreed: v } })
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {[true, false].map((v) => (
        <button
          key={String(v)}
          type="button"
          disabled={busy}
          aria-pressed={agreed === v}
          onClick={() => answer(v)}
          className={`${btn} ${agreed === v ? 'border-[var(--p)] text-[var(--p)]' : 'border-[var(--bd)] text-[var(--t1)]'}`}
        >
          {v ? '맞아요' : '아니에요'}
        </button>
      ))}
      <span aria-live="polite" className="font-body text-[12px] text-[var(--t2)]">
        {error ? '저장하지 못했어요' : agreed !== undefined ? '답해 주셔서 고마워요' : ''}
      </span>
    </div>
  )
}
