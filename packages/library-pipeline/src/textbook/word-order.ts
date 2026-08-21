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

import { hasCitationResidue } from './csat-format'

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
  if (!answer || hasCitationResidue(answer)) return null
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

  // 첫 낱말의 대문자를 흘리지 않는다 — 흔한 낱말일 때만 내린다.
  const first = tokens[0]!
  const lowered = first.charAt(0).toLowerCase() + first.slice(1)
  const bank = [...tokens]
  if (/^[A-Z]/.test(first) && isCommonWord(lowered)) bank[0] = lowered

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
