// apps/web/src/app/(main)/dashboard/page.tsx

import { StubPage } from '@/components/dev/StubPage'

export default function DashboardPage() {
  return (
    <StubPage
      title="대시보드"
      description="학습 통계 · 주간 히트맵 · 모듈별 정확도 · 점수 추이"
      upcoming={[
        'StatCard 4종 — 오늘 학습 / 연속 일수 / 누적 단어 / 정확도',
        'WeeklyHeatmap — 7요일 × 4주 그리드',
        'ModuleAccuracyRing — Flashcard / SpellForge / WordBlitz / ScriptQuiz 도넛',
        'ScoreTrendChart — 최근 7일 라인 차트',
        'RecentActivity — 학습 기록 타임라인',
      ]}
    />
  )
}
