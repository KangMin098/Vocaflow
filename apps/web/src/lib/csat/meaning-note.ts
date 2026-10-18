// apps/web/src/lib/csat/meaning-note.ts
//
// **원문 이해 「내 말로」 노트 — 의미 하나에 노트 하나.** (v3.2 · scene=meaning · 2026-10-14)
//
// 02 원문 이해에서 학습자가 어려운 의미를 자기 말로 다시 쓰고(처음 설명), 검수된 쉬운 말 · 지킬 조건과 스스로 대조한 뒤
// 고쳐 쓴다(고친 설명 · 선택한 「달라진 점」). 07 내 설명(출제 원리 자기 설명 · SelfExplanation)과는 다른 기록이다.
//
// 계약:
//   · id = `${item}|${unitId}` — 같은 의미의 노트는 하나(동시 탭 · 재시도 · 다른 기기가 같은 칸을 덮어쓴다. 새로 고친 쪽이 이긴다).
//   · binding = 쓸 때의 분석 버전 · 교수 설명 내용 해시. 지금 설명과 다르면 화면이 「예전 설명을 보고 쓴 노트」로 표시하고
//     현재 정본 설명과 섞지 않는다(기록은 지우지 않는다).
//   · 원문 영어 · 정답 · 선지 번호를 담지 않는다 — 학습자가 쓴 한국어와 의미 id 뿐. 자동 채점 · 점수 · 숙달 판정 없음.
//   · 고친 횟수를 세지 않는다(수정은 성취 지표가 아니다). 처음 설명은 고쳐도 남는다(수정 전후 비교).
// 병합은 continuity.mergeDissection 이 id 단위로 한다(mergeMeaningNotes).

export const MEANING_NOTE_MAX = 300
export const MEANING_CHANGE_MAX = 200
export const MEANING_NOTE_KEEP = 200

export interface MeaningNote {
  id: string
  item: string
  unitId: string
  binding: { analysisVersion: number | null; contentHash: string | null }
  /** 처음 쓴 설명 */
  first: string
  /** 고쳐 쓴 설명(없으면 아직 고치지 않음) */
  revised?: string
  /** 선택 — 처음 이해한 것과 달라진 점 */
  change?: string
  /** 검수된 쉬운 말 · 지킬 조건과 나란히 놓고 대조했는가(열람과 구별) */
  compared: boolean
  at: number
  updatedAt: number
}

export const meaningNoteId = (item: string, unitId: string) => `${item}|${unitId}`

const clip = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/** 저장 · 병합 전에 모양을 고정한다 — 깨진 기록 · 너무 긴 글 · 빈 처음 설명은 버리거나 자른다 */
export function normalizeMeaningNote(x: Partial<MeaningNote> | null | undefined): MeaningNote | null {
  if (!x || typeof x.item !== 'string' || typeof x.unitId !== 'string' || !x.item || !x.unitId) return null
  const first = clip(x.first, MEANING_NOTE_MAX)
  if (!first) return null
  const revised = clip(x.revised, MEANING_NOTE_MAX)
  const change = clip(x.change, MEANING_CHANGE_MAX)
  const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
  const at = num(x.at, 0)
  const av = x.binding?.analysisVersion
  const ch = x.binding?.contentHash
  return {
    id: meaningNoteId(x.item, x.unitId),
    item: x.item,
    unitId: x.unitId,
    binding: {
      analysisVersion: typeof av === 'number' && Number.isFinite(av) ? av : null,
      contentHash: typeof ch === 'string' && /^[0-9a-f]{16}$/.test(ch) ? ch : null,
    },
    first,
    ...(revised ? { revised } : {}),
    ...(change ? { change } : {}),
    compared: x.compared === true,
    at,
    updatedAt: Math.max(at, num(x.updatedAt, at)),
  }
}

/** id 단위 병합 — 새로 고친 쪽(updatedAt)이 이긴다. 같으면 뒤(서버 또는 최신 기기)를 쓴다 */
export function mergeMeaningNotes(a?: MeaningNote[], b?: MeaningNote[]): MeaningNote[] | undefined {
  if (!a?.length && !b?.length) return undefined
  const byId = new Map<string, MeaningNote>()
  for (const raw of [...(a ?? []), ...(b ?? [])]) {
    const x = normalizeMeaningNote(raw)
    if (!x) continue
    const prev = byId.get(x.id)
    if (!prev || x.updatedAt >= prev.updatedAt) byId.set(x.id, x)
  }
  return [...byId.values()].sort((p, q) => p.at - q.at).slice(-MEANING_NOTE_KEEP)
}

export const sameMeaningNotes = (a?: MeaningNote[], b?: MeaningNote[]) =>
  (a ?? []).length === (b ?? []).length && (a ?? []).every((x, i) => x.id === b?.[i]?.id && x.updatedAt === b?.[i]?.updatedAt)

/** 처음 저장 — 이미 있으면 처음 설명은 바꾸지 않고(고쳐 쓰기는 reviseMeaningNote) 결속만 지금 것으로 둔다 */
export function writeMeaningNote(
  prev: MeaningNote | null,
  input: { item: string; unitId: string; text: string; binding: MeaningNote['binding'] },
  now: number,
): MeaningNote | null {
  if (prev && prev.first) return prev
  return normalizeMeaningNote({ item: input.item, unitId: input.unitId, first: input.text, binding: input.binding, compared: false, at: now, updatedAt: now })
}

/** 고쳐 쓰기 — 처음 설명은 그대로 두고 고친 설명 · (선택) 달라진 점만 바꾼다. 같은 글이면 그대로 */
export function reviseMeaningNote(prev: MeaningNote, input: { text: string; change?: string; binding: MeaningNote['binding'] }, now: number): MeaningNote {
  const revised = clip(input.text, MEANING_NOTE_MAX)
  const change = clip(input.change, MEANING_CHANGE_MAX)
  if ((revised || '') === (prev.revised ?? '') && (change || '') === (prev.change ?? '')) return prev
  return normalizeMeaningNote({ ...prev, revised: revised || undefined, change: change || undefined, binding: input.binding, updatedAt: now }) ?? prev
}

/** 대조했다 — 한 번 대조하면 유지(열람과 구별되는 학습 행동 표시일 뿐 점수 아님) */
export function markCompared(prev: MeaningNote, now: number): MeaningNote {
  return prev.compared ? prev : { ...prev, compared: true, updatedAt: now }
}

/** 지금 설명과 다른 결속으로 쓴 노트인가 — 화면이 예전 설명 표시를 붙인다 */
export function isStaleMeaningNote(note: MeaningNote, current: MeaningNote['binding']): boolean {
  if (note.binding.contentHash && current.contentHash) return note.binding.contentHash !== current.contentHash
  return note.binding.analysisVersion != null && current.analysisVersion != null && note.binding.analysisVersion !== current.analysisVersion
}
