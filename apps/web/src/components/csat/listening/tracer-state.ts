// apps/web/src/components/csat/listening/tracer-state.ts
//
// 근거 추적 도구의 순수 상태 — 판단(후보 → 지움/남김 + 발화 연결) · 제출 · 노출 단계 · 자막, 그리고
// sessionStorage 복원. 시계를 읽지 않는다. 저장소 접근은 모두 try/catch(사생활 모드 · 차단에서도 화면은 뜬다).

import { EXPOSURE_LEVELS, canTransition, effectiveLevel, type ExposureContext, type ExposureLevel } from '@/lib/csat/listening/exposure'
import type { CandidateVerdict, ListeningTraceFixture } from '@/lib/csat/listening/fixtures'

export interface CandidateJudgment {
  verdict: CandidateVerdict
  utteranceId: string
}

export interface ItemTraceState {
  level: ExposureLevel
  judgments: Record<string, CandidateJudgment>
  submitted: boolean
  captions: boolean
}

export interface TracerSnapshot {
  selectedKey: string
  byItem: Record<string, ItemTraceState>
}

export const STORAGE_KEY = 'vf:csat-listening-trace:v1'

export const initialItemState = (): ItemTraceState => ({ level: 'L1', judgments: {}, submitted: false, captions: true })

export function judge(state: ItemTraceState, candidateId: string, j: CandidateJudgment): ItemTraceState {
  if (state.submitted) return state
  return { ...state, judgments: { ...state.judgments, [candidateId]: j } }
}

export function unjudge(state: ItemTraceState, candidateId: string): ItemTraceState {
  if (state.submitted || !(candidateId in state.judgments)) return state
  const next = { ...state.judgments }
  delete next[candidateId]
  return { ...state, judgments: next }
}

export function remainingCount(fx: ListeningTraceFixture, state: ItemTraceState): number {
  return fx.candidates.filter((c) => state.judgments[c.id]?.verdict !== 'eliminated').length
}

export type SubmitBlock = 'unjudged' | 'none-remaining' | null

/** 모든 후보를 판단했고 남긴 후보가 하나 이상일 때만 제출 */
export function submitBlock(fx: ListeningTraceFixture, state: ItemTraceState): SubmitBlock {
  if (fx.candidates.some((c) => !state.judgments[c.id])) return 'unjudged'
  if (fx.candidates.every((c) => state.judgments[c.id]?.verdict === 'eliminated')) return 'none-remaining'
  return null
}

export function submit(fx: ListeningTraceFixture, state: ItemTraceState): ItemTraceState {
  return submitBlock(fx, state) === null ? { ...state, submitted: true } : state
}

/** 단계 전이는 계약(canTransition)에만 묻는다 */
export function moveLevel(state: ItemTraceState, to: ExposureLevel, ctx: ExposureContext): ItemTraceState {
  const r = canTransition(state.level, to, ctx)
  return r.ok ? { ...state, level: r.to } : state
}

export type LinkMatch = 'match' | 'verdict-differs' | 'utterance-differs' | 'unjudged'

/** L4 이상에서 학습자의 판단을 분석 기준과 맞대어 본다 — 점수·숙달 산입 없음 */
export function compareCandidate(fx: ListeningTraceFixture, state: ItemTraceState, candidateId: string): LinkMatch {
  const c = fx.candidates.find((x) => x.id === candidateId)
  const j = state.judgments[candidateId]
  if (!c || !j) return 'unjudged'
  if (j.verdict !== c.expected) return 'verdict-differs'
  return c.keyUtteranceIds.includes(j.utteranceId) ? 'match' : 'utterance-differs'
}

// ── 복원 ────────────────────────────────────────────────────────────────

function sanitizeItem(fx: ListeningTraceFixture, raw: unknown): ItemTraceState {
  const base = initialItemState()
  if (!raw || typeof raw !== 'object') return base
  const r = raw as Record<string, unknown>
  const level = (EXPOSURE_LEVELS as readonly string[]).includes(r.level as string) ? (r.level as ExposureLevel) : base.level
  const uttIds = new Set(fx.utterances.map((u) => u.id))
  const judgments: Record<string, CandidateJudgment> = {}
  if (r.judgments && typeof r.judgments === 'object') {
    for (const c of fx.candidates) {
      const j = (r.judgments as Record<string, unknown>)[c.id] as Partial<CandidateJudgment> | undefined
      if (j && (j.verdict === 'eliminated' || j.verdict === 'remaining') && typeof j.utteranceId === 'string' && uttIds.has(j.utteranceId)) {
        judgments[c.id] = { verdict: j.verdict, utteranceId: j.utteranceId }
      }
    }
  }
  const draft: ItemTraceState = { level, judgments, submitted: false, captions: r.captions !== false }
  // 제출 표지는 판단이 실제로 제출 가능할 때만 되살린다
  if (r.submitted === true && submitBlock(fx, draft) === null) draft.submitted = true
  return draft
}

export function parseSnapshot(raw: string | null, fixtures: readonly ListeningTraceFixture[], fallbackKey: string): TracerSnapshot {
  const empty: TracerSnapshot = { selectedKey: fallbackKey, byItem: {} }
  if (!raw) return empty
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return empty
  }
  if (!data || typeof data !== 'object') return empty
  const d = data as Record<string, unknown>
  const byItem: Record<string, ItemTraceState> = {}
  const src = d.byItem && typeof d.byItem === 'object' ? (d.byItem as Record<string, unknown>) : {}
  for (const fx of fixtures) if (fx.key in src) byItem[fx.key] = sanitizeItem(fx, src[fx.key])
  const selectedKey = fixtures.some((f) => f.key === d.selectedKey) ? (d.selectedKey as string) : fallbackKey
  return { selectedKey, byItem }
}

export interface StorageLike {
  getItem(k: string): string | null
  setItem(k: string, v: string): void
}

function sessionStore(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    return null
  }
}

export function loadSnapshot(fixtures: readonly ListeningTraceFixture[], fallbackKey: string, store: StorageLike | null = sessionStore()): TracerSnapshot {
  try {
    return parseSnapshot(store ? store.getItem(STORAGE_KEY) : null, fixtures, fallbackKey)
  } catch {
    return { selectedKey: fallbackKey, byItem: {} }
  }
}

export function saveSnapshot(snap: TracerSnapshot, store: StorageLike | null = sessionStore()): void {
  try {
    store?.setItem(STORAGE_KEY, JSON.stringify(snap))
  } catch {
    // 저장 실패는 화면을 막지 않는다
  }
}

/** 화면이 실제로 그리는 단계 — 보류가 시작되면 계약이 L3 으로 깎는다 */
export function shownLevel(state: ItemTraceState, ctx: ExposureContext): ExposureLevel {
  return effectiveLevel(state.level, ctx)
}
