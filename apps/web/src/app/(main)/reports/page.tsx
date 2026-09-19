// apps/web/src/app/(main)/reports/page.tsx
// @form: 환경 변형 — 주마다 한 겹: 그 주의 복습 수만큼 두꺼운 층이 위에서부터 쌓인다(/dashboard 「기억의 지층」과 같은 문법)
// 주간 Report Card (리틀팍스 월리포트 이식, LEARNER_MANAGEMENT P2).
// 2026-09-19 화면 재설계(DD-29): 이모지 빈 상태 · 3칸 숫자 상자 · 카드 그림자 · 분(分) 표기를 걷고,
//   조회 실패를 빈 상태와 구분한다(`fetchRecentReports` 가 실패를 돌려준다).
// daily_activity(P0) 주간 집계 + Empathetic 코멘트. 생성은 클라 "갱신" 버튼(server action).

import { ReportsClient } from '@/components/reports/ReportsClient'
import { Screen } from '@/components/ui/ios'
import { fetchRecentReports } from '@/lib/learner/weekly-report'

export const metadata = {
  title: '주간 리포트',
  description: '주마다 학습을 돌아보는 Report Card',
}

export default async function ReportsPage() {
  const res = await fetchRecentReports(8)
  return (
    <Screen width="content" background="bg" padX="md">
      <ReportsClient reports={res.ok ? res.reports : []} failed={!res.ok} />
    </Screen>
  )
}
