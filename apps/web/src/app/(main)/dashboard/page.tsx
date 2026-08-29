// apps/web/src/app/(main)/dashboard/page.tsx
//
// Growth (Reflect, L7) — "나 어떻게 하고 있나" 단일 표면.
//
// v06.201 재설계 — 회고면이 답하는 질문을 바꿨다.
//   이전: "얼마나 많이 했나" (known-word 개수 + 기억 4상태 + 28일 분(分) + 관리 3카드)
//   지금: "내 기억은 얼마나 **오래 버티나**, 이번 주에 무엇을 **되찾았나**"
//
// 왜 바꿨나 — 실측으로 확인한 결함(근거는 lib/learner/memory-horizon.ts 머리주석):
//   ① 히어로가 `user_stats.known_word_count` 를 읽어 **0개**를 띄웠다(단어 252개를 든 계정에서).
//      갱신은 정상이었고 0도 정직한 값이다 — 정의가 `stability>=21` 이라 몇 달은 0인
//      지표를 주인공으로 세운 것이 결함이다. (경위: memory-horizon.ts 머리주석 ①)
//   ② 28일 위젯이 `daily_activity.total_minutes>0` 을 학습일로 봤다. 그 컬럼은 60초 미만
//      세션을 0분으로 반올림해 버려서 "28일 중 1일" — 실제로는 8일 연속 학습 중이었다.
//   ③ 그 결과 **한 화면에 연속일이 세 종류**(띠 3일 · 히어로 3일 · 히트맵 0일)로 떠 있었고,
//      통계줄은 "시간 1분 · 단어 301개"(1분에 301단어)라는 자기모순을 인쇄했다.
//   ④ 어휘 학습 플랫폼의 회고 화면인데 **단어가 한 개도 없었다** — 개수와 막대뿐이었다.
//   ⑤ 최근 활동 칩 5개가 전부 같은 값("딕테 X · 11분 전")이라 정보량이 0이었다.
//
// 구성 (backward / 메타인지 — forward CTA 는 여전히 /hub 소관):
//   1. 헤더            — 날짜 + 이름 (인사·오늘 진행 없음)
//   2. DurabilityLadder — 기억이 버티는 시간 (히어로)
//   3. RescuedWords    — 이번 주에 다시 만난 단어 (실물 단어)
//   4. ActivityTrace   — 28일 실제 흐름 (리뷰 기준 · 분 없음 · streak 단일 정의)
//   5. LexicalReach    — 어휘의 무게중심 (빈도 밴드)
//   6. ManageSection   — 진단·계획·리포트 (이동만)
//   7. RecentActivity  — 최근 흐름
//
// **MemoryStatus(기억 4상태)를 제거했다.** ADR 0006 D2 가 "기억 4색이 FlowNav·Growth 두 곳"
// 이라고 적고 상태 띠가 그것을 흡수한다고 선언했지만, Growth 쪽 제거가 실제로는 되지 않아
// 조치 표면이 둘로 남아 있었다. 4상태는 "지금 뭘 할까"(forward)라 띠의 소관이고,
// 이 화면은 "얼마나 오래 가나"(backward)를 맡는다.

import { Screen } from '@/components/ui/ios'
import { ActivityTrace } from '@/components/dashboard/ActivityTrace'
import { DurabilityLadder } from '@/components/dashboard/DurabilityLadder'
import { LexicalReach } from '@/components/dashboard/LexicalReach'
import { ManageSection } from '@/components/dashboard/ManageSection'
import { RecentActivity } from '@/components/dashboard/RecentActivity'
import { RescuedWords } from '@/components/dashboard/RescuedWords'
import { fetchManageOverview } from '@/lib/learner/manage-overview'
import { fetchMemoryHorizon } from '@/lib/learner/memory-horizon'

export const metadata = {
  title: 'Growth',
  description: '기억이 얼마나 오래 버티는지 돌아보세요',
}

function kstDateLabel(): string {
  return new Date().toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })
}

export default async function DashboardPage() {
  const [overview, horizon] = await Promise.all([fetchManageOverview(), fetchMemoryHorizon()])

  if (!overview) {
    return (
      <Screen width="wide" background="bg2" padX="md">
        <div className="mx-auto max-w-md px-4 py-24 text-center font-body text-[14px] text-[var(--t2)]">
          로그인하면 성장 기록을 볼 수 있어요.
        </div>
      </Screen>
    )
  }

  return (
    <Screen width="wide" background="bg2" padX="md">
      <div className="flex flex-col gap-4 py-6 md:py-8">
        {/* 1. 헤더 — 날짜와 이름만. 오늘 진행·연속일은 셸 상태 띠가 이미 판다. */}
        <header>
          <span className="font-mono text-[10px] font-[700] uppercase tracking-[0.15em] text-[var(--t2)]">
            {kstDateLabel()}
          </span>
          <h1 className="mt-1 font-editorial text-[26px] font-[500] leading-[1.05] tracking-[-0.012em] text-[var(--t1)] md:text-[32px]">
            <span className="text-[var(--p)]">{overview.userName}</span>
            <span>님이 지나온 길</span>
          </h1>
        </header>

        {/* 2. 히어로 — 기억이 버티는 시간 */}
        {horizon && <DurabilityLadder ladder={horizon.ladder} />}

        {/* 3·4. 되찾은 단어 + 28일 흐름 — 한 줄에 나란히 (좌: 결과 · 우: 노정) */}
        {horizon && (
          <div className="grid gap-4 lg:grid-cols-2">
            <RescuedWords rescued={horizon.rescued} />
            <ActivityTrace
              days={horizon.days28}
              streak={horizon.streak}
              activeDays={horizon.activeDays}
            />
          </div>
        )}

        {/* 5. 어휘의 무게중심 — 순위를 아는 단어가 없으면 스스로 사라진다 */}
        {horizon && <LexicalReach reach={horizon.reach} />}

        {/* 6. 학습 관리 (진단·계획·리포트) */}
        <ManageSection overview={overview} />

        {/* 7. 최근 학습 */}
        <RecentActivity />

        {/* Calm closing — 정서적 부호화. 모바일 하단 탭에 가리지 않도록 여백을 둔다
            (이전에는 관리 카드가 탭 뒤로 잘렸다 — 390px 실측). */}
        <footer className="mt-4 pb-20 text-center md:pb-4">
          <p className="font-english text-[14px] italic leading-relaxed text-[var(--t2)]">
            “Slow is smooth, smooth is fast.”
          </p>
          <p className="mt-1 font-body text-[12px] text-[var(--t2)]">
            오늘도 차분한 페이스로 잘 해내고 있어요.
          </p>
        </footer>
      </div>
    </Screen>
  )
}
