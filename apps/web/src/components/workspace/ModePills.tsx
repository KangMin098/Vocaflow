// apps/web/src/components/workspace/ModePills.tsx

'use client'

import type { ModeKey, ModeStatus } from '@/types/library'
import Link from 'next/link'

interface Mode {
  key: ModeKey
  label: string
  group: 'input' | 'study' | 'practice'
}

const MODES: Mode[] = [
  { key: 'read', label: '읽기', group: 'input' },
  { key: 'listen', label: '듣기', group: 'input' },
  { key: 'words', label: '단어', group: 'study' },
  { key: 'flashcard', label: '카드', group: 'study' },
  { key: 'spellforge', label: '스펠', group: 'practice' },
  { key: 'wordblitz', label: '블리츠', group: 'practice' },
  { key: 'quiz', label: '퀴즈', group: 'practice' },
]

interface ModePillsProps {
  textId: string
  currentMode: ModeKey
  modeStatus: Record<ModeKey, ModeStatus>
  isFocusMode: boolean
}

export function ModePills({ textId, currentMode, modeStatus, isFocusMode }: ModePillsProps) {
  return (
    <nav
      aria-label="학습 도구 선택"
      className={`bg-[var(--reading-bg)]/92 sticky top-[60px] z-40 backdrop-blur-[16px] transition-all duration-[var(--dur-slower)] ${isFocusMode ? '-translate-y-1 opacity-40 hover:translate-y-0 hover:opacity-100' : 'opacity-100'} `}
    >
      <div className="mx-auto flex max-w-[1080px] items-center justify-center gap-1 px-8 py-2">
        {MODES.map((mode, idx) => {
          const isActive = currentMode === mode.key
          const status = modeStatus[mode.key]
          const showDivider = idx > 0 && MODES[idx - 1].group !== mode.group

          return (
            <span key={mode.key} className="inline-flex items-center">
              {showDivider && (
                <span className="mx-1 h-3.5 w-px bg-[var(--bd)]" aria-hidden="true" />
              )}
              <Link
                href={`/text/${textId}?mode=${mode.key}`}
                aria-current={isActive ? 'page' : undefined}
                className={`group inline-flex items-center gap-1.5 rounded-[var(--r-full)] px-2.5 py-1 font-display text-[12px] font-[600] transition-all duration-[var(--dur-normal)] ease-[var(--ease)] ${
                  isActive
                    ? 'bg-[var(--bg)] text-[var(--t1)] shadow-[var(--sh-sm)]'
                    : 'text-[var(--t3)] hover:bg-[var(--bg2)] hover:text-[var(--t1)]'
                } `}
              >
                {/* Dot */}
                <span
                  className={`h-2 w-2 rounded-full transition-all duration-[var(--dur-normal)] ${status === 'done' ? 'bg-[var(--success)]' : 'bg-[var(--t4)]'} ${isActive ? 'animate-[breathing_4s_ease-in-out_infinite] !bg-[var(--p)]' : ''} `}
                  aria-hidden="true"
                />
                <span
                  className={`overflow-hidden whitespace-nowrap transition-[max-width,margin] duration-[var(--dur-normal)] ease-[var(--ease)] ${isActive ? 'ml-0.5 max-w-[80px]' : 'max-w-0 group-hover:ml-0.5 group-hover:max-w-[80px]'} `}
                >
                  {mode.label}
                </span>
              </Link>
            </span>
          )
        })}
      </div>
    </nav>
  )
}
