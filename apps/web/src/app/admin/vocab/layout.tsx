import type { ReactNode } from 'react'
import { requireAdmin } from '@/lib/auth/require-admin'
import { VcbSectionNav } from '@/components/admin/vcb/VcbSectionNav'

export default async function VcbAdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin('/admin/vocab')

  return (
    <>
      {/* 모바일/태블릿 차단 */}
      <div className="lg:hidden p-12 text-center" style={{ color: 'var(--t3)' }}>
        <p className="font-display text-lg">VCB 관리는 데스크톱(≥1024px)에서 이용하세요</p>
      </div>

      {/* 데스크톱 전용 */}
      <div className="hidden lg:block max-w-6xl mx-auto px-6 py-10">
        <VcbSectionNav />
        {children}
      </div>
    </>
  )
}
