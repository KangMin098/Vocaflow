// apps/web/src/app/admin/analytics/page.tsx
import { Activity, Users, BarChart3 } from 'lucide-react'
import { AdminKpiGrid } from '@/components/admin/AdminKpiGrid'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { RetentionPanel } from '@/components/admin/RetentionPanel'
import { TeacherFunnelPanel } from '@/components/admin/TeacherFunnelPanel'
import { fetchRetention } from '@/lib/admin/retention'
import { fetchTeacherFunnelGaps } from '@/lib/admin/teacher-funnel'
import { fmt, getAdminDashboardStats } from '@/lib/admin/dashboard-stats'
import { requireAdmin } from '@/lib/auth/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const metadata = { title: '활동 분석 — Admin' }
export default async function AdminAnalyticsPage() {
  await requireAdmin('/admin/analytics')
  const [stats, retention, teacherGaps] = await Promise.all([
    getAdminDashboardStats(createAdminClient()),
    fetchRetention(),
    fetchTeacherFunnelGaps(),
  ])
  return (
    <div className="flex flex-col gap-6 p-6">
      <AdminPageHeader
        icon={BarChart3}
        title="활동 분석"
        description="가입·활동·리텐션과 교사 채널의 실제 기록을 확인합니다."
      />
      <AdminScreenHelp screen="analytics" />
      <AdminKpiGrid
        kpis={[
          {
            label: '오늘 활성',
            value: fmt(stats.learners.verifiedActiveToday),
            icon: Activity,
            accent: 'var(--p)',
            bg: 'var(--bg3)',
            hint: `검증된 실사용 학습자만 · 전체 계정 오늘 ${fmt(stats.learners.activeToday)}(내부·미분류 포함)`,
          },
          {
            label: '실사용 학습자',
            value: fmt(stats.learners.verified),
            icon: Users,
            accent: 'var(--p)',
            bg: 'var(--bg3)',
            hint: `검증된 외부 계정만 · 전체 계정 ${fmt(stats.learners.total)}(내부·미분류 포함)`,
          },
        ]}
      />
      <RetentionPanel report={retention} />
      <TeacherFunnelPanel gaps={teacherGaps} />
    </div>
  )
}
