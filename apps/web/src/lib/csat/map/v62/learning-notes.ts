// apps/web/src/lib/csat/map/v62/learning-notes.ts
//
// T-0071 — Workspace 의 TASK 별 「내 원리 노트」 다시 찾기(읽기 전용). 서버 사본(GET /api/csat/state)의 reasoningNotes 와
// 그 TASK 의 본인 납품 목록(GET /api/csat/authored?task=…)을 **정확히** 잇는다: 노트 item = 납품 ref 이고 노트 authored.deliveryId = 납품 id 이며
// 납품 역할이 교수(원리 설명 · 안내 연습)일 때만. 다른 TASK · 남의 납품 · 평가 역할 · 결속을 모르는 노트(기출 노트 · 결속 없음)는 넣지 않는다.
// 처음 쓴 노트와 고쳐 쓴 노트는 T-0063 의 rootNoteOf/revisionChain 으로 묶는다(같은 문항의 전체 노트로 계보를 세운 뒤 결속된 것만 보인다).
// 노트는 설명 뒤 학습 기록이다 — 독립 첫 시도 · G2 · As-Is · PLAN 진전 · 숙달로 세지 않는다(여기서 아무 판정도 하지 않는다).

import { revisionChain, rootNoteOf } from '@/lib/csat/explain-draft'
import type { ReasoningNote } from '@/lib/csat/dissect'

export const NOTE_ROLES = ['model_explanation', 'guided_practice'] as const
export type NoteRole = (typeof NOTE_ROLES)[number]

/** 그 TASK 의 본인 납품 한 줄(AuthoredSupplyCard 가 이미 받은 모양) */
export interface DeliveredRow { ref: string; deliveryId: string; role: string; current?: boolean | null }

export interface NoteEntry {
  id: string
  statement: string
  grounds: string
  applicability: string
  limit: string
  at: number
  /** 고쳐 쓴 노트인가(처음 노트가 아니다) */
  revision: boolean
  /** 그때 검수된 원리와 스스로 대조했다고 표시했는가(과거 사실 — 지금 설명판과의 대조가 아니다) */
  comparedWithModel: boolean
}

export interface NoteGroup {
  ref: string
  deliveryId: string
  role: NoteRole
  /** 그 교수 납품이 지금 유효한가 — true 일 때만 학습 화면으로 이어 보기를 낸다 */
  current: boolean | null
  /** 처음 노트 → 마지막 고친 노트(쓴 시각 순) */
  chains: NoteEntry[][]
}

export type NotesState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; groups: NoteGroup[] }
  /** 확인 못 함 — 성공적으로 읽은 빈 목록과 구별한다 */
  | { status: 'unknown'; reason: 'unauthenticated' | 'held' | 'error' | 'not_installed' }

const isNoteRole = (r: string): r is NoteRole => (NOTE_ROLES as readonly string[]).includes(r)

export function notesForTask(notes: readonly ReasoningNote[] | null | undefined, rows: readonly DeliveredRow[]): NoteGroup[] {
  const all = notes ?? []
  const groups: NoteGroup[] = []
  for (const row of rows) {
    if (!isNoteRole(row.role)) continue
    const bound = all.filter((n) => n.item === row.ref && n.authored?.deliveryId === row.deliveryId)
    if (!bound.length) continue
    // 계보는 같은 문항의 모든 노트로 세우고(중간 노트가 다른 납품이어도 처음 노트를 잃지 않게) 보이는 것은 이 납품에 결속된 노트만
    const sameItem = all.filter((n) => n.item === row.ref)
    const roots = [...new Set(bound.map((n) => rootNoteOf(sameItem, n).id))]
    const chains = roots.map((rootId) => {
      const root = sameItem.find((n) => n.id === rootId)!
      return revisionChain(sameItem, root)
        .filter((n) => bound.includes(n))
        .map((n): NoteEntry => ({ id: n.id, statement: n.statement, grounds: n.grounds, applicability: n.applicability, limit: n.limit, at: n.at, revision: rootNoteOf(sameItem, n).id !== n.id, comparedWithModel: n.comparedWithModel }))
    }).filter((c) => c.length > 0)
    groups.push({ ref: row.ref, deliveryId: row.deliveryId, role: row.role, current: row.current ?? null, chains })
  }
  return groups
}

/** GET /api/csat/state 응답 → 노트 배열 또는 확인 못 한 이유. 401 = 로그아웃 · 423 = 보류 판정(보류 문항 노트를 기기 사본으로 되살리지 않는다) · 그 외 오류 */
export function notesFromStateResponse(status: number, body: unknown): { ok: true; notes: ReasoningNote[] } | { ok: false; reason: 'unauthenticated' | 'held' | 'error' } {
  if (status === 401) return { ok: false, reason: 'unauthenticated' }
  if (status === 423) return { ok: false, reason: 'held' }
  const b = body as { ok?: unknown; record?: { reasoningNotes?: unknown } | null } | null
  if (status !== 200 || !b || b.ok !== true) return { ok: false, reason: 'error' }
  const raw = b.record?.reasoningNotes
  if (raw === undefined || raw === null) return { ok: true, notes: [] }
  return Array.isArray(raw) ? { ok: true, notes: raw as ReasoningNote[] } : { ok: false, reason: 'error' }
}
