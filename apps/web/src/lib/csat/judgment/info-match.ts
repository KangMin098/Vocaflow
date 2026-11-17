// apps/web/src/lib/csat/judgment/info-match.ts
// R-NOTICE(안내문) · R-FACT(인물·대상 글) 정보 일치 판단 모델 — 선지를 성분으로 쪼개 성분마다 원문 근거를 잇고
// 「일치 / 어긋남 / 언급 없음」을 성분 단위로 표시한다. 선지 전체를 한 번에 O/X 하지 않는다.
//
// 성분 분해는 두 갈래뿐이다.
//   1) 결정적 규칙 — 숫자·수사·시점·범위·허용/금지 표지를 정규식으로 찾는다. 「뜻」을 지어내지 않고 「확인할 표지」만 표시한다.
//   2) 학습자 선택 — 규칙이 못 잡은 말(대상·행위 등)은 학습자가 어절을 골라 직접 성분으로 묶는다.
// 공개 전에는 학습자 판단을 채점하지 않는다. 공개 뒤에만 해설 [uN] 과 학습자 연결을 나란히 대조한다.
import { refsOf, unitsAtIndex } from './evidence'
import type { EvidenceUnit, JudgmentItem, RevealData } from './types'

export type RuleKind = 'number' | 'time' | 'range' | 'modality'
export type Mark = 'match' | 'conflict' | 'absent'

export const RULE_LABEL: Record<RuleKind, string> = {
  number: '수치',
  time: '시점·기간',
  range: '범위·경계',
  modality: '허용·금지·부정',
}

export const MARK_LABEL: Record<Mark, string> = {
  match: '일치',
  conflict: '어긋남',
  absent: '언급 없음',
}

/** 화면 기호 — 색만으로 구분하지 않는다 */
export const MARK_SIGN: Record<Mark, string> = { match: '=', conflict: '≠', absent: '∅' }

export type Token = { i: number; text: string; start: number; end: number }

export type Component = {
  id: string
  /** 선지 어절 번호(오름차순) */
  tokens: number[]
  text: string
  origin: 'rule' | 'learner'
  kinds: RuleKind[]
  links: string[]
  mark?: Mark
}

export type ChoiceWork = { components: Component[]; pending: number[] }
export type InfoMatchState = { choices: Record<number, ChoiceWork> }

/** 발문이 일치하지 않는 것을 묻는지 — 규칙: 「일치하지 않는」 표현 */
export type AskPolarity = 'find-mismatch' | 'find-match' | 'unknown'
export function askPolarity(stem: string): AskPolarity {
  if (/일치하지\s*않는/.test(stem)) return 'find-mismatch'
  if (/일치하는/.test(stem)) return 'find-match'
  return 'unknown'
}

export function tokenize(text: string): Token[] {
  const out: Token[] = []
  for (const m of text.matchAll(/\S+/g)) {
    const start = m.index ?? 0
    out.push({ i: out.length, text: m[0], start, end: start + m[0].length })
  }
  return out
}

const KO_RULES: { kind: RuleKind; re: RegExp }[] = [
  { kind: 'number', re: /\d+(?:[.,]\d+)?/g },
  { kind: 'number', re: /(?:^|\s)(?:한|두|세|네|다섯|여섯|일곱|여덟|아홉|열)\s+(?:개|그루|권|편|명|시간|번|가지|살)/g },
  { kind: 'number', re: /반년|하루|이틀/g },
  { kind: 'time', re: /오전|오후|저녁|아침|매년|매일|매주|당일|생전|사후|동안|어렸을\s*때|기간|일정/g },
  { kind: 'range', re: /이상|이하|미만|초과|넘는|넘게|이내|까지|부터/g },
  { kind: 'modality', re: /수\s*있|해야|와야|않|못|없|무료|유료|필요|금지/g },
]

/** 규칙 성분 — 규칙이 맞은 어절을 묶는다. 범위·기간 표지가 수치 바로 뒤에 오면 한 성분으로 붙인다(「10권이 넘는」 「3시간 동안」) */
export function ruleComponents(choice: string): Component[] {
  const tokens = tokenize(choice)
  const hits: { kind: RuleKind; a: number; b: number }[] = []
  for (const r of KO_RULES) {
    for (const m of choice.matchAll(r.re)) {
      let s = m.index ?? 0
      let e = s + m[0].length
      while (s < e && /\s/.test(choice[s])) s++
      while (e > s && /\s/.test(choice[e - 1])) e--
      const a = tokens.findIndex((t) => t.end > s)
      const b = tokens.findIndex((t) => t.end >= e)
      if (a >= 0 && b >= 0) hits.push({ kind: r.kind, a, b })
    }
  }
  const byToken = new Map<number, Set<RuleKind>>()
  for (const h of hits) for (let i = h.a; i <= h.b; i++) byToken.set(i, (byToken.get(i) ?? new Set()).add(h.kind))
  // 한 규칙이 여러 어절에 걸치면(「수 있다」) 그 어절들을 한 성분으로
  const groups: number[][] = []
  const spanOf = (i: number) => hits.filter((h) => h.a <= i && i <= h.b)
  for (const i of [...byToken.keys()].sort((x, y) => x - y)) {
    const last = groups[groups.length - 1]
    const joined = last && last[last.length - 1] === i - 1 && spanOf(i).some((h) => h.a < i)
    const rangeAfterNumber = last && last[last.length - 1] === i - 1 && [...(byToken.get(i) ?? [])].every((k) => k === 'range' || k === 'time') && last.some((t) => byToken.get(t)?.has('number'))
    if (joined || rangeAfterNumber) last.push(i)
    else groups.push([i])
  }
  return groups.map((g) => {
    const kinds = new Set<RuleKind>()
    g.forEach((t) => byToken.get(t)?.forEach((k) => kinds.add(k)))
    return { id: `r${g[0]}`, tokens: g, text: g.map((t) => tokens[t].text).join(' '), origin: 'rule' as const, kinds: [...kinds], links: [] }
  })
}

export function initialState(item: JudgmentItem): InfoMatchState {
  const choices: Record<number, ChoiceWork> = {}
  item.choices.forEach((c, i) => { choices[i + 1] = { components: ruleComponents(c), pending: [] } })
  return { choices }
}

const work = (s: InfoMatchState, n: number): ChoiceWork => s.choices[n] ?? { components: [], pending: [] }
const put = (s: InfoMatchState, n: number, w: ChoiceWork): InfoMatchState => ({ choices: { ...s.choices, [n]: w } })

export function usedTokens(w: ChoiceWork): Set<number> {
  return new Set(w.components.flatMap((c) => c.tokens))
}

/** 아직 성분에 안 넣은 어절을 고르거나 푼다 */
export function togglePending(s: InfoMatchState, n: number, token: number): InfoMatchState {
  const w = work(s, n)
  if (usedTokens(w).has(token)) return s
  const pending = w.pending.includes(token) ? w.pending.filter((t) => t !== token) : [...w.pending, token].sort((a, b) => a - b)
  return put(s, n, { ...w, pending })
}

/** 고른 어절을 학습자 성분으로 묶는다 */
export function groupPending(s: InfoMatchState, n: number, choiceText: string): InfoMatchState {
  const w = work(s, n)
  if (w.pending.length === 0) return s
  const tokens = tokenize(choiceText)
  const id = `l${w.pending[0]}`
  const comp: Component = { id, tokens: w.pending, text: w.pending.map((t) => tokens[t]?.text ?? '').join(' '), origin: 'learner', kinds: [], links: [] }
  const components = [...w.components, comp].sort((a, b) => a.tokens[0] - b.tokens[0])
  return put(s, n, { components, pending: [] })
}

/** 학습자 성분 풀기(규칙 성분은 규칙의 결과라 남긴다) */
export function ungroup(s: InfoMatchState, n: number, compId: string): InfoMatchState {
  const w = work(s, n)
  return put(s, n, { ...w, components: w.components.filter((c) => !(c.id === compId && c.origin === 'learner')) })
}

export function toggleLink(s: InfoMatchState, n: number, compId: string, unitId: string): InfoMatchState {
  const w = work(s, n)
  return put(s, n, {
    ...w,
    components: w.components.map((c) => {
      if (c.id !== compId) return c
      const links = c.links.includes(unitId) ? c.links.filter((u) => u !== unitId) : [...c.links, unitId]
      // 근거를 모두 풀면 일치·어긋남 표시도 근거를 잃는다
      const mark = links.length === 0 && (c.mark === 'match' || c.mark === 'conflict') ? undefined : c.mark === 'absent' && links.length > 0 ? undefined : c.mark
      return { ...c, links, mark }
    }),
  })
}

/**
 * 표시 가능 여부 — 일치·어긋남은 원문 근거가 있어야 하고, 언급 없음은 연결한 근거가 없어야 한다.
 * 「반대로 말함(어긋남)」과 「아예 말하지 않음(언급 없음)」을 섞지 않게 하는 규칙이다.
 */
export function canMark(c: Component, mark: Mark): { ok: true } | { ok: false; reason: string } {
  if ((mark === 'match' || mark === 'conflict') && c.links.length === 0) return { ok: false, reason: '원문 문장을 먼저 이 성분에 연결해야 일치·어긋남을 표시할 수 있다.' }
  if (mark === 'absent' && c.links.length > 0) return { ok: false, reason: '연결한 원문이 있으면 언급 없음이 아니다. 연결을 풀거나, 그 문장이 반대로 말하면 어긋남을 고른다.' }
  return { ok: true }
}

export function setMark(s: InfoMatchState, n: number, compId: string, mark: Mark | undefined): InfoMatchState {
  const w = work(s, n)
  const target = w.components.find((c) => c.id === compId)
  if (!target) return s
  if (mark && target.mark !== mark && !canMark(target, mark).ok) return s
  const next = target.mark === mark ? undefined : mark
  return put(s, n, { ...w, components: w.components.map((c) => (c.id === compId ? { ...c, mark: next } : c)) })
}

/** 영어 근거 속 범위·조건 표지 — 숫자만 맞추고 단위·범위·조건을 놓치는 실패를 막는 확인 대상 */
const EN_MARKERS: { label: string; re: RegExp }[] = [
  { label: '괄호 속 조건', re: /\([^)]*\)/g },
  { label: '수치 범위', re: /\d+(?:\s*(?:a\.m\.|p\.m\.))?\s*[-–]\s*\d+(?:\s*(?:a\.m\.|p\.m\.))?/gi },
  { label: '경계', re: /\b(?:or more|or less|at least|at most|up to|more than|less than|over|under|aged)\b/gi },
  { label: '단위·빈도', re: /\b(?:per|each day|each|every|annual|all three|half a year)\b/gi },
  { label: '대조·예외', re: /\b(?:but|however|although|instead of|instead|except|or)\b/gi },
  { label: '부정', re: /\b(?:not|no|never|could not|cannot|can't)\b/gi },
  { label: '허용·의무', re: /\b(?:free|required|encouraged|available|must|should|bring|will be provided|will be prepared)\b/gi },
  { label: '시점', re: /\b(?:after|before|during|until|when|throughout)\b/gi },
]

export type Marker = { label: string; text: string }
export function scopeMarkers(text: string): Marker[] {
  const out: Marker[] = []
  const seen = new Set<string>()
  for (const r of EN_MARKERS) {
    for (const m of text.matchAll(r.re)) {
      const key = `${r.label}:${m[0].toLowerCase()}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ label: r.label, text: m[0] })
    }
  }
  return out
}

export function linkedMarkers(c: Component, units: EvidenceUnit[]): { unitId: string; markers: Marker[] }[] {
  return c.links.map((id) => ({ unitId: id, markers: scopeMarkers(units.find((u) => u.id === id)?.text ?? '') }))
}

export type ChoiceTally = {
  total: number
  marked: number
  match: number
  conflict: number
  absent: number
  /** 성분에 넣지 않은 어절 — 일부 성분만 맞춰 선지 전체를 일반화하지 않도록 남은 말을 보인다 */
  uncovered: string[]
  /** 범위·조건 표지가 있는 근거에 일치를 표시한 성분 */
  scopeChecks: { compId: string; markers: Marker[] }[]
}

export function tally(w: ChoiceWork, choiceText: string, units: EvidenceUnit[]): ChoiceTally {
  const used = usedTokens(w)
  const uncovered = tokenize(choiceText).filter((t) => !used.has(t.i)).map((t) => t.text)
  const count = (m: Mark) => w.components.filter((c) => c.mark === m).length
  const scopeChecks = w.components
    .filter((c) => c.mark === 'match')
    .map((c) => ({ compId: c.id, markers: linkedMarkers(c, units).flatMap((x) => x.markers) }))
    .filter((x) => x.markers.length > 0)
  return { total: w.components.length, marked: w.components.filter((c) => c.mark).length, match: count('match'), conflict: count('conflict'), absent: count('absent'), uncovered, scopeChecks }
}

/** 학습자 표시의 요약 문장 — 채점이 아니라 「내 표시로는」 상태 보고 */
export function tallySentence(t: ChoiceTally): string {
  if (t.total === 0) return '아직 성분이 없다. 선지의 어절을 골라 성분으로 묶는다.'
  if (t.marked === 0) return `성분 ${t.total}개 중 표시한 것이 없다.`
  const parts = [`성분 ${t.total}개 중 ${t.marked}개 표시`]
  if (t.conflict) parts.push(`어긋남 ${t.conflict}`)
  if (t.absent) parts.push(`언급 없음 ${t.absent}`)
  if (t.match) parts.push(`일치 ${t.match}`)
  let s = parts.join(' · ')
  if (t.conflict === 0 && t.absent === 0 && (t.marked < t.total || t.uncovered.length > 0)) s += ' — 일치만 표시했지만 남은 성분·말이 있어 선지 전체가 일치한다고 아직 말할 수 없다.'
  return s
}

export type RevealCompare = {
  n: number
  verdict: 'correct' | 'distractor'
  /** 선지가 원문과 일치하는지 — 발문 극성과 verdict 로 정한다 */
  textMatches: boolean | null
  explain: string
  trap?: string
  revealUnits: string[]
  learnerUnits: string[]
  shared: string[]
  missed: string[]
  extra: string[]
  /** 학습자 표시와 해설 판정이 다른 방향인지 */
  disagreement: string | null
}

export function compareWithReveal(item: JudgmentItem, data: RevealData, n: number, w: ChoiceWork): RevealCompare | null {
  const c = data.choices.find((x) => x.n === n)
  if (!c) return null
  const pol = askPolarity(item.stem)
  const isCorrect = c.verdict === 'correct'
  const textMatches = pol === 'unknown' ? null : pol === 'find-mismatch' ? !isCorrect : isCorrect
  const explain = c.verdict === 'correct' ? c.why_correct : c.how_to_reject ?? ''
  const extraIdx = c.verdict === 'correct' ? c.confirmed_at?.sentence_index : undefined
  const revealUnits = [...new Set([...refsOf(explain, item.units), ...(c.verdict === 'correct' ? refsOf(c.confirmed_at?.note, item.units) : []), ...unitsAtIndex(extraIdx, item.units)])]
  const learnerUnits = [...new Set(w.components.flatMap((x) => x.links))]
  const shared = revealUnits.filter((u) => learnerUnits.includes(u))
  const missed = revealUnits.filter((u) => !learnerUnits.includes(u))
  const extra = learnerUnits.filter((u) => !revealUnits.includes(u))
  const hasNeg = w.components.some((x) => x.mark === 'conflict' || x.mark === 'absent')
  const allMatch = w.components.length > 0 && w.components.every((x) => x.mark === 'match')
  let disagreement: string | null = null
  if (textMatches === true && hasNeg) disagreement = '해설은 이 선지를 원문과 일치로 본다. 어긋남·언급 없음으로 표시한 성분의 근거를 다시 대 본다.'
  else if (textMatches === false && allMatch) disagreement = '해설은 이 선지가 원문과 어긋난다고 본다. 모든 성분을 일치로 표시했으니 바뀐 성분을 해설 근거에서 찾는다.'
  return { n, verdict: c.verdict, textMatches, explain, trap: c.verdict === 'distractor' ? c.trap : undefined, revealUnits, learnerUnits, shared, missed, extra, disagreement }
}
