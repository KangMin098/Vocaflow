// apps/web/src/components/wordvault/PageHeader.tsx
// 페이지 상단 — 제목 + 액션 버튼

'use client'

import { ArrowRight, Plus } from 'lucide-react'

export interface PageHeaderProps {
  /** 학습 모드 진입 */
  onStartStudy: () => void
  /** 단어 추가 */
  onAddWord?: () => void
}

export function PageHeader({ onStartStudy, onAddWord }: PageHeaderProps) {
  return (
    <div className="mb-s-5 flex flex-col gap-s-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="mb-s-1 font-display text-[28px] font-extrabold leading-[1.1] tracking-[-0.025em] text-t1">
          나의 영단어
        </h1>
        <p className="font-body text-sm font-medium text-t3">
          컴팩트 뷰 · 클릭하면 예문 펼침 · 키보드 단축키 지원
        </p>
      </div>

      <div className="flex gap-s-2">
        <button
          type="button"
          onClick={onAddWord}
          className="hover:border-bd-strong inline-flex items-center gap-s-2 rounded-md border border-bd bg-bg px-s-3 py-s-2 font-display text-[13px] font-semibold tracking-[-0.01em] text-t2 transition-all duration-fast hover:bg-bg2 hover:text-t1"
        >
          <Plus size={14} />
          <span>단어 추가</span>
        </button>

        <button
          type="button"
          onClick={onStartStudy}
          className="inline-flex items-center gap-s-2 rounded-md bg-p px-s-4 py-s-2 font-display text-[13px] font-bold tracking-[-0.01em] text-bg shadow-sm transition-all duration-fast hover:bg-p-hover hover:shadow-md"
        >
          <span>학습 시작</span>
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  )
}
