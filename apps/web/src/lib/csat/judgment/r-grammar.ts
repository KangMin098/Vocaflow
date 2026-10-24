// apps/web/src/lib/csat/judgment/r-grammar.ts
// R-GRAMMAR(어법) 판단 모델 — 밑줄 지점마다 학습자가 문장 구조(주어·정동사·수식 묶음)를 직접 표시하고,
// 「이 자리에 무엇이 필요한가」를 고르고, 대안 형태로 바꿔 성립/실패를 스스로 비교한다.
// 공개 전에는 채점하지 않는다. 경고는 학습자가 표시한 구조에서 나온 반례 질문일 뿐 정답 판정이 아니다.
//
// 선지 위치는 DB choices 문자열이 아니라 units 텍스트의 ①~⑤ 기호 위치로 찾는다.
// (choices 는 밑줄 구간이 아니라 ①부터 다음 기호까지 잘린 긴 문자열로 저장된 결함이 있다 — choiceDefects 가 기록한다.)
import type { EvidenceUnit, JudgmentItem, RevealData } from './types'

export const CIRCLED = ['①', '②', '③', '④', '⑤'] as const

export type Mark = {
  /** 1~5 */
  n: number
  unitId: string
  /** 기호를 뺀 문장 낱말들(구두점 붙은 채) */
  tokens: string[]
  /** 기호 바로 뒤 낱말의 tokens 인덱스 */
  at: number
  /** 기본 밑줄 후보 길이(낱말 수) — 후보일 뿐, 학습자가 조정한다 */
  defaultLen: number
}

export type Defect =
  | { kind: 'choice-overlong'; n: number; words: number }
  | { kind: 'mark-missing'; n: number }
  | { kind: 'mark-count'; marks: number; choices: number }

const MAX_SPAN = 4

function tokenize(text: string): string[] {
  return text.split(/\s+/).filter(Boolean)
}

/** units 의 ①~⑤ 위치 → 밑줄 지점. 기호가 낱말에 붙어 있어도(「①which」) 떼어 낸다 */
export function parseMarks(units: EvidenceUnit[]): Mark[] {
  const marks: Mark[] = []
  for (const u of units) {
    const raw = tokenize(u.text)
    const tokens: string[] = []
    const found: { n: number; at: number }[] = []
    for (const t of raw) {
      const idx = CIRCLED.findIndex((c) => t.startsWith(c))
      if (idx < 0) { tokens.push(t); continue }
      found.push({ n: idx + 1, at: tokens.length })
      const rest = t.slice(1)
      if (rest) tokens.push(rest)
    }
    for (const f of found) {
      if (f.at >= tokens.length) continue
      const first = clean(tokens[f.at]).toLowerCase()
      marks.push({ n: f.n, unitId: u.id, tokens, at: f.at, defaultLen: first === 'to' && f.at + 1 < tokens.length ? 2 : 1 })
    }
  }
  return marks.sort((a, b) => a.n - b.n)
}

/** 원문 파싱 결함 기록 — 화면은 이 결함에 기대지 않는다(choices 를 밑줄 문자열로 쓰지 않는다) */
export function choiceDefects(item: JudgmentItem, marks = parseMarks(item.units)): Defect[] {
  const out: Defect[] = []
  if (marks.length !== item.choices.length) out.push({ kind: 'mark-count', marks: marks.length, choices: item.choices.length })
  item.choices.forEach((c, i) => {
    const words = tokenize(c).length
    if (words > 6) out.push({ kind: 'choice-overlong', n: i + 1, words })
    if (!marks.some((m) => m.n === i + 1)) out.push({ kind: 'mark-missing', n: i + 1 })
  })
  return out
}

export function clean(t: string): string {
  return t.replace(/^[“"‘'(]+|[.,;:!?”"’')]+$/g, '')
}

export function clampLen(m: Mark, len: number): number {
  return Math.max(1, Math.min(MAX_SPAN, m.tokens.length - m.at, len))
}

/** 학습자가 조정한 밑줄 후보 구간의 낱말 */
export function spanText(m: Mark, len: number): string {
  return m.tokens.slice(m.at, m.at + clampLen(m, len)).map(clean).join(' ')
}

// ── 학습자 판단 상태 ───────────────────────────────────────────

export type Role = 'S' | 'V' | 'M'
export const ROLE_LABEL: Record<Role, string> = { S: '주어', V: '정동사', M: '수식 묶음' }

export type Need = 'finite-verb' | 'nonfinite' | 'rel-gap' | 'rel-complete' | 'modifier' | 'voice'
export const NEEDS: { id: Need; label: string; ask: string }[] = [
  { id: 'finite-verb', label: '정동사 자리', ask: '이 절의 주어는 무엇이고 수가 맞는가?' },
  { id: 'nonfinite', label: '준동사 자리', ask: '이 절에 정동사가 이미 있는가?' },
  { id: 'rel-gap', label: '뒤가 불완전 — 관계대명사', ask: '뒤 절에서 빠진 명사 자리가 어디인가?' },
  { id: 'rel-complete', label: '뒤가 완전 — 관계부사·전치사+관계사', ask: '뒤 절에 주어·동사·목적어가 다 있는가?' },
  { id: 'modifier', label: '수식어 자리 — 부사/형용사', ask: '이 낱말이 꾸미는 것은 명사인가, 동사·형용사인가?' },
  { id: 'voice', label: '능동/수동', ask: '주어가 동작을 하는가, 받는가?' },
]

/** 원리의 적용 한계 — 성분 세기·위치 규칙만으로 닫히지 않는 경우 */
export const LIMITS: Record<Need, string> = {
  'finite-verb': '도치(There is …, 부정어 도치)와 상관접속사(either A or B) 주어는 위치만으로 정하지 않는다.',
  nonfinite: '지각·사역동사 뒤 원형, 관용 -ing(be busy -ing)는 「정동사가 있으면 준동사」 규칙만으로 형태가 정해지지 않는다.',
  'rel-gap': 'what 은 선행사를 품는다 — 앞에 선행사가 있으면 쓸 수 없다. 관계대명사가 생략된 절은 기호가 없어도 빈자리가 있다.',
  'rel-complete': '관계사 생략, the way how 불가 같은 관용은 성분 세기로 닫히지 않는다. 선행사의 뜻(장소·시간)만으로 where 를 단정하지 않는다.',
  modifier: 'look·become·grow(되다) 같은 2형식 동사 뒤는 형용사 보어다 — 「동사 뒤면 부사」로 일반화하지 않는다.',
  voice: '자동사는 수동이 없고, be + p.p. 는 동작이 아니라 상태(be warmed up)일 수 있다.',
}

export type Judg = 'holds' | 'fails' | 'unsure'
export const JUDG_LABEL: Record<Judg, string> = { holds: '성립', fails: '실패', unsure: '모르겠다' }

export type MarkState = { len?: number; roles: Record<number, Role>; need?: Need; alt: Record<string, Judg> }
export type GrammarState = Record<number, MarkState>

export function markState(s: GrammarState, n: number): MarkState {
  return s[n] ?? { roles: {}, alt: {} }
}

export function setRole(s: GrammarState, n: number, token: number, role: Role | null): GrammarState {
  const cur = markState(s, n)
  const roles = { ...cur.roles }
  if (role === null || roles[token] === role) delete roles[token]
  else roles[token] = role
  return { ...s, [n]: { ...cur, roles } }
}

export function patchMark(s: GrammarState, n: number, patch: Partial<MarkState>): GrammarState {
  return { ...s, [n]: { ...markState(s, n), ...patch } }
}

// ── 대안 형태(조건 조작) ─────────────────────────────────────────
// 낱말을 지어내지 않는다: 철자가 규칙으로 확정되는 것(which↔where, is↔are, -ly 떼기)만 낱말로 쓰고,
// 나머지는 「형태 종류」 이름으로 보인다.

export type Alt = { id: string; label: string }

const REL_SWAP: Record<string, string[]> = {
  which: ['where', 'what', 'that'],
  where: ['which', 'in which'],
  what: ['which', 'that'],
  that: ['which', 'what'],
  who: ['whom', 'which'],
  whom: ['who'],
  when: ['which'],
}
const BE_SWAP: Record<string, string> = { is: 'are', are: 'is', was: 'were', were: 'was', has: 'have', have: 'has', does: 'do', do: 'does' }

export function alternativesOf(m: Mark, len: number): Alt[] {
  const words = spanText(m, len).split(' ')
  const w = words[0].toLowerCase()
  const original: Alt = { id: 'orig', label: `원문 그대로: ${spanText(m, len)}` }
  const alts: Alt[] = []
  if (REL_SWAP[w]) for (const r of REL_SWAP[w]) alts.push({ id: `rel:${r}`, label: [r, ...words.slice(1)].join(' ') })
  else if (BE_SWAP[w]) alts.push({ id: `num:${BE_SWAP[w]}`, label: [BE_SWAP[w], ...words.slice(1)].join(' ') + ' (수 바꾸기)' })
  else if (w === 'to' && words[1]) {
    alts.push({ id: 'form:ing', label: `${words[1]} 의 -ing 형` }, { id: 'form:bare', label: `to 없는 원형 ${words[1]}` })
  } else if (/ly$/.test(w) && w.length > 4) {
    const adj = w.endsWith('ily') ? w.slice(0, -3) + 'y' : w.endsWith('bly') ? w.slice(0, -1) + 'e' : w.slice(0, -2)
    alts.push({ id: `adj:${adj}`, label: `${adj} (형용사형)` })
  } else if (/ing$/.test(w)) {
    alts.push({ id: 'form:finite', label: `${w} 대신 정동사형(-s/-ed)` }, { id: 'form:pp', label: `${w} 대신 과거분사형` }, { id: 'form:to', label: `${w} 대신 to부정사` })
  } else if (/ed$/.test(w)) {
    alts.push({ id: 'form:ing', label: `${w} 대신 -ing 형` }, { id: 'form:bare', label: `${w} 대신 원형` })
  } else {
    alts.push({ id: 'form:to', label: `to ${w}` }, { id: 'form:ing', label: `${w} 의 -ing 형` }, { id: 'form:pp', label: `${w} 의 과거분사형` })
  }
  return [original, ...alts]
}

// ── 실패 조건(반례) 질문 — 학습자가 표시한 구조에서만 나온다 ─────────

export type Warning = { id: 'near-noun' | 'initial-ing' | 'no-structure' | 'no-subject'; text: string }

const PREP = new Set(['of', 'in', 'with', 'for', 'on', 'at', 'from', 'by', 'about', 'into', 'within'])

export function warningsOf(m: Mark, st: MarkState): Warning[] {
  const out: Warning[] = []
  const entries = Object.entries(st.roles).map(([k, r]) => [Number(k), r] as const)
  const subj = entries.filter(([, r]) => r === 'S').map(([i]) => i)
  const verb = entries.filter(([, r]) => r === 'V').map(([i]) => i)
  for (const i of subj) {
    // 주어로 고른 낱말 앞 세 낱말 안에 전치사가 있으면(그 사이에 다른 표시·쉼표 없이) 전치사의 목적어일 수 있다
    let p: string | null = null
    for (let k = i - 1; k >= Math.max(0, i - 3); k--) {
      if (st.roles[k] || /[,;]$/.test(m.tokens[k])) break
      const w = clean(m.tokens[k]).toLowerCase()
      if (PREP.has(w)) { p = w; break }
    }
    if (p) {
      out.push({ id: 'near-noun', text: `주어로 고른 「${clean(m.tokens[i])}」 앞에 전치사 ${p} 가 있다. 전치사 뒤 명사는 주어가 될 수 없다 — 동사에 가장 가까운 명사에 수를 맞추는 실패 조건이 아닌지 확인한다.` })
      break
    }
  }
  const first = clean(m.tokens[0] ?? '')
  if (/ing$/i.test(first) && st.roles[0] === 'M') {
    const firstV = verb.length ? Math.min(...verb) : -1
    const otherSubj = subj.some((i) => i > 0 && i < firstV)
    if (firstV > 0 && !otherSubj) out.push({ id: 'initial-ing', text: `문두 「${first}」를 수식(분사구문)으로 묶었는데, 정동사 앞에 다른 주어를 표시하지 않았다. 그러면 -ing 가 주어(동명사)일 수 있다 — 문두 -ing 를 분사구문으로 단정하는 실패 조건.` })
  }
  if ((st.need === 'rel-gap' || st.need === 'rel-complete') && !entries.some(([i, r]) => i > m.at && (r === 'S' || r === 'V'))) {
    out.push({ id: 'no-structure', text: '관계사 낱말 하나만으로는 완전/불완전을 말할 수 없다. 기호 뒤 절의 주어·정동사를 먼저 표시해 성분을 센다.' })
  }
  if (st.need === 'finite-verb' && subj.length === 0) {
    out.push({ id: 'no-subject', text: '수 일치는 주어를 정해야 판단된다. 이 동사의 주어 낱말을 먼저 표시한다.' })
  }
  return out
}

// ── 공개 뒤 대조 ───────────────────────────────────────────────

export type LearnerRecord = { span: string; need?: string; subjects: string[]; verbs: string[]; groups: string[]; alt: { label: string; judg: Judg }[] }

export function learnerRecord(m: Mark, st: MarkState): LearnerRecord {
  const pick = (r: Role) => Object.entries(st.roles).filter(([, x]) => x === r).map(([i]) => clean(m.tokens[Number(i)]))
  const alts = alternativesOf(m, st.len ?? m.defaultLen)
  return {
    span: spanText(m, st.len ?? m.defaultLen),
    need: NEEDS.find((x) => x.id === st.need)?.label,
    subjects: pick('S'),
    verbs: pick('V'),
    groups: pick('M'),
    alt: alts.filter((a) => st.alt[a.id]).map((a) => ({ label: a.label, judg: st.alt[a.id] })),
  }
}

/** 공개 자료에서 이 지점의 해설 — 공개 뒤에만 호출한다 */
export function analysisFor(data: RevealData, n: number) {
  return data.choices.find((c) => c.n === n)
}
