// apps/web/src/app/(main)/hub/page.tsx
//
// Today (Hub) — forward 진입면.
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
//   · 미진단                    → TodayFocus (진단 유도)
//   경쟁하는 표면을 만들지 않는다. 단어 지면은 "할 일" 표면이 아니라 학습 재료다.
//
// 회고(backward)는 /dashboard 단독 — 여기는 forward 만.

import { Screen } from '@/components/ui/ios'
import { kstRoomTime } from '@/components/home/room-tone'
import { TodayFocus } from '@/components/home/TodayFocus'
import { TodayPlanCard } from '@/components/home/TodayPlanCard'
import { TodayStage } from '@/components/home/TodayStage'
import { fetchStudyPlanItems } from '@/lib/learner/plan-actions'
import { fetchTodayPrescription } from '@/lib/learner/prescription-actions'
import { fetchReadingRoom } from '@/lib/learner/reading-room-actions'
import { fetchDcpDoneToday, fetchTouchedModulesToday } from '@/lib/learner/today-status-query'

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
  const [planItems, prescription, room, touchedToday, dcpDoneToday] = await Promise.all([
    fetchStudyPlanItems(),
    fetchTodayPrescription(),
    fetchReadingRoom(),
    // 셸 띠와 **같은 값**을 쓴다 — cache() 라 추가 쿼리는 돌지 않는다.
    fetchTouchedModulesToday(),
    fetchDcpDoneToday(),
  ])

  const today = kstWeekday()
  const hasTodayPlan = planItems.some((i) => i.weekdays.includes(today))
  const isDiagnosed = prescription?.isDiagnosed ?? false

  // 시각은 서버에서 정한다 — 클라이언트에서 계산하면 SSR 과 어긋나 지면 색이 한 번 튄다.
  const time = kstRoomTime()

  return (
    <Screen width="wide" background="bg2" padX="md">
      <div className="flex flex-col gap-4 py-6 md:py-8">
        {/* 무대 — 좌: 오늘 되찾을 단어(학습 재료) · 우: 오늘의 흐름(처방이 정본일 때만).
            수동계획이 정본인 날에는 흐름을 넘기지 않는다(표면 이중화 방지). */}
        <TodayStage
          room={room}
          prescription={hasTodayPlan ? null : prescription}
          time={time}
          touchedToday={[...touchedToday]}
          dcpDoneToday={dcpDoneToday}
        />

        {/* 오늘 정본 — 수동계획 우선 */}
        {hasTodayPlan && <TodayPlanCard items={planItems} today={today} />}

        {/* 미진단 — 오늘 분량 자체가 없다. 진단 하나만 남긴다. */}
        {!hasTodayPlan && !isDiagnosed && <TodayFocus />}
      </div>
    </Screen>
  )
}
