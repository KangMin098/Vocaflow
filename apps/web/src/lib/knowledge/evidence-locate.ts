// apps/web/src/lib/knowledge/evidence-locate.ts
// E축 확인 과제(2026-10-10 · 학습 지도 최종 목표 큰 틀) — 「본문↔선지」 · 「근거 판단」 두 단계의 FIND/CHECK 문항을 골격의 근거 표시에서 만든다(순수).
//
// 과제: 지문에서 **정답을 고르게 하는 근거 문장 하나**를 번호로 고른다(정본 §13 6 Semantic Correspondence).
//   틀리면 그 문장이 매력적인 오답이 비튼 곳(lure 앵커)인지 알려 준다(§13 7 Distortion). 정답 선지 번호는 묻지 않는다 — 근거 판단만 잰다.
// 근거는 **합의 주석**(annotations/evidence-tasks.v1.json)만 쓴다 — 골격 answer 앵커 · 역할 학습자(상위 · 맹검) · 판정자 B(맹검)가 겹친 문장.
//   골격 answer 앵커를 그대로 정답으로 쓰지 않는다: 빈칸 문항에서 앵커가 빈칸 문장 자체를 가리킨 사례가 있었다(2026#32 · 역할 학습자 시뮬레이션에서 발견).
//   함정(lure) 위치는 골격 reject 앵커에서 파생한다(근거 · 갈린 문장 제외). 골격 서명이 주석과 같을 때만 살아 있다.
// 쓸 수 있는 문항만: 합의 주석이 있고 · 유형이 그 과제의 유형 · 문장 4개 이상 · 근거 문장 1–2개.
import { createHash } from 'node:crypto'

import curated from './annotations/evidence-tasks.v1.json'
import { skeletonSig } from './claim-support'

export type EvidenceTaskKey = 'option-restate' | 'evidence-locate'

/** 과제 → 쓸 수 있는 문항 유형. option-restate = 글 전체 핵심을 선지로 재표현(주제 · 제목 · 요지) · evidence-locate = 빈칸 근거 */
export const EVIDENCE_TASK_TYPES: Record<EvidenceTaskKey, readonly string[]> = {
  'option-restate': ['R-TOPIC', 'R-TITLE', 'R-GIST'],
  'evidence-locate': ['R-BLANK'],
}

export const MIN_SENTENCES = 4
export const MAX_EVIDENCE = 2

export interface SkeletonLike {
  id: string
  type_id: string | null
  sentences: { chars: number }[]
  anchors: { id: string; sentences: number[]; from?: string; lure?: boolean }[]
}

export interface EvidenceAnnotation {
  version: string
  key: EvidenceTaskKey
  itemId: string
  skeletonSig: string
  sentenceCount: number
  /** 정답 근거 문장(0부터) — 합의 주석 */
  evidence: number[]
  /** 판정이 갈린 문장 — 골라도 틀리지 않는다(채점 제외) */
  disputed: number[]
  /** 빈칸 문장(evidence-locate) — 근거가 아니다 */
  blank: number | null
  /** 매력적인 오답이 비튼 문장(근거 문장 제외) — 골격 reject 앵커 중 lure */
  lures: number[]
}

export interface CuratedEvidence {
  key: string
  skeletonSig: string
  sentenceCount: number
  blank: number | null
  evidence: number[]
  disputed: number[]
}

export const CURATED: Readonly<Record<string, CuratedEvidence>> = (curated as { items: Record<string, CuratedEvidence> }).items

/** 합의 주석 + 지금 골격 → 과제 주석. 주석이 없거나 · 과제가 다르거나 · 골격 서명이 다르면 null */
export function deriveEvidenceAnnotation(key: EvidenceTaskKey, sk: SkeletonLike | null, table: Readonly<Record<string, CuratedEvidence>> = CURATED): EvidenceAnnotation | null {
  if (!sk || !sk.type_id || !EVIDENCE_TASK_TYPES[key].includes(sk.type_id)) return null
  const c = table[sk.id]
  if (!c || c.key !== key) return null
  const n = sk.sentences.length
  const sig = skeletonSig(sk.sentences.map((s) => s.chars))
  if (n < MIN_SENTENCES || c.sentenceCount !== n || c.skeletonSig !== sig) return null
  const inRange = (s: number) => Number.isInteger(s) && s >= 0 && s < n
  const evidence = [...new Set(c.evidence)].filter(inRange).filter((s) => s !== c.blank).sort((a, b) => a - b)
  if (evidence.length === 0 || evidence.length > MAX_EVIDENCE) return null
  const disputed = [...new Set(c.disputed)].filter(inRange).filter((s) => s !== c.blank && !evidence.includes(s)).sort((a, b) => a - b)
  const lures = [...new Set(sk.anchors.filter((a) => a.id.startsWith('reject:') && a.lure).flatMap((a) => a.sentences))]
    .filter((s) => inRange(s) && !evidence.includes(s) && !disputed.includes(s))
    .sort((a, b) => a - b)
  return { version: `${key}.v1`, key, itemId: sk.id, skeletonSig: sig, sentenceCount: n, evidence, disputed, blank: c.blank, lures }
}

export function evidenceAnnotationHash(a: EvidenceAnnotation): string {
  return createHash('sha256').update(JSON.stringify(a)).digest('hex')
}

export interface EvidenceResponse {
  pick: number
}

export interface EvidenceGrade {
  /** 고른 문장이 근거 문장인가 */
  evidenceOk: boolean
  /** 틀렸을 때 고른 문장이 함정 문장인가(오답 선지가 비튼 곳) */
  lurePicked: boolean
  isCorrect: boolean
}

export function parseEvidenceResponse(raw: unknown, a: EvidenceAnnotation): EvidenceResponse | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (Object.keys(r).length !== 1) return null
  if (!Number.isInteger(r.pick) || (r.pick as number) < 0 || (r.pick as number) >= a.sentenceCount) return null
  return { pick: r.pick as number }
}

export function gradeEvidence(a: EvidenceAnnotation, r: EvidenceResponse): EvidenceGrade {
  const evidenceOk = a.evidence.includes(r.pick) || a.disputed.includes(r.pick)
  return { evidenceOk, lurePicked: !evidenceOk && a.lures.includes(r.pick), isCorrect: evidenceOk }
}

/** 화면이 받는 과제 모양 — 정답 · 함정 위치는 없다(채점은 서버) */
export interface EvidencePanelProps {
  taskKey: EvidenceTaskKey
  sentenceCount: number
}

export function evidencePanelProps(a: EvidenceAnnotation): EvidencePanelProps {
  return { taskKey: a.key, sentenceCount: a.sentenceCount }
}
