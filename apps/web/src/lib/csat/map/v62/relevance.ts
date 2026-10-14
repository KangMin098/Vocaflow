// apps/web/src/lib/csat/map/v62/relevance.ts
//
// v6.2 §3(관계 데이터 최소 계약) · §6.2 — 기출 문항 ↔ TASK 관련성.
//   relevance = 검토된 값만(direct · indirect · not_applicable · unknown). 기본값은 unknown.
//   candidate_relevance = AI · 자동 후보(연구 v1.2 의 6,310 등) — **별도 필드**. relevance 로 자동 복사하지 않는다.
//   누락 = unknown(not_applicable 로 해석 금지). G2 의 직접 · 간접성은 학생 숙달 · 결손과 무관하다.
// 지금 제품에 검토된 문항↔TASK 링크는 0건이다(연구 46건은 R1 · AI 원문 결속 검토 — 인간 검수 아님, 제품 승격 전).
// 기존 라인 매핑(라인 → 문항 · 라인 → TASK)은 **라인 수준 연결**이라 문항 단위 검토 링크가 아니다 → source 'legacy_line', tier R0.

export type Relevance = 'direct' | 'indirect' | 'not_applicable' | 'unknown'
export type EvidenceTier = 'R0' | 'R1' | 'R2' | 'R3' | 'R4' | 'R5'
export type LinkSource = 'legacy_line' | 'research_ai_candidate' | 'research_ai_reviewed' | 'human_review'

export interface TaskItemLink {
  task: string
  /** 문항 id(<examId>-<no> 등) */
  item: string
  /** 검토된 관련성 — 사람 검수(human_review)만 unknown 아닌 값을 쓸 수 있다 */
  relevance: Relevance
  /** 자동 후보 — 검토 대기열 선정용. 목표 중요도 · 개인 약점 계산에 쓰지 않는다 */
  candidateRelevance: Exclude<Relevance, 'not_applicable'> | null
  source: LinkSource
  tier: EvidenceTier
  analysisVersion: string | null
}

/** 링크를 만들 때 검토 안 된 출처가 relevance 를 정하지 못하게 한다(가드) */
export function makeLink(input: Omit<TaskItemLink, 'relevance' | 'tier'> & { relevance?: Relevance; tier?: EvidenceTier }): TaskItemLink {
  const reviewed = input.source === 'human_review'
  if (!reviewed && input.relevance && input.relevance !== 'unknown') {
    throw new Error(`검토되지 않은 출처(${input.source})는 relevance 를 정할 수 없다 — candidateRelevance 에만 둔다`)
  }
  const tier: EvidenceTier = input.tier ?? (input.source === 'human_review' ? 'R2' : input.source === 'research_ai_reviewed' ? 'R1' : 'R0')
  if (!reviewed && (tier === 'R2' || tier === 'R3' || tier === 'R4' || tier === 'R5')) throw new Error(`검토되지 않은 출처(${input.source})를 ${tier} 로 올릴 수 없다`)
  return { task: input.task, item: input.item, relevance: reviewed ? input.relevance ?? 'unknown' : 'unknown', candidateRelevance: input.candidateRelevance, source: input.source, tier, analysisVersion: input.analysisVersion }
}

/** 문항 × TASK 조합 하나의 관련성 — 링크가 없으면 unknown(무관 아님) */
export function relevanceOf(links: readonly TaskItemLink[], task: string, item: string): Relevance {
  return links.find((l) => l.task === task && l.item === item)?.relevance ?? 'unknown'
}

export interface RelevanceCounts {
  /** 조합 분모(문항 수 × TASK 수) */
  pairs: number
  reviewed: { direct: number; indirect: number; not_applicable: number }
  unknown: number
  /** 자동 후보(검토 전) — reviewed 와 섞지 않는다 */
  candidates: { direct: number; indirect: number }
}

/** 조합 분모와 검토 · 후보 수 — 후보는 reviewed 에 더하지 않는다(v6.2 §1.2 · §12.3) */
export function relevanceCounts(links: readonly TaskItemLink[], items: number, taskCount: number): RelevanceCounts {
  const reviewed = { direct: 0, indirect: 0, not_applicable: 0 }
  const candidates = { direct: 0, indirect: 0 }
  const seen = new Set<string>()
  for (const l of links) {
    const k = `${l.task}|${l.item}`
    if (seen.has(k)) continue
    seen.add(k)
    if (l.relevance !== 'unknown') reviewed[l.relevance]++
    if (l.candidateRelevance === 'direct' || l.candidateRelevance === 'indirect') candidates[l.candidateRelevance]++
  }
  const pairs = items * taskCount
  return { pairs, reviewed, unknown: pairs - reviewed.direct - reviewed.indirect - reviewed.not_applicable, candidates }
}
