// apps/web/src/app/(main)/onboarding/page.tsx
// 온보딩 — 수능 D-day + 주당 목표 → Study Plan 생성 (Busuu study plan 이식, LEARNER_MANAGEMENT P1).
// known-word/최근 처리량은 서버에서 주입 → 클라이언트가 입력 조정 시 실시간 미리보기.

import { OnboardingClient } from '@/components/onboarding/OnboardingClient'
import { Screen } from '@/components/ui/ios'
import { fetchOnboardingContext } from '@/lib/learner/goal-actions'

export const metadata = {
  title: '학습 계획 · Vocaflow',
  description: '수능 D-day 와 주당 목표로 나만의 학습 계획을 만들어요',
}

export default async function OnboardingPage() {
  const context = await fetchOnboardingContext()
  return (
    <Screen width="content" background="bg2" padX="md">
      <OnboardingClient context={context} />
    </Screen>
  )
}
