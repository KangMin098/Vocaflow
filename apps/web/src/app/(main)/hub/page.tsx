// apps/web/src/app/(main)/hub/page.tsx
// @form: 망각 — 「오늘 다시 볼 단어」 슬라이더 → 7일 기억 곡선이 들어 올려지고 낱말에 권점 · 200ms (TodayStage)
//
// Today (Hub) — forward 진입면.
//
// 2026-09-19 화면 재설계 — **첫 시선 = 7일 기억 곡선**(발산 A 「들어 올리는 곡선」, docs/design/compare/hub.md ·
// 골든 docs/design/golden/hub.md · DECISIONS DD-22). 감사(2026-09-18)가 이전 첫 시선을 "단어 카드 1장" 으로
// 평균 판정했다. 밀린 단어 표제어 카드(`TodayStage` 옛 좌측)·미진단 카드(`TodayFocus`)·뒤이어 띠(`NextWordsStrip`)는
// 곡선 아래 낱말 줄 하나로 합쳤다 — 세 표면이 같은 단어 목록을 서로 다른 모양으로 보여 주고 있었다.
//
// 아래는 v06.200 기록이다(흐름 목록·단일 CTA·"오늘" 정본 규칙은 그대로 유효).
//
// v06.200 재설계 — 진입면이 답하는 질문을 바꿨다.
//   이전: "무엇이 있나" (히어로 인사말 + 처방 5블록 나열 + 7개 동일 모듈 카드 + 추천 + 관리)
//   지금: "무엇을 배우고, 지금 뭘 하지" (단어 지면 + 오늘의 흐름)
//
// 왜 바꿨나 — 실측 스크린샷으로 확인한 결함:
//   ① 히어로 140px 를 매일 같은 인사말 하나에 썼다(정보밀도 0)
//   ② 처방 5블록이 전부 같은 무게로 나열돼 "지금 뭘" 이 3초에 안 읽혔다
//   ③ 빈 상태 카드가 페이지 중앙을 히어로급으로 점거했다
//   ④ 7개 동일 정사각 카드 중 다섯이 "아직 학습 전" — 죽은 정보. 도구는 사이드바가 이미 판다
//   ⑤ 어휘 학습 플랫폼인데 **화면에 단어가 한 개도 없었다**
//   ⑥ 추천 단어장이 /wordvault 와 중복, "V-Level 갱신" 관리 기능이 학습 진입면에 있었다
//   설계 3안 비교와 점수는 재설계 랩(`/hub-lab`)에 남아 있다.
//
// **유지한 것 — "오늘" 단일 정본(v06.108 META Opt A)**:
//   · 오늘 수동계획 있음        → TodayPlanCard 가 정본 (사용자 의지 우선 · Empathetic)
//   · 진단완료 + 수동계획 없음  → TodayStage 의 오늘의 흐름이 정본 (prescribe_today 5블록)
//   · 미진단                    → TodayStage 의 곡선 + 1차 행동 = 진단 (2026-09-19 — TodayFocus 카드는 은퇴)
//   경쟁하는 표면을 만들지 않는다. 단어 지면은 "할 일" 표면이 아니라 학습 재료다.
//
// 회고(backward)는 /dashboard 단독 — 여기는 forward 만.

// 배럴(`@/components/ui/ios`) 대신 파일을 직접 — 배럴은 이 화면이 쓰지 않는 카드(떠오르는 hover)까지 트리에 싣는다
import { Screen } from '@/components/ui/ios/Screen'
import { kstRoomTime } from '@/components/home/room-tone'
import { GatewayLead } from '@/components/home/GatewayLead'
import { TodayPlanCard } from '@/components/home/TodayPlanCard'
import { TodayReading } from '@/components/home/TodayReading'
import { TodayStage } from '@/components/home/TodayStage'
import { fetchStudyPlanItems } from '@/lib/learner/plan-actions'
import { fetchTodayPrescription } from '@/lib/learner/prescription-actions'
import { fetchHubLift } from '@/lib/learner/hub-lift-query'
import { fetchGatewayState } from '@/lib/learner/gateway'
import { fetchTasteWord } from '@/lib/learner/taste-word'
import {
  fetchCheckDoneToday,
  fetchDcpDoneToday,
  fetchReadDoneToday,
  fetchTouchedModulesToday,
} from '@/lib/learner/today-status-query'

export const metadata = {
  title: 'Today',
  description: '오늘의 학습을 시작하세요',
}

/** KST 오늘 요일 0=일..6=토. */
function kstDay(): number {
  return new Date(Date.now() + 9 * 3_600_000).getUTCDay()
}

/** KST 오늘 요일 1=월..7=일 — 수동 계획(`weekdays`)의 표기. */
function kstWeekday(): number {
  const day = kstDay()
  return day === 0 ? 7 : day
}

export default async function HubPage() {
  const [planItems, prescription, lift, touchedToday, dcpDoneToday, readDoneToday, checkDoneToday, gateway] =
    await Promise.all([
    fetchStudyPlanItems(),
    fetchTodayPrescription(),
    // 세션 큐와 같은 조회 — 곡선 아래 앞 N개가 곧 「이 N개부터」 가 여는 세션이다(hub-lift-query 주석)
    fetchHubLift(),
    // 셸 띠와 **같은 값**을 쓴다 — cache() 라 추가 쿼리는 돌지 않는다.
    fetchTouchedModulesToday(),
    fetchDcpDoneToday(),
    // 읽기·검증은 `by_module` 에 안 남는다 — 안 넘기면 그 두 블록이 영원히 미완료다
    fetchReadDoneToday(),
    fetchCheckDoneToday(),
    fetchGatewayState(),
  ])

  const today = kstWeekday()
  const hasTodayPlan = planItems.some((i) => i.weekdays.includes(today))
  const isDiagnosed = prescription?.isDiagnosed ?? false

  // 모은 낱말이 0 인 미진단 학습자에게만 낱말 하나를 세운다 — 곡선을 지어낼 수 없는 자리의 다음 한 걸음(D5).
  const tasteWord = lift?.kind === 'empty' && !isDiagnosed ? await fetchTasteWord() : null

  // 시각은 서버에서 정한다 — 클라이언트에서 계산하면 SSR 과 어긋나 지면 색이 한 번 튄다.
  const time = kstRoomTime()

  return (
    <Screen width="wide" background="bg2" padX="md">
      <div className="flex flex-col gap-4 py-6 md:py-8">
        {/* 관문 첫 줄 — 돌아온 사람을 알아본다.
            처음 온 사람·오늘 이미 한 사람에게는 스스로 사라진다(할 말이 없으면 그리지 않는다). */}
        <GatewayLead state={gateway} />

        {/* 무대 — 좌: 7일 기억 곡선 + 낱말(골격) · 우: 오늘의 흐름(처방이 정본일 때만).
            수동계획이 정본인 날에는 흐름을 넘기지 않는다(표면 이중화 방지). */}
        <TodayStage
          lift={lift}
          tasteWord={tasteWord}
          isDiagnosed={isDiagnosed}
          prescription={hasTodayPlan ? null : prescription}
          time={time}
          weekday={kstDay()}
          touchedToday={[...touchedToday]}
          dcpDoneToday={dcpDoneToday}
          readDoneToday={readDoneToday}
          checkDoneToday={checkDoneToday}
        />

        {/* 오늘 읽을 것 — 처방이 고른 실제 글을 제목으로 세운다.
            흐름의 `Read · 30분` 은 개수와 같은 것이고, 제목·수준·성격이 있어야 고를 수 있다
            (단어에 대해 v06.200 이 내린 결론을 읽을거리에 적용). */}
        {!hasTodayPlan && isDiagnosed && prescription && (
          <TodayReading candidates={prescription.input.candidates} />
        )}

        {/* 오늘 정본 — 수동계획 우선 */}
        {hasTodayPlan && <TodayPlanCard items={planItems} today={today} />}
      </div>
    </Screen>
  )
}
