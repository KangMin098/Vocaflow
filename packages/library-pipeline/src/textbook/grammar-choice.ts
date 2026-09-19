// packages/library-pipeline/src/textbook/grammar-choice.ts
//
// **어법상 틀린 것 고르기 (수능 29번).** 결정론이고 LLM 도 구문 분석기도 쓰지 않는다.
//
// ── 수능 실제 형식 ───────────────────────────────────────────────────
// 지문의 다섯 곳에 밑줄이 있고 ①~⑤ 가 붙는다. 그중 하나가 어법상 틀렸다.
//
// ── 이 유형이 어려워 보였던 이유, 그리고 그게 착각인 이유 ────────────
// "어법이 맞는지" 를 판정하려면 문장 구조를 알아야 한다 — 우리에겐 구문 분석기가 없다.
// 그런데 **판정할 필요가 없다.** 발행된 원문은 이미 맞고, 우리는 답을 만드는 쪽이다.
// 그러니 **반드시 틀리게 만드는 교체**만 쓰면 된다. DCP 가 순서·삽입에서 쓰는
// "원문 = 정답 키" 와 같은 뒤집기다.
//
//     원문   an hour   →  교체   a hour     (틀림 · 확정)
//     원문   these books → 교체   this books  (틀림 · 확정)
//
// ── 그래도 지켜야 하는 것: 원문이 정말 맞는가 ────────────────────────
// 원문이 틀려 있었다면 교체가 오히려 **고쳐 버린다.** 그러면 정답이 없는 문항이 된다.
// 그래서 규칙마다 **원문이 표준형과 맞는지 먼저 확인**하고, 확인이 안 되면 건드리지 않는다.
//
//   관사    표준 규칙(모음 글자 앞 `an`)과 원문이 어긋나면 건너뛴다.
//           `an hour`(자음 글자인데 `an`) · `a university`(모음 글자인데 `a`) 가 그렇게 빠진다 —
//           예외이거나 오류이거나 둘 중 하나인데, 어느 쪽이든 우리가 만질 자리가 아니다.
//   지시사  뒤 명사의 수를 형태로 볼 수 있을 때만. `this books` 처럼 원문이 이미 어긋나 보이면 건너뛴다.
//
// ── 우리가 못 만드는 것 (숨기지 않는다) ──────────────────────────────
// 실제 29번은 관계사 · 분사 · 병렬 · 태 · 수일치를 두루 묻는다. 우리는 **한정사와 지시사의
// 수일치**만 만든다. 그 둘은 구문 분석 없이도 "반드시 틀리게" 만들 수 있는 자리이기 때문이다.
// 나머지는 문장 구조를 알아야 하고, 그건 이 파이프라인 밖이다.

import { CSAT_ITEM_WORDS } from './compose-unit'
import { isPrintablePassage, selectPassageWindow } from './csat-format'
import { isPrintableUnderlineWord } from './vocab-choice'

/** 우리가 만들 수 있는 어법 교체. */
export type GrammarRule =
  /** 부정관사 — `a` ↔ `an`. */
  | 'article'
  /** 지시사 수일치 — `this` ↔ `these` · `that` ↔ `those`. */
  | 'demonstrative'

/** 밑줄 다섯 — 수능과 같다. */
export const GRAMMAR_UNDERLINES = 5

export interface GrammarUnderline {
  sentenceIdx: number
  tokenIdx: number
  /** 화면에 보이는 낱말 — 정답 자리에서는 **틀린 형태**다. */
  word: string
  label: string
}

export interface GrammarChoiceItem {
  kind: 'grammar_choice'
  /** 지문 문장들. 정답 자리는 이미 틀린 형태로 바뀌어 있다. */
  sentences: string[]
  underlines: GrammarUnderline[]
  /** 정답 번호 1~5. */
  answer: number
  rule: GrammarRule
  /** 원래(맞는) 형태 — 해설과 검수용. */
  original: string
}

const LABELS = ['①', '②', '③', '④', '⑤'] as const

/** 지시사 짝. 어느 쪽으로 바꿔도 수가 어긋난다. */
const DEMONSTRATIVE_PAIR: Record<string, string> = {
  this: 'these',
  these: 'this',
  that: 'those',
  those: 'that',
}

/**
 * 형태만으로 복수로 보이지만 단수인 낱말 — 여기 걸리면 수를 못 정한다.
 *
 * 언어 사실이지 임의로 정한 목록이 아니다. `-s` 로 끝나는 단수 명사(`news`)와
 * 단복수가 같은 명사(`series` · `species`)다. 이런 낱말 앞에서는 지시사를 건드리지 않는다.
 */
const S_ENDING_SINGULAR = new Set([
  'news',
  'series',
  'species',
  'means',
  'crossroads',
  'headquarters',
  'physics',
  'mathematics',
  'economics',
  'politics',
  'statistics',
  'ethics',
  'athletics',
  'measles',
  'diabetes',
])

/**
 * **명사구의 머리가 될 수 없는 낱말** — 지시사 판정에서 뒤 낱말을 거르는 자.
 *
 * 목록에 든 것은 전부 닫힌 부류(한정사·대명사·전치사·조동사·접속사)다. 열린 부류를
 * 적는 목록이 아니므로 **자라지 않는다** — 새 명사가 생겨도 여기 더할 것이 없다.
 */
const NOT_A_NOUN_HEAD = new Set([
  // 한정사·수식 한정
  'the', 'a', 'an', 'this', 'that', 'these', 'those',
  'my', 'your', 'his', 'her', 'its', 'our', 'their',
  'some', 'any', 'all', 'each', 'every', 'no', 'both', 'either', 'neither',
  'much', 'many', 'more', 'most', 'few', 'fewer', 'less', 'least', 'several',
  // 대명사
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'us', 'them',
  'who', 'whom', 'whose', 'which', 'what', 'there', 'here',
  // 조동사·계사 — 뒤가 절이라는 가장 흔한 신호다
  'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'has', 'have', 'had', 'do', 'does', 'did',
  'will', 'would', 'can', 'could', 'shall', 'should', 'may', 'might', 'must',
  // 전치사·접속사
  'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'from', 'as', 'than',
  'and', 'or', 'but', 'if', 'because', 'while', 'when', 'where', 'though',
  'not', 'so', 'such', 'very', 'too', 'just', 'only',
])

/** 낱말을 소문자 알파벳으로. */
function bare(token: string): string {
  return token.toLowerCase().replace(/[^a-z']/g, '')
}

/** 원문의 대소문자를 바꾼 낱말에 옮긴다 — 문장 첫머리가 소문자로 내려가면 안 된다. */
function matchCase(original: string, replacement: string): string {
  if (/^[A-Z]/.test(original)) return replacement.charAt(0).toUpperCase() + replacement.slice(1)
  return replacement
}

/**
 * 부정관사의 표준형 — 모음 **글자**로 시작하면 `an`.
 *
 * 소리가 아니라 글자로 본다. 소리로 판정하려면 발음 정보가 필요한데 `shared_dictionary` 의
 * `ipa` 는 채워진 비율이 낮다. 대신 **표준형과 어긋나는 원문은 통째로 건너뛰어**
 * 예외(`an hour` · `a university`)를 안전하게 피한다.
 */
export function standardArticle(nextWord: string): 'a' | 'an' {
  return /^[aeiou]/i.test(nextWord) ? 'an' : 'a'
}

/** 형태로 복수인가. 판정이 안 서면 null — 그러면 건드리지 않는다. */
export function looksPlural(noun: string): boolean | null {
  const w = bare(noun)
  if (!w || w.length < 3) return null
  if (S_ENDING_SINGULAR.has(w)) return false
  if (/(?:ss|us|is)$/.test(w)) return null // class · status · analysis — 형태로 못 가른다
  if (w.endsWith('s')) return true
  return false
}

/** 형태로 보아 수식어인가 — 분사·형용사·부사 어미와 하이픈 복합어. */
export function looksModifier(word: string): boolean {
  return /-/.test(word) || /(?:ed|ing|ous|ful|ive|al|ic|able|ible|ly)$/i.test(word)
}

/**
 * **지시어 뒤가 「지시어 + 명사」로 확정되는가.**
 *
 * ── 왜 머리 명사를 「찾지」 않고 「확정되는지」를 묻나 (실측 2026-09-13) ──
 * 영어에서 형용사와 명사는 **형태로 안 갈린다** — `late`·`big`·`class` 는 둘 다 될 수 있다.
 * 그래서 `these late hour` 를 스캔하면 `late` 가 먼저 잡히고, 그것을 명사로 여긴 해설이
 * **「late 가 단수이므로」** 라는 없는 규칙을 적었다.
 *
 * 추측을 개선하는 대신 **추측이 필요한 자리를 만들지 않는다**: 지시어 바로 뒤가 수를
 * 가를 수 있는 낱말이고, **그 다음이 내용어가 아닐 때만** 후보로 삼는다.
 *
 *     these panels were shipped   → `panels` 뒤가 `were`(기능어) → 확정. 후보다.
 *     these late hour             → `late` 뒤가 `hour`(내용어)  → 둘 중 무엇이 머리인지
 *                                    모른다 → **안 만든다.**
 *     These class members         → `class` 뒤가 `members`     → 같은 이유로 안 만든다.
 *
 * 잃는 것은 수식어가 낀 명사구뿐이고, 얻는 것은 **틀린 근거를 인쇄하지 않는 것**이다.
 * 어법 재고는 이미 충분하다(V5 4,330문항).
 */
function isUnambiguousNounHead(tokens: ReadonlyArray<string>, headIdx: number): boolean {
  const after = tokens[headIdx + 1]
  if (after === undefined) return true // 문장 끝 — 뒤에 다툴 것이 없다
  const w = bare(after)
  if (!w) return true // 구두점뿐
  // 기능어가 따라오면 앞 낱말이 머리다. 내용어가 따라오면 어느 쪽이 머리인지 모른다.
  return NOT_A_NOUN_HEAD.has(w)
}

/**
 * 지시어가 실제로 받는 **머리 명사**를 찾는다. 못 찾으면 빈 문자열.
 *
 * ── 왜 바로 뒤 낱말로는 안 되나 (3인 검수 실측 2026-09-13, 2회차) ────
 * `even at these late hour` 로 문항이 만들어졌고, 해설이 **「late 가 단수이므로」** 라고
 * 적었다. `late` 는 형용사라 수가 없고, `these` 를 막는 것은 핵어 **hour** 다.
 * 해설 전체에 `hour` 가 한 번도 안 나온다 — 학습자는 정답을 맞히고도 **없는 규칙**을 배운다.
 *
 * ⚠️ **해설 작성기는 이미 이 교훈을 갖고 있었다**(`explain-items.headNounAfter` —
 *   「바로 뒤 낱말을 그냥 쓰면 `those AI-focused data centers` 에서 형용사를 명사라고
 *   부르게 된다」). 생성기만 못 받았다. 오늘 세 번째 「자가 둘」이라 **여기를 정본으로 두고**
 *   해설 쪽이 이것을 부른다.
 *
 * 수식어는 건너뛰고, 한정사·조동사가 나오면 그 자리는 명사구가 아니다(빈 문자열).
 * 3칸 안에 못 찾으면 판정하지 않는다 — 억지로 지목하면 틀린 근거를 만든다.
 */
export function headNounAt(tokens: ReadonlyArray<string>, from: number): string {
  for (let k = from; k < Math.min(tokens.length, from + 3); k += 1) {
    const w = bare(tokens[k] ?? '')
    if (!w) continue
    // 명사구의 머리가 될 수 없는 낱말이 먼저 나오면 애초에 명사구가 아니다.
    if (NOT_A_NOUN_HEAD.has(w)) return ''
    if (looksModifier(w)) continue
    // 수를 형태로 못 가르는 낱말은 근거로 못 쓴다 — 건너뛰고 다음을 본다.
    if (looksPlural(w) === null) continue
    return w
  }
  return ''
}

export interface Candidate {
  sentenceIdx: number
  tokenIdx: number
  token: string
  rule: GrammarRule
  /** 틀리게 바꾼 형태. */
  broken: string
}

/** 이 자리를 반드시 틀리게 만들 수 있는가. 확인이 안 되면 null. */
export function candidateAt(
  tokens: ReadonlyArray<string>,
  ti: number,
  sentenceIdx: number,
): Candidate | null {
  const token = tokens[ti]!
  const w = bare(token)
  // 붙은 부호가 있으면 자리 표시가 지저분해진다 — 순수한 낱말만.
  //
  // ⚠️ **이 검사는 끝의 구두점을 막지 못한다**(실측 2026-09-13). 양쪽이 그 부호를 똑같이
  //   떼어 내므로 `"Analogously,"` 는 `Analogously === Analogously` 로 **통과한다** —
  //   막히는 것은 가운데 낀 비문자(괄호·대시)뿐이다. 그래서 절을 끊는 부호가 붙은 낱말이
  //   밑줄이 됐고, 어휘 쪽에서 같은 자국을 고친 뒤 재생성해 보니 이 유형에서만 남았다
  //   (「만들었는데 자에 또 걸림 7건」 — `regen-underlines.mjs` 가 세서 알려 줬다).
  //   2026-09-13(2차): 위의 두 갈래 비교와 쉼표 검사를 **어휘 쪽과 같은 자 하나로** 바꿨다.
  //   여기서는 잃는 것이 없다 — 어법 후보는 바로 뒤 낱말을 보므로 문장 끝은 이미 빠지고,
  //   자가 둘이면 한쪽만 고쳐져 또 갈린다(`isPrintableUnderlineWord` 가 정본이다).
  if (!isPrintableUnderlineWord(token)) return null
  const next = tokens[ti + 1]
  if (!next) return null

  if (w === 'a' || w === 'an') {
    const nextBare = bare(next)
    if (!nextBare) return null
    // **원문이 표준형과 맞을 때만.** 어긋나면 예외이거나 오류다 — 어느 쪽이든 건너뛴다.
    if (standardArticle(nextBare) !== w) return null
    return {
      sentenceIdx,
      tokenIdx: ti,
      token,
      rule: 'article',
      broken: matchCase(token, w === 'a' ? 'an' : 'a'),
    }
  }

  const pair = DEMONSTRATIVE_PAIR[w]
  if (pair) {
    // ⚠️ **`that` 은 지시사가 아닐 때가 많다** (3인 검수 실측 2026-09-13).
    //   `…said that the deep-seated…` 의 `that` 은 **명사절 접속사**인데 여기서
    //   지시사로 판정했다. 뒤 낱말이 `the` 라 `looksPlural('the')` 가 「단수」를 내주고
    //   (–s 로 안 끝나므로) 그대로 통과한 것이다. 그 결과 해설이
    //   **「the 가 단수이므로 that 이 맞다」** 고 적었다 — 관사를 명사로 취급한 **없는 규칙**이다.
    //   학습자는 정답을 맞히고도 틀린 것을 배운다. 문항이 틀린 것보다 나쁘다.
    //
    //   지시사는 **명사구의 머리** 앞에 온다. 뒤가 한정사·대명사·전치사·조동사면
    //   명사구가 아니므로 그 자리는 지시사가 아니다 — 건드리지 않는다.
    if (NOT_A_NOUN_HEAD.has(bare(next))) return null
    // ⚠️ **머리가 확정될 때만 만든다** — `these late hour` 에서 `late` 를 명사로 여긴
    //   해설이 「late 가 단수이므로」라는 없는 규칙을 적었다. 형용사와 명사는 형태로
    //   안 갈리므로, 추측을 개선하는 대신 **추측이 필요한 자리를 만들지 않는다**
    //   (`isUnambiguousNounHead` 머리 주석).
    if (!isUnambiguousNounHead(tokens, ti + 1)) return null
    const plural = looksPlural(next)
    if (plural === null) return null
    // 원문이 이미 어긋나 보이면 건너뛴다 — 바꾸면 오히려 고쳐진다.
    const expectPlural = w === 'these' || w === 'those'
    if (plural !== expectPlural) return null
    return { sentenceIdx, tokenIdx: ti, token, rule: 'demonstrative', broken: matchCase(token, pair) }
  }

  return null
}

/**
 * 어법 문항을 만든다. 조건을 못 맞추면 **null**.
 *
 * @param sentences 지문 문장들.
 */
export function buildGrammarChoice(paragraph: ReadonlyArray<string>): GrammarChoiceItem | null {
  // 인용 잔해·용어풀이가 섞인 문단은 교재에 실을 수 없다.
  //   (VOA 기사 끝의 용어풀이가 본문과 같은 문단으로 붙어 오는 것을 실측에서 발견했다)
  if (!isPrintablePassage(paragraph.join(' '))) return null
  // **문단을 통째로 쓰지 않는다.** 규격(90~200어)에 맞는 연속 구간을 잘라 쓴다 —
  // 실측에서 어법 문항의 **78.6%** 가 규격 밖이었다. 580개인 줄 알았던 재고가 실은 124개였다.
  const sentences = selectPassageWindow(paragraph, CSAT_ITEM_WORDS, GRAMMAR_UNDERLINES)
  if (!sentences) return null

  const all: Candidate[] = []
  for (let si = 0; si < sentences.length; si++) {
    const tokens = sentences[si]!.split(/\s+/)
    for (let ti = 0; ti < tokens.length; ti++) {
      const c = candidateAt(tokens, ti, si)
      if (c) all.push(c)
    }
  }
  if (all.length < GRAMMAR_UNDERLINES) return null

  // 밑줄은 서로 다른 문장에 흩어져야 한다 — 한 문장에 몰리면 자리로 찍는다.
  const bySentence = new Map<number, Candidate>()
  for (const c of all) if (!bySentence.has(c.sentenceIdx)) bySentence.set(c.sentenceIdx, c)
  const spread = [...bySentence.values()].sort(
    (a, b) => a.sentenceIdx - b.sentenceIdx || a.tokenIdx - b.tokenIdx,
  )
  if (spread.length < GRAMMAR_UNDERLINES) return null

  // 자리를 다섯 곳 고르고, 그중 하나를 결정론으로 망가뜨린다 — 같은 지문은 늘 같은 문항.
  const picked = pickSpread(spread, GRAMMAR_UNDERLINES)
  const at = hash(sentences.join(' ')) % picked.length
  const chosen = picked[at]!

  const out = [...sentences]
  const tokens = out[chosen.sentenceIdx]!.split(/\s+/)
  tokens[chosen.tokenIdx] = chosen.broken
  out[chosen.sentenceIdx] = tokens.join(' ')

  const underlines: GrammarUnderline[] = picked.map((p, i) => ({
    sentenceIdx: p.sentenceIdx,
    tokenIdx: p.tokenIdx,
    word: i === at ? chosen.broken : p.token,
    label: LABELS[i]!,
  }))

  return {
    kind: 'grammar_choice',
    sentences: out,
    underlines,
    answer: at + 1,
    rule: chosen.rule,
    original: chosen.token,
  }
}

/** 후보에서 n 개를 고르게 뽑는다 — 앞뒤로 몰리지 않게. */
export function pickSpread<T>(items: ReadonlyArray<T>, n: number): T[] {
  if (items.length <= n) return [...items]
  const out: T[] = []
  for (let k = 0; k < n; k++) out.push(items[Math.round((k * (items.length - 1)) / (n - 1))]!)
  return out
}

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
