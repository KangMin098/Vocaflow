// apps/web/src/lib/csat/dissect.ts
// Pure prediction/session rules. Passage text never belongs to this model.
import type { LearnerCatalog } from './session/catalog'
import type { MeaningNote } from './meaning-note'
import type { CatalogItem } from './session/model'
import type { RevealAnchor } from './session/reveal'
import { countedPredictions, type LearningSession } from './learning-session'

export interface DissectionItem extends CatalogItem {
  answer: number
  topic: string
  format: string
  formula: string
  formulaTag: string
  wrapup: string
  intent: string
  intentOptions: string[]
  evidence: string
  distractor: { n: number; family: string; line: string }
  trapOptions: string[]
  skeleton: { sentences: number[]; anchors: (RevealAnchor & { spans?: { sentence: number; start: number; end: number }[] })[] }
  history: { id: string; topic: string; formula: string }[]
}
export interface DissectionCatalog extends LearnerCatalog {
  items: DissectionItem[]
  families: string[]
  audit: { total: number; fields: Record<string, number>; excluded: { id: string; missing: string[] }[] }
}
export interface Prediction {
  item: string; type: string; step: 1 | 2 | 3; hit: boolean; at: number; family?: string
  /** 어디서 남겼나 — 'theater' 는 출제 사고 화면의 공개 게이트(`lib/csat/reveal-gate.ts`). 없으면 해부 세션 */
  source?: 'theater'
  /** 게이트에서 고른 근거 문장(0-기반) · 정답 선지 · 확신도(1~5). null 은 「모르겠어요」 */
  sentence?: number | null
  choice?: number | null
  confidence?: number
  /** 설계 주석 예측(주제문 문장 · 구조 패턴 · 정답 표현 변환) — `lib/csat/design.ts` 의 라벨 */
  topic?: number
  pattern?: string
  transform?: string
  /** 시도 id(client_attempt_id · uuid) — 있으면 병합 중복 판정의 키(G0 계약 §4) */
  attempt?: string
  /** 이 예측을 남긴 학습 세션 id */
  session?: string
}
export interface DissectionDraft { phase: 'scan' | 'predict1' | 'compare1' | 'predict2' | 'compare2' | 'predict3' | 'compare3' | 'blueprint' | 'formula'; selection: string | null; answers: { step: number; hit: boolean; selection: string }[] }
export interface Formula {
  tag: string
  text: string
  type: string
  sources: string[]
  /** 해설 극장에서 저장한 원리(M4) — 적용 조건 · 해석 한계를 함께 둔다(문구만 저장하지 않는다) */
  conditions?: string
  limit?: string
  from?: 'theater'
}
export interface DissectionRecord {
  drafts?: Record<string, DissectionDraft>
  inspected?: string[]
  active?: { items: string[]; index: number; pairSeen: boolean; loci: Record<string, string> }
  /** 서버가 보류 문항이 든 진행 세트를 뺀 사본에만 붙인다 — 기기 병합이 그 빈자리로 기기의 세트를 지우지 않게(Reveal Gate) */
  activeWithheld?: true
  version: 1
  seed: number
  onboarded: boolean
  predictions: Prediction[]
  formulas: Formula[]
  queue: { tag: string; source: string; due: number }[]
  completed: { id: string; at: number }[]
  /** 해설 극장에서 연 문항(가장 최근 시각 하나씩) — 넓이 · 재방문 판정용(ia-design §2-5) */
  views?: { id: string; at: number }[]
  /** 마지막으로 고친 시각 — 기기 ↔ 서버 병합의 기준(continuity.mergeDissection) */
  updatedAt?: number
  /** 학습 세션(해설 극장) — `lib/csat/learning-session.ts` · G0 계약. 병합은 id 단위 */
  sessions?: LearningSession[]
  /** 자기 설명(해설 극장 M4) — 학습자가 쓴 오답 설계 설명. 병합은 id 단위 · 자동 채점 없음 */
  explanations?: SelfExplanation[]
  /** 이해 확인(해설 극장 M4) — 근거 자리 · 바뀐 성분 과제의 시도. 검수된 관계로 판정 · 병합은 id 단위 */
  checks?: CheckAttempt[]
  /** 비교 완료(해설 극장 M4) — 검수된 같은 원리 쌍을 학습자가 실제로 대조했는가. 열람과 구별 */
  compares?: { id: string; item: string; other: string; at: number }[]
  /** 원리 노트(v3 M4) — 해설 뒤 학습자가 쓴 조건부 원리 · 근거 · 적용 경계. 병합은 id 단위(새로 고친 쪽) · 자동 채점 없음 · 독립 진단 아님 */
  reasoningNotes?: ReasoningNote[]
  /** 원문 이해 「내 말로」 노트(v3.2 · `lib/csat/meaning-note.ts`) — 의미 하나에 하나. 병합은 id 단위(새로 고친 쪽) · 자동 채점 없음 */
  meaningNotes?: MeaningNote[]
}

/**
 * 이해 확인 시도 하나(`lib/csat/understanding-check.ts`). 해설이 열린 화면에서 낸 과제라 **늘 설명 후 수행**이다 —
 * 독립 수행으로 세지 않는다. `tries` 는 맞힐 때까지 고른 횟수(1 = 첫 시도에 맞힘), `revealed` 는 답을 열어 본 경우.
 */
export interface CheckAttempt {
  id: string
  item: string
  kind: 'evidence' | 'lure'
  correct: boolean
  tries: number
  revealed: boolean
  at: number
  afterExplanation: true
  /** 복습에서 다시 푼 것인가 — 처음 학습과 구별한다 */
  review?: boolean
}

/**
 * 오답 하나를 골라 「왜 그럴듯한가 · 무엇이 바뀌어 배제되나」를 학습자가 쓴 기록.
 * 정오를 매기지 않는다 — 검수된 분석 설명과 **스스로 대조**한 여부만 남긴다(자동 의미 채점 경로가 없다).
 * `afterExplanation`: 해설이 이미 열려 있는 화면에서 쓴 것 — 독립 수행으로 세지 않는다.
 */
export interface SelfExplanation {
  id: string
  item: string
  kind: 'lure'
  choice: number
  tempting: string
  reject: string
  at: number
  afterExplanation: true
  /** 쓴 뒤 분석 설명을 열어 대조했는가 */
  compared: boolean
}

/**
 * 원리 노트 하나(CSAT_REASONING_DATA_V3 §ReasoningNote). 언제나 **설명 후 기록**이다 — `helpAtReveal` 이 independent 여도 독립 수행이 아니다.
 * 원문 · 도표를 첨부하지 않는다(문장 번호만). 쓴 내용은 분석 이벤트로 보내지 않는다.
 */
export interface ReasoningNote {
  id: string
  item: string
  /** 근거로 삼은 비교 쌍(검수된 v3 쌍 id) */
  pairIds: string[]
  /** 쓸 때의 결속 — 분석 버전이 바뀌면 화면이 「예전 분석으로 쓴 노트」로 표시한다 */
  binding: { analysisVersion: number | null }
  statement: string
  grounds: string
  applicability: string
  limit: string
  /** 근거 문장 번호(이 문항 지문) */
  evidence: number[]
  afterExplanation: true
  /** 원세션의 해설 노출 수준을 알 때만 복사 — 덮어쓰지 않는다 */
  helpAtReveal?: 'independent' | 'hint' | 'viewed_first'
  /** 쓴 뒤 검수된 원리와 스스로 대조했는가 */
  comparedWithModel: boolean
  /**
   * FI-011 C — 창작 교수 자료(안내 연습 · 원리 설명)에서 쓴 노트의 결속. 서버(state PUT)가 본인 · 지금 유효한 교수 납품 ·
   * 현재 주석 hash 와 맞을 때만 받는다. 기출 노트에는 없다(기존 노트 호환)
   */
  authored?: { deliveryId: string; annotationHash: string }
  at: number
  updatedAt: number
}

/** 원리 노트 한 칸 글자 상한 · 보관 건수 — 한글(3바이트) 최대치로도 노트 전체가 약 360KB 로 서버 상한(900KB) 안에 남게 */
export const NOTE_FIELD_MAX = 300
export const NOTE_KEEP = 100

/** 노트 정규화 — 칸마다 NOTE_FIELD_MAX 로 자르고, 원리 문장이 비면 버린다(빈 노트가 저장되지 않게). 순수 */
export function normalizeReasoningNote(x: Partial<ReasoningNote> | null | undefined): ReasoningNote | null {
  if (!x || typeof x.id !== 'string' || typeof x.item !== 'string') return null
  const clip = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, NOTE_FIELD_MAX) : '')
  const statement = clip(x.statement)
  if (!statement) return null
  const at = Number.isFinite(x.at) ? Number(x.at) : 0
  return {
    id: x.id, item: x.item,
    pairIds: Array.isArray(x.pairIds) ? x.pairIds.filter((p): p is string => typeof p === 'string').slice(0, 10) : [],
    binding: { analysisVersion: typeof x.binding?.analysisVersion === 'number' ? x.binding.analysisVersion : null },
    statement, grounds: clip(x.grounds), applicability: clip(x.applicability), limit: clip(x.limit),
    evidence: Array.isArray(x.evidence) ? x.evidence.filter((n): n is number => Number.isInteger(n) && n > 0).slice(0, 20) : [],
    afterExplanation: true,
    ...(x.helpAtReveal === 'independent' || x.helpAtReveal === 'hint' || x.helpAtReveal === 'viewed_first' ? { helpAtReveal: x.helpAtReveal } : {}),
    comparedWithModel: x.comparedWithModel === true,
    ...(x.authored && typeof x.authored.deliveryId === 'string' && /^[0-9a-f-]{36}$/i.test(x.authored.deliveryId) && typeof x.authored.annotationHash === 'string' && /^[0-9a-f]{16,128}$/i.test(x.authored.annotationHash)
      ? { authored: { deliveryId: x.authored.deliveryId, annotationHash: x.authored.annotationHash } } : {}),
    at, updatedAt: Number.isFinite(x.updatedAt) ? Number(x.updatedAt) : at,
  }
}

/** 한 칸 글자 상한 — 기록 전체가 서버 상한(900KB)을 넘지 않게 */
export const EXPLAIN_MAX = 600
export function emptyDissectionRecord(seed: number): DissectionRecord {
  return { version: 1, seed, onboarded: false, predictions: [], formulas: [], queue: [], completed: [] }
}
export function hashTag(text: string): string {
  let h = 2166136261
  for (const c of text.normalize('NFC').trim()) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return (h >>> 0).toString(36)
}
export function shuffled<T>(values: readonly T[], seed: number): T[] {
  const out = [...values]
  let state = seed >>> 0
  for (let i = out.length - 1; i > 0; i--) {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0
    const j = Math.floor((state / 4294967296) * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}
export function readyItem(i: DissectionItem): boolean {
  return i.answer >= 1 && i.answer <= 5 && Boolean(i.topic && i.format && i.formula && i.intent && i.evidence && i.wrapup) &&
    i.skeleton.anchors.some(a => a.id === 'answer' && a.sentences.length > 0) &&
    i.skeleton.anchors.some(a => a.id === `reject:${i.distractor.n}` && a.sentences.length > 0) &&
    i.trapOptions.length === 4 && new Set(i.trapOptions).size === 4 && i.trapOptions.includes(i.distractor.family) &&
    i.intentOptions.length === 3 && new Set(i.intentOptions).size === 3 && i.intentOptions.includes(i.intent) &&
    i.intentOptions.every(s => s.length >= i.intent.length * .8 && s.length <= i.intent.length * 1.2) && i.history.length > 0
}
export function composeDissection(catalog: DissectionCatalog, record: DissectionRecord, now: number, cached: string[] = [], tag?: string): DissectionItem[] {
  const pool = catalog.items.filter(readyItem)
  const types = [...new Set(pool.map(i => i.type_id))]
  const seen = new Map<string, Set<string>>()
  for (const p of record.predictions) if (p.family) {
    const set = seen.get(p.type) ?? new Set<string>(); set.add(p.family); seen.set(p.type, set)
  }
  const coverage = (type: string) => {
    const total = new Set(pool.filter(i => i.type_id === type).map(i => i.distractor.family))
    return [...total].filter(f => seen.get(type)?.has(f)).length / Math.max(1, total.size)
  }
  const due = record.queue.filter(q => q.due <= now).sort((a, b) => a.due - b.due)
  const last = (i: DissectionItem) => Math.max(0, ...record.completed.filter(c => c.id === i.id).map(c => c.at))
  types.sort((a, b) => coverage(a) - coverage(b) || a.localeCompare(b))
  for (const type of types) {
    const items = pool.filter(i => i.type_id === type).sort((a, b) =>
      last(a) - last(b) || Number(cached.includes(b.exam_id)) - Number(cached.includes(a.exam_id)) || b.exam_id.localeCompare(a.exam_id) || a.no - b.no)
    // Reserve a due sibling before picking the comparison pair; otherwise the pair can consume it.
    const reserved = due.flatMap(q => items.filter(i => i.formulaTag === q.tag && i.id !== q.source))[0]
    // 복습이 걸린 세트에서는 그 복습의 **원래 문항**도 뺀다 — 한 세트 안에서 외운 문항을 다시 보면 복습이 아니다(ia-design S6)
    const reservedSource = reserved ? due.find(q => q.tag === reserved.formulaTag && q.source !== reserved.id)?.source : undefined
    const available = items.filter(i => i.id !== reserved?.id && i.id !== reservedSource)
    const candidates = tag ? available.filter(i => i.formulaTag === tag) : available
    for (const first of candidates) {
      for (const second of available.filter(i => i.id !== first.id && i.topic !== first.topic)) {
        const rest = items.filter(i => i.id !== first.id && i.id !== second.id)
        const transfer = reserved ?? rest[0]
        if (transfer) return [first, second, transfer]
      }
    }
  }
  return []
}
export function recordDecision(record: DissectionRecord, item: DissectionItem, decision: 'save' | 'unsure' | 'transfer', now: number, siblings: DissectionItem[]): DissectionRecord {
  const formulas = record.formulas.map(f => ({ ...f, sources: [...f.sources] }))
  if (decision === 'save') {
    const existing = formulas.find(f => f.tag === item.formulaTag)
    if (existing) existing.sources = [...new Set([...existing.sources, item.id])]
    else formulas.push({ tag: item.formulaTag, text: item.formula, type: item.type_id, sources: [item.id] })
  }
  let queue = record.queue.filter(q => !(q.tag === item.formulaTag && q.source !== item.id && q.due <= now))
  if (decision === 'unsure' && siblings.some(i => i.formulaTag === item.formulaTag && i.id !== item.id)) {
    queue = [...queue.filter(q => q.tag !== item.formulaTag), { tag: item.formulaTag, source: item.id, due: now + 3 * 86400000 }]
  }
  return { ...record, formulas, queue, completed: [...record.completed, { id: item.id, at: now }] }
}
export function predictionStats(record: DissectionRecord, families: string[]) {
  // 「모르겠어요—바로 보기」는 예측이 아니다 — 분모 · 분자 모두에서 뺀다(G0 계약 §5)
  const recent = countedPredictions(record.predictions).slice(-30)
  const seen = new Set(record.predictions.map(p => p.family).filter(Boolean))
  return { formulas: record.formulas.length, hit: recent.length ? Math.round(100 * recent.filter(p => p.hit).length / recent.length) : null, seen: families.filter(f => seen.has(f)).length, total: families.length }
}
