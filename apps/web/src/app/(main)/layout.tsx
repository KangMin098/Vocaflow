// apps/web/src/app/main/layout.tsx
'use client'

import Sidebar from '@/components/layout/Sidebar'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'

// ─────────────────────────────────────────
// Context 정의
// ─────────────────────────────────────────
type Theme = 'light' | 'dark'

interface MainLayoutContextValue {
  /** 사이드바 열림 상태 (모바일) */
  sidebarOpen: boolean
  /** 사이드바 열기 */
  openSidebar: () => void
  /** 사이드바 닫기 */
  closeSidebar: () => void
  /** 사이드바 토글 */
  toggleSidebar: () => void
  /** 현재 테마 */
  theme: Theme
  /** 테마 토글 */
  toggleTheme: () => void
}

const MainLayoutContext = createContext<MainLayoutContextValue | null>(null)

/**
 * /main/* 페이지에서 레이아웃 상태에 접근하는 훅
 *
 * @example
 * const { openSidebar, theme, toggleTheme } = useMainLayout();
 */
export function useMainLayout(): MainLayoutContextValue {
  const ctx = useContext(MainLayoutContext)
  if (!ctx) {
    throw new Error('useMainLayout은 /main/* 페이지에서만 사용 가능합니다')
  }
  return ctx
}

// ─────────────────────────────────────────
// Layout 컴포넌트
// ─────────────────────────────────────────
export default function MainLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>('light')

  // 테마 초기화 (localStorage)
  useEffect(() => {
    const saved = localStorage.getItem('theme') as Theme | null
    if (saved === 'dark') {
      setTheme('dark')
      document.documentElement.setAttribute('data-theme', 'dark')
    }
  }, [])

  const openSidebar = useCallback(() => setSidebarOpen(true), [])
  const closeSidebar = useCallback(() => setSidebarOpen(false), [])
  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), [])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light'
      document.documentElement.setAttribute('data-theme', next)
      localStorage.setItem('theme', next)
      return next
    })
  }, [])

  return (
    <MainLayoutContext.Provider
      value={{
        sidebarOpen,
        openSidebar,
        closeSidebar,
        toggleSidebar,
        theme,
        toggleTheme,
      }}
    >
      <div className="flex min-h-screen bg-bg">
        <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </MainLayoutContext.Provider>
  )
}
