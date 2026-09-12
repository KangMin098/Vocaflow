// apps/web/src/app/(main)/reports/page.tsx
// 주간 Report Card (리틀팍스 월리포트 이식, LEARNER_MANAGEMENT P2).
// daily_activity(P0) 주간 집계 + Empathetic 코멘트. 생성은 클라 "갱신" 버튼(server action).

import { ReportsClient } from '@/components/reports/ReportsClient'
import { Screen } from '@/components/ui/ios'
import { fetchRecentReports } from '@/lib/learner/weekly-report'

export const metadata = {
  title: '주간 리포트',
  description: '주마다 학습을 돌아보는 Report Card',
}

export default async function ReportsPage() {
  const reports = await fetchRecentReports(8)
  return (
    <Screen width="content" background="bg2" padX="md">
      <ReportsClient reports={reports} />
    </Screen>
  )
}
