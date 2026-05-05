// apps/web/src/components/textviewer/TextStatusBadge.tsx
//
// 스크립트 4단계 상태 배지 — CLAUDE.md §17.2 [2] 상태 축
// 미시작 / N% 진행중 / 정복(100%)
// (DB 연동 시 "단어 추출 완료" 4단계 분기 추가 — 현재는 progressPercent 만 사용)

import { Trophy } from 'lucide-react'
import type { LibraryText } from '@/types/library'

interface TextStatusBadgeProps {
  text: Pick<LibraryText, 'progressPercent'>
}

export function TextStatusBadge({ text }: TextStatusBadgeProps) {
  const pct = text.progressPercent
  const conquered = pct >= 100
  const inProgress = pct > 0 && pct < 100

  if (conquered) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-[var(--r-sm)] bg-[var(--success)]/10 px-2 py-0.5 font-display text-[10px] font-[700] uppercase tracking-wider text-[var(--success)]"
        aria-label="정복 완료"
      >
        <Trophy size={10} strokeWidth={2.5} aria-hidden="true" />
        정복
      </span>
    )
  }

  if (inProgress) {
    return (
      <span
        className="inline-flex items-center rounded-[var(--r-sm)] bg-[var(--p)]/10 px-2 py-0.5 font-display text-[10px] font-[700] tabular-nums text-[var(--p)]"
        aria-label={`진행률 ${pct}%`}
      >
        {pct}%
      </span>
    )
  }

  return (
    <span
      className="inline-flex items-center rounded-[var(--r-sm)] bg-[var(--bg3)] px-2 py-0.5 font-display text-[10px] font-[700] uppercase tracking-wider text-[var(--t3)]"
      aria-label="미시작"
    >
      미시작
    </span>
  )
}
