// apps/web/src/lib/knowledge/item-tasks.ts
// 문항 확인 과제 레지스트리(2026-10-08 · 두 번째 수직 경로에서 일반화) — 과제 종류마다 주석 · 입력 검증 · 채점 · 화면 모양 · 학습자 문구.
// 게이트(product-server) · 기록 API · 지도 링크 · 관리자 추적은 이 레지스트리만 본다 — 과제를 더할 때 여기 한 줄 + 주석 파일 + 화면 칸.
// 한 문항에는 과제 하나(주석이 있는 첫 과제). 주석은 골격 서명이 지금 골격과 같을 때만 살아 있다.
import 'server-only'

import { loadItemSkeleton } from '@/lib/csat/skeleton'

import { annotationFor as claimAnnotationFor, annotationHash as claimHash, gradeClaimSupport, parseResponse as parseClaim, skeletonSig } from './claim-support'
import { CLAIM_SUPPORT_LEARNER } from './claim-support-labels'
import { cohesionAnnotationFor, cohesionAnnotationHash, cohesionPanelProps, gradeCohesion, parseCohesionResponse } from './cohesion-link'
import { COHESION_LINK_LEARNER } from './cohesion-link-labels'
import { deriveEvidenceAnnotation, evidenceAnnotationHash, evidencePanelProps, gradeEvidence, parseEvidenceResponse, type EvidenceTaskKey } from './evidence-locate'
import { EVIDENCE_LOCATE_LEARNER, OPTION_RESTATE_LEARNER } from './evidence-locate-labels'

export interface ItemTaskAnnotation {
  version: string
  itemId: string
  skeletonSig: string
  sentenceCount: number
}

export interface ItemTaskDef {
  key: string
  learner: { title: string; why: string }
  annotationFor(itemId: string): ItemTaskAnnotation | null
  hash(a: ItemTaskAnnotation): string
  /** 화면이 받는 과제 모양(정답 없음) */
  panel(a: ItemTaskAnnotation): Record<string, unknown>
  /** 입력 검증 + 채점. 잘못된 입력이면 null */
  grade(a: ItemTaskAnnotation, raw: unknown): { response: unknown; grade: Record<string, unknown> & { isCorrect: boolean }; summary: Record<string, boolean> } | null
}

/* eslint-disable @typescript-eslint/no-explicit-any -- 레지스트리는 과제마다 주석 모양이 다르다. 각 과제 모듈이 자기 타입으로 검증한다 */
export const ITEM_TASKS: readonly ItemTaskDef[] = [
  {
    key: 'claim-support',
    learner: CLAIM_SUPPORT_LEARNER,
    annotationFor: claimAnnotationFor,
    hash: (a) => claimHash(a as any),
    panel: (a: any) => ({ sentenceCount: a.sentenceCount, relationSentence: a.relationProbe.sentence }),
    grade: (a: any, raw) => {
      const r = parseClaim(raw, a)
      if (!r) return null
      const g = gradeClaimSupport(a, r)
      return { response: r, grade: g as any, summary: { claim: g.claimOk, support: g.supportOk, relation: g.relationOk } }
    },
  },
  {
    key: 'cohesion-link',
    learner: COHESION_LINK_LEARNER,
    annotationFor: cohesionAnnotationFor,
    hash: (a) => cohesionAnnotationHash(a as any),
    panel: (a: any) => cohesionPanelProps(a) as any,
    grade: (a: any, raw) => {
      const r = parseCohesionResponse(raw, a)
      if (!r) return null
      const g = gradeCohesion(a, r)
      return { response: r, grade: g as any, summary: { ...g.probes, order: g.orderOk } }
    },
  },
  // E축(2026-10-10) — 주석은 골격 근거 표시에서 파생(손 주석 없음). 위 두 과제보다 뒤 — 한 문항에 손 주석 과제가 있으면 그쪽이 먼저다
  ...(['option-restate', 'evidence-locate'] as const).map((key: EvidenceTaskKey): ItemTaskDef => ({
    key,
    learner: key === 'option-restate' ? OPTION_RESTATE_LEARNER : EVIDENCE_LOCATE_LEARNER,
    annotationFor: (itemId) => deriveEvidenceAnnotation(key, loadItemSkeleton(itemId)),
    hash: (a) => evidenceAnnotationHash(a as any),
    panel: (a: any) => evidencePanelProps(a) as any,
    grade: (a: any, raw) => {
      const r = parseEvidenceResponse(raw, a)
      if (!r) return null
      const g = gradeEvidence(a, r)
      return { response: r, grade: g as any, summary: { evidence: g.evidenceOk, lure: g.lurePicked } }
    },
  })),
]
/* eslint-enable @typescript-eslint/no-explicit-any */

export function taskByKey(key: string): ItemTaskDef | null {
  return ITEM_TASKS.find((t) => t.key === key) ?? null
}

/** 이 문항의 살아 있는 과제(주석 있음 · 골격 서명 같음). 없으면 null */
export function currentItemTask(itemId: string): { def: ItemTaskDef; ann: ItemTaskAnnotation } | null {
  const sk = loadItemSkeleton(itemId)
  if (!sk) return null
  const sig = skeletonSig(sk.sentences.map((s) => s.chars))
  for (const def of ITEM_TASKS) {
    const ann = def.annotationFor(itemId)
    if (ann && ann.skeletonSig === sig && ann.sentenceCount === sk.sentences.length) return { def, ann }
  }
  return null
}
