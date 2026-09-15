// packages/library-pipeline/src/textbook/word-order.ts
//
// **영작 배열 — 주어진 낱말로 문장 완성.** 중등 내신의 대표 서술형이고, 결정론이다.
//
// ── 왜 이 유형인가 ───────────────────────────────────────────────────
// 서술형은 대개 사람이 채점해야 해서 우리 파이프라인 밖이다. 그런데 **배열만은 다르다** —
// 정답이 원문이라 문자열 비교로 채점된다. 순서·삽입과 같은 성질이고, 지문 제약도 없다.
// 그래서 커버리지를 가장 싸게 올린다.
//
// ── 낱말 수 범위는 실측으로 정했다 (2026-08-21) ──────────────────────
// `scripts/textbook/sentence-probe.mjs` — ND 제외 문장 28,455개:
//
//     p10 3 · p25 8 · 중앙 14 · p75 22 · p90 30
//     밴드별 중앙   V2 11어 · V3 12어 · V4 12어 · V5 13어 · V6 18어
//
// **6~12어**로 잡았다. 그 아래(5어 이하)는 배열 경우의 수가 적어 보자마자 맞고, 그 위는
// 중등 학습자가 손으로 배열하기 어렵다. 이 구간이 전체의 26.9%(7,662문장)이고
// 대상 밴드(V2~V5)의 29~43% 다 — **대상 밴드의 중앙값까지 덮는 가장 넓은 구간**이다.
//
// ── 정답이 하나로 확정되지 않는 문장은 버린다 ────────────────────────
// 같은 낱말이 두 번 나오면 어느 자리에 어느 것을 놓아도 같은 문장이 된다 — 채점이 갈린다.
// 실측 **50.5%(14,369문장)** 가 여기 해당한다. 이만큼은 못 쓴다.
//
// ── 첫 글자 대문자가 답을 흘린다 ─────────────────────────────────────
// 낱말 뭉치에 `The` 가 있으면 그게 첫 낱말임을 그냥 알려 준다. 그렇다고 무조건 소문자로
// 내리면 고유명사(`Prague`)가 망가진다. 그래서 **흔한 낱말일 때만** 내린다 —
// 판단은 사전에 맡기고(`isCommonWord`) 이 모듈은 순수하게 둔다.

import { isPrintablePassage } from './csat-format'

/** 배열 문항이 받는 낱말 수. 위 주석의 실측에서 나왔다. */
export const WORD_ORDER_WORDS = { min: 6, max: 12 } as const

export interface WordOrderItem {
  kind: 'word_order'
  /** 배열할 낱말들 — 원문 어순이 아니다. */
  bank: string[]
  /** 정답 = 원문 문장(끝 부호 포함). */
  answer: string
  /** 이 문장 앞에 있던 문장. **우리말 뜻이 없으므로 문맥이 그 자리를 대신한다.** */
  context: string | null
}

/** 문장 안에 부호가 섞이면 그 부호가 자리를 알려 준다 — 그런 문장은 쓰지 않는다. */
const INTERNAL_PUNCT = /[,;:—–"“”'‘’()[\]{}]/

/**
 * **자리를 옮겨도 말이 되는 부사 — 이것이 있으면 정답이 하나가 아니다.**
 *
 * ── 왜 이 검사가 생겼나 (실측 2026-09-15) ────────────────────────────
 * 3인 검수 청크 둘이 각자 짚었다. chunk-00 의 실물:
 *
 *     정답  `He therefore borrowed a horse from Mr. Wilkins.`
 *     대안  `Therefore he borrowed a horse from Mr. Wilkins.`   ← 같은 낱말, 같은 뜻
 *
 * 위의 「같은 낱말이 두 번」 검사는 **낱말의 중복**만 본다. 어순 대안은 안 본다.
 * 게다가 바로 아래 「첫 글자 대문자를 내린다」가 **그 대안을 가능하게 만든다** —
 * `He`·`Therefore` 가 둘 다 소문자가 되어 어느 쪽이 첫 낱말인지 표시가 사라진다.
 * 답을 흘리지 않으려던 조치가 **답을 둘로 만든 것**이다.
 *
 * 재고 실측: 48,855건 중 **4,133건(8.5%)**. 버리는 것이 아니라 **채점이 갈리던 것**이다.
 *
 * ⚠️ **부정 부사는 넣지 않는다** — `never`·`rarely`·`seldom` 은 앞으로 내면 도치가 필요하고
 *   (`Rarely do we hear…`) 낱말이 하나 늘어난다. 같은 뭉치로 만들 수 없으므로 대안이 아니다.
 * ⚠️ **`always` 도 뺀다** — `Always he arrived late.` 는 시적 어순이지 평범한 대안이 아니다.
 * ⚠️ **`also` 는 `but` 이 없을 때만 센다** — `not only … but also` 의 `also` 는 붙박이다
 *   (표본에서 실제로 걸렸다: `…in the environment but also during infection`).
 */
const MOVABLE_ADVERB = new Set([
  'therefore', 'thus', 'however', 'moreover', 'furthermore', 'consequently',
  'nevertheless', 'nonetheless', 'meanwhile', 'instead', 'finally', 'then',
  'now', 'today', 'yesterday', 'later', 'soon', 'recently', 'suddenly',
  'perhaps', 'often', 'usually', 'sometimes', 'frequently', 'occasionally',
  'generally', 'normally', 'certainly', 'probably', 'clearly', 'obviously',
])

/**
 * **닫힌 부류의 기능어 — 사전을 묻지 않고 첫 글자를 내린다.**
 *
 * ⚠️ 첫 글자 내리기를 `isCommonWord` 에만 맡겼더니 **3,182건(6.5%)** 이 대문자를 그대로
 *   달고 지면에 나갔다(`Their`·`These`·`Such`). 사전에 없는 기능어가 있었던 것이다 —
 *   3인 검수 chunk-01 이 `Their` 로 짚었다. 뭉치에 대문자 낱말이 하나면 **첫 자리가
 *   공짜로 정해진다.**
 *
 * 고유명사를 망가뜨리지 않으려고 사전을 묻는 설계는 옳다. 다만 **기능어는 고유명사일 수
 * 없으므로** 사전을 물을 이유가 없다 — 물어서 얻는 것이 없고 못 찾으면 잃기만 한다.
 */
const FUNCTION_WORD = new Set([
  'the', 'a', 'an',
  'this', 'that', 'these', 'those', 'such', 'some', 'many', 'most', 'both', 'each', 'every',
  'other', 'another', 'all', 'any', 'no', 'one',
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'there',
  'my', 'your', 'his', 'her', 'its', 'our', 'their',
  'if', 'when', 'while', 'although', 'though', 'because', 'as', 'since', 'unless', 'after', 'before',
  'in', 'on', 'at', 'for', 'with', 'by', 'from', 'to', 'of', 'about', 'over', 'under', 'between',
])

/** 끝 부호 — 배열 문제에서는 떼고 주고, 정답에는 붙여 둔다. */
const TERMINAL = /[.!?]+$/

/**
 * 배열 문항을 만든다. 조건을 못 맞추면 **null**.
 *
 * @param sentence 원문 문장.
 * @param context 바로 앞 문장. 없으면 null.
 * @param isCommonWord 이 낱말이 사전에 있는 흔한 낱말인가 — 첫 글자를 내릴지 정한다.
 */
export function buildWordOrder(
  sentence: string,
  context: string | null,
  isCommonWord: (word: string) => boolean,
): WordOrderItem | null {
  const answer = sentence.trim()
  if (!answer || !isPrintablePassage(answer)) return null
  if (INTERNAL_PUNCT.test(answer)) return null
  if (!TERMINAL.test(answer)) return null

  const tokens = answer.replace(TERMINAL, '').split(/\s+/).filter(Boolean)
  if (tokens.length < WORD_ORDER_WORDS.min || tokens.length > WORD_ORDER_WORDS.max) return null
  // 숫자·기호가 섞이면 배열이 아니라 받아쓰기가 된다.
  if (tokens.some((t) => !/^[A-Za-z][A-Za-z'-]*$/.test(t))) return null

  // 같은 낱말이 두 번 나오면 정답이 하나로 확정되지 않는다.
  const seen = new Set<string>()
  for (const t of tokens) {
    const k = t.toLowerCase()
    if (seen.has(k)) return null
    seen.add(k)
  }

  // ── 자리를 옮겨도 말이 되는 부사가 있으면 정답이 하나가 아니다 ──────
  // ⚠️ **바로 아래 대문자 내리기보다 먼저 본다.** 순서를 바꾸면 안 된다 —
  //   대문자를 내린 뒤에야 대안이 성립하므로, 이 검사가 뒤로 가면 「아직 대문자가 있으니
  //   대안이 없다」고 잘못 판단하기 쉽다. 여기서는 낱말만 보면 된다.
  const lower = tokens.map((t) => t.toLowerCase())
  const hasBut = lower.includes('but')
  if (lower.some((w) => MOVABLE_ADVERB.has(w) || (w === 'also' && !hasBut))) return null

  // 첫 낱말의 대문자를 흘리지 않는다 — 기능어는 사전을 묻지 않고, 나머지는 흔한 낱말일 때만.
  const first = tokens[0]!
  const lowered = first.charAt(0).toLowerCase() + first.slice(1)
  const bank = [...tokens]
  if (/^[A-Z]/.test(first) && (FUNCTION_WORD.has(lowered.toLowerCase()) || isCommonWord(lowered))) {
    bank[0] = lowered
  }

  const shuffled = deterministicShuffle(bank, answer)
  // 섞은 결과가 원문 그대로면 문제가 안 된다.
  if (shuffled.every((w, i) => w === bank[i])) return null

  return { kind: 'word_order', bank: shuffled, answer, context }
}

/**
 * 결정론 셔플 — 같은 문장이면 늘 같은 배열이 나온다(멱등).
 *
 * 낱말을 정렬 키로 바꿔 세운다. 키는 낱말과 seed 를 함께 해싱해 만들므로,
 * 같은 낱말이라도 문장이 다르면 다른 자리에 간다.
 */
export function deterministicShuffle(items: ReadonlyArray<string>, seed: string): string[] {
  return items
    .map((w, i) => ({ w, k: hash(`${seed}#${i}#${w}`) }))
    .sort((a, b) => a.k - b.k || (a.w < b.w ? -1 : 1))
    .map((x) => x.w)
}

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * **이미 저장된 뭉치에도 같은 자를 댄다 — 생성기만 고치면 재고는 그대로 인쇄된다.**
 *
 * 위 두 검사는 **앞으로 만들 문항**만 막는다. 그런데 재고에 이미
 * 「부사가 옮겨지는 것」 4,133건 · 「대문자가 첫 자리를 흘리는 것」 3,182건이 있고
 * 그것들은 지금도 조판 대상이다. 그래서 조판 게이트(`item-hygiene.ts`)가 부를 수 있게
 * 같은 집합으로 판정자를 내준다 — **목록을 두 벌 두면 반드시 갈린다.**
 */
export function bankHasMovableAdverb(bank: ReadonlyArray<string>): boolean {
  const lower = bank.map((w) => String(w ?? '').toLowerCase())
  const hasBut = lower.includes('but')
  return lower.some((w) => MOVABLE_ADVERB.has(w) || (w === 'also' && !hasBut))
}

/**
 * 뭉치에 **대문자로 시작하는 기능어**가 남아 있는가 — 있으면 첫 자리가 공짜로 정해진다.
 *
 * ⚠️ 고유명사는 대문자가 정상이므로 세지 않는다. 기능어만 본다.
 */
export function bankLeaksFirstWord(bank: ReadonlyArray<string>): boolean {
  return bank.some((w) => {
    const s = String(w ?? '')
    return /^[A-Z]/.test(s) && FUNCTION_WORD.has(s.toLowerCase())
  })
}
