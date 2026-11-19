// apps/web/src/lib/csat/judgment/r-summary.ts
// R-SUMMARY(요약문 (A)(B)) 판단 모델 — 칸별 후보어를 따로 고르고, 후보어마다 지지/반박 원문 단위를 잇고,
// 극성 반전 · 범위 과대 · 원문 낱말 재사용 함정을 대조한다. 정답을 모르므로 공개 전에는 채점하지 않는다.
import type { EvidenceUnit, JudgmentItem, RevealData } from './types'

export type Slot = 'A' | 'B'
export type Polarity = 'pos' | 'neg' | 'neutral'
export type Relation = 'support' | 'refute'

/** 선지 'effective …… success' → 칸별 후보어. 구분자가 없으면 null(파싱 결함 — 조합 표시를 하지 않는다) */
export const SLOT_SEP = /\s*…{1,2}\s*|\s*\.{3,6}\s*/
export function parseChoices(choices: string[]): { a: string; b: string }[] | null {
  const out: { a: string; b: string }[] = []
  for (const c of choices) {
    const parts = c.split(SLOT_SEP).map((s) => s.trim()).filter(Boolean)
    if (parts.length !== 2) return null
    out.push({ a: parts[0], b: parts[1] })
  }
  return out
}

/** 칸별 후보어 — 선지 등장 순서, 중복 없음 */
export function candidatesOf(choices: string[]): Record<Slot, string[]> {
  const parsed = parseChoices(choices) ?? []
  return { A: [...new Set(parsed.map((p) => p.a))], B: [...new Set(parsed.map((p) => p.b))] }
}

/** 두 칸 고른 조합이 어느 선지와 같은지 — 없으면 null. 맞고 틀림이 아니라 위치만 알려 준다 */
export function choiceOfCombo(choices: string[], a?: string, b?: string): number | null {
  if (!a || !b) return null
  const parsed = parseChoices(choices)
  const i = parsed?.findIndex((p) => p.a === a && p.b === b) ?? -1
  return i >= 0 ? i + 1 : null
}

const MARKS_ONLY = /^[\s(AB)]*$/
/** PDF 추출이 남긴 사용자 정의 영역 글리프(예: U+F000 화살표 상자) — 요약문 앞 표지라 내용이 아니다 */
const PUA = /[-]/g
const hasSlots = (t: string) => t.includes('(A)') && t.includes('(B)')

export type SummarySource = {
  /** 요약문 문장 — 원문 단위에서 실제로 떼어 낸 것만. 없으면 null(지어내지 않는다) */
  summary: { text: string; fromUnit: string } | null
  /** 판단 근거로 쓸 원문 단위(요약문 부분을 떼어 낸 본문) */
  evidence: EvidenceUnit[]
  /** '(A) (B)' 껍데기만 남은 단위 — 근거에서 뺀다 */
  shells: string[]
}

/**
 * 원문 단위에서 요약문을 찾는다. 추출 결함으로 요약문이 마지막 본문 문장 뒤에 붙어 있는 경우(예: H1906G1#40 u9)
 * 그 단위를 문장 경계에서 나눠 앞은 본문 근거로, (A)(B) 가 든 뒤쪽은 요약문으로 쓴다.
 */
export function summarySource(units: EvidenceUnit[]): SummarySource {
  const shells = units.filter((u) => MARKS_ONLY.test(u.text) && /\(A\)|\(B\)/.test(u.text)).map((u) => u.id)
  let summary: SummarySource['summary'] = null
  const evidence: EvidenceUnit[] = []
  for (const u of units) {
    if (shells.includes(u.id)) continue
    if (!summary && hasSlots(u.text)) {
      const segs = u.text.replace(PUA, ' ').split(/(?<=[.!?])\s+/)
      const at = segs.findIndex((s) => s.includes('(A)'))
      const sum = segs.slice(at).join(' ').trim()
      if (hasSlots(sum)) {
        summary = { text: sum, fromUnit: u.id }
        const body = segs.slice(0, at).join(' ').trim()
        if (body) evidence.push({ ...u, text: body })
        continue
      }
    }
    evidence.push(u)
  }
  return { summary, evidence, shells }
}

/** 요약문을 칸 조각으로 — 화면이 칸 자리에 고른 후보어를 끼운다 */
export function summaryParts(text: string): ({ kind: 'text'; text: string } | { kind: 'slot'; slot: Slot })[] {
  return text.split(/(\([AB]\))/).filter(Boolean).map((p) => (p === '(A)' || p === '(B)' ? { kind: 'slot' as const, slot: p[1] as Slot } : { kind: 'text' as const, text: p }))
}

export const keyOf = (slot: Slot, word: string) => `${slot}:${word}`

export type CandidateNote = { links: Record<string, Relation>; polarity?: Polarity }
export type SummaryState = { pick: Partial<Record<Slot, string>>; notes: Record<string, CandidateNote> }
export const initialState = (): SummaryState => ({ pick: {}, notes: {} })

export function pick(s: SummaryState, slot: Slot, word: string): SummaryState {
  return { ...s, pick: { ...s.pick, [slot]: s.pick[slot] === word ? undefined : word } }
}

/** 단위를 후보어의 지지/반박 근거로 잇는다 — 같은 관계를 다시 누르면 뗀다, 다른 관계면 바꾼다 */
export function link(s: SummaryState, key: string, unitId: string, rel: Relation): SummaryState {
  const note = s.notes[key] ?? { links: {} }
  const links = { ...note.links }
  if (links[unitId] === rel) delete links[unitId]
  else links[unitId] = rel
  return { ...s, notes: { ...s.notes, [key]: { ...note, links } } }
}

export function setPolarity(s: SummaryState, key: string, p: Polarity): SummaryState {
  const note = s.notes[key] ?? { links: {} }
  return { ...s, notes: { ...s.notes, [key]: { ...note, polarity: note.polarity === p ? undefined : p } } }
}

export const linksOf = (s: SummaryState, key: string, rel: Relation) => Object.entries(s.notes[key]?.links ?? {}).filter(([, r]) => r === rel).map(([id]) => id)

const STOP = new Set(['the', 'and', 'for', 'more', 'than', 'with', 'that', 'this'])
/** 후보어(앞 5글자 어간)가 원문에 그대로 나온 단위 — 「같은 낱말 = 근거」 착각을 대조하는 재료일 뿐 판정이 아니다 */
export function reusedIn(word: string, units: EvidenceUnit[]): string[] {
  const w = word.toLowerCase().replace(/[^a-z]/g, '')
  if (w.length < 3 || STOP.has(w)) return []
  const stem = w.slice(0, Math.min(5, w.length))
  const re = new RegExp(`\\b${stem}[a-z]*`, 'i')
  return units.filter((u) => re.test(u.text)).map((u) => u.id)
}

export type Flag =
  | { kind: 'polarity'; unitIds: string[]; other: string }
  | { kind: 'scope'; unitIds: string[] }
  | { kind: 'reuse'; unitIds: string[] }
  | { kind: 'split'; unitIds: string[] }

/**
 * 후보어 하나에 대한 대조 표지. 모두 「확인하라」는 신호이지 오답 판정이 아니다.
 * - polarity: 같은 칸의 반대 극성 후보가 같은 문장을 지지 근거로 쓴다 → 그 문장의 결과가 누구 것인지(주어) 갈라 봐야 한다
 * - scope: 지지 근거가 한 문장뿐 → 일부 결과를 요약문 전체로 일반화하는지
 * - reuse: 후보어가 원문에 그대로 나온다 → 낱말이 같다고 의미·방향이 같은 것은 아니다
 * - split: 같은 문장을 지지와 반박 양쪽으로 쓴 적은 없지만, 지지·반박이 모두 있다 → 어느 쪽이 요약문 주어에 대한 말인지
 */
export function flagsOf(s: SummaryState, slot: Slot, word: string, words: string[], units: EvidenceUnit[]): Flag[] {
  const key = keyOf(slot, word)
  const sup = linksOf(s, key, 'support')
  const ref = linksOf(s, key, 'refute')
  const flags: Flag[] = []
  const pol = s.notes[key]?.polarity
  if (pol && pol !== 'neutral') {
    for (const other of words) {
      if (other === word) continue
      const op = s.notes[keyOf(slot, other)]?.polarity
      if (!op || op === 'neutral' || op === pol) continue
      const shared = linksOf(s, keyOf(slot, other), 'support').filter((id) => sup.includes(id))
      if (shared.length) flags.push({ kind: 'polarity', unitIds: shared, other })
    }
  }
  if (sup.length === 1) flags.push({ kind: 'scope', unitIds: sup })
  const reused = reusedIn(word, units)
  if (reused.length) flags.push({ kind: 'reuse', unitIds: reused })
  if (sup.length && ref.length) flags.push({ kind: 'split', unitIds: [...sup, ...ref] })
  return flags
}

/** 공개 전 모델 출력 — 학습자 판단 요약. 정답·판정 키 없음 */
export function overview(item: JudgmentItem, s: SummaryState) {
  const c = candidatesOf(item.choices)
  return {
    picks: s.pick,
    combo: choiceOfCombo(item.choices, s.pick.A, s.pick.B),
    linked: (['A', 'B'] as Slot[]).flatMap((slot) => c[slot].map((w) => ({ slot, word: w, support: linksOf(s, keyOf(slot, w), 'support').length, refute: linksOf(s, keyOf(slot, w), 'refute').length }))),
  }
}

/** 공개 뒤 대조 — 학습자 조합·근거와 해설 근거를 나란히 */
export function compareWithReveal(item: JudgmentItem, s: SummaryState, r: RevealData) {
  const parsed = parseChoices(item.choices)
  const key = parsed?.[r.answer - 1]
  const locus = (r.answerLocus?.sentence_index ?? []).map((n) => item.units.find((u) => u.n === n)?.id).filter((x): x is string => Boolean(x))
  const mine = key ? [...new Set([...linksOf(s, keyOf('A', key.a), 'support'), ...linksOf(s, keyOf('B', key.b), 'support')])] : []
  return {
    answerWords: key ?? null,
    myCombo: choiceOfCombo(item.choices, s.pick.A, s.pick.B),
    slotMatch: { A: key ? s.pick.A === key.a : false, B: key ? s.pick.B === key.b : false },
    locus,
    shared: mine.filter((id) => locus.includes(id)),
    missed: locus.filter((id) => !mine.includes(id)),
  }
}
