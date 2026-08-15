// apps/web/src/lib/learner/growth-math.ts
//
// 회고(Growth) 수치의 **순수 계산부**. 조회는 `growth-stats.ts` · `memory-horizon.ts` 가 맡는다.
//
// ⚠️ 이 파일에 `server-only` 나 `react.cache` 를 들이지 말 것.
//    두 가지가 동시에 깨진다:
//      ① 클라이언트 컴포넌트(ActivityTrace·DurabilityLadder)가 타입·상수를 import 하는 순간
//         모듈 그래프가 서버 전용 코드를 끌어와 라우트가 죽는다
//         (`today-status.ts` 머리주석의 사고와 같은 계열 — 그때는 전 라우트 500 이었다).
//      ② vitest(node 환경)에서 `cache is not a function` 으로 스위트가 통째로 못 뜬다.
//         실제로 이 파일을 나누기 전에 그렇게 실패했다.
//    분리 덕분에 아래 규칙들은 DB 없이도 회귀로 지켜진다.

/** 직렬화 가능(서버→클라이언트) 활동 1일 — date 는 'YYYY-MM-DD' */
export interface ActivityDayDto {
  date: string
  minutes: number
  words: number
}

// ────────────────────────────────────────────────────────────
// 지속 사다리 — stability(일) 를 학습자가 체감하는 시간 단위로 접는다.
//
// 경계값 근거: 7일·30일은 사람이 "한 주/한 달" 로 세는 단위다. 21일(Anki 의 mature 기준)을
// 쓰지 않은 이유는 학습자에게 설명할 수 없는 숫자이기 때문이다 — 사다리는 읽히는 게 목적이다.
// (21일은 `refresh_user_known_word_count` 안에 그대로 남아 있다. 두 정의가 싸우지 않도록
//  Growth 는 `known_word_count` 를 **읽지도 쓰지도 않는다**.)
// ────────────────────────────────────────────────────────────
export const RUNGS = [
  { key: 'day', label: '하루', note: '내일이면 흐려져요', min: 0, max: 1 },
  { key: 'few', label: '사흘', note: '주말까진 남아요', min: 1, max: 3 },
  { key: 'week', label: '한 주', note: '한 주를 건너요', min: 3, max: 7 },
  { key: 'month', label: '한 달', note: '한 달을 건너요', min: 7, max: 30 },
  { key: 'season', label: '계절', note: '계절이 바뀌어도 남아요', min: 30, max: Infinity },
] as const

export type RungKey = (typeof RUNGS)[number]['key']

/**
 * 지속 시간(일) → 사다리 칸. 한 번도 복습하지 않았으면(S<=0) 사다리 밖이라 null.
 *
 * 순수 함수로 뽑아 둔 이유: 경계값(1·3·7·30)이 틀리면 화면은 멀쩡히 뜨고 **분류만 조용히**
 * 어긋난다.
 */
export function rungFor(stability: number): RungKey | null {
  if (!Number.isFinite(stability) || stability <= 0) return null
  return (RUNGS.find((r) => stability >= r.min && stability < r.max) ?? RUNGS[RUNGS.length - 1]).key
}

/**
 * 연속 학습일 — 오름차순 일자 배열에서 뒤에서부터 센다. **앱 전체의 단일 정의**다.
 *
 * ⚠️ 판정을 `minutes > 0` 로 두지 않는다: `daily_activity.total_minutes` 는
 * `ROUND(duration_seconds/60.0)` 로 누적돼서 **60초 미만 세션이 0분으로 반올림**된다.
 * 그 기준으로는 리뷰 120건을 한 날도 "학습 안 함" 이 된다(실측 2026-08-15: 8일 연속
 * 활동 중인 계정이 "28일 중 1일" 로 표시됐다). `total_words` 를 함께 본다.
 *
 * ⚠️ `user_stats.current_streak` 도 쓰지 않는다. 갱신 경로가 불분명해 실제 활동과 어긋난다
 * (같은 계정에 **3** 이 들어 있었다). 한때 한 화면에 연속일이 세 종류로 떴다.
 *
 * 오늘이 아직 비어 있어도 어제까지의 연속을 끊지 않는다 — 하루가 끝나기 전에 "끊겼다" 고
 * 말하는 것은 압박이다(철학 ③ Empathetic Feedback).
 */
export function computeStreak(days: readonly ActivityDayDto[]): number {
  let streak = 0
  for (let i = days.length - 1; i >= 0; i--) {
    const active = days[i].minutes > 0 || days[i].words > 0
    if (active) streak += 1
    else if (i === days.length - 1) continue // 오늘은 아직 진행 중
    else break
  }
  return streak
}

/**
 * 지속 시간(일) → 학습자가 읽는 문장 조각.
 *
 * 0.069일을 "0일" 로 쓰지 않기 위한 포맷이다. 회고 화면의 주인공 수치가 0으로 보이면
 * 학습자는 자기가 아무것도 못 했다고 읽는다 — 실제로 이전 히어로가 그랬다.
 */
export function formatDuration(days: number): string {
  if (days >= 30) return `${Math.round(days / 30)}개월`
  if (days >= 7) return `${Math.round(days / 7)}주`
  if (days >= 1) return `${Math.round(days)}일`
  const hours = days * 24
  if (hours >= 1) return `${Math.round(hours)}시간`
  return `${Math.max(1, Math.round(hours * 60))}분`
}

// ────────────────────────────────────────────────────────────
// 화면이 받는 형태(DTO). 순수 타입이라 여기 둔다 — 클라이언트 컴포넌트가 이것 때문에
// 서버 모듈을 import 하면 위 ①의 사고가 그대로 재현된다.
// ────────────────────────────────────────────────────────────

export interface Ladder {
  /** 사다리 칸별 단어 수 — 복습 기록이 있는 단어만(S>0) */
  counts: Record<RungKey, number>
  /** 아직 한 번도 복습하지 않은 단어 (S=0) — 사다리 밖에 따로 센다 */
  unseen: number
  /** 사다리에 올라간 단어 총합 */
  onLadder: number
  /** 중앙값 지속 시간(일). 사다리가 비면 null */
  medianDays: number | null
  /** 가장 오래 버티는 단어의 지속 시간(일). 비면 null */
  topDays: number | null
}

export interface RescuedWords {
  /** 최근 7일 안에 다시 만나 **맞힌** 서로 다른 단어 수 */
  count: number
  /** 그중 실제 단어 몇 개 (지면에 단어를 세우기 위한 표본) */
  sample: { word: string; meaning: string }[]
}

/** 하루치 실제 학습량 — 분(minutes)은 기록되지 않으므로 담지 않는다. */
export interface TraceDay {
  /** 'YYYY-MM-DD' (KST) */
  date: string
  /** 그날 리뷰 건수 */
  reviews: number
  /** 그날 만난 서로 다른 단어 수 */
  words: number
}

/** 빈도 밴드 — 학습자가 붙잡고 있는 단어가 어디쯤인지. */
export interface ReachBand {
  key: string
  label: string
  count: number
}

export interface Reach {
  bands: ReachBand[]
  /** 순위를 아는 단어 수 (밴드 합계) */
  ranked: number
  /** 순위 중앙값 — "당신의 단어 절반은 이 순위 밖" */
  medianRank: number | null
}

/** 정렬된 배열의 중앙값. 비면 null. */
export function median(sorted: readonly number[]): number | null {
  if (sorted.length === 0) return null
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}
