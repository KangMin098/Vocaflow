// apps/web/src/components/layout/DashboardHeader.tsx
// Vocaflow 대시보드 헤더 — Dashboard_Web.html 기반
// 기간 탭 + 우측 액션 (테마, 메뉴)

'use client'

import { ButtonGroup } from '@/components/ui/ButtonGroup'
import { Download, Menu } from 'lucide-react'

export type Period = '7' | '30' | '90' | 'all'

export interface DashboardHeaderProps {
  /** 페이지 제목 */
  title?: string
  /** 부제 */
  subtitle?: string
  /** 현재 선택된 기간 */
  period?: Period
  /** 기간 변경 콜백 */
  onPeriodChange?: (period: Period) => void
  /** 모바일 햄버거 클릭 */
  onMenuClick?: () => void
  /** 테마 토글 */
  onThemeToggle?: () => void
  /** 현재 테마 */
  theme?: 'light' | 'dark'
  /** 내보내기 클릭 */
  onExport?: () => void
}

export function DashboardHeader({
  title = '학습 Dashboard',
  subtitle = '마지막 업데이트 · 방금 전',
  period = '30',
  onPeriodChange,
  onMenuClick,
  onThemeToggle,
  theme = 'light',
  onExport,
}: DashboardHeaderProps) {
  return (
    <header className="flex h-[60px] flex-shrink-0 items-center gap-s-4 border-b border-bd bg-bg px-s-4 lg:px-s-6">
      {/* ── 모바일 햄버거 ── */}
      <button
        onClick={onMenuClick}
        aria-label="사이드바 열기"
        className="flex h-9 w-9 items-center justify-center rounded-md text-t1 transition-colors duration-normal hover:bg-bg2 lg:hidden"
      >
        <Menu size={18} />
      </button>

      {/* ── 제목 영역 ── */}
      <div className="flex min-w-0 flex-col">
        <h1 className="truncate font-display text-base font-bold leading-tight tracking-tight text-t1 sm:text-lg">
          {title}
        </h1>
        <p className="truncate font-mono text-[10px] uppercase tracking-wider text-t3">
          {subtitle}
        </p>
      </div>

      {/* ── 가운데 spacer ── */}
      <div className="flex-1" />

      {/* ── 기간 탭 (데스크톱) ── */}
      {onPeriodChange && (
        <div className="hidden md:block">
          <ButtonGroup
            size="sm"
            value={period}
            onChange={(v) => onPeriodChange(v as Period)}
            options={[
              { value: '7', label: '7일' },
              { value: '30', label: '30일' },
              { value: '90', label: '3개월' },
              { value: 'all', label: '전체' },
            ]}
            ariaLabel="조회 기간"
          />
        </div>
      )}

      {/* ── 우측 액션 ── */}
      <div className="flex items-center gap-s-1">
        {onExport && (
          <button
            onClick={onExport}
            aria-label="데이터 내보내기"
            className="flex h-9 w-9 items-center justify-center rounded-md text-t2 transition-colors duration-normal hover:bg-bg2 hover:text-t1"
          >
            <Download size={16} />
          </button>
        )}
        {onThemeToggle && (
          <button
            onClick={onThemeToggle}
            aria-label="테마 전환"
            className="flex h-9 w-9 items-center justify-center rounded-md text-t2 transition-colors duration-normal hover:bg-bg2 hover:text-t1"
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        )}
      </div>
    </header>
  )
}
