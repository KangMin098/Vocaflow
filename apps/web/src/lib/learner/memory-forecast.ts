// apps/web/src/lib/learner/memory-forecast.ts
//
// **망각을 시간축으로 꺼낸다** — 지금까지 UI 는 R(t) 의 *스냅샷*(4색)만 보여줬다.
//
// R(t) = exp(ln(0.9)·t/S) 는 연속 함수인데, 화면은 늘 "오늘 몇 개가 흐릿한가" 한 점만
// 그렸다. 그래서 학습자가 **왜 오늘 해야 하는지**를 알 방법이 없었다 — 내일 해도 같은
// 그림처럼 보이기 때문이다. 같은 수식을 미래 7일에 대해 다시 풀면 그 이유가 눈에 보인다:
// "지금 손대지 않으면 목요일에 이만큼이 흐려진다."
//
// ⚠️ 추가 쿼리 0. `growth-stats` 가 이미 `vocabularies(stability, last_review_at)` 전량을
//    읽고 있고, 그 행을 4색으로 접은 뒤 버리고 있었다. 여기서는 같은 행을 8번(오늘+7일)
//    더 접을 뿐이다. 데이터를 다시 부르지 않는다.
//
// ⚠️ `memory_state` 를 저장하지 않는다(CLAUDE.md 절대 금지). 예보도 저장하지 않는다 —
//    저장하는 순간 "동적 계산" 규칙이 예보 테이블이라는 이름으로 되돌아온다.
//
// 어조 규칙(철학 ③ Empathetic Feedback): 이 모듈은 **수만 낸다.** "잃는다"·"위험"
//   같은 말은 화면이 고른다. 여기서 평가어를 붙이면 모든 화면이 같은 압박을 물려받는다.

import { getMemoryState } from '@/lib/srs/state'

/** 예보에 필요한 최소 카드 — `vocabularies` 에서 읽는 두 컬럼 그대로. */
export interface ForecastCard {
  stability: number | null
  last_review_at: string | null
}

export interface ForecastDay {
  /** 오늘로부터 며칠 뒤 (0 = 오늘) */
  offset: number
  stable: number
  shaky: number
  risk: number
}

export interface MemoryForecast {
  /** 오늘 + 이후 `horizonDays` 일 (오름차순, 길이 = horizonDays + 1) */
  days: ForecastDay[]
  /**
   * **지금은 버티고 있지만 기간 안에 흐려질 단어 수.**
   *
   * 오늘 이미 `risk` 인 것은 세지 않는다 — 그건 예보가 아니라 현재 상태이고,
   * 이미 띠의 "다시 볼" 이 말하고 있다. 두 수가 같은 것을 세면 학습자는 같은 단어를
   * 두 번 세고 있다고 느낀다.
   */
  fadingSoon: number
  /** 오늘 시점에 이미 흐려진 단어 수 (= 기존 risk 정의와 같은 값) */
  fadedNow: number
  /** 예보 지평 (일) */
  horizonDays: number
  /** 예보 대상이 된 카드 수 — `new`(미학습)는 감쇠가 정의되지 않아 제외된다 */
  tracked: number
}

const DAY_MS = 86_400_000

/**
 * 앞으로 며칠 동안 기억이 어떻게 내려앉는지.
 *
 * @param cards `vocabularies` 행 (stability · last_review_at)
 * @param now   기준 시각 — 테스트 가능성을 위해 주입받는다
 * @param horizonDays 기본 7일. 한 주가 학습자가 계획을 세우는 단위다
 */
export function forecastMemory(
  cards: readonly ForecastCard[],
  now: Date = new Date(),
  horizonDays = 7,
): MemoryForecast {
  const horizon = Math.max(1, Math.floor(horizonDays))
  const days: ForecastDay[] = []
  let tracked = 0

  // 한 번 만들어 재사용 — 카드마다 Date 를 새로 만들면 수천 행에서 GC 가 튄다.
  const parsed = cards.map((c) => ({
    difficulty: 0,
    stability: c.stability ?? 0,
    lastReviewAt: c.last_review_at ? new Date(c.last_review_at) : null,
  }))

  for (const c of parsed) {
    // `new`(D/S 미부여)는 감쇠 곡선이 없다 — 예보의 분모에서 뺀다.
    if (c.lastReviewAt && c.stability > 0) tracked += 1
  }

  for (let offset = 0; offset <= horizon; offset++) {
    const at = new Date(now.getTime() + offset * DAY_MS)
    const day: ForecastDay = { offset, stable: 0, shaky: 0, risk: 0 }
    for (const c of parsed) {
      const state = getMemoryState(c as Parameters<typeof getMemoryState>[0], at)
      if (state === 'new') continue
      day[state] += 1
    }
    days.push(day)
  }

  // 오늘은 버티지만(risk 아님) 지평 안에 risk 가 되는 카드 — 카드 단위로 센다.
  // 일자별 risk 수의 차이로 구하면 안 된다: 같은 날 다른 카드가 복습돼 빠지면
  // 차이가 실제보다 작아진다(지금은 그런 경로가 없지만, 생기면 조용히 틀린다).
  let fadingSoon = 0
  let fadedNow = 0
  const horizonAt = new Date(now.getTime() + horizon * DAY_MS)
  for (const c of parsed) {
    if (!c.lastReviewAt || c.stability <= 0) continue
    const today = getMemoryState(c as Parameters<typeof getMemoryState>[0], now)
    if (today === 'risk') {
      fadedNow += 1
      continue
    }
    if (getMemoryState(c as Parameters<typeof getMemoryState>[0], horizonAt) === 'risk') {
      fadingSoon += 1
    }
  }

  return { days, fadingSoon, fadedNow, horizonDays: horizon, tracked }
}

/**
 * **곡선을 그릴 것이 있는가.**
 *
 * ⚠️ `tracked > 0` 만으로 판정하면 안 된다 — 실측 2026-09-05(계정 runtime-test, 밀린 단어
 * 252)에서 곡선이 **완전한 수평선**으로 그려졌다(`M3,37 L21,37 … L129,37`). 이미 흐려진
 * 136개는 예보의 대상이 아니고, 남은 카드들은 안정도가 커서 7일 안에 아무 일도 일어나지
 * 않았기 때문이다. 계산은 정확했지만 **그림은 아무 말도 하지 않았고**, 오히려 고장난
 * 그래프처럼 보였다.
 *
 * 움직이지 않는 곡선은 그리지 않는다 — 그 상태에서 할 말은 곡선이 아니라 문장이 한다
 * (`forecastSentence` 가 "지금 다시 만나면 N개가 제자리로 돌아와요" 를 낸다).
 */
export function hasForecastCurve(f: MemoryForecast): boolean {
  if (f.tracked === 0 || f.days.length < 2) return false
  const holding = f.days.map((d) => d.stable + d.shaky)
  return Math.max(...holding) !== Math.min(...holding)
}
