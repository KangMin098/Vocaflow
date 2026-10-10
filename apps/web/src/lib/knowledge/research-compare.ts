// apps/web/src/lib/knowledge/research-compare.ts
//
// 작업 4 — 영어 본질 · 원리 연구 비교(2026-10-10). 원리마다 근거를 **종류별로 따로** 세고, 적용 조건 · 충돌하는 설명을 나란히 놓는다.
//   혼동 금지(사용자 규칙): 연구 근거 · 전문가 주장 · 현장(강사) 주장 · 기출 관찰 · 분석자 추론을 한 숫자로 합치지 않는다.
//   이 모듈은 판정하지 않는다 — 「연구로 뒷받침됨」 같은 말은 연구 설계 근거가 실제로 있을 때만 쓰고, 효과(efficacy)는 건드리지 않는다.
// 영역 지도: 8 기능 영역(skill:*) × 층(본질 · 원리 · 방법 · 과제) — 어느 영역에 원리 층이 비었는지 보인다.

export const RESEARCH_LEVELS = ['meta_analysis', 'systematic_review', 'rct', 'quasi_experimental', 'correlational', 'descriptive'] as const
export const DOMAINS = ['skill:reading', 'skill:listening', 'skill:vocabulary', 'skill:grammar', 'skill:writing', 'skill:speaking', 'skill:pronunciation', 'skill:logic'] as const
export const DOMAIN_LABEL: Record<(typeof DOMAINS)[number], string> = {
  'skill:reading': '읽기', 'skill:listening': '듣기', 'skill:vocabulary': '어휘', 'skill:grammar': '문법',
  'skill:writing': '쓰기', 'skill:speaking': '말하기', 'skill:pronunciation': '발음', 'skill:logic': '논리 · 글 구조',
}
const LAYERS = ['essence', 'principle', 'method', 'practice'] as const

export interface RItem {
  id: string
  slug: string
  title: string
  layer: string
  status: string
  skillIds: string[]
}
export interface REvidence {
  itemId: string
  attribution: string | null
  evidenceLevel: string | null
  applicability: string | null
  applicabilityNote: string | null
  researchSourceId: string | null
}
export interface RInquiryLink {
  itemId: string | null
  inquiryId: string
  role: string
}

/** 근거 종류 — 서로 합치지 않는다 */
export interface EvidenceBuckets {
  research: number
  expert: number
  practitioner: number
  exam: number
  inferred: number
  unrated: number
}

export type ResearchStanding =
  /** 연구 설계 근거가 있고 적용 가능성 높음/부분 */
  | 'research_backed'
  /** 지지와 반대 설명이 함께 연결됨 — 비교 검토 필요 */
  | 'contested'
  /** 연구 근거는 있으나 적용 적합성이 낮음 · 미확인 — 「연구 없음」과 구별한다(Codex P2) */
  | 'research_low_fit'
  /** 기출 관찰 · 현장 주장 · 추론뿐 — 연구 근거 없음 */
  | 'observation_only'
  /** 근거 연결 없음 */
  | 'no_evidence'

export interface PrincipleComparison {
  item: RItem
  buckets: EvidenceBuckets
  /** 적용 조건이 적힌 근거(문장) — 조건 없이 일반화하지 않게 */
  conditions: string[]
  applicability: Record<string, number>
  support: number
  counter: number
  uncertain: number
  standing: ResearchStanding
  /** 다음 연구 업무(사람이 할 일) */
  gaps: string[]
}

export function bucketOf(e: REvidence): keyof EvidenceBuckets {
  if (e.evidenceLevel && (RESEARCH_LEVELS as readonly string[]).includes(e.evidenceLevel) && e.researchSourceId) return 'research'
  // 분석자 추론은 근거 수준 표시와 무관하게 추론이다 — 「강사 주장」 · 「기출 관찰」 칸에 섞이면 근거가 실제보다 많아 보인다(Codex P2)
  if (e.attribution === 'inferred') return 'inferred'
  if (e.evidenceLevel === 'expert_opinion') return 'expert'
  if (e.evidenceLevel === 'practitioner_claim') return 'practitioner'
  if (e.evidenceLevel === 'exam_observation') return 'exam'
  if (e.attribution === 'inferred') return 'inferred'
  return 'unrated'
}

export function comparePrinciple(item: RItem, evidence: readonly REvidence[], links: readonly RInquiryLink[]): PrincipleComparison {
  const buckets: EvidenceBuckets = { research: 0, expert: 0, practitioner: 0, exam: 0, inferred: 0, unrated: 0 }
  const applicability: Record<string, number> = {}
  const conditions: string[] = []
  let researchApplicable = 0
  for (const e of evidence) {
    const b = bucketOf(e)
    buckets[b]++
    const a = e.applicability ?? 'unknown'
    applicability[a] = (applicability[a] ?? 0) + 1
    if (e.applicabilityNote?.trim()) conditions.push(e.applicabilityNote.trim())
    if (b === 'research' && (a === 'high' || a === 'partial')) researchApplicable++
  }
  const role = (r: string) => links.filter((l) => l.role === r).length
  const support = role('support') + role('candidate')
  const counter = role('counter')
  const uncertain = role('uncertain')
  const standing: ResearchStanding =
    counter > 0 && (support > 0 || evidence.length > 0) ? 'contested'
      : researchApplicable > 0 ? 'research_backed'
        : buckets.research > 0 ? 'research_low_fit'
        : evidence.length > 0 ? 'observation_only'
          : 'no_evidence'
  const gaps: string[] = []
  if (buckets.research === 0) gaps.push('연구 근거 없음 — 서지(설계 · 대상 · L2 맥락) 등록 후 연결')
  if (evidence.length > 0 && conditions.length === 0) gaps.push('적용 조건 미기록 — 누구에게 · 어떤 문항에서 통하는지 적기')
  if (counter === 0) gaps.push('반대 · 대안 설명 미검토 — 탐구 질문에 반례 연결')
  if (buckets.inferred > 0 && buckets.research + buckets.exam === 0) gaps.push('분석자 추론만 — 관찰 · 연구로 확인 필요')
  return { item, buckets, conditions, applicability, support, counter, uncertain, standing, gaps }
}

export interface DomainCell {
  total: number
  adopted: number
}
export type DomainMatrix = Record<string, Record<string, DomainCell>>

/** 영역 × 층 — 채택(adopted · applied) 수와 전체 수 */
export function domainMatrix(items: readonly RItem[]): DomainMatrix {
  const m: DomainMatrix = {}
  for (const d of DOMAINS) {
    m[d] = {}
    for (const l of LAYERS) m[d][l] = { total: 0, adopted: 0 }
  }
  for (const it of items) {
    if (!(LAYERS as readonly string[]).includes(it.layer)) continue
    for (const s of it.skillIds) {
      if (!m[s]) continue
      m[s][it.layer].total++
      if (it.status === 'adopted' || it.status === 'applied') m[s][it.layer].adopted++
    }
  }
  return m
}

/** 원리 층이 비어 있는 영역 — 영어 전 영역 확장에서 먼저 볼 곳 */
export function principleGaps(m: DomainMatrix): string[] {
  return DOMAINS.filter((d) => m[d].principle.total === 0)
}
