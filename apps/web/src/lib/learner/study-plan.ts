// apps/web/src/lib/learner/study-plan.ts
//
// Study Plan 역산 (Busuu study plan 이식 · LEARNER_MANAGEMENT.md §4).
// 수능 D-day + 목표 어휘 + 현재 known-word + 주당 목표 → 주당/일 필요량 + 완료일 예측.
// 순수 함수 — 서버에서 컨텍스트 fetch 후 호출. "계획을 세우면 달성 확률 5배"(Busuu).

export interface StudyPlanInput {
  /** 수능 D-day (ISO date 'YYYY-MM-DD') */
  targetDate: string
  /** 목표 어휘 수 (learning_goals.target_word_count) */
  targetWordCount: number
  /** 현재 known-word (user_stats.known_word_count, stability≥21) */
  knownWordCount: number
  /** 주당 학습일 목표 */
  weeklyTargetDays: number
  /** 최근 4주 실제 주당 처리량(단어). 없으면 0 → 완료일 예측 보류 */
  recentWeeklyRate?: number
  /** 기준 시각(테스트 주입용) */
  today?: Date
}

export interface StudyPlan {
  daysLeft: number
  weeksLeft: number
  gapWords: number
  /** 남은 기간에 목표 도달하려면 주당 필요 단어 */
  weeklyNeeded: number
  /** 주당 필요 / 주당 학습일 = 하루 권장 단어 */
  dailyNeeded: number
  /** 이미 목표 달성(gap 0) */
  achieved: boolean
  /** 현 속도(recentWeeklyRate) 기준 도달 예측일 (ISO date) — 데이터 없으면 null */
  projectedDate: string | null
  /** 현 속도로 D-day 안에 도달 가능? (예측 불가 시 null) */
  onTrack: boolean | null
}

const MS_PER_DAY = 86_400_000

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * MS_PER_DAY)
}

/** 수능 D-day 역산. 격려형 예측 — 미달 시 압박 금지(§철학3, 호출부 UI 책임). */
export function computeStudyPlan(input: StudyPlanInput): StudyPlan {
  const today = input.today ?? new Date()
  const target = new Date(`${input.targetDate}T00:00:00`)

  const daysLeft = Math.max(0, Math.ceil((target.getTime() - today.getTime()) / MS_PER_DAY))
  const weeksLeft = Math.max(1, Math.ceil(daysLeft / 7))

  const gapWords = Math.max(0, input.targetWordCount - input.knownWordCount)
  const achieved = gapWords === 0

  const weeklyNeeded = achieved ? 0 : Math.ceil(gapWords / weeksLeft)
  const days = Math.max(1, input.weeklyTargetDays)
  const dailyNeeded = achieved ? 0 : Math.ceil(weeklyNeeded / days)

  let projectedDate: string | null = null
  let onTrack: boolean | null = null
  if (achieved) {
    onTrack = true
  } else if (input.recentWeeklyRate && input.recentWeeklyRate > 0) {
    const weeksToFinish = Math.ceil(gapWords / input.recentWeeklyRate)
    const projected = addDays(today, weeksToFinish * 7)
    projectedDate = projected.toISOString().slice(0, 10)
    onTrack = projected.getTime() <= target.getTime()
  }

  return { daysLeft, weeksLeft, gapWords, weeklyNeeded, dailyNeeded, achieved, projectedDate, onTrack }
}
