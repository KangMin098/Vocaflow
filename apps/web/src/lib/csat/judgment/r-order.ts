// apps/web/src/lib/csat/judgment/r-order.ts
// R-ORDER(글의 순서) 판단 모델 — 단락 분해 · 이음매 단서 후보 · 학습자 연결 · 배열/선지별 끊긴 연결.
// 공개 전에는 정답을 모른다: 판정 기준은 오직 학습자가 고른 「단서 → 전제 대상」 연결이다.
import type { ChoiceAnalysis, EvidenceUnit, JudgmentItem, RevealData } from './types'

export type ParaKey = 'G' | 'A' | 'B' | 'C'
export type Movable = Exclude<ParaKey, 'G'>
export type Paragraph = { key: ParaKey; label: string; unitIds: string[] }
export type OrderModel = { given: Paragraph; paras: Record<Movable, Paragraph>; unitPara: Record<string, ParaKey> }

export const PARA_LABEL: Record<ParaKey, string> = { G: '주어진 글', A: '(A)', B: '(B)', C: '(C)' }
const MARK = /^\s*\(([ABC])\)\s*/

/** 단락 표지 '(A)' 로 시작하는 단위부터 다음 표지 전까지를 한 단락으로 — 표지 앞은 주어진 글. 구조가 맞지 않으면 null */
export function parseOrder(units: EvidenceUnit[]): OrderModel | null {
  const buckets: Record<ParaKey, string[]> = { G: [], A: [], B: [], C: [] }
  let cur: ParaKey = 'G'
  const seen = new Set<ParaKey>()
  for (const u of units) {
    const m = MARK.exec(u.text)
    if (m) {
      const k = m[1] as Movable
      if (seen.has(k)) return null
      seen.add(k)
      cur = k
    }
    buckets[cur].push(u.id)
  }
  if (buckets.G.length === 0 || !buckets.A.length || !buckets.B.length || !buckets.C.length) return null
  const unitPara: Record<string, ParaKey> = {}
  for (const k of ['G', 'A', 'B', 'C'] as ParaKey[]) for (const id of buckets[k]) unitPara[id] = k
  const mk = (key: ParaKey): Paragraph => ({ key, label: PARA_LABEL[key], unitIds: buckets[key] })
  return { given: mk('G'), paras: { A: mk('A'), B: mk('B'), C: mk('C') }, unitPara }
}

/** '(C) - (A) - (B)' → ['C','A','B']. 세 표지가 정확히 한 번씩이 아니면 null(잘린 선지 문자열에 기대지 않는다) */
export function parseChoiceOrder(s: string): Movable[] | null {
  const ks = [...s.matchAll(/\(([ABC])\)/g)].map((m) => m[1] as Movable)
  return ks.length === 3 && new Set(ks).size === 3 ? ks : null
}

export type CueKind = 'example' | 'time' | 'contrast' | 'demonstrative' | 'pronoun' | 'pronounInner' | 'definite' | 'repeat'
export type Cue = { id: string; para: Movable; unitId: string; text: string; kind: CueKind }

/** 단서 종류별 — 무엇을 전제하는가 · 약한 단서인가 */
export const CUE_INFO: Record<CueKind, { name: string; presupposes: string; weak: boolean }> = {
  example: { name: '예시 표지', presupposes: '앞에 이 사례가 뒷받침할 일반 주장이 있다', weak: false },
  time: { name: '시간 표지', presupposes: '앞에 기준이 되는 이전 시점이 있다', weak: false },
  contrast: { name: '대비 표지', presupposes: '앞에 반대 방향의 서술이 있다', weak: false },
  demonstrative: { name: '지시어', presupposes: '앞에 가리킬 구체적 대상·현상이 서술돼 있다', weak: false },
  pronoun: { name: '문두 대명사', presupposes: '단락 첫머리 대명사라 선행 명사가 앞 단락에 있을 가능성이 크다', weak: false },
  pronounInner: { name: '문장 안 대명사', presupposes: '같은 문장 앞쪽에 선행사가 있으면 단락 순서와 무관하다 — 먼저 같은 문장 안에서 찾는다', weak: true },
  definite: { name: '정관사', presupposes: '앞에 이 명사가 이미 소개됐을 수 있다(일반 지식으로도 쓰인다)', weak: true },
  repeat: { name: '같은 낱말', presupposes: '다른 단락에도 같은 낱말이 있다 — 방향을 정하지 않는다', weak: true },
}

const PATTERNS: { kind: CueKind; re: RegExp }[] = [
  { kind: 'example', re: /\b(?:For (?:example|instance)|To illustrate)\b/g },
  { kind: 'time', re: /\b(?:Later|Then|Afterwards?|Eventually|Finally|Soon after|At first)\b/g },
  { kind: 'contrast', re: /\b(?:By contrast|In contrast|However|(?<!even )though|Instead|On the other hand)\b/g },
  { kind: 'demonstrative', re: /\b(?:This|These|That|Those|Such)\s+[a-z]+/g },
  { kind: 'demonstrative', re: /\b(?:This|These)\b(?=\s+(?:is|are|was|were|may|can|will|shows?)\b)/g },
  { kind: 'pronoun', re: /^(?:They|It|He|She|We)\b|\b(?:they|them|their|it(?! is\b| was\b)|its|he|she|him|her)\b/g },
  { kind: 'definite', re: /\b[Tt]he\s+(?:[a-z-]+\s+){0,2}[a-z-]{4,}/g },
]
const STOP = new Set(['these', 'those', 'their', 'there', 'which', 'would', 'could', 'should', 'about', 'other', 'while', 'where', 'example', 'later', 'though', 'contrast', 'different', 'because'])

const words = (t: string) => (t.toLowerCase().match(/[a-z]{5,}/g) ?? []).filter((w) => !STOP.has(w))
const stem = (w: string) => w.slice(0, 6)

/** 각 단락 첫 단위(앞 단락과 맞닿는 첫머리)에서 단서 후보를 고른다. 학습자가 고를 후보일 뿐 판정이 아니다 */
export function cueCandidates(item: JudgmentItem, model: OrderModel): Cue[] {
  const byId = new Map(item.units.map((u) => [u.id, u]))
  const out: Cue[] = []
  for (const k of ['A', 'B', 'C'] as Movable[]) {
    const head = byId.get(model.paras[k].unitIds[0])
    if (!head) continue
    const text = head.text.replace(MARK, '')
    const taken: [number, number, CueKind][] = []
    // 약한 단서는 앞쪽 몇 개만 — 후보가 지문 전체 낱말 목록이 되면 고르기가 판단이 아니라 찾기가 된다
    const cap = (kind: CueKind, n: number) => out.filter((c) => c.para === k && c.kind === kind).length >= n
    const push = (kind: CueKind, at: number, s: string) => {
      // 반복 낱말은 정관사 구 안에 있어도 따로 고를 수 있다('the roots of individualism')
      if (taken.some(([a, b, tk]) => at < b && at + s.length > a && !(kind === 'repeat' && tk === 'definite'))) return
      taken.push([at, at + s.length, kind])
      out.push({ id: `${k}-${out.length}`, para: k, unitId: head.id, text: s, kind })
    }
    for (const { kind, re } of PATTERNS) {
      for (const m of text.matchAll(re)) {
        if (kind === 'definite' && cap('definite', 2)) continue
        // 문장 중간 대명사는 대개 같은 문장의 앞 명사를 받는다(T-0151 P1-02) — 단락 간 강한 단서로 올리지 않는다
        const at = m.index ?? 0
        push(kind === 'pronoun' && at > 0 ? 'pronounInner' : kind, at, m[0])
      }
    }
    // 같은 낱말 반복 — 다른 단락에도 같은 어간이 있는 내용어
    const elsewhere = new Set(item.units.filter((u) => model.unitPara[u.id] !== k).flatMap((u) => words(u.text).map(stem)))
    const seenRep = new Set<string>()
    for (const m of text.matchAll(/[A-Za-z]{5,}/g)) {
      const w = m[0].toLowerCase()
      if (cap('repeat', 3) || STOP.has(w) || !elsewhere.has(stem(w)) || seenRep.has(stem(w))) continue
      seenRep.add(stem(w))
      push('repeat', m.index ?? 0, m[0])
    }
  }
  return out.map((c, i) => ({ ...c, id: `${c.para}-${i}` }))
}

/** 학습자가 만든 연결: 단서 → 그 단서가 전제하는 원문 단위 */
export type Link = { cueId: string; para: Movable; cueText: string; kind: CueKind; antecedent: string; antecedentPara: ParaKey }

/** 같은 단락 안에서 전제 대상이 해소됨 — 올바른 읽기일 수 있지만 단락 순서의 근거는 아니다 */
export type InsideLink = { inside: true; cueId: string; antecedent: string; message: string }

export function makeLink(cue: Cue, antecedentUnit: string, model: OrderModel): Link | InsideLink | { error: string } {
  const p = model.unitPara[antecedentUnit]
  if (!p) return { error: '원문에 없는 단위다.' }
  if (p === cue.para) return { inside: true, cueId: cue.id, antecedent: antecedentUnit, message: `'${cue.text}' 는 같은 단락 안에서 해소된다 — 맞는 읽기일 수 있지만 단락 순서를 정하는 근거는 아니다.` }
  return { cueId: cue.id, para: cue.para, cueText: cue.text, kind: cue.kind, antecedent: antecedentUnit, antecedentPara: p }
}

export type Arrangement = [Movable, Movable, Movable]
export const fullOrder = (a: readonly Movable[]): ParaKey[] => ['G', ...a]

export function moveIn(a: Arrangement, k: Movable, dir: -1 | 1): Arrangement {
  const i = a.indexOf(k), j = i + dir
  if (i < 0 || j < 0 || j > 2) return a
  const n = [...a] as Arrangement
  ;[n[i], n[j]] = [n[j], n[i]]
  return n
}

export type LinkStatus = 'closed' | 'distant' | 'broken'
/** closed = 전제 대상이 바로 앞 단락(이음매가 닫힘) · distant = 앞에 있지만 맞닿지 않음 · broken = 전제 대상이 뒤에 옴 */
export function linkStatus(order: ParaKey[], l: Link): LinkStatus {
  const ci = order.indexOf(l.para), ai = order.indexOf(l.antecedentPara)
  if (ai > ci) return 'broken'
  return ai === ci - 1 ? 'closed' : 'distant'
}

export type Junction = { index: number; front: ParaKey; back: Movable; frontUnit: string; backUnit: string; links: { link: Link; status: LinkStatus }[]; weakOnly: boolean }

/** 배열의 세 이음매(앞 단락 끝 ↔ 뒤 단락 첫머리)와 그 이음매에 걸린 학습자 연결 */
export function junctions(model: OrderModel, arrangement: readonly Movable[], links: Link[]): Junction[] {
  const order = fullOrder(arrangement)
  const para = (k: ParaKey) => (k === 'G' ? model.given : model.paras[k])
  return [1, 2, 3].map((i) => {
    const front = order[i - 1], back = order[i] as Movable
    const mine = links.filter((l) => l.para === back).map((link) => ({ link, status: linkStatus(order, link) }))
    const closing = mine.filter((x) => x.status === 'closed')
    return {
      index: i, front, back,
      frontUnit: para(front).unitIds[para(front).unitIds.length - 1],
      backUnit: para(back).unitIds[0],
      links: mine,
      weakOnly: closing.length > 0 && closing.every((x) => CUE_INFO[x.link.kind].weak),
    }
  })
}

/** 배열에서 끊긴 연결 — 학습자 근거 기준. 정답 판정이 아니다 */
export function brokenLinks(arrangement: readonly Movable[], links: Link[]): Link[] {
  const order = fullOrder(arrangement)
  return links.filter((l) => linkStatus(order, l) === 'broken')
}

export type ChoiceCompare = { n: number; label: string; order: Movable[] | null; broken: Link[]; sameAsMine: boolean }
export function compareChoices(item: JudgmentItem, arrangement: readonly Movable[], links: Link[]): ChoiceCompare[] {
  return item.choices.map((label, i) => {
    const order = parseChoiceOrder(label)
    return { n: i + 1, label, order, broken: order ? brokenLinks(order, links) : [], sameAsMine: Boolean(order && order.join() === arrangement.join()) }
  })
}

export type Caution = { kind: 'failure' | 'limit'; linkCue: string; text: string }
/** 성립하지 않는 조건(약한 단서만으로 잇기) · 원리의 한계(양방향으로 읽히는 연결) */
export function cautions(links: Link[]): Caution[] {
  const out: Caution[] = []
  for (const l of links) {
    if (l.kind === 'repeat') out.push({ kind: 'failure', linkCue: l.cueText, text: `'${l.cueText}' 는 다른 단락에도 나올 뿐 무엇이 먼저인지 말하지 않는다. 같은 낱말 반복만으로는 잇지 못한다 — 출제자가 미끼로 쓰기도 한다.` })
    if (l.kind === 'definite') out.push({ kind: 'failure', linkCue: l.cueText, text: `'${l.cueText}' 의 정관사는 앞선 소개를 시사할 뿐, 일반 지식으로도 쓰인다. 정관사 하나로 순서를 단정하지 않는다 — 지시어·시간·대비 단서와 겹칠 때만 힘이 있다.` })
    const back = links.find((o) => o !== l && o.para === l.antecedentPara && o.antecedentPara === l.para)
    if (back && l.cueId < back.cueId) out.push({ kind: 'limit', linkCue: l.cueText, text: `'${l.cueText}' 와 '${back.cueText}' 가 서로를 전제한다 — 두 연결이 동시에 닫힐 수 없다. 단서가 양방향으로 읽히면 이 원리만으로는 순서가 정해지지 않으니 다른 이음매로 정한다.` })
  }
  return out
}

/** 공개 뒤: 선지 순서에만 있는(정답 순서에는 없는) 이음매 — 그 선지의 함정이 걸린 지점 */
export type RevealJunctionNote = { n: number; label: string; extra: [ParaKey, ParaKey][]; analysis: ChoiceAnalysis }
export function revealNotes(item: JudgmentItem, data: RevealData): { answerOrder: Movable[] | null; notes: RevealJunctionNote[] } {
  const answerOrder = parseChoiceOrder(item.choices[data.answer - 1] ?? '')
  const pairs = (o: readonly Movable[]) => { const f = fullOrder(o); return [1, 2, 3].map((i) => [f[i - 1], f[i]] as [ParaKey, ParaKey]) }
  const ans = new Set(answerOrder ? pairs(answerOrder).map((p) => p.join('>')) : [])
  const notes = item.choices.map((label, i) => {
    const o = parseChoiceOrder(label)
    const analysis = data.choices.find((c) => c.n === i + 1) ?? data.choices[i]
    return { n: i + 1, label, extra: o && answerOrder ? pairs(o).filter((p) => !ans.has(p.join('>'))) : [], analysis }
  })
  return { answerOrder, notes }
}
