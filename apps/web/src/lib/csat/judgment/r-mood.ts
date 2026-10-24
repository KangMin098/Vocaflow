// apps/web/src/lib/csat/judgment/r-mood.ts
// R-MOOD(심경·분위기) 판단 모델 — 학습자가 지정한 전환점으로 글을 앞 칸/뒤 칸으로 가르고,
// 학습자가 고른 심경 신호(신체 반응·행동·감정어)의 극성·강도를 칸별로 모아 선지 'A → B' 의 두 칸과 나란히 비교한다.
// 공개 전에는 정답을 모르므로 채점하지 않는다: 비교는 「학습자 자신의 신호」 와 「학습자가 매긴 선지 낱말의 극성」 사이의 일관성뿐이다.
import { refsOf } from './evidence'
import type { EvidenceUnit, RevealData } from './types'

export type SignalKind = 'body' | 'action' | 'word'
export type Polarity = '+' | '-'
export type Strength = 1 | 2
export type Signal = { kind: SignalKind; polarity: Polarity; strength: Strength }

export const KIND_LABEL: Record<SignalKind, string> = { body: '신체 반응', action: '행동', word: '감정어' }
export const POLARITY_LABEL: Record<Polarity, string> = { '+': '긍정(+)', '-': '부정(−)' }

export type MoodState = {
  /** 전환점 문장 — 이 문장 앞은 앞 칸, 뒤는 뒤 칸. 전환점 문장 자체는 어느 칸에도 넣지 않는다 */
  turn: string | null
  signals: Record<string, Signal>
  /** 선지 낱말에 학습자가 매긴 극성 — 키 `${n}:before` | `${n}:after` | `${n}:single` */
  wordPolarity: Record<string, Polarity>
}

export const initialMood = (): MoodState => ({ turn: null, signals: {}, wordPolarity: {} })

export type ParsedChoice = { n: number; text: string; shape: 'change'; before: string; after: string } | { n: number; text: string; shape: 'single'; word: string }

/** 'nervous → relieved' → 두 칸. 화살표가 없으면 단일 심경·분위기형(변화 없음)으로 두고 칸을 지어내지 않는다 */
export function parseChoice(text: string, n: number): ParsedChoice {
  const parts = text.split(/\s*(?:→|->|⇒)\s*/).map((s) => s.trim()).filter(Boolean)
  if (parts.length === 2) return { n, text, shape: 'change', before: parts[0], after: parts[1] }
  return { n, text, shape: 'single', word: text.trim() }
}

export type Side = 'before' | 'after'

/** 전환점 기준 칸 나누기 — 전환점이 없으면 칸도 없다(모든 신호를 한 덩어리로 섞지 않는다) */
export function segment(units: EvidenceUnit[], turn: string | null): { before: string[]; after: string[]; turnN: number | null } {
  const t = units.find((u) => u.id === turn)
  if (!t) return { before: [], after: [], turnN: null }
  return { before: units.filter((u) => u.n < t.n).map((u) => u.id), after: units.filter((u) => u.n > t.n).map((u) => u.id), turnN: t.n }
}

export type ColumnSummary = { ids: string[]; plus: number; minus: number; net: number; kinds: SignalKind[]; tone: Polarity | 'mixed' | 'none' }

export function summarize(state: MoodState, ids: string[]): ColumnSummary {
  const inCol = ids.filter((id) => state.signals[id])
  let plus = 0, minus = 0
  const kinds = new Set<SignalKind>()
  for (const id of inCol) {
    const s = state.signals[id]
    kinds.add(s.kind)
    if (s.polarity === '+') plus += s.strength
    else minus += s.strength
  }
  const tone: ColumnSummary['tone'] = inCol.length === 0 ? 'none' : plus > 0 && minus > 0 ? 'mixed' : plus > 0 ? '+' : '-'
  return { ids: inCol, plus, minus, net: plus - minus, kinds: [...kinds], tone }
}

export type Warning =
  | { code: 'no-turn' }
  | { code: 'turn-signal'; unitId: string }
  | { code: 'empty'; side: Side }
  | { code: 'single-word'; side: Side }
  | { code: 'mixed'; side: Side }

/** 판단이 실패하는 조건을 학습자 표시에서 찾는다 — 정답 여부가 아니라 근거 구조의 빈틈이다 */
export function warningsOf(units: EvidenceUnit[], state: MoodState): Warning[] {
  const seg = segment(units, state.turn)
  if (seg.turnN === null) return [{ code: 'no-turn' }]
  const out: Warning[] = []
  if (state.turn && state.signals[state.turn]) out.push({ code: 'turn-signal', unitId: state.turn })
  for (const side of ['before', 'after'] as const) {
    const c = summarize(state, seg[side])
    if (c.tone === 'none') out.push({ code: 'empty', side })
    else if (c.ids.length === 1 && c.kinds[0] === 'word') out.push({ code: 'single-word', side })
    if (c.tone === 'mixed') out.push({ code: 'mixed', side })
  }
  return out
}

export type HalfVerdict = 'consistent' | 'conflict' | 'no-signal' | 'unlabelled' | 'no-turn' | 'mixed'

/** 선지 한 칸 ↔ 학습자 칸 신호. 「정답」 이 아니라 「당신이 표시한 근거와 맞는가」 */
export function compareHalf(state: MoodState, col: ColumnSummary | null, key: string): HalfVerdict {
  if (!col) return 'no-turn'
  const p = state.wordPolarity[key]
  if (!p) return 'unlabelled'
  if (col.tone === 'none') return 'no-signal'
  if (col.tone === 'mixed') return col.net === 0 ? 'mixed' : (col.net > 0 ? '+' : '-') === p ? 'consistent' : 'conflict'
  return col.tone === p ? 'consistent' : 'conflict'
}

export type ChoiceComparison = { choice: ParsedChoice; before?: HalfVerdict; after?: HalfVerdict; single?: HalfVerdict; conflicts: Side[] }

export function compareChoices(units: EvidenceUnit[], choices: string[], state: MoodState): ChoiceComparison[] {
  const seg = segment(units, state.turn)
  const has = seg.turnN !== null
  const b = has ? summarize(state, seg.before) : null
  const a = has ? summarize(state, seg.after) : null
  return choices.map((text, i) => {
    const c = parseChoice(text, i + 1)
    if (c.shape === 'single') {
      const all = summarize(state, units.map((u) => u.id))
      return { choice: c, single: compareHalf(state, all, `${c.n}:single`), conflicts: [] }
    }
    const before = compareHalf(state, b, `${c.n}:before`)
    const after = compareHalf(state, a, `${c.n}:after`)
    return { choice: c, before, after, conflicts: [before === 'conflict' ? 'before' : null, after === 'conflict' ? 'after' : null].filter((x): x is Side => Boolean(x)) }
  })
}

/** 해설 문장에서 「전환」·「경계」 를 말하는 구절의 [uN] — 해설이 전환점을 따로 표시하지 않으면 빈 배열 */
export function revealTurnUnits(reveal: RevealData, units: EvidenceUnit[]): string[] {
  const correct = reveal.choices.find((c) => c.verdict === 'correct')
  const texts = [reveal.answerLocus?.reasoning, reveal.designIntent, correct?.verdict === 'correct' ? correct.why_correct : undefined, correct?.verdict === 'correct' ? correct.confirmed_at?.note : undefined]
  const hits = new Set<string>()
  for (const t of texts) {
    if (!t) continue
    // 「[u9]이 전환점」 · 「[u9]이 두 칸의 경계」 — 표지어 바로 앞 참조만
    for (const mm of t.matchAll(/((?:\[u\d+\]\s*)+)(?:이|가|은|는)?\s*(?:두 칸의\s*)?(?:전환점|경계)/g)) refsOf(mm[1], units).forEach((id) => hits.add(id))
    // 「전환은 [u5] … 와 [u6] …,」 — 표지어 뒤 쉼표·마침표까지
    for (const mm of t.matchAll(/전환(?:점)?(?:은|는)\s*([^,.]*)/g)) refsOf(mm[1], units).forEach((id) => hits.add(id))
  }
  return units.filter((u) => hits.has(u.id)).map((u) => u.id)
}

export type TurnContrast = {
  learnerN: number | null
  revealTurnN: number[]
  /** 해설 근거 문장(confirmed_at ∪ answerLocus)이 학습자 칸에 어떻게 떨어지는가 */
  evidenceBefore: number[]
  evidenceAfter: number[]
  evidenceAtTurn: number[]
  /** 학습자 전환점이 해설 전환 표지와 같거나 그 범위(최소~최대) 안인가 */
  agree: boolean | null
}

export function contrastTurn(units: EvidenceUnit[], state: MoodState, reveal: RevealData): TurnContrast {
  const seg = segment(units, state.turn)
  const correct = reveal.choices.find((c) => c.verdict === 'correct')
  const idx = [...new Set([...(correct?.verdict === 'correct' ? correct.confirmed_at?.sentence_index ?? [] : []), ...(reveal.answerLocus?.sentence_index ?? [])])].filter((n) => units.some((u) => u.n === n)).sort((x, y) => x - y)
  const nOf = (id: string) => units.find((u) => u.id === id)?.n ?? 0
  const revealTurnN = revealTurnUnits(reveal, units).map(nOf)
  const L = seg.turnN
  const agree = L === null || revealTurnN.length === 0 ? null : L >= Math.min(...revealTurnN) && L <= Math.max(...revealTurnN)
  return {
    learnerN: L,
    revealTurnN,
    evidenceBefore: L === null ? [] : idx.filter((n) => n < L),
    evidenceAfter: L === null ? [] : idx.filter((n) => n > L),
    evidenceAtTurn: L === null ? [] : idx.filter((n) => n === L),
    agree,
  }
}
