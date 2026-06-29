// apps/web/src/app/(main)/dashboard/page.tsx
// 회고(Reflect, L7) — "나 어떻게 하고 있나" 단일 표면 (v06.108 메타 4→2 통합).
//
// 구성 (backward / 메타인지):
//   1. 헤더        — 날짜 + known-word 성장(Implicit Progress). 인사·forward CTA 없음(= 오늘/hub 책임)
//   2. MemoryStatus — 기억 4상태 분포 + 복습 CTA
//   3. WeeklyHeatmap— 28일 활동 + 연속(streak)
//   4. 학습 관리   — 진단·계획·리포트 3카드 (/manage 흡수, fetchManageOverview)
//   5. RecentActivity — 최근 학습 흐름
//
// L7 Reflect = /dashboard 단독 (LEARNING_MODEL 이중할당 해소). 인사·오늘 진행(forward)은 /hub(오늘).

import { Screen } from '@/components/ui/ios'
import { ManageSection } from '@/components/dashboard/ManageSection'
import { MemoryStatus } from '@/components/dashboard/MemoryStatus'
import { RecentActivity } from '@/components/dashboard/RecentActivity'
import { WeeklyHeatmap } from '@/components/dashboard/WeeklyHeatmap'
import { fetchManageOverview } from '@/lib/learner/manage-overview'

function kstDateLabel(): string {
  return new Date().toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })
}

export default async function DashboardPage() {
  const overview = await fetchManageOverview()

  if (!overview) {
    return (
      <Screen width="content" background="bg2" padX="md">
        <div className="mx-auto max-w-md px-4 py-24 text-center font-body text-[14px] text-[var(--t3)]">
          로그인하면 학습 회고를 볼 수 있어요.
        </div>
      </Screen>
    )
  }

  return (
    <Screen width="content" background="bg2" padX="md">
      <div className="flex flex-col gap-5 py-6 md:py-8">
        {/* 1. 헤더 — known-word 성장 (회고, Implicit Progress) */}
        <header>
          <span className="font-mono text-[10px] font-[700] uppercase tracking-[0.15em] text-[var(--t3)]">
            {kstDateLabel()}
          </span>
          <h1 className="mt-1 font-editorial text-[28px] font-[500] leading-[1.05] tracking-[-0.012em] text-[var(--t1)] md:text-[34px]">
            <span className="text-[var(--p)]">{overview.userName}</span>
            <span className="text-[var(--t1)]">님의 학습 여정</span>
          </h1>
          <p className="mt-2 font-body text-[13.5px] leading-relaxed text-[var(--t2)]">
            {overview.knownWordCount > 0 ? (
              <>
                지금까지{' '}
                <span className="font-display font-[700] text-[var(--p)]">
                  {overview.knownWordCount.toLocaleString()}개
                </span>
                의 단어가 마음에 자리잡았어요.
              </>
            ) : (
              '아직 자리잡은 단어가 없어요 — 한 걸음씩, 차분히 쌓아가요.'
            )}
          </p>
        </header>

        {/* 2. 기억 4상태 */}
        <MemoryStatus />

        {/* 3. 28일 활동 + 연속 */}
        <WeeklyHeatmap />

        {/* 4. 학습 관리 (진단·계획·리포트) — /manage 흡수 */}
        <ManageSection overview={overview} />

        {/* 5. 최근 학습 */}
        <RecentActivity />

        {/* Calm closing — 정서적 부호화 */}
        <footer className="mt-4 text-center">
          <p className="font-english text-[14px] italic leading-relaxed text-[var(--t3)]">
            “Slow is smooth, smooth is fast.”
          </p>
          <p className="mt-1 font-body text-[12px] text-[var(--t3)]">
            오늘도 차분한 페이스로 잘 해내고 있어요.
          </p>
        </footer>
      </div>
    </Screen>
  )
}
