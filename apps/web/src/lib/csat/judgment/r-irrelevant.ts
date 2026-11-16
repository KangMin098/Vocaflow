// apps/web/src/lib/csat/judgment/r-irrelevant.ts
// 무관한 문장(R-IRRELEVANT) 판단 모델 — 원문 단위에서 ①~⑤ 문장을 찾아 이음매(앞 문장→선지 · 선지→뒤 문장)와
// 「빼고 읽기」 다리(앞 문장→뒤 문장)를 세우고, 학습자가 표시한 연결 판단을 모양·경고로 되돌려 준다.
// 정답을 모르므로 채점하지 않는다. 경고는 「한 표지어만으로 결론」 같은 판단 방식의 실패 조건만 가리킨다.
import type { EvidenceUnit, JudgmentItem } from './types'

const CIRCLED = ['①', '②', '③', '④', '⑤'] as const

/** 선지 문장 한 칸 — 원문 단위에서 기호 위치로 찾았다(choices 문자열은 각주가 붙는 등 결함이 있어 대조용으로만 쓴다) */
export type Slot = {
  n: number
  unitId: string
  text: string
  /** 앞 단위(없으면 null) */
  prevId: string | null
  /** 뒤 단위(마지막 문장이면 null) */
  nextId: string | null
  /** 문장 첫머리 연결사 — 「확인할 곳」 안내일 뿐 판단 근거가 아니다 */
  opener: string | null
  /** 첫머리 지시 표현(This·Such·They…) */
  reference: string | null
}

export type Structure = {
  /** ①보다 앞의 단위 — 중심 화제를 세우는 도입 */
  lead: EvidenceUnit[]
  slots: Slot[]
  /** choices[n-1] 이 원문 단위 문장과 다른 선지 번호(예: 각주가 붙음) */
  choiceMismatch: number[]
}

const OPENERS = [
  'For instance', 'For example', 'In addition', 'In contrast', 'On the other hand', 'As a result', 'In fact', 'In other words',
  'However', 'Similarly', 'Likewise', 'Moreover', 'Furthermore', 'Therefore', 'Thus', 'Hence', 'Consequently', 'Instead',
  'Nevertheless', 'Meanwhile', 'Also', 'But', 'Yet', 'Still', 'Even', 'Unless', 'If', 'When', 'Although', 'While',
]
const REFERENCES = ['This', 'These', 'That', 'Those', 'Such', 'They', 'It', 'Their', 'Its']

function firstMatch(text: string, words: string[]): string | null {
  for (const w of words) if (text === w || text.startsWith(w + ' ') || text.startsWith(w + ',')) return w
  return null
}

const norm = (s: string) => s.replace(/\s+/g, ' ').trim()

export function parseStructure(item: JudgmentItem): Structure {
  const units = item.units
  const slots: Slot[] = []
  units.forEach((u, i) => {
    const t = u.text.trimStart()
    const k = CIRCLED.findIndex((c) => t.startsWith(c))
    if (k < 0 || slots.some((s) => s.n === k + 1)) return
    const text = t.slice(1).trim()
    slots.push({
      n: k + 1,
      unitId: u.id,
      text,
      prevId: i > 0 ? units[i - 1].id : null,
      nextId: i < units.length - 1 ? units[i + 1].id : null,
      opener: firstMatch(text, OPENERS),
      reference: firstMatch(text, REFERENCES),
    })
  })
  slots.sort((a, b) => a.n - b.n)
  const firstIdx = slots.length ? units.findIndex((u) => u.id === slots[0].unitId) : units.length
  const lead = units.slice(0, Math.max(0, firstIdx))
  const choiceMismatch = slots.filter((s) => norm(item.choices[s.n - 1] ?? '') !== norm(s.text)).map((s) => s.n)
  return { lead, slots, choiceMismatch }
}

/** 이음매를 판단할 때 학습자가 댄 근거 종류 */
export const CUES = ['connective', 'reference', 'topic', 'direction'] as const
export type Cue = (typeof CUES)[number]
export const CUE_LABEL: Record<Cue, string> = {
  connective: '연결사',
  reference: '지시어',
  topic: '화제어',
  direction: '논지 방향',
}

export type Seam = 'back' | 'forward' | 'bridge'
export type SeamMark = { verdict: 'holds' | 'breaks' | null; cues: Cue[] }
export type SlotMarks = Record<Seam, SeamMark>
export type ToolState = {
  /** 학습자가 중심 화제 근거로 고정한 단위 */
  topic: string[]
  marks: Record<number, SlotMarks>
  /** 지금 빼고 읽는 선지 번호 */
  removed: number | null
  /** 학습자가 고른 무관 후보 — 채점하지 않는다 */
  suspect: number | null
}

const emptySeam = (): SeamMark => ({ verdict: null, cues: [] })
const emptySlot = (): SlotMarks => ({ back: emptySeam(), forward: emptySeam(), bridge: emptySeam() })

export function initialState(): ToolState {
  return { topic: [], marks: {}, removed: null, suspect: null }
}

export function marksOf(state: ToolState, n: number): SlotMarks {
  return state.marks[n] ?? emptySlot()
}

export function toggleTopic(state: ToolState, unitId: string): ToolState {
  const has = state.topic.includes(unitId)
  return { ...state, topic: has ? state.topic.filter((x) => x !== unitId) : [...state.topic, unitId] }
}

export function setVerdict(state: ToolState, n: number, seam: Seam, verdict: 'holds' | 'breaks'): ToolState {
  const cur = marksOf(state, n)
  const next = cur[seam].verdict === verdict ? null : verdict
  return { ...state, marks: { ...state.marks, [n]: { ...cur, [seam]: { ...cur[seam], verdict: next } } } }
}

export function toggleCue(state: ToolState, n: number, seam: Seam, cue: Cue): ToolState {
  const cur = marksOf(state, n)
  const cues = cur[seam].cues.includes(cue) ? cur[seam].cues.filter((c) => c !== cue) : [...cur[seam].cues, cue]
  return { ...state, marks: { ...state.marks, [n]: { ...cur, [seam]: { ...cur[seam], cues } } } }
}

export function toggleRemoved(state: ToolState, n: number): ToolState {
  return { ...state, removed: state.removed === n ? null : n }
}

export function toggleSuspect(state: ToolState, n: number): ToolState {
  return { ...state, suspect: state.suspect === n ? null : n }
}

export type Warning = { seam: Seam | 'slot'; code: 'connective-only' | 'topic-only-holds' | 'no-cue' | 'limit-removable' | 'one-side'; text: string }

const WARN_TEXT: Record<Warning['code'], string> = {
  'connective-only': '연결사만 근거로 댔다. However·Similarly 같은 표지는 방향을 약속할 뿐이다 — 뒤 내용이 그 약속을 지키는지 논지 방향을 함께 확인하라.',
  'topic-only-holds': '같은 화제어만 보고 이어진다고 했다. 표면 화제어가 같아도 논지 방향(무엇을 주장·비교하는가)이 어긋나면 무관할 수 있다.',
  'no-cue': '판단만 있고 근거 종류가 없다. 무엇으로 이어지거나 끊기는지 하나 이상 골라라.',
  'limit-removable': '빼도 이어진다는 것만으로는 무관이 아니다. 앞뒤와 모두 이어지는 귀결·요약·예시 문장도 빼면 매끄럽게 읽힌다 — 원리의 한계다.',
  'one-side': '한쪽 이음매만 끊겼다. 화제가 넘어가는 경계 문장일 수 있으니 반대쪽과 빼고 읽기 결과를 함께 보라.',
}

/** 판단 방식의 실패 조건 — 결론의 맞고 틀림이 아니라 근거가 한 가지 표지에만 기댄 경우를 가리킨다 */
export function warningsOf(state: ToolState, slot: Slot): Warning[] {
  const m = marksOf(state, slot.n)
  const out: Warning[] = []
  const seams: Seam[] = slot.nextId ? ['back', 'forward', 'bridge'] : ['back']
  for (const seam of seams) {
    const s = m[seam]
    if (!s.verdict) continue
    if (s.cues.length === 0) out.push({ seam, code: 'no-cue', text: WARN_TEXT['no-cue'] })
    else if (s.cues.length === 1 && s.cues[0] === 'connective') out.push({ seam, code: 'connective-only', text: WARN_TEXT['connective-only'] })
    else if (s.verdict === 'holds' && s.cues.every((c) => c === 'topic')) out.push({ seam, code: 'topic-only-holds', text: WARN_TEXT['topic-only-holds'] })
  }
  const p = profileOf(state, slot)
  if (p === 'removable-but-linked') out.push({ seam: 'slot', code: 'limit-removable', text: WARN_TEXT['limit-removable'] })
  if (p === 'one-side') out.push({ seam: 'slot', code: 'one-side', text: WARN_TEXT['one-side'] })
  return out
}

export type Profile = 'unmarked' | 'linked' | 'removable-but-linked' | 'intruder-shape' | 'one-side' | 'partial'

/**
 * 학습자 표시에서 읽히는 모양. 「intruder-shape」 = 앞뒤가 모두 끊기고 빼면 다리가 이어진다 — 무관 문장의 전형 모양.
 * 마지막 문장은 다리가 없으므로 앞 이음매 하나로는 intruder-shape 를 주지 않는다(한쪽 근거로 일반화하지 않는다).
 */
export function profileOf(state: ToolState, slot: Slot): Profile {
  const m = marksOf(state, slot.n)
  const b = m.back.verdict, f = m.forward.verdict, br = m.bridge.verdict
  if (!slot.nextId) return b === null ? 'unmarked' : b === 'holds' ? 'linked' : 'partial'
  if (b === null && f === null && br === null) return 'unmarked'
  if (b === 'breaks' && f === 'breaks' && br === 'holds') return 'intruder-shape'
  if (b === 'holds' && f === 'holds') return br === 'holds' ? 'removable-but-linked' : 'linked'
  if (b !== null && f !== null && b !== f) return 'one-side'
  return 'partial'
}

export const PROFILE_TEXT: Record<Profile, string> = {
  unmarked: '아직 표시 없음',
  linked: '앞뒤로 이어짐',
  'removable-but-linked': '앞뒤로 이어지고 빼도 읽힘',
  'intruder-shape': '앞뒤가 끊기고 빼면 이어짐 — 끼어든 문장의 모양',
  'one-side': '한쪽만 끊김',
  partial: '판단이 덜 모임',
}

/** 공개 뒤 대조 — 학습자 후보와 해설 정답을 나란히 둔다(공개 전에는 부르지 않는다) */
export function compareWithAnswer(state: ToolState, answer: number): { suspect: number | null; answer: number; same: boolean | null } {
  return { suspect: state.suspect, answer, same: state.suspect === null ? null : state.suspect === answer }
}
