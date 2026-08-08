// apps/web/src/app/(main)/hub/page.tsx
//
// Today (Hub) — forward 진입면 (v06.34 IA · v06.108 메타 통합 · v06.110 오늘의 계획 · v06.199 처방 정본)
//
//   ① HubHero              (인사 + Streak + V-Level 배지 + Today CTA)
//   ② "오늘" 정본 (택1)     — META 확정(Opt A): 아래 우선순위로 단일 표면만 노출(3중화 해소)
//        · 오늘 수동계획 있음        → TodayPlanCard   (사용자 의지 우선 · Empathetic)
//        · 진단완료 + 수동계획 없음  → TodayPrescriptionCard (★ prescribe_today 5블록 스마트 기본값)
//        · 미진단                    → TodayFocus (진단 유도 CTA)
//   ③ ContinueCard         (이어하기 — 최근 열람 텍스트)
//   ④ ModuleGrid           (학습 모듈)
//   ⑤ RecommendedSets      (★ VRL 추천 — recommend_word_sets_for_user RPC)
//   (최근 학습/회고는 /dashboard 단독 — v06.108 메타 4→2 통합)
//
// 설계 원칙:
//   - "오늘 할 일" 단일 정본(SSoT) — 경쟁하는 3표면 지양(Calm UI · Progressive Disclosure)
//   - 오늘(forward) 단일 책임 — 회고(backward)는 /dashboard
//   - Flow State 진입 보조 · SDT 자율성 · Calm UI

import { Screen } from '@/components/ui/ios'
import { ArcadeEntryCard } from '@/components/home/ArcadeEntryCard'
import { ContinueCard } from '@/components/home/ContinueCard'
import { HubHero } from '@/components/home/HubHero'
import { ModuleGrid } from '@/components/home/ModuleGrid'
import { TodayFocus } from '@/components/home/TodayFocus'
import { TodayPlanCard } from '@/components/home/TodayPlanCard'
import { TodayPrescriptionCard } from '@/components/home/TodayPrescriptionCard'
import { RecommendedSetsSection } from '@/components/wordvault/hub/RecommendedSetsSection'
import { fetchStudyPlanItems } from '@/lib/learner/plan-actions'
import { fetchTodayPrescription } from '@/lib/learner/prescription-actions'

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
  const [planItems, prescription] = await Promise.all([
    fetchStudyPlanItems(),
    fetchTodayPrescription(),
  ])

  const today = kstWeekday()
  const hasTodayPlan = planItems.some((i) => i.weekdays.includes(today))
  const isDiagnosed = prescription?.isDiagnosed ?? false

  return (
    <Screen width="wide" background="bg2" padX="md">
      <div className="flex flex-col gap-4 py-6 md:py-8">
        {/* ① Hero — 인사 + Streak + V-Level 배지 + Today CTA */}
        <HubHero />

        {/* ② "오늘" 정본 — 단일 표면만 (META Opt A 우선순위: 수동계획 → 처방 → 진단유도) */}
        {hasTodayPlan ? (
          <TodayPlanCard items={planItems} today={today} />
        ) : isDiagnosed && prescription ? (
          <TodayPrescriptionCard data={prescription} />
        ) : (
          <TodayFocus />
        )}

        {/* ③ Continue — 이어하기 */}
        <section aria-label="이어하기">
          <h2 className="sr-only">이어하기</h2>
          <ContinueCard />
        </section>

        {/* ④ Module Grid — 학습 모듈 */}
        <section aria-label="학습 모듈">
          <h2 className="sr-only">학습 모듈</h2>
          <ModuleGrid />
        </section>

        {/* ④-b 아케이드 진입 — 게임 수는 GAME_CATALOG 파생(ArcadeEntryCard) */}
        <section aria-label="아케이드">
          <h2 className="sr-only">아케이드</h2>
          <ArcadeEntryCard />
        </section>

        {/* ⑤ Recommended Sets — V-Level + Track + Interest 기반 추천 */}
        <section aria-label="추천 단어장">
          <h2 className="sr-only">추천 단어장</h2>
          <RecommendedSetsSection hideUndiagnosedCard />
        </section>
        {/* 최근 학습(회고)은 /dashboard 단독 — hub 는 forward(오늘)만 (v06.108 IA 통합) */}
      </div>
    </Screen>
  )
}
