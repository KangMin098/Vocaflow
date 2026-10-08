// apps/web/src/lib/knowledge/vnext.ts
// 학습 원리 vNext — 설계·배포·수행·검증 층의 닫힌 값과 순수 규칙. 정본 docs/methodology/VNEXT.md · 마이그레이션 20261008120000.
// DB CHECK 와 값이 같아야 한다. 서버·화면·테스트가 모두 이 파일을 쓴다(server-only 아님).
import type { ItemStatus, Layer } from './labels'

// ── 원리의 면 ────────────────────────────────────────────────────────
export const FACETS = ['language', 'learning'] as const
export type Facet = (typeof FACETS)[number]
export const FACET_LABEL: Record<Facet, string> = {
  language: '언어 처리 기제',
  learning: '학습·기억 기제',
}
export function isFacet(v: unknown): v is Facet {
  return typeof v === 'string' && (FACETS as readonly string[]).includes(v)
}

// ── 근거 세 축 중 새 두 축 ───────────────────────────────────────────
export const RESEARCH_LEVELS = [
  'meta_analysis',
  'systematic_review',
  'rct',
  'quasi_experimental',
  'correlational',
  'expert_consensus',
  'practitioner_claim',
  'observation',
  'not_assessed',
] as const
export type ResearchLevel = (typeof RESEARCH_LEVELS)[number]
export const RESEARCH_LEVEL_LABEL: Record<ResearchLevel, string> = {
  meta_analysis: '메타분석',
  systematic_review: '체계적 문헌고찰',
  rct: '무작위 통제 실험',
  quasi_experimental: '준실험',
  correlational: '상관 연구',
  expert_consensus: '공식·전문가 합의',
  practitioner_claim: '강사 주장(가설)',
  observation: '관찰',
  not_assessed: '평가 안 함',
}
export function isResearchLevel(v: unknown): v is ResearchLevel {
  return typeof v === 'string' && (RESEARCH_LEVELS as readonly string[]).includes(v)
}

export const FITS = ['direct', 'adapted', 'weak', 'not_assessed'] as const
export type Fit = (typeof FITS)[number]
export const FIT_LABEL: Record<Fit, string> = {
  direct: '그대로 적용',
  adapted: '옮겨 적용',
  weak: '약함',
  not_assessed: '평가 안 함',
}
export function isFit(v: unknown): v is Fit {
  return typeof v === 'string' && (FITS as readonly string[]).includes(v)
}

// ── 탐구 질문 ────────────────────────────────────────────────────────
export const INQUIRY_STATUSES = ['open', 'collecting', 'synthesizing', 'concluded', 'parked'] as const
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number]
export const INQUIRY_STATUS_LABEL: Record<InquiryStatus, string> = {
  open: '열림',
  collecting: '근거 모으는 중',
  synthesizing: '결론 쓰는 중',
  concluded: '결론',
  parked: '보류',
}
export function isInquiryStatus(v: unknown): v is InquiryStatus {
  return typeof v === 'string' && (INQUIRY_STATUSES as readonly string[]).includes(v)
}

export const STANCES = ['supports', 'contradicts', 'qualifies', 'counterexample'] as const
export type Stance = (typeof STANCES)[number]
export const STANCE_LABEL: Record<Stance, string> = {
  supports: '지지',
  contradicts: '반박',
  qualifies: '조건부',
  counterexample: '반례',
}
export function isStance(v: unknown): v is Stance {
  return typeof v === 'string' && (STANCES as readonly string[]).includes(v)
}

// ── 학습 설계 ────────────────────────────────────────────────────────
export const DESIGN_STATUSES = ['draft', 'ready', 'deployed', 'paused', 'retired'] as const
export type DesignStatus = (typeof DESIGN_STATUSES)[number]
export const DESIGN_STATUS_LABEL: Record<DesignStatus, string> = {
  draft: '초안',
  ready: '배포 준비',
  deployed: '배포 중',
  paused: '중단',
  retired: '종료',
}
export function isDesignStatus(v: unknown): v is DesignStatus {
  return typeof v === 'string' && (DESIGN_STATUSES as readonly string[]).includes(v)
}

export const DESIGN_ROLES = ['capability', 'language_mechanism', 'learning_mechanism', 'method', 'practice'] as const
export type DesignRole = (typeof DESIGN_ROLES)[number]
export const DESIGN_ROLE_LABEL: Record<DesignRole, string> = {
  capability: '역량',
  language_mechanism: '언어 처리 기제',
  learning_mechanism: '학습 기제',
  method: '방법론',
  practice: '공부법(가설)',
}
export function isDesignRole(v: unknown): v is DesignRole {
  return typeof v === 'string' && (DESIGN_ROLES as readonly string[]).includes(v)
}

/** 역할이 받을 수 있는 층 — 역할과 층이 어긋난 연결을 서버 액션이 거부한다. */
export const ROLE_LAYER: Record<DesignRole, Layer> = {
  capability: 'essence',
  language_mechanism: 'principle',
  learning_mechanism: 'principle',
  method: 'method',
  practice: 'practice',
}

/**
 * 학습자 화면 구현 — 설계의 `module_key` 가 가리킬 수 있는 것은 **코드에 있는 모듈뿐**이다.
 * 새 모듈은 학습자 화면을 만든 커밋에서 여기에 더한다(키만 있고 화면이 없으면 배포해도 아무도 못 본다).
 */
export const LEARNER_MODULES = {
  csat_claim_evidence: {
    label: '주장·근거 문장 찾기',
    path: (slug: string) => `/csat/practice/${slug}`,
    /** 지문 골격에 정답 근거 문장이 있는 대의 유형만 받는다 */
    typeIds: ['R-CLAIM', 'R-GIST', 'R-TOPIC', 'R-TITLE'] as readonly string[],
  },
} as const
export type LearnerModuleKey = keyof typeof LEARNER_MODULES
export function isLearnerModuleKey(v: unknown): v is LearnerModuleKey {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(LEARNER_MODULES, v)
}

export const END_REASON_LABEL: Record<string, string> = {
  evidence_changed: '근거 변화로 자동 중단',
  manual_pause: '운영자 중단',
  rollback: '이전 버전으로 되돌림',
  retired: '종료',
}

/** 설계 상태 전이 — 배포 문턱 자체는 DB 트리거가 지키고, 여기서는 버튼을 보일지만 정한다. */
export const DESIGN_TRANSITIONS: Record<DesignStatus, readonly DesignStatus[]> = {
  draft: ['ready', 'retired'],
  ready: ['draft', 'deployed', 'retired'],
  deployed: ['paused', 'retired'],
  paused: ['ready', 'deployed', 'retired'],
  retired: [],
}

export interface DesignLink {
  role: DesignRole
  layer: Layer
  status: ItemStatus
  slug: string
}

export interface Readiness {
  ok: boolean
  /** 막는 이유 — 사람이 읽는 문장. 비어 있으면 배포할 수 있다. */
  blockers: string[]
}

/**
 * 배포 문턱 — DB 트리거 `knowledge_designs_guard` 와 같은 규칙을 화면에서 미리 보여 준다.
 * 화면이 통과라고 해도 DB 가 최종 판정한다(그 사이 채택이 풀릴 수 있다).
 */
export function checkDeployReadiness(links: readonly DesignLink[]): Readiness {
  const blockers: string[] = []
  if (!links.some((l) => l.role === 'capability' || l.role === 'method')) {
    blockers.push('역량 또는 방법론 항목이 연결돼 있지 않다')
  }
  const notAdopted = links.filter((l) => l.status !== 'adopted' && l.status !== 'applied')
  if (notAdopted.length > 0) {
    blockers.push(`채택되지 않은 항목 ${notAdopted.length}개: ${notAdopted.map((l) => l.slug).join(', ')}`)
  }
  const mismatched = links.filter((l) => ROLE_LAYER[l.role] !== l.layer)
  if (mismatched.length > 0) {
    blockers.push(`역할과 층이 맞지 않는 연결 ${mismatched.length}개: ${mismatched.map((l) => l.slug).join(', ')}`)
  }
  return { ok: blockers.length === 0, blockers }
}

// ── 설계 절차 · 평가 계획 (jsonb) ────────────────────────────────────
export interface ProcedureStep {
  title: string
  detail?: string
}

export function parseProcedure(v: unknown): ProcedureStep[] {
  if (!Array.isArray(v)) return []
  return v
    .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object')
    .filter((s) => typeof s.title === 'string' && s.title.trim().length > 0)
    .map((s) => ({ title: String(s.title), detail: typeof s.detail === 'string' ? s.detail : undefined }))
}

export interface ProtocolThresholds {
  /** 사전 측정으로 쓰는 첫 훈련 횟수 */
  preCount: number
  /** 판정에 넣을 학습자당 최소 사후 횟수 */
  minPostPerLearner: number
  /** 판정에 필요한 최소 학습자 수(실학습자) */
  minLearners: number
  /** 지연 측정 — 직전 수행과 이만큼 떨어진 첫 수행 */
  delayDays: number
}

export const DEFAULT_THRESHOLDS: ProtocolThresholds = {
  preCount: 3,
  minPostPerLearner: 5,
  minLearners: 20,
  delayDays: 7,
}

export function parseThresholds(assessment: unknown): ProtocolThresholds {
  const t = (assessment && typeof assessment === 'object' ? (assessment as Record<string, unknown>).thresholds : null) as
    | Record<string, unknown>
    | null
  const num = (k: keyof ProtocolThresholds) => {
    const v = t?.[k]
    return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : DEFAULT_THRESHOLDS[k]
  }
  return { preCount: num('preCount'), minPostPerLearner: num('minPostPerLearner'), minLearners: num('minLearners'), delayDays: num('delayDays') }
}

// ── 효과 검증 프로토콜 ────────────────────────────────────────────────
export interface RunRecord {
  userId: string
  phase: 'train' | 'transfer'
  claimHit: boolean | null
  optionCorrect: boolean | null
  /** epoch ms */
  at: number
  designVersion: number
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
  metrics: {
    preHit: number | null
    postHit: number | null
    gainMean: number | null
    gainCiLow: number | null
    gainCiHigh: number | null
    preCorrect: number | null
    postCorrect: number | null
    delayedHit: number | null
    nDelayed: number
    transferHit: number | null
    nTransfer: number
  }
  /** 판정의 한계 — 화면과 기록에 그대로 남긴다 */
  caveats: string[]
}

const DAY = 86_400_000

function rate(xs: readonly (boolean | null)[]): number | null {
  const v = xs.filter((x): x is boolean => x !== null)
  if (v.length === 0) return null
  return v.filter(Boolean).length / v.length
}

function mean(xs: readonly number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null
}

function round3(x: number | null): number | null {
  return x === null ? null : Math.round(x * 1000) / 1000
}

/**
 * 사전·사후·지연·전이 프로토콜. **대조군이 없는 사전-사후 설계**라 인과를 말하지 않는다(caveats).
 * - 학습자마다 훈련 수행을 시간순으로: 첫 `preCount` 회 = 사전, 그 뒤 = 사후.
 * - 지연 = 직전 수행과 `delayDays` 이상 떨어진 첫 훈련 수행(사후 구간 안).
 * - 전이 = 훈련하지 않은 유형(phase='transfer') 수행, 사전 구간이 끝난 뒤.
 * - 판정: 자격 학습자(사전 = preCount, 사후 ≥ minPostPerLearner)가 minLearners 미만이면 insufficient_data.
 *   이상이면 학습자별 적중률 이득(사후−사전)의 평균과 95% 구간(정규 근사)으로 판정.
 * - 한 설계 버전만 넣는다 — 버전이 섞이면 호출자가 걸러야 한다(여기서 거부).
 */
export function evaluateProtocol(runs: readonly RunRecord[], th: ProtocolThresholds = DEFAULT_THRESHOLDS): ProtocolResult {
  const versions = new Set(runs.map((r) => r.designVersion))
  if (versions.size > 1) throw new Error('evaluateProtocol: 설계 버전이 섞였다 — 한 버전의 수행만 넣는다')

  const byUser = new Map<string, RunRecord[]>()
  for (const r of runs) {
    const xs = byUser.get(r.userId) ?? []
    xs.push(r)
    byUser.set(r.userId, xs)
  }

  const gains: number[] = []
  const pre: (boolean | null)[] = []
  const post: (boolean | null)[] = []
  const preC: (boolean | null)[] = []
  const postC: (boolean | null)[] = []
  const delayed: (boolean | null)[] = []
  const transfer: (boolean | null)[] = []
  let nDelayed = 0
  let nTransfer = 0

  for (const xs of byUser.values()) {
    const sorted = [...xs].sort((a, b) => a.at - b.at)
    const train = sorted.filter((r) => r.phase === 'train')
    if (train.length < th.preCount) continue
    const p = train.slice(0, th.preCount)
    const q = train.slice(th.preCount)
    if (q.length < th.minPostPerLearner) continue
    const pr = rate(p.map((r) => r.claimHit))
    const po = rate(q.map((r) => r.claimHit))
    if (pr === null || po === null) continue
    gains.push(po - pr)
    pre.push(...p.map((r) => r.claimHit))
    post.push(...q.map((r) => r.claimHit))
    preC.push(...p.map((r) => r.optionCorrect))
    postC.push(...q.map((r) => r.optionCorrect))

    for (let i = 1; i < train.length; i++) {
      if (i < th.preCount) continue
      if (train[i].at - train[i - 1].at >= th.delayDays * DAY) {
        delayed.push(train[i].claimHit)
        nDelayed++
        break
      }
    }
    const preEnd = p[p.length - 1].at
    const tr = sorted.filter((r) => r.phase === 'transfer' && r.at > preEnd)
    if (tr.length) nTransfer++
    transfer.push(...tr.map((r) => r.claimHit))
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

  const caveats = ['대조군 없는 사전-사후 비교라 연습 효과·문항 난이도 차이를 분리하지 못한다.']
  if (nQualified < th.minLearners) {
    caveats.push(`자격 학습자 ${nQualified}명 — 판정 문턱 ${th.minLearners}명 미만이라 효과를 말하지 않는다.`)
  }
  if (nDelayed === 0) caveats.push('지연 측정이 없다 — 기억 유지는 알 수 없다.')
  if (nTransfer === 0) caveats.push('전이 측정이 없다 — 다른 유형으로 옮겨 가는지는 알 수 없다.')

  return {
    verdict,
    nLearners: byUser.size,
    nQualified,
    nRuns: runs.length,
    metrics: {
      preHit: round3(rate(pre)),
      postHit: round3(rate(post)),
      gainMean: round3(g),
      gainCiLow: round3(lo),
      gainCiHigh: round3(hi),
      preCorrect: round3(rate(preC)),
      postCorrect: round3(rate(postC)),
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
  /** 판정에 쓴 최근 수행 수 */
  n: number
  hits: number
  /** 학습자에게 보이는 한 문장 */
  message: string
}

/** 최근 `window` 회로 판정한다. `minRuns` 미만이면 판정하지 않고 직접 확인 과제를 권한다. */
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
    return {
      state: 'unconfirmed',
      n,
      hits: k,
      message: `아직 ${n}번 해 봤어요. ${minRuns}번까지는 판단하지 않고, 직접 확인하는 과제부터 해요.`,
    }
  }
  if (k / n >= confirmAt) {
    return { state: 'confirmed', n, hits: k, message: `최근 ${n}번 중 ${k}번 주장 문장을 바로 찾았어요.` }
  }
  return { state: 'needs_practice', n, hits: k, message: `최근 ${n}번 중 ${k}번 찾았어요. 주장 문장을 먼저 찾는 연습을 이어 가요.` }
}
