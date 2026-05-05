// apps/web/src/app/(main)/hub/page.tsx
//
// Phase 3-3 완료 — 4영역(Hero · Modules · Continue · Recent) 모두 useHubData 자가 페치.

import { ContinueCard } from '@/components/home/ContinueCard'
import { HubHero } from '@/components/home/HubHero'
import { ModuleGrid } from '@/components/home/ModuleGrid'
import { RecentActivity } from '@/components/dashboard/RecentActivity'

export const metadata = {
  title: 'Hub · Vocaflow',
  description: '오늘의 학습을 시작하세요',
}

export default function HubPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-4 md:p-8">
      {/* ① Hero */}
      <HubHero />

      {/* ② Module Grid */}
      <section aria-label="학습 모듈">
        <h2 className="sr-only">학습 모듈</h2>
        <ModuleGrid />
      </section>

      {/* ③ Continue */}
      <section aria-label="이어하기">
        <h2 className="sr-only">이어하기</h2>
        <ContinueCard />
      </section>

      {/* ④ Reflection */}
      <section aria-label="최근 학습 활동">
        <h2 className="sr-only">최근 학습 활동</h2>
        <RecentActivity />
      </section>
    </div>
  )
}
