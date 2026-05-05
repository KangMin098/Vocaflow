// apps/web/src/app/(main)/layout.tsx

import { FlowNav } from '@/components/layout/FlowNav'
import { SessionFrame } from '@/components/layout/SessionFrame'
import { Sidebar } from '@/components/layout/Sidebar'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  // TODO: Supabase 연동 후 실제 데이터 주입
  const streak = 23

  return (
    <div className="flex min-h-screen bg-[var(--bg2)]">
      <Sidebar streak={streak} />
      <div className="flex min-w-0 flex-1 flex-col">
        <FlowNav />
        <main className="min-w-0 flex-1">
          <SessionFrame>{children}</SessionFrame>
        </main>
      </div>
    </div>
  )
}
