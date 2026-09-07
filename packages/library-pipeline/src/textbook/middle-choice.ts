// packages/library-pipeline/src/textbook/middle-choice.ts
//
// **중등 내신 객관식 두 유형** — 본문 어휘 뜻 · 단원 문법.
//
// ── 왜 별도 파일인가 (`middle-short.ts` 와 무엇이 다른가) ────────────
// 단답은 정답이 원문이라 채점이 문자열 비교다. **객관식은 오답을 우리가 만들어야 한다** —
// 그리고 오답이 정답과 겹치면 답이 둘이 된다. 그래서 이 파일의 위험은 단답과 다르고,
// 조심할 것도 다르다: 단답은 *정답의 유일성*, 객관식은 *오답의 무해성*.
//
// ── 중등은 수능과 규격이 다르다 ──────────────────────────────────────
//   보기 수    **초·중·고 모두 5지선다** (아래 ⚠️ 참조)
//   지문 길이  수능 90~200어 · **중등 40~120어** (교과서 한 단원 본문이 그 정도다)
//   밑줄 수    5
// 같은 생성기를 규격만 바꿔 돌리지 않고 별도 함수로 두는 이유는, 규격이 섞이면
// 커버리지가 거짓말을 하기 때문이다 — 수능 어법 재고를 중등 재고로 세게 된다.
//
// ⚠️ **2026-08-30 정정 — 여기 "중등 4지선다" 라고 적혀 있었고 그 근거는 없었다.**
//   시중 79종을 문항 단위로 세어 보니 반대다(`market-spec.json` `choiceCount`):
//
//     학교급   3지   4지   5지    5지 비율
//     초등      50    13   248     79.7%
//     중등       4    10   211     **93.8%**
//     고등      97    48   801     84.7%
//
//   그 한 줄 때문에 `unit_vocab` 2,848 + `unit_grammar` 1,287 = **4,135문항이
//   4지선다로 만들어졌다.** 근거 없는 규격 한 줄이 재고의 24%를 시장 밖으로 보냈다.
//   지문 길이(40~120어)는 실측이 뒷받침하므로 그대로 둔다 — 틀린 것은 보기 수뿐이다.
//
// ⚠️ 어법 규칙 판정은 `grammar-choice.ts` 의 `candidateAt` 을 **그대로 쓴다.**
//   재구현하면 두 유형의 판정이 조용히 갈라진다(`middle-short.ts` 와 같은 이유).

import { candidateAt, type GrammarRule } from './grammar-choice'
import { isPrintablePassage, selectPassageWindow } from './csat-format'
import { firstSense, type ElementaryWord } from './elementary'

/** 중등 객관식 보기 수 — 시중 실측 지배값(중등 93.8%가 5지). 위 ⚠️ 참조. */
export const MIDDLE_CHOICES = 5

/**
 * 중등 지문 규격 — 시중 실측(`market-spec.json` `passageWords`).
 *
 * 상한 152 는 **중1 p90** 이다(중2 156 · 중3 153 중 가장 보수적인 값).
 * 2026-08-30 이전에는 120 이었고 근거가 "교과서 한 단원 본문이 그 정도" 라는 말뿐이었다.
 *
 * ⚠️ 이 값은 보기 수와 **함께** 움직인다. 밑줄을 4→5 로 올리면 좁은 창에서는
 * 어법 후보 5개를 못 찾아 수율이 무너진다 — 실측:
 *
 *   4지 · 40~120   unit_vocab 45.0% · unit_grammar 27.6%
 *   5지 · 40~120   unit_vocab 45.0% · unit_grammar **16.6%**  ← 창이 좁아 −40%
 *   5지 · 40~152   unit_vocab 48.7% · unit_grammar **24.0%**  ← 시장 창으로 −13%
 *
 * 즉 시장 규격 두 개(보기 5 · 지문 p90)는 **같이 지켜야** 성립한다.
 */
export const MIDDLE_ITEM_WORDS = { min: 40, max: 152 } as const

/** 중등 어법 밑줄 수. 보기 수와 같아야 한다 — 밑줄 하나가 보기 하나다. */
export const MIDDLE_GRAMMAR_UNDERLINES = 5

const LABELS = ['①', '②', '③', '④', '⑤'] as const

export interface MiddleChoiceItem {
  kind: 'unit_vocab' | 'unit_grammar'
  promptKo: string
  /** 지문 문장들. 어법에서는 정답 자리가 이미 틀린 형태다. */
  sentences: string[]
  /** 보기. */
  choices: { label: string; text: string }[]
  /** 정답 번호 1~5. */
  answer: number
}

export interface MiddleVocabItem extends MiddleChoiceItem {
  kind: 'unit_vocab'
  /** 뜻을 묻는 낱말 — 지문 안에 있다. */
  target: string
}

export interface MiddleGrammarItem extends MiddleChoiceItem {
  kind: 'unit_grammar'
  underlines: { sentenceIdx: number; tokenIdx: number; word: string; label: string }[]
  rule: GrammarRule
  /** 원래(맞는) 형태 — 해설과 검수용. */
  original: string
}

function bare(token: string): string {
  return token.replace(/[^A-Za-z']/g, '')
}

// ── ① 본문 어휘 뜻 ─────────────────────────────────────────────────

/**
 * 지문 안 낱말의 뜻을 묻는다. 조건을 못 맞추면 **null**.
 *
 * ── 초등 `buildWordMeaning` 과 무엇이 다른가 ────────────────────────
 * 오답을 고르는 규칙(유의어 제외 · 뜻 문자열 겹침 제외)은 같은 문제를 푼다. 다른 것은
 * **표제어가 어디서 오는가**다 — 초등은 교육과정 별표에서, 중등은 **지문에서** 온다.
 * 그래서 지문에 없는 낱말을 묻지 않고, 반대로 지문에 있어도 사전에 뜻이 없으면 못 낸다.
 *
 * ⚠️ 지문에 **한 번만** 나오는 낱말을 고른다. 여러 번 나오면 학습자가 어느 자리의
 *   뜻을 묻는지 헷갈리고, 다의어일 때 문맥마다 뜻이 달라 정답이 흔들린다.
 *
 * @param paragraph 지문 문장들.
 * @param lookup 지문 낱말 → 사전 표제어. 없으면 null.
 * @param pool 오답 뜻을 뽑을 낱말들(같은 밴드).
 */
export function buildUnitVocab(
  paragraph: ReadonlyArray<string>,
  lookup: (word: string) => ElementaryWord | null,
  pool: readonly ElementaryWord[],
): MiddleVocabItem | null {
  if (!isPrintablePassage(paragraph.join(' '))) return null
  const sentences = selectPassageWindow(paragraph, MIDDLE_ITEM_WORDS, 2)
  if (!sentences) return null

  const counts = new Map<string, number>()
  for (const s of sentences) {
    for (const t of s.split(/\s+/)) {
      const w = bare(t).toLowerCase()
      if (w) counts.set(w, (counts.get(w) ?? 0) + 1)
    }
  }

  // 결정론으로 훑는다 — 같은 지문이면 늘 같은 문항이 나온다.
  const words = [...counts.keys()].filter((w) => counts.get(w) === 1 && /^[a-z]{4,}$/.test(w)).sort()
  if (!words.length) return null
  const start = hash(sentences.join(' ')) % words.length

  for (let k = 0; k < words.length; k++) {
    const word = words[(start + k) % words.length]!
    const entry = lookup(word)
    if (!entry) continue
    const answer = firstSense(entry.meaningKo)
    if (!answer) continue

    const synonyms = new Set((entry.synonyms ?? []).map((s) => s.toLowerCase()))
    const others = pool.filter((w) => {
      if (w.word.toLowerCase() === word) return false
      if (synonyms.has(w.word.toLowerCase())) return false
      // **지문에 있는 낱말은 오답으로 쓰지 않는다** — 학습자가 지문을 읽고
      // "그 낱말도 여기 있네" 로 헷갈린다. 초등판에는 없던 제약이다(지문이 없으니까).
      if (counts.has(w.word.toLowerCase())) return false
      const sense = firstSense(w.meaningKo)
      if (!sense || sense === answer) return false
      if (sense.includes(answer) || answer.includes(sense)) return false
      return true
    })
    if (others.length < MIDDLE_CHOICES - 1) continue

    const distractors = pickDeterministic(others, MIDDLE_CHOICES - 1, word)
    if (distractors.length < MIDDLE_CHOICES - 1) continue
    const senses = distractors.map((d) => firstSense(d.meaningKo))
    // 오답끼리 같은 뜻이면 보기가 셋으로 줄어든 것과 같다.
    if (new Set(senses).size !== senses.length) continue

    const texts = rotate([answer, ...senses], hash(word) % MIDDLE_CHOICES)
    return {
      kind: 'unit_vocab',
      promptKo: `본문의 밑줄 친 "${word}" 의 뜻으로 알맞은 것은?`,
      sentences: [...sentences],
      target: word,
      choices: texts.map((t, i) => ({ label: LABELS[i]!, text: t })),
      answer: texts.indexOf(answer) + 1,
    }
  }
  return null
}

// ── ② 단원 문법 ────────────────────────────────────────────────────

/**
 * 중등 규격 어법 문항 — 밑줄 다섯 중 틀린 것 고르기. 조건을 못 맞추면 **null**.
 *
 * 수능 어법(`buildGrammarChoice`)과 규칙은 같고 **지문 길이만 다르다**(40~120어).
 * 규격을 섞지 않으려고 함수를 나눴다 — 섞으면 수능 재고를 중등 재고로 세게 된다.
 */
export function buildUnitGrammar(paragraph: ReadonlyArray<string>): MiddleGrammarItem | null {
  if (!isPrintablePassage(paragraph.join(' '))) return null
  const sentences = selectPassageWindow(paragraph, MIDDLE_ITEM_WORDS, 2)
  if (!sentences) return null

  const all = []
  for (let si = 0; si < sentences.length; si++) {
    const tokens = sentences[si]!.split(/\s+/)
    for (let ti = 0; ti < tokens.length; ti++) {
      const c = candidateAt(tokens, ti, si)
      if (c) all.push(c)
    }
  }
  if (all.length < MIDDLE_GRAMMAR_UNDERLINES) return null

  // 밑줄을 지문에 고르게 퍼뜨린다 — 한 문장에 몰리면 나머지 문장을 안 읽어도 풀린다.
  const picked = spread(all, MIDDLE_GRAMMAR_UNDERLINES)
  const answerIdx = hash(sentences.join(' ')) % picked.length

  const broken = sentences.map((s) => s.split(/\s+/))
  const target = picked[answerIdx]!
  broken[target.sentenceIdx]![target.tokenIdx] = target.broken

  return {
    kind: 'unit_grammar',
    promptKo: '밑줄 친 부분 중 어법상 틀린 것은?',
    sentences: broken.map((t) => t.join(' ')),
    underlines: picked.map((c, i) => ({
      sentenceIdx: c.sentenceIdx,
      tokenIdx: c.tokenIdx,
      word: i === answerIdx ? c.broken : c.token,
      label: LABELS[i]!,
    })),
    choices: picked.map((_, i) => ({ label: LABELS[i]!, text: LABELS[i]! })),
    answer: answerIdx + 1,
    rule: target.rule,
    original: bare(target.token),
  }
}

// ── 공용 ───────────────────────────────────────────────────────────

/** 고르게 퍼뜨려 n 개 — 앞쪽에 몰리지 않게 등간격으로 집는다. */
export function spread<T>(items: readonly T[], n: number): T[] {
  if (items.length <= n) return [...items]
  const step = items.length / n
  return Array.from({ length: n }, (_, i) => items[Math.floor(i * step)]!)
}

/** 같은 입력이면 늘 같은 선택 — 재생성해도 문항이 바뀌면 안 된다. */
export function pickDeterministic<T extends { word: string }>(
  pool: readonly T[],
  n: number,
  seed: string,
): T[] {
  return [...pool]
    .map((w) => ({ w, k: hash(`${seed}#${w.word}`) }))
    .sort((a, b) => a.k - b.k || (a.w.word < b.w.word ? -1 : 1))
    .slice(0, n)
    .map((x) => x.w)
}

function rotate<T>(items: readonly T[], by: number): T[] {
  const k = ((by % items.length) + items.length) % items.length
  return [...items.slice(k), ...items.slice(0, k)]
}

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
