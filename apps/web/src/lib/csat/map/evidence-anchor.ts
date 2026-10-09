// apps/web/src/lib/csat/map/evidence-anchor.ts
// 계약 B — Evidence Anchor(순수 · DB 없음 · 2026-10-09 PROPOSED · docs/csat-learner/MAP_CONTRACTS_ABC.md §B).
// 정본 LEARNING_MAP_VNEXT §17-2–17-3: 원문 정체성 · 유일 좌표 · 후보 → 검증 → 사람 확인. 경계(길이 · 단위 경계) 해시만으로 원문 검증을 인정하지 않는다.
// 문장 단위 근거는 「위치 + 문장 텍스트 해시」로 묶는다 — 길이만 같은 다른 문장은 같은 근거가 아니다.
import { createHash } from 'node:crypto'

/** 정규화 규칙 버전 — 규칙이 바뀌면 올리고, 모든 앵커가 재검증 대상이 된다 */
export const NORMALIZATION_VERSION = 'anchor-norm-1'

export type AnchorType = 'passage' | 'stem' | 'option' | 'underline' | 'blank' | 'given_sentence'
export type EvidenceType = 'answer_anchor' | 'task_annotation' | 'student_evidence' | 'human_tag'
export type ValidationStatus = 'legacy_candidate' | 'validated_anchor' | 'reviewed_anchor'

export interface EvidenceAnchor {
  sourceId: string
  itemId: string
  /** 원문 정체성 — 이 앵커가 기준으로 삼은 본문 버전 */
  sourceRevision: string
  /** 정규화 본문 sha256 — 없으면 원문 검증이 아니다(boundary_only) */
  sourceTextHash: string | null
  normalizationVersion: string
  segmentationVersion: string
  anchorType: AnchorType
  evidenceType: EvidenceType
  /** 문장 단위 좌표 — 위치와 그 문장 텍스트 해시를 함께 */
  unit: { index: number; textHash: string } | null
  validationStatus: ValidationStatus
  /** 이 앵커를 쓰는 판정 · 채점의 revision — 원문이 바뀌면 다시 계산 대상 */
  judgmentRevision: string
}

/** 정규화 v1: NFC · 줄바꿈 · 연속 공백 → 공백 1 · 앞뒤 공백 제거 · 따옴표 통일. 대소문자 · 구두점은 유지 */
export function normalizeText(s: string): string {
  return s
    .normalize('NFC')
    .replace(/[‘’‛′]/g, "'")
    .replace(/[“”‟″]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

export function textHash(s: string): string {
  return createHash('sha256').update(normalizeText(s)).digest('hex')
}

/** 본문(문장 배열) 해시 — 문장 경계와 텍스트를 함께 묶는다 */
export function sourceHash(sentences: readonly string[]): string {
  return createHash('sha256').update(JSON.stringify(sentences.map(normalizeText))).digest('hex')
}

export interface SourceSnapshot {
  sourceRevision: string
  segmentationVersion: string
  sentences: readonly string[]
}

/** 지금 본문에서 문장 앵커를 만든다(후보 — 승격은 사람 · 검증 단계의 몫) */
export function anchorSentence(
  base: Omit<EvidenceAnchor, 'sourceRevision' | 'sourceTextHash' | 'normalizationVersion' | 'segmentationVersion' | 'unit' | 'validationStatus'>,
  src: SourceSnapshot,
  index: number,
): EvidenceAnchor {
  const sentence = src.sentences[index]
  if (sentence === undefined) throw new Error(`문장 ${index} 이 본문에 없다`)
  return {
    ...base,
    sourceRevision: src.sourceRevision,
    sourceTextHash: sourceHash(src.sentences),
    normalizationVersion: NORMALIZATION_VERSION,
    segmentationVersion: src.segmentationVersion,
    unit: { index, textHash: textHash(sentence) },
    validationStatus: 'legacy_candidate',
  }
}

export type AnchorCheck =
  | { status: 'valid' }
  | { status: 'relocated'; index: number }
  | { status: 'ambiguous'; indexes: number[] }
  | { status: 'stale'; reason: 'text_missing' | 'segmentation_changed' | 'normalization_changed' }
  | { status: 'boundary_only' }

/**
 * 앵커를 지금 본문에 대조한다(계약 B-3). 자동 승격은 하지 않는다 — relocated 도 재검토 대상이다.
 * - 원문 해시가 없으면 경계만 같은 것 → boundary_only(legacy_candidate 유지)
 * - 정규화 · 분할 버전이 다르면 stale
 * - 같은 위치 · 같은 텍스트 해시 · 그 텍스트가 본문에 한 번만 → valid
 * - 위치는 바뀌었지만 같은 텍스트가 정확히 한 곳 → relocated · 둘 이상 → ambiguous · 없음 → stale
 */
export function checkAnchor(a: EvidenceAnchor, src: SourceSnapshot): AnchorCheck {
  if (!a.sourceTextHash || !a.unit) return { status: 'boundary_only' }
  if (a.normalizationVersion !== NORMALIZATION_VERSION) return { status: 'stale', reason: 'normalization_changed' }
  if (a.segmentationVersion !== src.segmentationVersion) return { status: 'stale', reason: 'segmentation_changed' }
  const hashes = src.sentences.map(textHash)
  const hits = hashes.flatMap((h, i) => (h === a.unit!.textHash ? [i] : []))
  if (hits.length === 0) return { status: 'stale', reason: 'text_missing' }
  if (hits.length > 1) return { status: 'ambiguous', indexes: hits }
  if (hits[0] === a.unit.index) return { status: 'valid' }
  return { status: 'relocated', index: hits[0] }
}

/** 판정 · 채점이 이 앵커를 지금 써도 되나 — valid 이고 validated 이상일 때만(학생 진단 표시는 reviewed 부터 — 호출자가 고른다) */
export function usableForItemEvidence(a: EvidenceAnchor, src: SourceSnapshot): boolean {
  return checkAnchor(a, src).status === 'valid' && a.validationStatus !== 'legacy_candidate'
}
