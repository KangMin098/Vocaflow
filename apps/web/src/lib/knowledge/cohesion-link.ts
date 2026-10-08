// apps/web/src/lib/knowledge/cohesion-link.ts
// Phase 3 두 번째 수직 경로(2026-10-08) — 「문장 관계: 연결어 · 지시어」 문항 주석 · 실행 과제 채점(순수).
//
// 과제: 순서 문항 한 개에서 ① · ② 지정한 단서(지시어 · 정관사 + 명사 등)가 가리키는 내용이 나온 문장을 고르고 ③ 그 연결로 (A)(B)(C) 순서를 고른다.
// 주석은 **문장 번호만**(0부터 · 골격 서명에 묶음) — 지문 원문 없음. 단서 이름(cueLabel)은 학습자 말로 적은 짧은 설명이다.
// 정답 근거 앵커와 다른 객체다 — 앵커는 해설용 위치, 이 주석은 응집 단서 → 가리키는 문장의 연결(과제용). 겹침은 answerAnchorOverlap 에 적는다.
import { createHash } from 'node:crypto'

import annotation2022_36 from './annotations/cohesion-link-2022-36.v1.json'
import type { CohesionPanelProps } from './cohesion-link-labels'

export interface CohesionProbe {
  id: string
  /** 단서가 있는 문장(0부터) */
  cueSentence: number
  /** 학습자에게 보이는 단서 설명(원문 인용 아님 — 짧은 한국어 설명) */
  cueLabel: string
  /** 정답 — 단서가 가리키는 내용이 나온 문장(두 판정자 합의) */
  referent: number[]
  /** 두 판정자가 갈린 문장 — 골라도 틀리지 않는다(채점 제외) */
  disputed: number[]
}

export interface CohesionLinkAnnotation {
  version: string
  itemId: string
  skeletonSig: string
  sentenceCount: number
  probes: CohesionProbe[]
  order: { options: string[]; answer: number }
  answerAnchorOverlap: { answerAnchorSentences: number[]; note: string }
  provenance: Record<string, unknown>
}

const ANNOTATIONS: Record<string, CohesionLinkAnnotation> = {
  [annotation2022_36.itemId]: annotation2022_36 as CohesionLinkAnnotation,
}

export function cohesionAnnotationFor(itemId: string): CohesionLinkAnnotation | null {
  return ANNOTATIONS[itemId] ?? null
}

export function cohesionAnnotationHash(a: CohesionLinkAnnotation): string {
  return createHash('sha256').update(JSON.stringify(a)).digest('hex')
}

export interface CohesionResponse {
  picks: Record<string, number>
  order: number
}

export interface CohesionGrade {
  probes: Record<string, boolean>
  orderOk: boolean
  isCorrect: boolean
}

export function parseCohesionResponse(raw: unknown, a: CohesionLinkAnnotation): CohesionResponse | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const picksRaw = r.picks
  if (!picksRaw || typeof picksRaw !== 'object') return null
  const picks: Record<string, number> = {}
  for (const p of a.probes) {
    const v = (picksRaw as Record<string, unknown>)[p.id]
    if (!Number.isInteger(v) || (v as number) < 0 || (v as number) >= a.sentenceCount) return null
    picks[p.id] = v as number
  }
  if (Object.keys(picksRaw as object).length !== a.probes.length) return null
  if (!Number.isInteger(r.order) || (r.order as number) < 0 || (r.order as number) >= a.order.options.length) return null
  return { picks, order: r.order as number }
}

export function gradeCohesion(a: CohesionLinkAnnotation, r: CohesionResponse): CohesionGrade {
  const probes = Object.fromEntries(a.probes.map((p) => [p.id, p.referent.includes(r.picks[p.id]) || p.disputed.includes(r.picks[p.id])]))
  const orderOk = r.order === a.order.answer
  return { probes, orderOk, isCorrect: Object.values(probes).every(Boolean) && orderOk }
}

export function cohesionPanelProps(a: CohesionLinkAnnotation): CohesionPanelProps {
  return { sentenceCount: a.sentenceCount, probes: a.probes.map((p) => ({ id: p.id, cueSentence: p.cueSentence, cueLabel: p.cueLabel })), orderOptions: a.order.options }
}
