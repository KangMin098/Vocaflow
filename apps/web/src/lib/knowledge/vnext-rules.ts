// apps/web/src/lib/knowledge/vnext-rules.ts
//
// 학습 원리 vNext 순수 규칙(2026-10-08) — 운영실 요약 · 병목 · 우선 처리 큐 · 관계 지도 · 입력 검증. DB · 시계 없음(시각은 인자).
// 정본 docs/methodology/VNEXT_ARCHITECTURE.md §1–§5.
import type { ItemStatus, Layer } from './labels'
import {
  APP_TRANSITIONS, KIND_ORDER, STRONG_LEVELS, isResearchDesign, kindFitsLayer,
  type AppStatus, type Applicability, type EvidenceLevel, type InquiryStatus, type Kind, type TrialStatus,
} from './vnext-labels'

export interface OpsItem { id: string; slug: string; title: string; layer: Layer; kind: Kind | null; status: ItemStatus; efficacy: string }
export interface OpsEvidence { itemId: string; sourceType: string; evidenceLevel: EvidenceLevel; applicability: Applicability }
export interface OpsInquiry { id: string; slug: string; question: string; status: InquiryStatus; links: number }
export interface OpsApplication { id: string; itemId: string; status: AppStatus; surfaceRef: string; statusReason: string | null; trials: TrialEvidenceInput[] }

// ── trial 근거 상태(T-0085) ───────────────────────────────────────────────────
/**
 * 기존 Trial DTO 의 세 필드만 읽는다(재분석 · 결과 기록 · DB 없음).
 *   current   명시 비합성 · status=analyzed · 현재 reviewRequiredAt=null — **설명적 분석 완료**일 뿐, 효과 지지 · 실제 참가자 확인이 아니다
 *   stale     reviewRequiredAt 있음 — 표본이 바뀌어 재계산 전까지 결과를 근거로 쓰지 않는다(F7)
 *   synthetic 명시 합성
 *   pending   명시 비합성 · 현재 · 아직 analyzed 아님(계획 · 진행)
 *   unknown   synthetic · reviewRequiredAt 가 명시 값이 아니다(누락 · null 합성 표지 · 잘못된 값) — 합성도 실제 0 도 추정하지 않는다
 * 「비합성」은 trial 메타 표시일 뿐이다 — 계정 cohort(account-cohort)로 확인된 실제 학습자가 아니다.
 */
export interface TrialEvidenceInput { status?: TrialStatus | string | null; synthetic?: boolean | null; reviewRequiredAt?: string | null }
export type TrialEvidenceState = 'current' | 'stale' | 'synthetic' | 'pending' | 'unknown'

export function trialEvidenceState(t: TrialEvidenceInput): TrialEvidenceState {
  if (t.synthetic === true) return 'synthetic'
  if (t.synthetic !== false) return 'unknown'
  if (typeof t.reviewRequiredAt === 'string' && t.reviewRequiredAt.length > 0) return 'stale'
  if (t.reviewRequiredAt !== null) return 'unknown'
  return t.status === 'analyzed' ? 'current' : 'pending'
}

export const TRIAL_EVIDENCE_LABEL: Record<TrialEvidenceState, string> = {
  current: '현재 분석 완료(비합성 표시) — 효과 입증 · 실제 참가자 확인 아님',
  stale: '재계산 필요 — 결과를 근거로 쓰지 않음',
  synthetic: '합성',
  pending: '분석 전(비합성 표시 계획 · 진행)',
  unknown: '확인 불가(합성 · 재계산 표지 미확인)',
}

/** trial 출처 표시 — 메타 그대로(비합성 ≠ 실제 참가자). 화면 3곳(설계 · 적용 목록 · 적용 추적)이 같이 쓴다 */
export function trialOriginLabel(t: Pick<TrialEvidenceInput, 'synthetic'>): string {
  return t.synthetic === true ? '합성' : t.synthetic === false ? '비합성 표시' : '합성 여부 미상'
}

export function trialEvidenceCounts(trials: readonly TrialEvidenceInput[]): Record<TrialEvidenceState, number> {
  const out: Record<TrialEvidenceState, number> = { current: 0, stale: 0, synthetic: 0, pending: 0, unknown: 0 }
  for (const t of trials) out[trialEvidenceState(t)] += 1
  return out
}

/** 순환의 단계 — 탐구 → 근거 → 채택 → 적용 → 검증 */
export interface Stage { key: 'inquiry' | 'evidence' | 'adoption' | 'application' | 'verification'; label: string; value: number; of: number | null; href: string; note: string }
export interface QueueEntry { severity: 1 | 2 | 3; title: string; detail: string; href: string }

export function opsSummary(input: { items: OpsItem[]; evidence: OpsEvidence[]; inquiries: OpsInquiry[]; applications: OpsApplication[]; openGaps: number }) {
  const { items, evidence, inquiries, applications } = input
  const byItem = new Map<string, OpsEvidence[]>()
  for (const e of evidence) byItem.set(e.itemId, [...(byItem.get(e.itemId) ?? []), e])
  const upper = items.filter((i) => i.layer !== 'practice')
  const upperWithEvidence = upper.filter((i) => (byItem.get(i.id)?.length ?? 0) > 0).length
  const research = evidence.filter((e) => e.sourceType === 'research').length
  const strong = evidence.filter((e) => STRONG_LEVELS.includes(e.evidenceLevel) && (e.applicability === 'high' || e.applicability === 'partial')).length
  const practitioner = evidence.filter((e) => e.evidenceLevel === 'practitioner_claim').length
  const adopted = items.filter((i) => i.status === 'adopted' || i.status === 'applied').length
  const waiting = items.filter((i) => i.status === 'extracted' || i.status === 'in_review').length
  const active = applications.filter((a) => a.status === 'active').length
  // 효과 검증 단계 = 현재 분석 완료(명시 비합성 · analyzed · 재계산 필요 아님)만 — 결과 종류와 무관하게 「분석 건수」이지 효과 지지 수가 아니다
  const tc = trialEvidenceCounts(applications.flatMap((a) => a.trials))
  const currentAnalyzed = tc.current
  const openInq = inquiries.filter((q) => q.status === 'open' || q.status === 'investigating').length
  const unclassified = items.filter((i) => i.kind === null).length

  const stages: Stage[] = [
    { key: 'inquiry', label: '탐구 질문', value: openInq, of: inquiries.length, href: '/admin/knowledge/lab', note: '열림 · 조사 중 / 전체' },
    { key: 'evidence', label: '근거', value: research, of: evidence.length, href: '/admin/knowledge/lab/research', note: `연구 근거 / 전체(실무자 주장 ${practitioner} · 효과 판단 가능 ${strong})` },
    { key: 'adoption', label: '채택', value: adopted, of: items.length, href: '/admin/knowledge/review', note: `채택 · 적용 / 전체(검토 대기 ${waiting})` },
    { key: 'application', label: '제품 적용', value: active, of: applications.length, href: '/admin/knowledge/product', note: '학습자에게 나간 적용 / 전체 적용' },
    { key: 'verification', label: '효과 검증', value: currentAnalyzed, of: null, href: '/admin/knowledge/design', note: `현재 분석 완료(비합성 표시 · 효과 입증 아님) · 재계산 필요 ${tc.stale} · 합성 ${tc.synthetic} · 확인 불가 ${tc.unknown} 제외` },
  ]

  const queue: QueueEntry[] = []
  const paused = applications.filter((a) => a.status === 'paused' && (a.statusReason ?? '').includes('자동 중단'))
  for (const a of paused) queue.push({ severity: 1, title: `자동 중단된 적용 — ${a.surfaceRef}`, detail: a.statusReason ?? '', href: '/admin/knowledge/product' })
  const activeNoReal = applications.filter((a) => a.status === 'active' && !a.trials.some((t) => t.synthetic === false))
  for (const a of activeNoReal) queue.push({ severity: 2, title: `비합성 검증 계획 없는 적용 — ${a.surfaceRef}`, detail: '명시 비합성 trial 이 없다(합성 · 확인 불가만) — 효과를 말할 수 없다', href: '/admin/knowledge/design' })
  const staleApps = applications.filter((a) => a.trials.some((t) => trialEvidenceState(t) === 'stale'))
  for (const a of staleApps) queue.push({ severity: 2, title: `재계산 필요한 분석 — ${a.surfaceRef}`, detail: '표본이 바뀌었다 — 재계산 전까지 결과를 근거로 쓰지 않는다', href: '/admin/knowledge/design' })
  if (upper.length > 0 && upperWithEvidence === 0) {
    queue.push({ severity: 1, title: '역량 · 기제 · 방법에 근거가 하나도 없다', detail: `위층 ${upper.length}개 근거 0 — 규칙상 채택할 수 없다. 탐구 질문에서 연구 근거부터`, href: '/admin/knowledge/lab' })
  }
  if (research === 0) queue.push({ severity: 2, title: '연구 근거 0', detail: `근거 ${evidence.length}개가 모두 연구 밖(실무자 주장 ${practitioner}) — 효과 수준을 판단할 근거가 없다`, href: '/admin/knowledge/lab/research' })
  if (unclassified > 0) queue.push({ severity: 3, title: `종류 미분류 ${unclassified}개`, detail: '역량 vs 묶음 · 처리 vs 학습 기제를 정한다', href: '/admin/knowledge/map' })
  if (openInq === 0) queue.push({ severity: 2, title: '열린 탐구 질문 0', detail: '수집이 질문을 따라가지 않는다 — 첫 질문을 연다', href: '/admin/knowledge/lab' })
  if (waiting > 0) queue.push({ severity: 3, title: `검토 대기 ${waiting}개`, detail: '두 모델 독립 판정 + 합성 규칙으로 채택 · 반려', href: '/admin/knowledge/review' })
  if (input.openGaps > 0) queue.push({ severity: 3, title: `열린 공백 ${input.openGaps}개`, detail: '모르는 것 — 다음 행동이 적혀 있다', href: '/admin/knowledge/gaps' })
  queue.sort((a, b) => a.severity - b.severity)

  // 병목 = 앞 단계는 있는데 다음 단계가 0 인 첫 자리
  const chain: [Stage['key'], number][] = [['inquiry', inquiries.length], ['evidence', research], ['adoption', adopted], ['application', active], ['verification', currentAnalyzed]]
  const zero = chain.findIndex(([, v]) => v === 0)
  const bottleneck = zero < 0 ? null : chain[zero][0]
  return { stages, queue, bottleneck }
}

// ── 관계 지도 ─────────────────────────────────────────────────────────────────
export interface GraphItem { id: string; slug: string; title: string; kind: Kind | null; layer: Layer; status: ItemStatus; skillIds: string[] }
export interface GraphLink { fromId: string; toId: string; kind: string }
export interface GraphLane { kind: Kind | 'unclassified'; items: GraphItem[] }

/** 종류별 열(역량 → 처리 기제 → 학습 기제 → 방법 → 과제 → 묶음) · 영역 필터 · 노드 주변 */
export function kindLanes(items: GraphItem[], skill: string | null): GraphLane[] {
  const pick = skill ? items.filter((i) => i.skillIds.includes(skill)) : items
  const lanes: GraphLane[] = KIND_ORDER.map((k) => ({ kind: k, items: pick.filter((i) => i.kind === k) }))
  const none = pick.filter((i) => i.kind === null)
  if (none.length) lanes.push({ kind: 'unclassified', items: none })
  return lanes.map((l) => ({ ...l, items: [...l.items].sort((a, b) => a.title.localeCompare(b.title, 'ko')) }))
}

/** 노드 하나의 주변 — 위로(이 항목이 구현하는 것) · 아래로(이 항목을 구현하는 것) · 옆(그 밖 관계) */
export function neighborhood(id: string, links: GraphLink[]) {
  return {
    up: links.filter((l) => l.fromId === id && l.kind === 'implements').map((l) => l.toId),
    down: links.filter((l) => l.toId === id && l.kind === 'implements').map((l) => l.fromId),
    side: links.filter((l) => l.kind !== 'implements' && (l.fromId === id || l.toId === id)).map((l) => ({ id: l.fromId === id ? l.toId : l.fromId, kind: l.kind })),
  }
}

// ── 입력 검증(서버 액션이 쓴다 — DB 제약 앞에서 사람 말로 막는다) ──────────────────────
const SLUG = /^[a-z0-9][a-z0-9-]{1,80}$/
export function checkInquiry(i: { slug: string; question: string }): string | null {
  if (!SLUG.test(i.slug)) return 'slug 는 영소문자 · 숫자 · 하이픈(2–81자)'
  if (i.question.trim().length < 5 || i.question.length > 500) return '질문은 5–500자'
  return null
}
export function checkResearchSource(r: { citation: string; doi: string | null; url: string | null; design: string; year: number | null }): string | null {
  if (r.citation.trim().length < 5 || r.citation.length > 600) return '인용은 5–600자'
  if (r.doi && !/^10\.\d{4,9}\/\S+$/.test(r.doi)) return 'DOI 형식(10.xxxx/…)이 아니다'
  if (r.url && !r.url.startsWith('https://')) return 'URL 은 https:// 로'
  if (!isResearchDesign(r.design)) return '연구 설계를 고른다'
  if (r.year !== null && (r.year < 1900 || r.year > 2100)) return '연도 범위'
  return null
}
export function checkAppTransition(from: AppStatus, to: AppStatus, reason: string): string | null {
  if (!APP_TRANSITIONS[from].includes(to)) return `${from} → ${to} 은 허용되지 않는다`
  if ((to === 'paused' || to === 'rolled_back') && reason.trim().length === 0) return '중단 · 롤백에는 이유가 필요하다'
  // B7 — 켜기는 학습자 출시 승인이다. 채택만으로는 켜지 않는다(DB 가드 20261008144206 이 같은 규칙을 강제)
  if (to === 'active' && reason.trim().length === 0) return '학습자에게 켜려면 출시 승인 사유가 필요하다 — 채택은 출시 승인이 아니다'
  return null
}
/** 검증 프로토콜 — 사전 · 사후는 필수, 지연 · 전이 · 비교 조건은 명시(없으면 「관찰된 변화」로만 보고) */
export interface TrialDesign { pre: boolean; post: boolean; delayedDays: number | null; transfer: boolean; comparison: string | null; minN: number; measures: string[] }
export function checkTrialDesign(d: TrialDesign): string | null {
  if (!d.pre || !d.post) return '사전 · 사후 평가는 필수'
  if (d.delayedDays !== null && (d.delayedDays < 1 || d.delayedDays > 180)) return '지연 평가는 1–180일'
  if (!Number.isInteger(d.minN) || d.minN < 1 || d.minN > 100000) return '최소 표본은 1 이상 정수'
  if (d.measures.length === 0) return '측정 지표를 하나 이상'
  return null
}
export const trialReportLevel = (d: TrialDesign) => (d.comparison ? '비교 조건 있음 — 효과 판단 후보' : '비교 조건 없음 — 「관찰된 변화」로만 보고')
export { kindFitsLayer }
