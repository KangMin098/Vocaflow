// apps/web/src/components/wordvault/HideToggleBar.tsx
// 표시 옵션 바 — Active Recall(영단어/뜻 숨김) + 전체 예문 펼침/접힘

'use client'

import { cn } from '@/lib/utils/cn'
import { ChevronsDownUp, ChevronsUpDown, Eye } from 'lucide-react'
import type { HideStates, HideType } from './types'

export interface HideToggleBarProps {
  /** 현재 숨김 상태 (영단어 / 뜻) */
  hideStates: HideStates
  /** 숨김 토글 콜백 */
  onToggle: (type: HideType) => void
  /** 모든 행 예문이 펼쳐졌는지 */
  allExpanded: boolean
  /** 전체 예문 펼치기/접기 토글 */
  onToggleAllExpanded: () => void
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

export function HideToggleBar({
  hideStates,
  onToggle,
  allExpanded,
  onToggleAllExpanded,
}: HideToggleBarProps) {
  return (
    <div className="py-s-2.5 mb-s-2 flex flex-col gap-s-3 rounded-lg border border-bd bg-bg2 px-s-4 sm:flex-row sm:items-center sm:justify-between">
      {/* ── 좌측 — Active Recall 그룹 ── */}
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
                    ? 'border-p bg-p text-bg'
                    : 'border-bd bg-bg text-t2 hover:bg-bg2 hover:text-t1'
                )}
                aria-pressed={isHidden}
              >
                <span>{cfg.label}</span>
                <kbd
                  className={cn(
                    'inline-flex items-center justify-center',
                    'h-[18px] min-w-[18px] rounded-[4px] px-s-1',
                    'font-mono text-[10px] font-bold',
                    isHidden ? 'bg-white/15 text-bg' : 'bg-bg2 text-t3'
                  )}
                >
                  {cfg.shortcut}
                </kbd>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── 우측 — 펼침 액션 ── */}
      <button
        type="button"
        onClick={onToggleAllExpanded}
        className={cn(
          'inline-flex items-center gap-s-2',
          'py-s-1.5 rounded-md border px-s-3',
          'font-display text-xs font-semibold tracking-[-0.01em]',
          'transition-all duration-fast',
          allExpanded
            ? 'border-bd-strong bg-bg text-t1 hover:bg-bg2'
            : 'border-bd bg-bg text-t2 hover:bg-bg2 hover:text-t1'
        )}
        aria-pressed={allExpanded}
        aria-label={allExpanded ? '전체 예문 접기' : '전체 예문 펼치기'}
      >
        {allExpanded ? <ChevronsDownUp size={13} /> : <ChevronsUpDown size={13} />}
        <span>{allExpanded ? '전체 예문 접기' : '전체 예문 펼치기'}</span>
        <kbd className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] bg-bg2 px-s-1 font-mono text-[10px] font-bold text-t3">
          E
        </kbd>
      </button>
    </div>
  )
}
