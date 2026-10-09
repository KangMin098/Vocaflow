// apps/web/src/lib/knowledge/claim-support.ts
// Phase 3 첫 수직 경로(2026-10-08) — 「주장과 근거 관계」 문항 주석 · 실행 과제 채점(순수).
//
// 주석은 **문장 번호만** 담는다(지문 원문은 평가원 저작물 — 학습자 화면도 문장 지도만 쓴다). 문장 번호는 구운 골격
// (lib/csat/skeleton-data)의 0부터 세는 번호이고, 골격 문장 길이 서명(skeletonSig)에 묶는다 — 골격이 다시 구워져
// 문장 경계가 바뀌면 채점하지 않는다(옛 번호로 채점하면 정답이 조용히 틀어진다).
//
// ⚠️ 이 주석은 **정답 근거 앵커(answer anchor)와 다른 객체**다.
//   정답 근거 앵커 = 이 문항의 정답이 왜 맞는지 설명하는 위치(해설용, csat_item_analyses.answer_locus · 골격 anchors)
//   주장/근거 주석 = 글의 논증 구조(주장 · 뒷받침 · 반박 대상) — 읽기 처리 기제를 연습시키는 과제용
//   같은 문장이 두 역할을 함께 할 수 있다(2022#20 은 주장 문장 = 정답 근거 앵커 문장). 그 겹침은 answerAnchorOverlap 에 적는다.
import { createHash } from 'node:crypto'

// v1 은 이력으로 남긴다(수행 기록의 content_hash 가 가리킬 수 있다) — 채점 · 노출은 v2
import annotation2022 from './annotations/claim-support-2022-20.v2.json'
// 2025#20 — 두 번째 확인 문항(2026-10-08 · Claude · Codex 맹검 합의). 2023#20(정답 앵커 ≠ 합의 주장) · 2024#20(주장 문장 불일치)은 보류
import annotation2025 from './annotations/claim-support-2025-20.v1.json'
// 2026-10-08 확대 — 채택 조건: 두 맹검 판정의 주장 문장이 같고 정답 근거 앵커와 같다. M2509#20 보류(주장 불일치)
import ann_2016_20 from './annotations/claim-support-2016-20.v1.json'
import ann_2020_20 from './annotations/claim-support-2020-20.v1.json'
import ann_2021_20 from './annotations/claim-support-2021-20.v1.json'
import ann_2026_20 from './annotations/claim-support-2026-20.v1.json'
import ann_m2506_20 from './annotations/claim-support-m2506-20.v1.json'
import ann_m2606_20 from './annotations/claim-support-m2606-20.v1.json'
import ann_m2609_20 from './annotations/claim-support-m2609-20.v1.json'
import { RELATIONS, type Relation } from './claim-support-labels'

export { RELATIONS, RELATION_LABEL, type Relation } from './claim-support-labels'

export interface ClaimSupportAnnotation {
  version: string
  itemId: string
  skeletonSig: string
  sentenceCount: number
  /** 0부터 세는 문장 번호 */
  claim: number
  claimRestated: number[]
  support: number[]
  /** 두 판정자가 갈린 문장 — 뒷받침으로 골라도 · 안 골라도 채점하지 않는다 */
  supportDisputed: number[]
  opposed: number[]
  /** 과제 3단계에서 묻는 문장과 그 관계 */
  relationProbe: { sentence: number; relation: Relation }
  answerAnchorOverlap: { answerAnchorSentences: number[]; note: string }
  provenance: {
    annotator: string
    independentReviewer: string
    reviewerBlind: boolean
    agreement: string
    resolved: string
    reviewedAt: string
  }
}

const ANNOTATIONS: Record<string, ClaimSupportAnnotation> = {
  [annotation2022.itemId]: annotation2022 as ClaimSupportAnnotation,
  [annotation2025.itemId]: annotation2025 as ClaimSupportAnnotation,
  [ann_2016_20.itemId]: ann_2016_20 as ClaimSupportAnnotation,
  [ann_2020_20.itemId]: ann_2020_20 as ClaimSupportAnnotation,
  [ann_2021_20.itemId]: ann_2021_20 as ClaimSupportAnnotation,
  [ann_2026_20.itemId]: ann_2026_20 as ClaimSupportAnnotation,
  [ann_m2506_20.itemId]: ann_m2506_20 as ClaimSupportAnnotation,
  [ann_m2606_20.itemId]: ann_m2606_20 as ClaimSupportAnnotation,
  [ann_m2609_20.itemId]: ann_m2609_20 as ClaimSupportAnnotation,
}

export function annotationFor(itemId: string): ClaimSupportAnnotation | null {
  return ANNOTATIONS[itemId] ?? null
}

/** 골격 문장 길이 배열의 서명 — 주석이 묶인 골격과 지금 골격이 같은지 본다 */
export function skeletonSig(sentenceChars: readonly number[]): string {
  return createHash('sha256').update(JSON.stringify(sentenceChars)).digest('hex')
}

/** 주석 내용 해시 — 수행 기록의 content_hash(무엇으로 채점했나) */
export function annotationHash(a: ClaimSupportAnnotation): string {
  return createHash('sha256').update(JSON.stringify(a)).digest('hex')
}

export interface ClaimSupportResponse {
  claim: number
  support: number[]
  relation: Relation
}

export interface ClaimSupportGrade {
  claimOk: boolean
  /** 주장을 다시 말한 문장을 고른 경우 — 틀렸지만 가까운 판단이라 따로 알려 준다 */
  claimRestated: boolean
  supportOk: boolean
  supportMissed: number[]
  supportExtra: number[]
  relationOk: boolean
  isCorrect: boolean
}

export function parseResponse(raw: unknown, a: ClaimSupportAnnotation): ClaimSupportResponse | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const inRange = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) < a.sentenceCount
  if (!inRange(r.claim)) return null
  if (!Array.isArray(r.support) || r.support.length === 0 || r.support.length > a.sentenceCount || !r.support.every(inRange)) return null
  if (new Set(r.support).size !== r.support.length) return null
  if (typeof r.relation !== 'string' || !(RELATIONS as readonly string[]).includes(r.relation)) return null
  return { claim: r.claim, support: [...(r.support as number[])].sort((x, y) => x - y), relation: r.relation as Relation }
}

export function gradeClaimSupport(a: ClaimSupportAnnotation, r: ClaimSupportResponse): ClaimSupportGrade {
  const want = new Set(a.support)
  const got = new Set(r.support)
  const supportMissed = a.support.filter((s) => !got.has(s))
  const supportExtra = r.support.filter((s) => !want.has(s) && !a.supportDisputed.includes(s))
  const claimOk = r.claim === a.claim
  const supportOk = supportMissed.length === 0 && supportExtra.length === 0
  const relationOk = r.relation === a.relationProbe.relation
  return {
    claimOk,
    claimRestated: !claimOk && a.claimRestated.includes(r.claim),
    supportOk,
    supportMissed,
    supportExtra,
    relationOk,
    isCorrect: claimOk && supportOk && relationOk,
  }
}

/** 주석이 있는 문항 id 전부 — 학습 지도 FIND 가 「서로 다른 확인 문항」을 고를 때 쓴다(노출은 여전히 적용 게이트가 정한다) */
export function annotatedItemIds(): string[] {
  return Object.keys(ANNOTATIONS)
}
