// apps/web/src/lib/knowledge/effect-signals.ts
//
// 트랙 E — 학습 결과 → 원리·방법론 **재검토 신호**(2026-10-08 · 판정 기준 docs/methodology/VNEXT_LOOP_ACCEPTANCE.md 고리 A).
//
// 이 모듈은 **효과를 판정하지 않는다.** 성과 변화가 원리를 자동으로 확증·반박하지 않는다(사용자 규칙). 하는 일은
//   적용(application)마다 「적격 첫 시도」를 단계별로 세어, 사람이 볼 이유가 있는지(검토 신호) · 아직 말할 수 없는지(표본 부족) ·
//   기록이 믿을 만한지(데이터 품질)를 가르는 것뿐이다. 항목 상태 · efficacy · trial 은 바꾸지 않는다 — 재검토는 관리자가 연다.
// 효과 추정(사전·사후·지연·전이 비교)은 G2 통합 쪽 protocol.ts 의 일이다. 여기서 다시 만들지 않는다.
//
// 첫 시도는 DB 뷰 learning_first_attempts 가 이미 골랐다 — 키 (user, task_key, item_ref, phase), 동률이면 answered_at → id.
// 적격(효과 표본)은 실제(비합성) · 독립 · 해설 먼저 아님 · 해설 뒤 아님 · (M8 적용 뒤) 시각 불확실 아님.

export type Phase = 'pre' | 'practice' | 'post' | 'delayed' | 'transfer' | 'review'

/** learning_first_attempts 한 행(+ 그 시도의 적용 id) */
export interface FirstAttempt {
  userId: string
  phase: Phase
  isCorrect: boolean | null
  synthetic: boolean
  helpLevel: string | null
  afterViewedFirst: boolean
  afterExplanation: boolean
  /** M8(시각 불확실 보류) 뒤에만 채워진다 — 없으면 false 로 본다 */
  timingUncertain?: boolean
}

export interface ApplicationInput {
  applicationId: string
  status: string
  /** 그 적용의 검증 계획들 — design.min_n 의 최댓값을 표본 문턱으로 쓴다 */
  trialMinN: number[]
  attempts: readonly FirstAttempt[]
}

export type SignalKind = 'insufficient_evidence' | 'performance_shortfall' | 'transfer_gap' | 'data_quality' | 'synthetic_only'

export interface Signal {
  kind: SignalKind
  /** review = 사람이 볼 이유 · watch = 지켜볼 것 · info = 아직 말할 수 없음 */
  level: 'review' | 'watch' | 'info'
  /** 관리자에게 보이는 한 문장 — 효과를 단정하지 않는다 */
  message: string
}

export interface PhaseStat {
  learners: number
  attempts: number
  correct: number
  /** 정오가 기록된 시도의 정답률 — 분모 0 이면 null(0% 와 다르다) */
  accuracy: number | null
}

export interface SignalResult {
  applicationId: string
  minN: number
  eligible: Record<string, PhaseStat>
  counts: { real: number; synthetic: number; excluded: number }
  signals: Signal[]
  /** 가장 강한 수준 — 화면 정렬용 */
  level: 'review' | 'watch' | 'info' | 'none'
}

/** 문턱 — 검증 계획이 없으면 정본 문서의 최소 표본 30 */
export const DEFAULT_MIN_N = 30
export const SHORTFALL_ACCURACY = 0.5
export const TRANSFER_GAP = 0.2
export const EXCLUDED_SHARE = 0.5
export const QUALITY_MIN_ATTEMPTS = 10

export function isEligible(a: FirstAttempt): boolean {
  return !a.synthetic && (a.helpLevel ?? 'independent') === 'independent' && !a.afterViewedFirst && !a.afterExplanation && !a.timingUncertain
}

function stat(rows: readonly FirstAttempt[]): PhaseStat {
  const graded = rows.filter((r) => r.isCorrect !== null)
  const correct = graded.filter((r) => r.isCorrect === true).length
  return {
    learners: new Set(rows.map((r) => r.userId)).size,
    attempts: rows.length,
    correct,
    accuracy: graded.length ? correct / graded.length : null,
  }
}

const pct = (x: number) => `${Math.round(x * 100)}%`

export function computeSignals(input: ApplicationInput): SignalResult {
  const minN = Math.max(DEFAULT_MIN_N, ...input.trialMinN.filter((n) => Number.isFinite(n) && n > 0))
  const real = input.attempts.filter((a) => !a.synthetic)
  const synthetic = input.attempts.length - real.length
  const eligibleRows = real.filter(isEligible)
  const excluded = real.length - eligibleRows.length

  const phases = [...new Set(eligibleRows.map((r) => r.phase))]
  const eligible: Record<string, PhaseStat> = {}
  for (const p of phases) eligible[p] = stat(eligibleRows.filter((r) => r.phase === p))

  const signals: Signal[] = []
  const practice = eligible.practice ?? stat([])
  const transfer = eligible.transfer

  if (real.length === 0 && synthetic > 0) {
    signals.push({ kind: 'synthetic_only', level: 'info', message: `합성 기록 ${synthetic}건뿐 — 경로 점검용이며 성과로 보지 않는다` })
  }
  if (practice.learners < minN) {
    signals.push({
      kind: 'insufficient_evidence',
      level: 'info',
      message: `적격 학습자 ${practice.learners}명 / 문턱 ${minN}명 — 성과에 대해 아직 말할 수 없다(insufficient_evidence)`,
    })
  } else if (practice.accuracy !== null && practice.accuracy < SHORTFALL_ACCURACY) {
    signals.push({
      kind: 'performance_shortfall',
      level: 'review',
      message: `연습 첫 시도 정답률 ${pct(practice.accuracy)}(학습자 ${practice.learners}명) — 과제 설계 · 적용 조건을 검토할 이유. 방법이 틀렸다는 뜻은 아니다`,
    })
  }
  if (transfer && transfer.learners >= minN && practice.learners >= minN && practice.accuracy !== null && transfer.accuracy !== null && practice.accuracy - transfer.accuracy >= TRANSFER_GAP) {
    signals.push({
      kind: 'transfer_gap',
      level: 'review',
      message: `연습 ${pct(practice.accuracy)} 대비 새 지문 ${pct(transfer.accuracy)} — 연습 안에서만 통하는지 검토할 이유(결과 상충)`,
    })
  }
  if (real.length >= QUALITY_MIN_ATTEMPTS && excluded / real.length >= EXCLUDED_SHARE) {
    signals.push({
      kind: 'data_quality',
      level: 'watch',
      message: `실제 첫 시도 ${real.length}건 중 ${excluded}건(${pct(excluded / real.length)})이 해설 먼저 · 해설 뒤 · 시각 불확실로 제외 — 기록 경로나 화면 흐름을 확인`,
    })
  }

  const order = { review: 3, watch: 2, info: 1 } as const
  const top = signals.reduce<SignalResult['level']>((acc, s) => (acc === 'none' || order[s.level] > order[acc] ? s.level : acc), 'none')
  return { applicationId: input.applicationId, minN, eligible, counts: { real: real.length, synthetic, excluded }, signals, level: top }
}
