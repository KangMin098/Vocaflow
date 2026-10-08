// apps/web/src/lib/knowledge/protocol.ts
// 효과 검증 프로토콜 · 학습자 역량 판정(순수). 이식 원천: 동결 feat/knowledge-vnext 의 vnext.ts evaluateProtocol · judgeCapability.
// 정본(feat/methodology-vnext)에도 vnext.ts 가 있어 이름 충돌을 피해 protocol.ts 로 옮겼다(VNEXT_MERGE §2-1).
//
// 바뀐 점: 사전 · 사후를 「처음 N회」로 추정하지 않고 learning_task_attempts.phase(pre/post/delayed/transfer)를 그대로 쓴다.
// 효과 입력에서 빠지는 것(effectEligible): 합성 계정 · 관리자 미리보기(synthetic) · 골격 과제(SKELETON_TASK) ·
// 해설 먼저 본 시도(help_level=viewed_first) · 적용 버전이 없는 기록. 학습자 · 문항 · 단계마다 판단 시각이 가장 이른 시도만 센다.
// 이 계산은 **기반**이다 — 실학습자 데이터 전까지 실제 효과는 미확인이다(VNEXT_MERGE §0).
import { PRACTICE_TASK } from './practice'

export type ProtocolPhase = 'pre' | 'practice' | 'post' | 'delayed' | 'transfer'

export interface AttemptRecord {
  userId: string
  itemId: string
  taskKey: string
  phase: ProtocolPhase
  helpLevel: 'independent' | 'hint' | 'viewed_first'
  synthetic: boolean
  claimHit: boolean | null
  optionCorrect: boolean | null
  /** 판단 시각 epoch ms */
  at: number
  /** 적용(knowledge_applications) 버전 — 없으면 효과 입력이 아니다 */
  appVersion: number | null
}

/** 지연 측정 간격(정본 문서 기준 14일) — 지연 과제를 낼 때 쓴다 */
export const DELAYED_DAYS = 14

export interface ProtocolThresholds {
  /** 학습자당 최소 사전 · 사후 수 */
  minPrePerLearner: number
  minPostPerLearner: number
  /** 판정에 필요한 최소 실학습자 수 */
  minLearners: number
}

export const DEFAULT_THRESHOLDS: ProtocolThresholds = { minPrePerLearner: 3, minPostPerLearner: 3, minLearners: 20 }

export function effectEligible(r: AttemptRecord): boolean {
  return r.taskKey === PRACTICE_TASK && !r.synthetic && r.helpLevel === 'independent' && r.appVersion !== null
}

export type Verdict = 'insufficient_data' | 'positive' | 'no_effect' | 'negative' | 'inconclusive'

export const VERDICT_LABEL: Record<Verdict, string> = {
  insufficient_data: '표본 부족 — 판정 안 함',
  positive: '향상',
  no_effect: '차이 없음',
  negative: '하락',
  inconclusive: '불확실',
}

export interface ProtocolResult {
  verdict: Verdict
  nLearners: number
  nQualified: number
  nRuns: number
  nExcluded: number
  metrics: {
    preHit: number | null
    postHit: number | null
    gainMean: number | null
    gainCiLow: number | null
    gainCiHigh: number | null
    delayedHit: number | null
    nDelayed: number
    transferHit: number | null
    nTransfer: number
  }
  caveats: string[]
}

function rate(xs: readonly (boolean | null)[]): number | null {
  const v = xs.filter((x): x is boolean => x !== null)
  return v.length === 0 ? null : v.filter(Boolean).length / v.length
}
const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
const round3 = (x: number | null) => (x === null ? null : Math.round(x * 1000) / 1000)

/**
 * 사전 · 사후 · 지연 · 전이. **대조군 없는 사전-사후 설계**라 인과를 말하지 않는다(caveats).
 * 자격 학습자(사전 ≥ minPre, 사후 ≥ minPost)가 minLearners 미만이면 insufficient_data.
 * 이상이면 학습자별 적중률 이득(사후−사전)의 평균과 95% 구간(정규 근사)으로 판정한다.
 * 한 적용 버전만 넣는다 — 버전이 섞이면 거부한다.
 */
export function evaluateProtocol(all: readonly AttemptRecord[], th: ProtocolThresholds = DEFAULT_THRESHOLDS): ProtocolResult {
  const runs = all.filter(effectEligible)
  const versions = new Set(runs.map((r) => r.appVersion))
  if (versions.size > 1) throw new Error('evaluateProtocol: 적용 버전이 섞였다 — 한 버전의 시도만 넣는다')

  const seen = new Set<string>()
  const byUser = new Map<string, AttemptRecord[]>()
  for (const r of [...runs].sort((a, b) => a.at - b.at)) {
    const k = `${r.userId} ${r.itemId} ${r.phase}`
    if (seen.has(k)) continue
    seen.add(k)
    byUser.set(r.userId, [...(byUser.get(r.userId) ?? []), r])
  }

  const gains: number[] = []
  const pre: (boolean | null)[] = []
  const post: (boolean | null)[] = []
  const delayed: (boolean | null)[] = []
  const transfer: (boolean | null)[] = []
  let nDelayed = 0
  let nTransfer = 0
  for (const xs of byUser.values()) {
    const p = xs.filter((r) => r.phase === 'pre')
    const q = xs.filter((r) => r.phase === 'post')
    if (p.length < th.minPrePerLearner || q.length < th.minPostPerLearner) continue
    const pr = rate(p.map((r) => r.claimHit))
    const po = rate(q.map((r) => r.claimHit))
    if (pr === null || po === null) continue
    gains.push(po - pr)
    pre.push(...p.map((r) => r.claimHit))
    post.push(...q.map((r) => r.claimHit))
    const d = xs.filter((r) => r.phase === 'delayed')
    if (d.length) nDelayed++
    delayed.push(...d.map((r) => r.claimHit))
    const t = xs.filter((r) => r.phase === 'transfer')
    if (t.length) nTransfer++
    transfer.push(...t.map((r) => r.claimHit))
  }

  const nQualified = gains.length
  const g = mean(gains)
  let lo: number | null = null
  let hi: number | null = null
  if (g !== null && nQualified >= 2) {
    const sd = Math.sqrt(gains.reduce((a, x) => a + (x - g) ** 2, 0) / (nQualified - 1))
    const half = (1.96 * sd) / Math.sqrt(nQualified)
    lo = g - half
    hi = g + half
  }
  let verdict: Verdict = 'insufficient_data'
  if (nQualified >= th.minLearners && g !== null && lo !== null && hi !== null) {
    if (lo > 0) verdict = 'positive'
    else if (hi < 0) verdict = 'negative'
    else if (Math.abs(g) < 0.05 && lo > -0.1 && hi < 0.1) verdict = 'no_effect'
    else verdict = 'inconclusive'
  }
  const caveats = ['대조군 없는 사전-사후 비교라 연습 효과 · 문항 난이도 차이를 분리하지 못한다.']
  if (nQualified < th.minLearners) caveats.push(`자격 학습자 ${nQualified}명 — 판정 문턱 ${th.minLearners}명 미만이라 효과를 말하지 않는다.`)
  if (nDelayed === 0) caveats.push('지연 측정이 없다 — 기억 유지는 알 수 없다.')
  if (nTransfer === 0) caveats.push('전이 측정이 없다 — 다른 유형으로 옮겨 가는지는 알 수 없다.')

  return {
    verdict,
    nLearners: byUser.size,
    nQualified,
    nRuns: [...byUser.values()].reduce((a, xs) => a + xs.length, 0),
    nExcluded: all.length - runs.length,
    metrics: {
      preHit: round3(rate(pre)),
      postHit: round3(rate(post)),
      gainMean: round3(g),
      gainCiLow: round3(lo),
      gainCiHigh: round3(hi),
      delayedHit: round3(rate(delayed)),
      nDelayed,
      transferHit: round3(rate(transfer)),
      nTransfer,
    },
    caveats,
  }
}

// ── 학습자 역량 판정 ──────────────────────────────────────────────────
export type CapabilityState = 'unconfirmed' | 'confirmed' | 'needs_practice'

export interface CapabilityJudgement {
  state: CapabilityState
  n: number
  hits: number
  /** 학습자에게 보이는 한 문장 */
  message: string
}

/** 최근 window 회로 판정한다. minRuns 미만이면 판정하지 않고 직접 확인 과제를 권한다(이식 원천 그대로) */
export function judgeCapability(
  hits: readonly (boolean | null)[],
  opts: { window?: number; minRuns?: number; confirmAt?: number } = {},
): CapabilityJudgement {
  const window = opts.window ?? 10
  const minRuns = opts.minRuns ?? 5
  const confirmAt = opts.confirmAt ?? 0.8
  const recent = hits.filter((h): h is boolean => h !== null).slice(-window)
  const n = recent.length
  const k = recent.filter(Boolean).length
  if (n < minRuns) {
    return { state: 'unconfirmed', n, hits: k, message: `아직 ${n}번 해 봤어요. ${minRuns}번까지는 판단하지 않고, 직접 확인하는 과제부터 해요.` }
  }
  if (k / n >= confirmAt) return { state: 'confirmed', n, hits: k, message: `최근 ${n}번 중 ${k}번 주장 문장을 바로 찾았어요.` }
  return { state: 'needs_practice', n, hits: k, message: `최근 ${n}번 중 ${k}번 찾았어요. 주장 문장을 먼저 찾는 연습을 이어 가요.` }
}
