// apps/web/src/components/wordvault/HideToggleBar.tsx
// 표시 옵션 바 v2 (v06.21.5) — Active Recall(영단어/뜻 숨김) 만 유지
//
// 변경 (v06.21.5):
//   - "전체 예문 펼치기/접기" 버튼 제거 — 예문은 항상 행 우측에 인라인 노출 (펼침 X)
//   - allExpanded · onToggleAllExpanded prop 제거

'use client'

import { cn } from '@/lib/utils/cn'
import { Eye } from 'lucide-react'
import type { HideStates, HideType } from './types'

export interface HideToggleBarProps {
  hideStates: HideStates
  onToggle: (type: HideType) => void
}

interface ToggleConfig {
  type: HideType
  label: string
  shortcut: string
}

const HIDE_TOGGLES: ToggleConfig[] = [
  { type: 'word', label: '영단어 숨김', shortcut: 'H' },
  { type: 'meaning', label: '뜻 숨김', shortcut: 'M' },
]

export function HideToggleBar({ hideStates, onToggle }: HideToggleBarProps) {
  return (
    <div className="py-s-2.5 mb-s-2 flex flex-col gap-s-3 rounded-lg border border-bd bg-bg2 px-s-4 sm:flex-row sm:items-center sm:justify-between">
      {/* ── Active Recall 그룹 ── */}
      <div className="flex flex-wrap items-center gap-s-3">
        <div className="flex items-center gap-s-2">
          <Eye size={13} className="text-t3" />
          <span className="font-display text-xs font-semibold tracking-[-0.01em] text-t3">
            Active Recall
          </span>
        </div>

        <div className="flex flex-wrap gap-s-2">
          {HIDE_TOGGLES.map((cfg) => {
            const isHidden = hideStates[cfg.type]
            return (
              <button
                key={cfg.type}
                type="button"
                onClick={() => onToggle(cfg.type)}
                className={cn(
                  'inline-flex items-center gap-s-2',
                  'py-s-1.5 rounded-md border px-s-3',
                  'font-display text-xs font-semibold tracking-[-0.01em]',
                  'transition-all duration-fast',
                  isHidden
                    ? 'border-p bg-p-light text-p shadow-sm'
                    : 'border-bd bg-bg text-t2 hover:bg-bg2 hover:text-t1'
                )}
                aria-pressed={isHidden}
                aria-label={`${cfg.label} ${isHidden ? '해제' : '활성화'}`}
              >
                <span>{cfg.label}</span>
                <kbd
                  className={cn(
                    'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] px-s-1',
                    'font-mono text-[10px] font-bold',
                    isHidden ? 'bg-p text-bg' : 'bg-bg2 text-t3'
                  )}
                >
                  {cfg.shortcut}
                </kbd>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
