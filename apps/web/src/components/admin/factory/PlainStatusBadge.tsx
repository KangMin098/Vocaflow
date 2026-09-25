// apps/web/src/components/admin/factory/PlainStatusBadge.tsx
//
// **걸음 상태 — 색 + 모양 + 글자.** 색만으로 뜻을 전하지 않는다(색각 이상 · 흑백 인쇄).
//
// 글자 색은 **테마를 따라 바뀌는 토큰**이다(`--success-ink` 등). 공정 정본(`STATUS_KO`)의 고정 hex 를
// 그대로 쓰면 다크에서 초록 글자가 짙은 바탕에 묻혀 「순조로움」이 안 읽혔다(실측 2026-09-24 스크린샷).
// 색의 계열(초록 · 황토 · 빨강 · 회색)은 정본과 같다.

import { CircleCheck, CircleHelp, Layers, OctagonX } from 'lucide-react'

import type { StageStatus } from '@/lib/csat/factory-model'
import { PLAIN_STATUS, type PlainTone } from '@/lib/csat/factory-plain'

const ICON = { ok: CircleCheck, piling: Layers, stopped: OctagonX, unknown: CircleHelp } as const

const TONE: Record<PlainTone, { ink: string; wash: string }> = {
  ok: { ink: 'var(--success-ink)', wash: 'color-mix(in srgb, var(--success) 16%, transparent)' },
  piling: { ink: 'var(--ios-orange-ink)', wash: 'color-mix(in srgb, var(--ios-orange) 16%, transparent)' },
  stopped: { ink: 'var(--error-ink)', wash: 'color-mix(in srgb, var(--error) 16%, transparent)' },
  unknown: { ink: 'var(--t2)', wash: 'color-mix(in srgb, var(--t3) 14%, transparent)' },
}

export function PlainStatusBadge({ status, size = 'md' }: { status: StageStatus; size?: 'sm' | 'md' }) {
  const p = PLAIN_STATUS[status]
  const tone = TONE[p.tone]
  const Icon = ICON[p.tone]
  return (
    <span
      className={`inline-flex w-fit shrink-0 items-center gap-1 rounded-[var(--r-full)] font-display font-[700] ${
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-[12px]'
      }`}
      style={{ background: tone.wash, color: tone.ink }}
    >
      <Icon size={size === 'sm' ? 12 : 14} strokeWidth={2.2} aria-hidden />
      {p.label}
    </span>
  )
}
