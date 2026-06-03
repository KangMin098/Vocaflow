// apps/web/src/app/(main)/hub/page.tsx
//
// Hub — Vocaflow 특화 7-tier IA (v06.34)
//
//   ① HubHero          (인사 + Streak + V-Level 배지 + Today CTA)
//   ② TodayFocus       (★ 페르소나 분기: 미진단 → cold → warm-risk → warm-progress → hot)
//   ③ ContinueCard     (이어하기 — 최근 열람 텍스트)
//   ④ ModuleGrid       (7개 학습 모듈)
//   ⑤ RecommendedSets  (★ VRL 추천 — recommend_word_sets_for_user RPC)
//   ⑥ RecentActivity   (컴팩트 칩 행)
//
// 설계 원칙 (CLAUDE.md §"학습 모델 v3.0" + §14 Home Hub 정합):
//   - F-pattern 시선 (Hero → Focus → Continue → Modules → Recommended → Activity)
//   - Flow State 진입 보조 — Focus 1순위 의사결정 부담 최소화
//   - SDT 자율성 70% — 추천은 Focus 1곳 + Recommended 1곳, ModuleGrid 항상 동등 노출
//   - Calm UI — 풀-saturate accent 는 명시적 CTA 한정

import { ContinueCard } from '@/components/home/ContinueCard'
import { HubHero } from '@/components/home/HubHero'
import { ModuleGrid } from '@/components/home/ModuleGrid'
import { TodayFocus } from '@/components/home/TodayFocus'
import { RecentActivity } from '@/components/dashboard/RecentActivity'
import { RecommendedSetsSection } from '@/components/wordvault/hub/RecommendedSetsSection'

export const metadata = {
  title: 'Hub · Vocaflow',
  description: '오늘의 학습을 시작하세요',
}

export default function HubPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-4 md:p-8">
      {/* ① Hero — 인사 + Streak + V-Level 배지 + Today CTA */}
      <HubHero />

      {/* ② Today's Focus — 페르소나 분기 1순위 액션 */}
      <TodayFocus />

      {/* ③ Continue — 이어하기 */}
      <section aria-label="이어하기">
        <h2 className="sr-only">이어하기</h2>
        <ContinueCard />
      </section>

      {/* ④ Module Grid — 7개 학습 모듈 */}
      <section aria-label="학습 모듈">
        <h2 className="sr-only">학습 모듈</h2>
        <ModuleGrid />
      </section>

      {/* ⑤ Recommended Sets — V-Level + Track + Interest 기반 추천
            (미진단 사용자는 TodayFocus 가 이미 진단 안내 → 중복 회피) */}
      <section aria-label="추천 단어장">
        <h2 className="sr-only">추천 단어장</h2>
        <RecommendedSetsSection hideUndiagnosedCard />
      </section>

      {/* ⑥ Recent Activity — 최근 학습 흐름 */}
      <section aria-label="최근 학습 활동">
        <h2 className="sr-only">최근 학습 활동</h2>
        <RecentActivity />
      </section>
    </div>
  )
}
