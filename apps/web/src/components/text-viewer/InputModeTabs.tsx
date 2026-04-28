// apps/web/src/components/text-viewer/InputModeTabs.tsx
// 입력 방식 탭 (텍스트 / 파일 / URL)

'use client'

import { cn } from '@/lib/utils/cn'
import { Link as LinkIcon, Type, Upload, type LucideIcon } from 'lucide-react'

export type InputMode = 'text' | 'file' | 'url'

export interface InputModeTabsProps {
  value: InputMode
  onChange: (mode: InputMode) => void
}

const tabs: Array<{
  value: InputMode
  label: string
  icon: LucideIcon
  description: string
}> = [
  {
    value: 'text',
    label: '텍스트',
    icon: Type,
    description: '직접 입력 또는 붙여넣기',
  },
  {
    value: 'file',
    label: '파일',
    icon: Upload,
    description: 'PDF · DOCX · TXT',
  },
  {
    value: 'url',
    label: 'URL',
    icon: LinkIcon,
    description: '웹 페이지 가져오기',
  },
]

export function InputModeTabs({ value, onChange }: InputModeTabsProps) {
  return (
    <div className="mb-s-4 grid grid-cols-3 gap-s-2">
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isActive = value === tab.value
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            className={cn(
              'group relative flex flex-col items-center gap-s-2',
              'rounded-lg border p-s-3',
              'transition-all duration-normal',
              'hover:scale-[1.02]',
              isActive ? 'border-bdf bg-p-light' : 'border-bd bg-bg hover:border-t2 hover:bg-bg2'
            )}
          >
            {/* 활성 표시 점 */}
            {isActive && (
              <span
                aria-hidden
                className="absolute right-s-2 top-s-2 h-1.5 w-1.5 rounded-full bg-p"
              />
            )}

            <div
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                'transition-colors duration-normal',
                isActive
                  ? 'bg-p text-ti shadow-sm'
                  : 'bg-bg3 text-t2 group-hover:bg-bg group-hover:text-t1'
              )}
            >
              <Icon size={16} />
            </div>

            <div className="text-center">
              <div
                className={cn(
                  'font-display text-sm font-semibold',
                  isActive ? 'text-t1' : 'text-t2'
                )}
              >
                {tab.label}
              </div>
              <div className="mt-[1px] font-mono text-[9px] uppercase tracking-wider text-t3">
                {tab.description}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
