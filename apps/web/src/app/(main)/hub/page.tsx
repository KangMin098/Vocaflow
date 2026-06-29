// apps/web/src/app/(main)/hub/page.tsx
//
// Today (Hub) — forward 진입면 (v06.34 IA · v06.108 메타 통합 · v06.110 오늘의 계획)
//
//   ① HubHero          (인사 + Streak + V-Level 배지 + Today CTA)
//   ② TodayPlanCard    (★ 오늘 요일 study_plan_items — 계획→매일 실행, 항목 있을 때만)
//   ③ TodayFocus       (★ 페르소나 분기: 미진단 → cold → warm-risk → warm-progress → hot)
//   ④ ContinueCard     (이어하기 — 최근 열람 텍스트)
//   ⑤ ModuleGrid       (학습 모듈)
//   ⑥ RecommendedSets  (★ VRL 추천 — recommend_word_sets_for_user RPC)
//   (최근 학습/회고는 /dashboard 단독 — v06.108 메타 4→2 통합)
//
// 설계 원칙:
//   - F-pattern 시선 (Hero → 오늘 계획 → Focus → Continue → Modules → Recommended)
//   - 오늘(forward) 단일 책임 — 회고(backward)는 /dashboard
//   - Flow State 진입 보조 · SDT 자율성 · Calm UI

import { Screen } from '@/components/ui/ios'
import { ContinueCard } from '@/components/home/ContinueCard'
import { HubHero } from '@/components/home/HubHero'
import { ModuleGrid } from '@/components/home/ModuleGrid'
import { TodayFocus } from '@/components/home/TodayFocus'
import { TodayPlanCard } from '@/components/home/TodayPlanCard'
import { RecommendedSetsSection } from '@/components/wordvault/hub/RecommendedSetsSection'
import { fetchStudyPlanItems } from '@/lib/learner/plan-actions'

export const metadata = {
  title: 'Today · Vocaflow',
  description: '오늘의 학습을 시작하세요',
}

/** KST 오늘 요일 1=월..7=일. */
function kstWeekday(): number {
  const day = new Date(Date.now() + 9 * 3_600_000).getUTCDay()
  return day === 0 ? 7 : day
}

export default async function HubPage() {
  const planItems = await fetchStudyPlanItems()

  return (
    <Screen width="wide" background="bg2" padX="md">
      <div className="flex flex-col gap-4 py-6 md:py-8">
        {/* ① Hero — 인사 + Streak + V-Level 배지 + Today CTA */}
        <HubHero />

        {/* ② 오늘의 학습 계획 — study_plan_items 오늘 요일 (항목 있을 때만) */}
        <TodayPlanCard items={planItems} today={kstWeekday()} />

        {/* ③ Today's Focus — 페르소나 분기 1순위 액션 */}
        <TodayFocus />

        {/* ④ Continue — 이어하기 */}
        <section aria-label="이어하기">
          <h2 className="sr-only">이어하기</h2>
          <ContinueCard />
        </section>

        {/* ⑤ Module Grid — 학습 모듈 */}
        <section aria-label="학습 모듈">
          <h2 className="sr-only">학습 모듈</h2>
          <ModuleGrid />
        </section>

        {/* ⑥ Recommended Sets — V-Level + Track + Interest 기반 추천 */}
        <section aria-label="추천 단어장">
          <h2 className="sr-only">추천 단어장</h2>
          <RecommendedSetsSection hideUndiagnosedCard />
        </section>
        {/* 최근 학습(회고)은 /dashboard 단독 — hub 는 forward(오늘)만 (v06.108 IA 통합) */}
      </div>
    </Screen>
  )
}
