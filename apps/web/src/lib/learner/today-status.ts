// apps/web/src/lib/learner/today-status.ts
//
// 상태 띠(StatusRibbon)의 **순수 계산부** — ADR 0006 D2.
//
// ⚠️ 이 파일에 `server-only` 를 넣지 말 것. 클라이언트 컴포넌트가 이 계산을 import 하는 순간
//    모듈 그래프가 깨져 **앱의 모든 라우트가 500** 이 된다(v08.x 에서 실제로 발생 — CHANGELOG
//    "모듈 허브 3개 목업 제거" 참조). 서버 조회는 `today-status-query.ts` 가 따로 맡는다.
//
// 무엇을 계산하는가:
//   셸 최상단이 답해야 하는 질문은 셋뿐이다 — 오늘 끝나려면 얼마나 남았나 / 지금 조치할 것이
//   있나 / 며칠째인가. 이 파일은 그 셋을 모으고, **셋이 전부 0인지**를 함께 판정한다.
//
// v06.201 — "오늘 N/M" 을 여기서 계산하지 않는다.
//   이전에는 이 파일이 자체 4갈래 모델(review/read/listen/practice)과 자체 모듈 매핑표를
//   갖고 N/M 을 냈다. 그런데 /hub 무대의 "오늘의 흐름" 은 `today-blocks.ts` 의 5블록 모델로
//   따로 계산하고 있었다. 결과: **같은 화면에 진행이 두 개**로 떴다 — 띠는 `오늘 2/3`,
//   그 아래 흐름은 `0/5`(2026-08-15 실측 스크린샷). 둘 다 근거는 있었지만 학습자에게는
//   무엇을 믿어야 할지 알 방법이 없었다.
//   진행의 정의는 이제 `today-blocks.blockProgress()` 하나이고, 이 파일은 그 결과를 받는다.
//   모듈 매핑표도 `today-blocks.BLOCK_MODULES` 하나로 합쳤다 — 표가 둘이면 반드시 어긋난다
//   (실제로 어긋나 있었다: 이쪽은 `echo`, 저쪽은 존재하지 않는 `echomatch`).

export interface TodayStatus {
  /** 오늘 완료한 블록 수 — `today-blocks.blockProgress()` 산출 */
  done: number
  /** 오늘 실행 가능하고 완료를 관측할 수 있는 블록 수 */
  total: number
  /** 지금 조치할 것 — risk + shaky. `stable`·`new` 는 조치 불가라 띠에 넣지 않는다 */
  attention: number
  streak: number
  /**
   * 세 지표가 전부 0인가.
   *
   * true 면 띠는 **숫자를 하나도 그리지 않고** 문장 하나로 바뀐다 — ADR 0006 D2 의 핵심 규칙.
   * 0을 나열하는 것은 "당신은 아무것도 하지 않았다" 를 반복하는 것과 같다(철학 ③).
   */
  isEmpty: boolean
}

export interface TodayStatusInput {
  /** 오늘 진행 — `today-blocks.blockProgress()` 가 낸 값을 그대로 받는다 */
  progress: { done: number; total: number }
  /** R(t) 기반 기억 분포 — risk + shaky 만 쓴다 */
  memory: { risk: number; shaky: number }
  streak: number
}

export function computeTodayStatus(input: TodayStatusInput): TodayStatus {
  const total = Math.max(0, input.progress.total)
  // 링 비율이 1을 넘을 수 없도록 done 을 total 로 막는다.
  const done = Math.min(total, Math.max(0, input.progress.done))
  const attention = Math.max(0, input.memory.risk) + Math.max(0, input.memory.shaky)
  const streak = Math.max(0, input.streak)

  return {
    done,
    total,
    attention,
    streak,
    isEmpty: total === 0 && attention === 0 && streak === 0,
  }
}
