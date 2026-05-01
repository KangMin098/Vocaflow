// apps/web/src/app/admin/analytics/page.tsx

import { StubPage } from '@/components/dev/StubPage'

export default function AdminAnalyticsPage() {
  return (
    <StubPage
      title="플랫폼 분석"
      description="DAU / MAU · retention · 학습 효과 · 매출 추이"
      upcoming={[
        'DAU / WAU / MAU 추이 차트',
        'Retention 코호트 분석 (D1 / D7 / D30)',
        '학습 효과 — 단어 mastery 분포 · 평균 정답률',
        '모듈별 사용 빈도 — Flashcard / SpellForge / WordBlitz',
        '매출 추이 — MRR · 신규 구독 · 이탈',
        'Funnel — 가입 → 첫 학습 → 7일 활동',
      ]}
    />
  )
}
