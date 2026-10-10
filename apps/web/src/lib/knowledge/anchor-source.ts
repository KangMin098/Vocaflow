// apps/web/src/lib/knowledge/anchor-source.ts
// 과제 주석의 원문 결속 판정(계약 B · MC-06 · 2026-10-10) — 순수. 주석에 적힌 원문 해시 · 문장 텍스트 해시를 **지금 원문**에 대조한다.
// 결과가 valid 가 아니면 그 문항의 확인 과제를 닫는다(채점 · 기록 · 지도 링크 모두). 자동 승격 · 자동 재배치는 없다 — 재검토(anchor-bind 재실행 + 사람 확인)의 몫.
// 원문이 같다는 것은 「근거 위치가 맞다」 는 뜻일 뿐이다. 학생의 원인 판정(직접 확인)을 확정하는 근거가 아니다.
import { createHash } from 'node:crypto'

import { checkAnchor, type AnchorCheck, type EvidenceAnchor, type SourceSnapshot } from '@/lib/csat/map/evidence-anchor'
import { splitSentences } from '@/lib/csat/passage-skeleton'

/** 문장 분할 규칙 버전(passage-skeleton splitSentences) — 분할기가 바뀌면 올리고 모든 결속이 stale 이 된다 */
export const SEGMENTATION_VERSION = 'passage-skeleton-split-1'

export interface BoundUnit {
  index: number
  textHash: string
  charRange: { start: number; end: number }
}

export interface AnchorBinding {
  source?: { revision: string; textHash: string; normalization: string; segmentation: string }
  anchors?: { evidence: BoundUnit[]; disputed: BoundUnit[] }
  evidence: number[]
  disputed: number[]
}

/** 원문 revision = 원문 그대로의 sha256(anchor-bind 와 같은 계산) */
export function passageRevision(passage: string): string {
  return createHash('sha256').update(passage).digest('hex')
}

export function snapshotOf(passage: string, revision: string): SourceSnapshot {
  const ranges = splitSentences(passage)
  return { sourceRevision: revision, segmentationVersion: SEGMENTATION_VERSION, sentences: ranges.map((r) => passage.slice(r.start, r.end)) }
}

export type BindingCheck =
  | { ok: true }
  | { ok: false; reason: 'unbound' | 'index_mismatch' | 'char_range_changed'; detail?: string }
  | { ok: false; reason: 'anchor'; status: AnchorCheck['status']; index: number }

/**
 * 근거 · 갈린 문장 앵커가 모두 지금 원문에서 valid 인가. 하나라도 아니면 닫는다.
 * - 결속이 없으면(unbound) 닫는다 — 경계 서명만으로는 원문 검증이 아니다(boundary_only)
 * - 주석의 문장 번호와 앵커 번호가 다르면 닫는다(주석이 바뀌었는데 재결속하지 않음)
 * - 문자 범위가 지금 분할과 다르면 닫는다(같은 문장 · 다른 위치)
 */
export function checkBinding(b: AnchorBinding, itemId: string, passage: string, revision: string): BindingCheck {
  if (!b.source || !b.anchors) return { ok: false, reason: 'unbound' }
  const same = (xs: number[], us: BoundUnit[]) => xs.length === us.length && xs.every((x, i) => us[i].index === x)
  if (!same(b.evidence, b.anchors.evidence) || !same(b.disputed, b.anchors.disputed)) return { ok: false, reason: 'index_mismatch' }
  const src = snapshotOf(passage, revision)
  const ranges = splitSentences(passage)
  for (const u of [...b.anchors.evidence, ...b.anchors.disputed]) {
    const a: EvidenceAnchor = {
      sourceId: itemId, itemId, sourceRevision: b.source.revision, sourceTextHash: b.source.textHash,
      normalizationVersion: b.source.normalization, segmentationVersion: b.source.segmentation,
      anchorType: 'passage', evidenceType: 'task_annotation', unit: { index: u.index, textHash: u.textHash },
      charRange: u.charRange, validationStatus: 'validated_anchor', judgmentRevision: 'evidence-tasks.v1',
    }
    const c = checkAnchor(a, src)
    if (c.status !== 'valid') return { ok: false, reason: 'anchor', status: c.status, index: u.index }
    const r = ranges[u.index]
    if (!r || r.start !== u.charRange.start || r.end !== u.charRange.end) return { ok: false, reason: 'char_range_changed', detail: `${u.index}` }
  }
  return { ok: true }
}
