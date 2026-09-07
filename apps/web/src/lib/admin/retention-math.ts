// apps/web/src/lib/admin/retention-math.ts
//
// 학습자 활성화·리텐션 계산의 **순수부**. 조회는 `retention.ts` 가 맡는다.
// (`server-only`/`cache` 를 여기 두면 클라이언트·vitest 가 함께 못 쓴다 — `growth-math.ts` 참조.)
//
// ─────────────────────────────────────────────────────────────
// 왜 이벤트 테이블을 새로 만들지 않았나 (docs/PLATFORM_AUDIT.md F4)
//
// F4 는 "이벤트 6종(가입·첫 학습·세션 완료·재방문·단어장 생성·퀴즈 완료) 수집" 을
// 해소 조건으로 적고 있다. 그런데 실측해 보니 **6종 중 5종이 이미 기존 테이블에서 파생된다**
// (2026-08-16):
//   가입          → `auth.users.created_at`
//   첫 학습       → `learning_records` / `scores` 의 최초 행
//   세션 완료     → `scores`
//   단어장 생성   → `vocabularies`
//   퀴즈 완료     → `scores where module='scriptquiz'`
//   재방문(조회)  → **없음**
//
// 즉 F4 의 실체는 "수집 장치가 없다" 가 아니라 **"아무도 계산해 본 적이 없다"** 였다.
// 그래서 수집기를 새로 만드는 대신 계산기를 만든다 — 쓰기 부하 0, 마이그레이션 0.
//
// **순수 재방문(학습 없는 페이지 조회)은 일부러 수집하지 않는다.** 학습 제품에서 조회만 한
// 방문은 가치가 아니고, 그것을 쫓으면 지표가 실제 학습과 멀어진다. 여기서 재는 것은
// **활동 리텐션** — "돌아와서 실제로 학습했는가" 다.
// (조회 리텐션이 필요해지는 시점: 유료 전환 퍼널을 붙일 때. 그전에는 비용만 는다.)
// ─────────────────────────────────────────────────────────────

/** 한 학습자의 가입일과 활동일(KST 날짜, 중복 없음). */
export interface LearnerActivity {
  userId: string
  /** 'YYYY-MM-DD' */
  signupDay: string
  /** 'YYYY-MM-DD' 오름차순 · 중복 없음 */
  activeDays: string[]
}

export interface RetentionReport {
  /** 전체 가입자 */
  signups: number
  /** 한 번이라도 학습한 사람 */
  activated: number
  /**
   * 가입 → 첫 학습까지 걸린 일수의 중앙값. 활성화한 사람이 없으면 null.
   *
   * 이 값이 큰 것은 리텐션이 아니라 **활성화** 문제다 — 실측 2026-08-16 에 3명 중 2명이
   * 55일·87일이었다. 리텐션만 보면 이 구간이 통째로 안 보인다.
   */
  medianDaysToFirstLearn: number | null
  /** 가입 후 N일 안에 다시 와서 학습한 사람 수 (가입일 당일 학습은 제외) */
  returned: { d1: number; d7: number; d30: number }
  /**
   * 각 창의 **분모** — 가입 후 그만큼의 시간이 실제로 지난 사람만 센다.
   * 어제 가입한 사람을 D30 분모에 넣으면 리텐션이 구조적으로 낮게 나온다.
   */
  eligible: { d1: number; d7: number; d30: number }
  /** 최근 7일/28일에 학습한 사람 (WAU/MAU 대용) */
  active: { d7: number; d28: number }
}

const DAY = 86_400_000

function dayNum(iso: string): number {
  return Math.floor(Date.parse(`${iso}T00:00:00Z`) / DAY)
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? s[m] : (s[m - 1] + s[m]) / 2
}

/**
 * @param todayIso 오늘(KST) 'YYYY-MM-DD' — 경과 판정 기준. 테스트를 위해 주입받는다.
 */
export function computeRetention(
  learners: readonly LearnerActivity[],
  todayIso: string,
): RetentionReport {
  const today = dayNum(todayIso)

  let activated = 0
  const delays: number[] = []
  const returned = { d1: 0, d7: 0, d30: 0 }
  const eligible = { d1: 0, d7: 0, d30: 0 }
  const active = { d7: 0, d28: 0 }

  for (const l of learners) {
    const signup = dayNum(l.signupDay)
    const days = l.activeDays.map(dayNum).sort((a, b) => a - b)

    if (days.length > 0) {
      activated += 1
      // 가입 전 활동(시드 데이터 등)은 음수가 되므로 0 으로 막는다.
      delays.push(Math.max(0, days[0] - signup))
    }

    // 창마다 분모를 따로 센다 — 아직 그 시간이 안 지난 사람은 애초에 셀 수 없다.
    for (const [key, span] of [
      ['d1', 1],
      ['d7', 7],
      ['d30', 30],
    ] as const) {
      if (today - signup < span) continue
      eligible[key] += 1
      // 가입 **다음 날부터** 창 끝까지 학습한 적이 있는가(가입 당일 학습은 복귀가 아니다).
      if (days.some((d) => d > signup && d <= signup + span)) returned[key] += 1
    }

    if (days.some((d) => d > today - 7)) active.d7 += 1
    if (days.some((d) => d > today - 28)) active.d28 += 1
  }

  return {
    signups: learners.length,
    activated,
    medianDaysToFirstLearn: median(delays),
    returned,
    eligible,
    active,
  }
}

/**
 * 비율을 **그릴 수 있는가**.
 *
 * 표본이 작으면 퍼센트는 정보가 아니라 착시다 — 3명 중 1명이 "33%" 로 인쇄되는 순간
 * 그 숫자는 근거처럼 읽히고, 이 리포의 진단 문서가 경계하는 "문서의 수치를 근거로 쓰는" 사고가
 * 시작된다. 분모가 이 값 미만이면 화면은 **비율 대신 원수(N/M)** 를 보여준다.
 */
export const MIN_DENOMINATOR_FOR_RATE = 20

export function rateOrNull(numerator: number, denominator: number): number | null {
  if (denominator < MIN_DENOMINATOR_FOR_RATE) return null
  return numerator / denominator
}
