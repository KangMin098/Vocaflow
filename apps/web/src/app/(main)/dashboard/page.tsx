// apps/web/src/app/(main)/dashboard/page.tsx
// @form: 환경 변형 — 기억의 지층: 버티는 기간별 층 안에 내 낱말, 이번 주에 되찾은 낱말엔 권점 (DurabilityLadder)
//
// 2026-09-19 화면 재설계(DD-29 · docs/design/compare/retrospect.md 발산 A 「기억의 지층」):
//   선언한 골격이 렌더되지 않았다 — 흰 카드 7장 · 12px 막대 · 5칸 숫자(빈 칸은 0 세 개).
//   지금은 판면(bg) 위 번호 괘선 구획, 히어로는 층 안에 실제 낱말이 선 단면. 카드 그림자·3열 카드를 걷었다.
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
import { Rule } from '@/components/ui/press'
import { ActivityTrace } from '@/components/dashboard/ActivityTrace'
import { DurabilityLadder } from '@/components/dashboard/DurabilityLadder'
import { LexicalReach } from '@/components/dashboard/LexicalReach'
import { ManageSection } from '@/components/dashboard/ManageSection'
import { RecentActivity } from '@/components/dashboard/RecentActivity'
import { RescuedWords } from '@/components/dashboard/RescuedWords'
import { fetchManageOverview } from '@/lib/learner/manage-overview'
import { fetchMemoryHorizon } from '@/lib/learner/memory-horizon'
import { fetchRecentActivity } from '@/lib/learner/recent-activity-query'

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
  // ⚠️ 이 화면의 조회는 **여기서 끝난다** — 하위 컴포넌트는 스스로 조회하지 않는다.
  //    (실측 2026-09-06: 마지막 줄 `RecentActivity` 가 `useHubData()` 를 부르는 바람에
  //     이미 서버 컴포넌트인 이 페이지가 브라우저 데이터 요청 10건을 냈다.
  //     자세한 경위는 `lib/learner/recent-activity-query.ts` 머리주석.)
  const [overview, horizon, recent] = await Promise.all([
    fetchManageOverview(),
    fetchMemoryHorizon(),
    fetchRecentActivity(),
  ])

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
    <Screen width="wide" background="bg" padX="md">
      <div className="flex flex-col gap-4 py-6 md:py-8">
        {/* 1. 헤더 — 날짜와 이름만. 오늘 진행·연속일은 셸 상태 띠가 이미 판다.
            v07 — 이름을 `--p`(딥 잉크)로 칠하던 것을 주묵 표식으로 바꿨다. 한 화면에서
            "여기가 당신" 이라고 말하는 자리는 하나이고, 그 표식은 브랜드 색이 맡는다. */}
        <header className="border-b-2 border-[var(--t1)] pb-3">
          <span className="font-display text-[11px] font-[600] tracking-[0.04em] text-[var(--t2)]">
            {kstDateLabel()}
          </span>
          <h1 className="mt-1 font-editorial text-[26px] font-[500] leading-[1.05] tracking-[-0.012em] text-[var(--t1)] md:text-[32px]">
            <span className="text-[var(--ju-ink)]">{overview.userName}</span>
            <span>님이 지나온 길</span>
          </h1>
        </header>

        {/* ── v07 「주묵 판면」 ────────────────────────────────────────────────
            이 화면의 결함은 블록이 나쁜 게 아니라 **일곱 블록이 전부 같은 무게**라는 것이었다
            (실측 2026-09-16: 카드 10장 · 글자색 94%가 같은 잉크 한 색의 알파 3단계).
            위계가 글자 크기로만 생기니 어디부터 읽어야 할지가 매번 새로 판단된다.
            그래서 상자를 더 꾸미는 대신 **판면의 구획**을 얹는다 — 번호 붙은 괘선이
            "여기서부터 다른 이야기" 를 말하고, 블록 자체는 그대로 둔다. ─────────────── */}

        {/* 2. 히어로 — 기억이 버티는 시간 */}
        {horizon && (
          <>
            <Rule n="01" label="기억이 버티는 시간" tone="ju" className="mt-2" />
            <DurabilityLadder ladder={horizon.ladder} />
          </>
        )}

        {/* 3·4. 되찾은 단어 + 28일 흐름 — 한 줄에 나란히 (좌: 결과 · 우: 노정) */}
        {horizon && (
          <>
            <Rule n="02" label="되찾은 것과 지나온 날" className="mt-4" />
            <div className="grid gap-4 lg:grid-cols-2">
              <RescuedWords rescued={horizon.rescued} />
              <ActivityTrace
                days={horizon.days28}
                streak={horizon.streak}
                activeDays={horizon.activeDays}
              />
            </div>
          </>
        )}

        {/* 5. 어휘의 무게중심 — 순위를 아는 단어가 없으면 스스로 사라진다 */}
        {horizon && (
          <>
            <Rule n="03" label="어휘의 무게중심" className="mt-4" />
            <LexicalReach reach={horizon.reach} />
          </>
        )}

        {/* 6·7. 학습 관리 + 최근 학습 — 회고가 아니라 **조작**이라 한 구획으로 묶는다 */}
        <Rule n="04" label="학습 관리" className="mt-4" />
        <ManageSection overview={overview} />
        <RecentActivity data={recent} />

        {/* Calm closing — 정서적 부호화. 모바일 하단 탭에 가리지 않도록 여백을 둔다
            (이전에는 관리 카드가 탭 뒤로 잘렸다 — 390px 실측). */}
        <footer className="mt-4 pb-20 text-center md:pb-4">
          <p className="font-english text-[14px] italic leading-relaxed text-[var(--t2)]">
            “Slow is smooth, smooth is fast.”
          </p>
        </footer>
      </div>
    </Screen>
  )
}
