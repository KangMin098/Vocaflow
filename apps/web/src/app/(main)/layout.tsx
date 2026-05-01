// apps/web/src/app/(main)/layout.tsx

import { Sidebar } from '@/components/layout/Sidebar'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  // TODO: Supabase 연동 후 실제 데이터 주입
  const userName = '김학생'
  const streak = 23
  const todayCount = 8

  return (
    <div className="flex min-h-screen bg-[var(--bg2)]">
      <Sidebar userName={userName} streak={streak} todayCount={todayCount} />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  )
}
