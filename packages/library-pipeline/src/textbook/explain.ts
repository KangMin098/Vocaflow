// packages/library-pipeline/src/textbook/explain.ts
//
// **해설을 결정론으로 쓴다.** 상업 교재 제작 8단계 중 6번(해답·해설)이 없었다.
//
// ── 왜 결정론으로 되는가 ─────────────────────────────────────────────
// 순서·삽입은 **정답의 근거가 지문 표면에 남아 있다.** 글은 앞 문장을 받아 가며 이어지고,
// 그 이음매는 낱말로 드러난다 — 지시어(This·These) · 대명사(It·They) · 연결어(However·So) ·
// 한정사 전환(a rocket → the rocket) · 어휘 반복. 그 자국을 찾으면 "왜 여기인지" 를
// 지어내지 않고 **지문을 인용해서** 말할 수 있다.
//
// ── 규칙: 못 찾으면 안 쓴다 ──────────────────────────────────────────
// 근거를 못 찾았는데 그럴듯한 문장을 만들어 붙이는 것이 **가장 나쁜 해설**이다.
// 학습자는 그것을 믿고 틀린 규칙을 배운다. 그래서 `evidence` 가 비면 `body` 는 `null` 이고,
// 커버리지가 낮게 나오는 쪽을 택했다. 낮은 숫자는 고칠 수 있지만 거짓 해설은 못 고친다.
//
// ── 단서 목록은 실측이다 ─────────────────────────────────────────────
// `scripts/textbook/cue-probe.mjs` 로 문항 2,076개에서 근거가 될 자리의 문장 5,495개를 뽑아
// 첫 낱말 분포를 셌다(2026-08-21). 아래 목록의 낱말은 **그 분포에 실제로 나타난 것**이고,
// 주석의 %는 후보 문장 대비 실측 비율이다. 안 나타난 낱말은 넣지 않았다.
//
//     The 14.09 · In 4.44 · This 3.71 · It 3.53 · I 3.53 · He 2.75 · They 1.91 · But 1.87
//     A 1.64 · As 1.49 · However 1.35 · These 1.31 · We 1.31 · For 1.29 · There 1.20
//     And 1.18 · She 1.11 · When 0.93 · Then 0.91 · So 0.86 …  (서로 다른 첫 낱말 912종)

import type { CsatOrderItem, CsatInsertItem } from './csat-format'

/** 근거의 종류. 위쪽이 더 강하다 — 방향(무엇이 앞인지)까지 말해 주는 것이 강한 근거다. */
export type EvidenceKind =
  /** 한정사 전환 — 앞에서 `a/an X` 로 처음 나오고 뒤에서 `the X` 로 받는다. 방향이 확정된다. */
  | 'first_mention'
  /** 지시어 — `This/These/That/Those/Such` 가 앞의 명사를 받는다. */
  | 'demonstrative'
  /** 연결어 — `However/So/Then` 등. 앞이 있어야 성립하고 관계(대조·결과·추가·시간)까지 말한다. */
  | 'connective'
  /** 대명사 — `It/They/He/She` 등. 앞에 받을 것이 있어야 한다. */
  | 'pronoun'
  /** 어휘 반복 — 같은 내용어가 앞에 나온다. 가장 약하지만 가장 흔하다. */
  | 'lexical_repeat'

/** 연결어가 앞 내용과 맺는 관계. 해설 문장이 여기서 갈린다. */
export type Relation = 'contrast' | 'result' | 'addition' | 'sequence' | 'example' | 'summary'

export interface Evidence {
  kind: EvidenceKind
  /** 단서 — **지문에 그대로 있는 문자열**이어야 한다. */
  cue: string
  /** 그 단서가 받는 앞쪽 근거. 지문에 그대로 있는 문자열. 특정하지 못하면 null. */
  antecedent: string | null
  /** 근거가 가리키는 앞쪽 위치. */
  from: string
  /** 근거가 놓인 위치. */
  at: string
  ko: string
}

export interface Explanation {
  /** 문항의 정답과 같아야 한다 — 해설이 다른 답을 설명하면 그건 결함이다. */
  answer: number
  /** 근거. **비어 있으면 해설을 만들지 않은 것.** */
  evidence: Evidence[]
  /** 학습자에게 보일 해설. 근거가 없으면 null. */
  body: string | null
}

// ── 단서 사전 ────────────────────────────────────────────────────────

/** 연결어 → 관계. 여러 낱말짜리를 먼저 본다(`in addition` 이 `and` 보다 우선). */
const CONNECTIVES: ReadonlyArray<readonly [string, Relation]> = [
  // 대조 — But 1.87% · However 1.35% · Although 0.29% 실측
  ['on the other hand', 'contrast'],
  ['nevertheless', 'contrast'],
  ['nonetheless', 'contrast'],
  ['in contrast', 'contrast'],
  ['conversely', 'contrast'],
  ['however', 'contrast'],
  ['although', 'contrast'],
  ['instead', 'contrast'],
  ['whereas', 'contrast'],
  ['though', 'contrast'],
  ['still', 'contrast'],
  ['yet', 'contrast'],
  ['but', 'contrast'],
  // 결과 — So 0.86% 실측
  ['as a result', 'result'],
  ['consequently', 'result'],
  ['accordingly', 'result'],
  ['therefore', 'result'],
  ['because', 'result'],
  ['thus', 'result'],
  ['hence', 'result'],
  ['so', 'result'],
  // 추가 — And 1.18% · Additionally 0.25% 실측
  ['furthermore', 'addition'],
  ['additionally', 'addition'],
  ['in addition', 'addition'],
  ['moreover', 'addition'],
  ['besides', 'addition'],
  ['also', 'addition'],
  ['and', 'addition'],
  // 시간·순서 — Then 0.91% · After 0.76% · Now 0.40% 실측
  ['at the same time', 'sequence'],
  ['meanwhile', 'sequence'],
  ['afterward', 'sequence'],
  ['eventually', 'sequence'],
  ['finally', 'sequence'],
  ['later', 'sequence'],
  ['then', 'sequence'],
  ['next', 'sequence'],
  ['soon', 'sequence'],
  ['once', 'sequence'],
  ['now', 'sequence'],
  // 예시 — For 1.29% 실측(For example 포함)
  ['for instance', 'example'],
  ['for example', 'example'],
  // 요약
  ['in conclusion', 'summary'],
  ['in summary', 'summary'],
  ['in short', 'summary'],
  ['overall', 'summary'],
]

const RELATION_KO: Record<Relation, string> = {
  contrast: '앞의 내용을 뒤집는다',
  result: '앞의 내용에서 나온 결과다',
  addition: '앞의 내용에 하나를 더 얹는다',
  sequence: '앞의 일 다음에 일어난다',
  example: '앞의 내용을 예로 든다',
  summary: '앞의 내용을 묶는다',
}

/** 지시어 — This 3.71% · These 1.31% · That 0.69% 실측. */
const DEMONSTRATIVES = ['these', 'those', 'this', 'that', 'such'] as const

/** 대명사 — It 3.53% · He 2.75% · They 1.91% · She 1.11% · His 0.56% · Its 0.40% · Her 0.40% 실측. */
const PRONOUNS = ['they', 'them', 'their', 'she', 'her', 'his', 'him', 'its', 'it', 'he'] as const

/**
 * 어휘 반복에서 뺄 낱말.
 *
 * 실측 첫 낱말 분포의 상위 기능어와 일반 불용어다. 여기 없는 낱말이 앞뒤에 함께 나오면
 * **내용어**로 본다 — 그게 어휘 사슬이다.
 */
const STOPWORDS = new Set(
  (
    'the a an and or but of to in on at by for with from as is are was were be been being have has had ' +
    'do does did will would can could should may might must not no nor so if then than that this these ' +
    'those it its they them their there here he she his her him we our you your i my me one all some ' +
    'more most other such into over about after before during when while which who whom whose what how ' +
    'why where also very much many any each both just only same own too said says say like well even ' +
    'first also them well make made'
  ).split(' '),
)

// ── 조사 붙이기 ─────────────────────────────────────────────────────
//
// 해설은 영어 낱말을 한국어 문장 안에 넣는다. 조사를 고정하면 `"animal" 를` 처럼
// 인쇄된다 — 교재에서는 그냥 오탈자다. 앞말의 **받침 유무**로 갈라야 하는데, 영어 낱말은
// 한국어로 옮겼을 때의 끝소리로 판단한다.
//
//   받침 있음   animal 애니멀 · chicken 치킨 · system 시스템 · book 북 · building 빌딩
//   받침 없음   mother 머더 · study 스터디 · device 디바이스 · department 디파트먼트

/**
 * 끝소리가 받침으로 옮겨지는 철자. 나머지는 `ㅡ`·모음으로 끝나 받침이 없다.
 *
 * 낱말 끝의 `c` 는 영어에서 거의 언제나 /k/ 다 — music 뮤직 · traffic 트래픽 · public 퍼블릭.
 * 반면 `ce` 로 끝나면 `e` 가 끝 철자라 여기 걸리지 않는다(device 디바이스).
 */
const FINAL_CONSONANT = /(?:ng|[lmnkgc])$/i

/** 영어 낱말이 한국어로 옮겨졌을 때 받침으로 끝나는가. */
export function hasFinalConsonant(word: string): boolean {
  const w = word.toLowerCase().replace(/[^a-z]/g, '')
  if (!w) return false
  return FINAL_CONSONANT.test(w)
}

/** 앞말에 맞는 조사를 고른다 — `[받침 있을 때, 없을 때]`. */
function josa(word: string, pair: readonly [string, string]): string {
  return hasFinalConsonant(word) ? pair[0]! : pair[1]!
}

const EUL_REUL = ['을', '를'] as const
const EUN_NEUN = ['은', '는'] as const
const I_GA = ['이', '가'] as const

// ── 단서 찾기 ────────────────────────────────────────────────────────

/** 문장 첫머리를 정규화 — 따옴표·괄호를 벗기고 소문자로. */
function head(sentence: string): string {
  return sentence.trim().replace(/^[\s"'([‘’“”]+/, '').toLowerCase()
}

/** 단서 뒤가 낱말 경계인가 — `and` 가 `android` 를 잡으면 안 된다. */
function boundedAt(h: string, len: number): boolean {
  const rest = h.slice(len)
  return rest === '' || /^[\s,;:.'’]/.test(rest)
}

/** 문장이 연결어로 시작하면 그 연결어와 관계를 준다. */
export function findConnective(sentence: string): { cue: string; relation: Relation } | null {
  const h = head(sentence)
  for (const [word, relation] of CONNECTIVES) {
    if (h.startsWith(word) && boundedAt(h, word.length)) {
      return { cue: sentence.trim().slice(sentence.trim().length - h.length).slice(0, word.length), relation }
    }
  }
  return null
}

/** 문장이 지시어로 시작하면 `This report` 처럼 뒤 명사까지 묶어 준다. */
export function findDemonstrative(sentence: string): { cue: string; noun: string | null } | null {
  const h = head(sentence)
  for (const d of DEMONSTRATIVES) {
    if (!h.startsWith(d) || !boundedAt(h, d.length)) continue
    const after = h.slice(d.length).trim().split(/[\s,;:.]+/)[0] ?? ''
    const noun = after.replace(/[^a-z'-]/g, '')
    return {
      cue: sentence.trim().slice(sentence.trim().length - h.length).slice(0, d.length),
      noun: noun && !STOPWORDS.has(noun) && noun.length >= 4 ? noun : null,
    }
  }
  return null
}

/** 문장이 대명사로 시작하는가. */
export function findPronoun(sentence: string): string | null {
  const h = head(sentence)
  for (const p of PRONOUNS) {
    if (h.startsWith(p) && boundedAt(h, p.length)) {
      return sentence.trim().slice(sentence.trim().length - h.length).slice(0, p.length)
    }
  }
  return null
}

/** 내용어만 뽑는다 — 어휘 사슬을 만들 재료. */
export function contentWords(text: string): Set<string> {
  const out = new Set<string>()
  for (const raw of text.toLowerCase().split(/[^a-z'-]+/)) {
    const w = raw.replace(/^['-]+|['-]+$/g, '')
    if (w.length < 5 || STOPWORDS.has(w)) continue
    out.add(w)
    // 단복수는 같은 낱말로 본다 — 어휘 사슬이 `rocket`/`rockets` 로 끊기면 안 된다.
    if (w.endsWith('s') && w.length > 5) out.add(w.slice(0, -1))
  }
  return out
}

/**
 * 한정사 전환 — 앞 글에 `a/an X`, 뒤 문장에 `the X`.
 *
 * **방향이 확정되는 유일한 표면 단서**다. 영어는 처음 꺼낼 때 `a`, 이미 꺼낸 것을 `the` 로 받는다.
 */
export function findFirstMention(
  before: string,
  after: string,
): { cue: string; antecedent: string } | null {
  // 대소문자를 가리지 않는다 — 받는 쪽은 문장 첫머리라 `The` 로 나오는 일이 흔하다.
  // 잡아낸 문자열은 **지문에 있는 그대로**(`m[0]`) 돌려준다. 해설이 지문에 없는 말을
  // 인용하면 학습자가 찾지 못한다.
  const introduced = new Map<string, string>()
  for (const m of before.matchAll(/\ban?\s+([A-Za-z][A-Za-z'-]{4,})\b/gi)) {
    const noun = m[1]!.toLowerCase()
    if (STOPWORDS.has(noun)) continue
    if (!introduced.has(noun)) introduced.set(noun, m[0]!)
  }
  if (!introduced.size) return null
  for (const m of after.matchAll(/\bthe\s+([A-Za-z][A-Za-z'-]{4,})\b/gi)) {
    const noun = m[1]!.toLowerCase()
    const first = introduced.get(noun)
    if (first) return { cue: m[0]!, antecedent: first }
  }
  return null
}

/**
 * 문장 하나가 "앞에 무언가 있어야 한다" 고 말하는 근거들을 모은다.
 *
 * `before` 는 정답 순서에서 이 문장보다 앞에 오는 글 전체다. 근거는 **`before` 안에서 확인될 때만**
 * 인정한다 — 단서만 있고 받을 것이 없으면 근거가 아니다.
 *
 * 반환 순서가 곧 강도 순이다. 호출부는 맨 앞 하나만 쓴다.
 */
export function evidenceFor(sentence: string, before: string, from: string, at: string): Evidence[] {
  const out: Evidence[] = []
  const beforeWords = contentWords(before)

  const fm = findFirstMention(before, sentence)
  if (fm) {
    out.push({
      kind: 'first_mention',
      cue: fm.cue,
      antecedent: fm.antecedent,
      from,
      at,
      ko: `${at}의 "${fm.cue}"${josa(fm.cue, EUN_NEUN)} 이미 나온 것을 가리킨다 — ${from}에서 "${fm.antecedent}" 로 처음 꺼냈다.`,
    })
  }

  const dem = findDemonstrative(sentence)
  if (dem) {
    const resolved = dem.noun && beforeWords.has(dem.noun) ? dem.noun : null
    // 받을 말을 앞에서 찾은 것만 근거다. 지시어만 있고 받을 것이 없으면 근거가 아니다.
    if (resolved) {
      out.push({
        kind: 'demonstrative',
        cue: dem.cue,
        antecedent: resolved,
        from,
        at,
        ko: `${at}이 "${dem.cue}" 로 시작하고, 받는 말 "${resolved}"${josa(resolved, I_GA)} ${from}에 있다.`,
      })
    }
  }

  const conn = findConnective(sentence)
  if (conn) {
    out.push({
      kind: 'connective',
      cue: conn.cue,
      antecedent: null,
      from,
      at,
      ko: `${at}의 "${conn.cue}"${josa(conn.cue, EUN_NEUN)} ${RELATION_KO[conn.relation]} — ${from} 뒤여야 한다.`,
    })
  }

  const pron = findPronoun(sentence)
  if (pron) {
    out.push({
      kind: 'pronoun',
      cue: pron,
      antecedent: null,
      from,
      at,
      ko: `${at}이 대명사 "${pron}" 로 시작한다 — 받을 대상이 ${from}에 나와 있다.`,
    })
  }

  if (out.length === 0) {
    // 어휘 사슬 — 가장 약한 근거라 위의 것이 하나도 없을 때만 쓴다.
    const shared = [...contentWords(sentence)]
      .filter((w) => beforeWords.has(w))
      .sort((a, b) => b.length - a.length || (a < b ? -1 : 1))
    if (shared.length > 0) {
      const w = shared[0]!
      out.push({
        kind: 'lexical_repeat',
        cue: w,
        antecedent: w,
        from,
        at,
        ko: `${at}이 ${from}의 "${w}"${josa(w, EUL_REUL)} 이어받는다.`,
      })
    }
  }

  return out
}

// ── 문항별 해설 ──────────────────────────────────────────────────────

const CIRCLED = ['①', '②', '③', '④', '⑤'] as const

/**
 * **근거는 인접으로 잰다 — 앞 글 전체가 아니라 바로 앞 덩어리.**
 *
 * ── 처음 만든 규칙이 왜 틀렸나 (2026-08-21 실측) ────────────────────
 * 처음엔 단서를 **앞 글 전체**와 맞췄고 커버리지 92.1% 가 나왔다. 그런데 같은 탐지기를
 * 오답 답지에도 돌려 봤더니:
 *
 *     정답만 가리키는 해설    34/1,316 =  2.6%
 *     동점(가리지 못함)      988      = 75.1%
 *     오답을 더 가리킴       294      = 22.3%   ← 해설이 오답을 변호한다
 *
 * 원인은 **`before` 가 단조 증가**한다는 것이다. 어느 배열이든 뒤쪽 덩어리는 앞에 글이
 * 많아서 어휘 반복·대명사가 늘 걸린다. 92.1% 는 "해설을 썼다" 는 뜻이었을 뿐
 * "설명했다" 는 뜻이 아니었다.
 *
 * 글의 이음매는 실제로 **인접한 두 덩어리 사이**에 있다. 그래서 근거를 찾는 범위를
 * 바로 앞 단위로 좁혔다. 그러면 배열이 바뀔 때 앞 단위가 바뀌므로 근거도 바뀐다.
 *
 * ── 판별 규칙 ───────────────────────────────────────────────────────
 * 다섯 답지 전부에 같은 탐지기를 돌려 **정답의 근거 수가 유일하게 최다일 때만** 해설을 쓴다.
 * 동점이면 우리 근거로는 답을 가릴 수 없다는 뜻이므로 쓰지 않는다.
 *
 * 근거에 가중치를 두지 않는다 — 어떤 단서가 몇 점인지는 잴 방법이 없고, 근거 없이 정한
 * 숫자는 목표가 아니라 짐작이다. **받을 말을 앞에서 찾은 근거의 개수**만 센다.
 */
function scoreOf(evidence: readonly Evidence[]): number {
  return evidence.filter(isPositional).length
}

/**
 * 이 근거가 **자리를 가리는가**.
 *
 * 연결어(`However`)와 대명사(`It`)는 앞 글을 들여다보지 않는다 — "앞에 뭔가 있다" 만
 * 말할 뿐이라, 어느 배열에서든 똑같이 걸린다. 이 형식에서는 도입문이 늘 맨 앞이므로
 * **어떤 덩어리도 첫 자리가 아니고**, 따라서 그 단서들은 아무것도 가리지 못한다.
 * 해설에는 실리지만 판별에는 세지 않는다.
 *
 * 받을 말을 앞 단위에서 실제로 찾은 근거만(`antecedent` 가 있는 것) 자리를 가린다.
 */
export function isPositional(e: Evidence): boolean {
  return e.antecedent !== null
}

/** 한 배열에서 이음매마다 근거를 모은다 — 정답이든 오답이든 같은 탐지기. */
function orderEvidence(item: CsatOrderItem, perm: ReadonlyArray<'A' | 'B' | 'C'>): Evidence[] {
  const byLabel = new Map(item.blocks.map((b) => [b.label, b.sentences]))
  const out: Evidence[] = []
  let prevText = item.intro
  let prevName = '도입문'
  for (const label of perm) {
    const sentences = byLabel.get(label)
    if (!sentences?.length) continue
    // **바로 앞 단위만** 본다 — 여기가 인접 규칙이다.
    const found = evidenceFor(sentences[0]!, prevText, prevName, `(${label}) 첫 문장`)
    // 이음매마다 가장 강한 근거 하나만 — 해설이 길어지면 읽지 않는다.
    if (found.length) out.push(found[0]!)
    prevText = sentences.join(' ')
    prevName = `(${label})`
  }
  return out
}

/**
 * 순서 문항 해설 — 다섯 답지를 같은 잣대로 재고, **정답이 유일 최다일 때만** 쓴다.
 */
export function explainOrder(item: CsatOrderItem): Explanation {
  const perm = item.choices[item.answer - 1]
  if (!perm) return { answer: item.answer, evidence: [], body: null }

  const all = item.choices.map((p) => orderEvidence(item, p))
  const evidence = all[item.answer - 1]!
  const mine = scoreOf(evidence)
  const beatenOrTied = all.some((e, i) => i !== item.answer - 1 && scoreOf(e) >= mine)
  if (!mine || beatenOrTied) return { answer: item.answer, evidence: [], body: null }

  const seq = perm.map((l) => `(${l})`).join('-')
  return {
    answer: item.answer,
    evidence,
    body: [`정답 ${CIRCLED[item.answer - 1]} ${seq}`, '', ...evidence.map((e) => `· ${e.ko}`)].join('\n'),
  }
}

/**
 * 한 자리에서의 근거 — **양쪽 인접**만 본다.
 *
 *   바로 앞 문장 → 넣을 문장   넣을 문장이 바로 앞을 받는가
 *   넣을 문장 → 바로 뒤 문장   뒤 문장이 넣을 문장을 받는가
 */
function insertEvidence(item: CsatInsertItem, pos: number, slotNo: number): Evidence[] {
  const out: Evidence[] = []
  const prev = item.body[pos - 1]
  if (prev) {
    const back = evidenceFor(item.sentence, prev, `${pos}번째 문장`, '넣을 문장')
    if (back.length) out.push(back[0]!)
  }
  const next = item.body[pos]
  if (next) {
    const label = slotNo >= 1 && slotNo <= CIRCLED.length ? `${CIRCLED[slotNo - 1]} 뒤 문장` : '뒤 문장'
    const fwd = evidenceFor(next, item.sentence, '넣을 문장', label)
    if (fwd.length) out.push(fwd[0]!)
  }
  return out
}

/**
 * 삽입 문항 해설 — 다섯 자리를 같은 잣대로 재고, **정답 자리가 유일 최다일 때만** 쓴다.
 */
export function explainInsert(item: CsatInsertItem): Explanation {
  const pos = item.slots[item.answer - 1]
  if (pos == null) return { answer: item.answer, evidence: [], body: null }

  const all = item.slots.map((p, i) => insertEvidence(item, p, i + 1))
  const evidence = all[item.answer - 1]!
  const mine = scoreOf(evidence)
  const beatenOrTied = all.some((e, i) => i !== item.answer - 1 && scoreOf(e) >= mine)
  if (!mine || beatenOrTied) return { answer: item.answer, evidence: [], body: null }

  return {
    answer: item.answer,
    evidence,
    body: [`정답 ${CIRCLED[item.answer - 1]}`, '', ...evidence.map((e) => `· ${e.ko}`)].join('\n'),
  }
}

/**
 * 답지 5개 각각의 근거 — **감사용**.
 *
 * 해설이 정답만 가리키는지 확인하려면 오답의 근거도 같은 잣대로 봐야 한다.
 * `scripts/textbook/explain-discriminate.mjs` 가 이걸로 판별력을 잰다.
 */
export function orderEvidenceByChoice(item: CsatOrderItem): Evidence[][] {
  return item.choices.map((p) => orderEvidence(item, p))
}

/** 자리 5곳 각각의 근거 — 감사용. */
export function insertEvidenceBySlot(item: CsatInsertItem): Evidence[][] {
  return item.slots.map((p, i) => insertEvidence(item, p, i + 1))
}

export interface ExplainCoverage {
  total: number
  explained: number
  ratio: number
  byKind: Record<EvidenceKind, number>
}

/** 해설을 쓴 비율. **분모는 문항 전체** — 못 쓴 것을 빼고 세면 숫자가 거짓말이 된다. */
export function measureExplainCoverage(explanations: readonly Explanation[]): ExplainCoverage {
  const byKind: Record<EvidenceKind, number> = {
    first_mention: 0,
    demonstrative: 0,
    connective: 0,
    pronoun: 0,
    lexical_repeat: 0,
  }
  let explained = 0
  for (const e of explanations) {
    if (e.body) explained++
    for (const ev of e.evidence) byKind[ev.kind]++
  }
  return {
    total: explanations.length,
    explained,
    ratio: explanations.length ? explained / explanations.length : 0,
    byKind,
  }
}
