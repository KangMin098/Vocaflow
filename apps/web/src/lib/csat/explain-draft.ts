// apps/web/src/lib/csat/explain-draft.ts
//
// **자기 설명 · 원리 노트 초안 — 장면을 오가도 남고, 저장은 실제 결과로만 끝난다.** (기출 탐구 작업공간 W3)
//
// 초안은 문항별 부모 메모리(탭 메모리)에만 있다 — 새로고침 · 탭 종료면 사라진다(새 영구 저장소 · 이벤트 전송 없음).
// 저장 규칙(순수 함수 — 화면과 테스트가 같은 판정):
//   · 보낼 때 그 초안의 판(rev)과 기록 id 를 적는다. 실패하면 입력과 같은 id 를 그대로 둔다(다시 저장 = 같은 기록 교체).
//   · 성공하면 보낸 판만 완료 처리한다 — 보낸 뒤 새로 쓴 글이 있으면(rev 증가) 지우지 않는다.

export type DraftStatus = 'idle' | 'saving' | 'saved' | 'failed'

export interface DraftMeta {
  /** 편집할 때마다 1 씩 — 저장 결과가 「보낸 판」에만 적용되게 */
  rev: number
  /** 저장 중 · 실패한 기록의 id(다시 저장은 같은 id) */
  pendingId: string | null
  /** 저장 중 · 실패한 기록의 처음 시각(같은 기록 유지) */
  pendingAt: number | null
  /** 보낸 판 */
  sentRev: number | null
  status: DraftStatus
  /** 저장 뒤 대조로 보여 줄 기록 */
  shownId: string | null
}

export const EMPTY_META: DraftMeta = { rev: 0, pendingId: null, pendingAt: null, sentRev: null, status: 'idle', shownId: null }

/** 편집 — 판을 올리고, 「저장됨」 표시는 지운다(실패 · 저장 중의 같은 id 는 유지) */
export function edited<T extends DraftMeta>(d: T, patch: Partial<Omit<T, keyof DraftMeta>>): T {
  return { ...d, ...patch, rev: d.rev + 1, status: d.status === 'saved' ? 'idle' : d.status }
}

/** 보내기 — 다시 저장이면 같은 id · 같은 처음 시각 */
export function sending<T extends DraftMeta>(d: T, fresh: () => string, now: number): { draft: T; id: string; at: number } {
  const id = d.pendingId ?? fresh()
  const at = d.pendingAt ?? now
  return { draft: { ...d, pendingId: id, pendingAt: at, sentRev: d.rev, status: 'saving' }, id, at }
}

/** 결과 — 실패면 입력 · id 보존, 성공이면 보낸 판일 때만 비운다(clear 가 빈 입력을 돌려준다) */
export function settled<T extends DraftMeta>(d: T, ok: boolean, id: string, clear: (d: T) => T): T {
  if (d.pendingId !== id) return d // 다른 저장이 이미 이 초안을 이어받았다
  if (!ok) return { ...d, status: 'failed' }
  const base = { ...d, pendingId: null, pendingAt: null, sentRev: null, status: 'saved' as const, shownId: id }
  return d.sentRev === d.rev ? clear(base) : base
}

/** 자기 설명 초안 */
export interface ExplainDraft extends DraftMeta {
  choice: number | null
  tempting: string
  reject: string
}
export const EMPTY_EXPLAIN: ExplainDraft = { ...EMPTY_META, choice: null, tempting: '', reject: '' }
export const clearExplain = (d: ExplainDraft): ExplainDraft => ({ ...d, choice: null, tempting: '', reject: '' })

/** 원리 노트 초안 — evidence 는 학습자가 「이 근거를 노트에 연결」 한 문장 번호(선택) */
export interface NoteDraft extends DraftMeta {
  fields: { statement: string; grounds: string; applicability: string; limit: string }
  pairIds: string[]
  evidence: number[]
  /** T-0063 — 고쳐 쓰는 중이면 고칠 대상 노트 id(저장하면 새 노트 · revisionOf). 없으면 새로 쓰기 */
  revising?: string | null
}
export const EMPTY_NOTE: NoteDraft = { ...EMPTY_META, fields: { statement: '', grounds: '', applicability: '', limit: '' }, pairIds: [], evidence: [], revising: null }
export const clearNote = (d: NoteDraft): NoteDraft => ({ ...d, fields: { ...EMPTY_NOTE.fields }, pairIds: [], evidence: [], revising: null })

/** 고쳐 쓴 노트들의 처음 노트 — revisionOf 를 따라 올라간다(같은 문항 · 순환 방지 · 대상이 없으면 거기서 멈춤) */
export function rootNoteOf<N extends { id: string; revisionOf?: string }>(notes: readonly N[], note: N): N {
  let cur = note
  const seen = new Set<string>([cur.id])
  while (cur.revisionOf) {
    const up = notes.find((n) => n.id === cur.revisionOf)
    if (!up || seen.has(up.id)) break
    seen.add(up.id)
    cur = up
  }
  return cur
}

/** 같은 처음 노트에서 이어진 노트들(처음 → 마지막 고친 것, 쓴 시각 순) */
export function revisionChain<N extends { id: string; revisionOf?: string; at: number }>(notes: readonly N[], note: N): N[] {
  const root = rootNoteOf(notes, note)
  return notes.filter((n) => rootNoteOf(notes, n).id === root.id).sort((a, b) => a.at - b.at)
}

/**
 * 노트에 연결할 수 있는 근거 번호 — 지금 문항 지도의 실제 문장 범위 안 · 중복 없음 · 오름차순 · 최대 20(normalizeReasoningNote 와 같은 상한).
 * maxSentence 가 없으면(지도 없음 · 결속 확인 불가 · 문장 단위가 아닌 유형) 연결하지 않는다 — 번호를 지어내지 않는다.
 */
export function linkableEvidence(sentences: readonly number[] | null | undefined, maxSentence: number | null): number[] {
  if (!sentences?.length || !maxSentence) return []
  return [...new Set(sentences.filter((n) => Number.isInteger(n) && n >= 1 && n <= maxSentence))].sort((a, b) => a - b).slice(0, 20)
}
