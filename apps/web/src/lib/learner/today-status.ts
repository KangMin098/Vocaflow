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
  /** 지금 조치할 것 — risk + shaky. `stable` 은 조치 불가라 띠에 넣지 않는다 */
  attention: number
  /**
   * **아직 한 번도 만나지 않은 낱말** — 기억 4상태의 `new`.
   *
   * 예전에는 `new` 도 "조치 불가" 로 보아 띠에서 뺐다. 학습자가 스스로 뽑아 담던 시절엔
   * 맞는 판단이었다 — 담은 사람은 이미 그것을 본 사람이다.
   * **교사가 보낸 낱말이 생기면서 그 전제가 깨졌다.** 학생은 그 낱말을 아직 본 적이 없고,
   * 그것이야말로 가장 먼저 할 일이다.
   *
   * 2026-08-27 실측: 학생이 선생님이 보낸 3낱말을 담은 직후에도 띠는
   * **"아직 시작 전이에요 — 5분이면 오늘 할 일이 생겨요"** 였다. 사실이 아니다.
   *
   * ⚠️ `attention` 에 합치지 않는다 — "복습이 급하다" 와 "아직 안 배웠다" 는 다른 일이고,
   *    합치면 기존 숫자의 뜻이 조용히 바뀐다.
   */
  fresh: number
  streak: number
  /**
   * 세 지표가 전부 0인가.
   *
   * true 면 띠는 **숫자를 하나도 그리지 않고** 문장 하나로 바뀐다 — ADR 0006 D2 의 핵심 규칙.
   * 0을 나열하는 것은 "당신은 아무것도 하지 않았다" 를 반복하는 것과 같다(철학 ③).
   *
   * ⚠️ `fresh` 도 본다. 안 보면 **할 일이 있는 사람에게 없다고 말하게 된다** —
   *    선생님이 보낸 낱말을 막 담은 학생이 정확히 그 경우였다.
   */
  isEmpty: boolean
}

export interface TodayStatusInput {
  /** 오늘 진행 — `today-blocks.blockProgress()` 가 낸 값을 그대로 받는다 */
  progress: { done: number; total: number }
  /** R(t) 기반 기억 분포 — risk + shaky 는 `attention`, new 는 `fresh` 로 간다 */
  memory: { risk: number; shaky: number; fresh?: number }
  streak: number
}

/**
 * 띠에 그리는 수의 **상한**.
 *
 * ── 왜 상한이 필요한가 (실측 2026-08-31) ────────────────────────────
 * 어느 계정의 띠가 `새 단어 1858` 을 그리고 있었다. 이 띠의 설계 규칙 ② 는
 * **"조치 가능한 것만"** 인데, 1,858 은 조치 가능한 수가 아니다 — 오늘 할 수 있는 일이
 * 아니라 못 한 일의 총량이고, 학습자가 그 앞에서 할 수 있는 것은 닫는 것뿐이다.
 * 철학 ③(압박 금지)과 학습원칙 ⑥(작업기억 ~4항목)에 정면으로 걸린다.
 *
 * `fresh` 가 띠에 올라온 이유는 **선생님이 보낸 3낱말** 이었다(위 `fresh` 주석).
 * 그 크기에서는 옳은 판단이었고, 지금도 옳다 — 틀어진 것은 판단이 아니라 **자릿수**다.
 *
 * ⚠️ 자르되 **거짓말하지 않는다.** `99+` 는 "99보다 많다" 는 참인 문장이라
 *    "칩이 N 이라고 말했으면 누른 자리에 N 개가 있어야 한다" 는 이 띠의 계약을 깨지 않는다.
 *    반올림하거나(2k) 임의의 수로 바꾸면 그 계약이 깨진다.
 *
 * ⚠️ 여기서 **자르는 것은 표시뿐이다.** `isEmpty` 판정과 목적지 목록은 실수를 그대로 쓴다 —
 *    상한이 계산에 스며들면 100번째 낱말부터 조용히 사라진다.
 */
export const RIBBON_COUNT_CAP = 99

/** 띠에 그릴 문자열. 상한을 넘으면 `99+`. */
export function formatRibbonCount(n: number): string {
  const v = Math.max(0, Math.floor(n))
  return v > RIBBON_COUNT_CAP ? `${RIBBON_COUNT_CAP}+` : String(v)
}

/**
 * 스크린리더가 읽을 표현.
 *
 * ⚠️ 보이는 값과 **같은 뜻**이어야 한다. 화면은 `99+` 인데 소리는 `1858개` 면
 *    같은 링크가 두 사람에게 다른 약속을 한다.
 */
export function ribbonCountAria(n: number): string {
  const v = Math.max(0, Math.floor(n))
  return v > RIBBON_COUNT_CAP ? `${RIBBON_COUNT_CAP}개 이상` : `${v}개`
}

export function computeTodayStatus(input: TodayStatusInput): TodayStatus {
  const total = Math.max(0, input.progress.total)
  // 링 비율이 1을 넘을 수 없도록 done 을 total 로 막는다.
  const done = Math.min(total, Math.max(0, input.progress.done))
  const attention = Math.max(0, input.memory.risk) + Math.max(0, input.memory.shaky)
  const fresh = Math.max(0, input.memory.fresh ?? 0)
  const streak = Math.max(0, input.streak)

  return {
    done,
    total,
    attention,
    fresh,
    streak,
    isEmpty: total === 0 && attention === 0 && fresh === 0 && streak === 0,
  }
}
