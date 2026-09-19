// packages/library-pipeline/src/textbook/middle-short.ts
//
// **중등 내신 단답 두 유형** — 빈칸에 낱말 쓰기 · 어법 틀린 것 고쳐 쓰기.
//
// ── 왜 단답인가 ──────────────────────────────────────────────────────
// 서술형은 대개 사람이 채점해야 해서 이 파이프라인 밖이다. 그런데 **정답이 원문인 단답**은
// 다르다 — 문자열 비교로 채점된다. `word-order.ts` 가 같은 이유로 먼저 들어왔다.
//
// 커버리지 실측(2026-08-21, `scripts/textbook/coverage.mjs`)에서 중등은 6유형 중 1개만
// 구현돼 있었고, `measureSchoolCoverage().cheapWins` 가 **결정론 · 자동채점 · 지문 제약 없음**
// 조건으로 남은 4개를 지목했다. 이 파일은 그중 단답 두 개다.
//
// ── 두 유형이 결정론인 이유가 서로 다르다 ────────────────────────────
//   빈칸    원문에서 낱말을 **지웠으므로** 정답이 원문이다.
//   어법     원문을 규칙으로 **망가뜨렸으므로** 되돌릴 형태를 우리가 안다.
// 둘 다 "정답을 우리가 만들었다" 는 점에서 확정적이다. 추론으로 정답을 정하지 않는다.
//
// ⚠️ 빈칸은 **확정성이 저절로 오지 않는다.** 문장에서 낱말 하나를 지우면 그 자리에
//   들어갈 수 있는 낱말이 대개 여럿이다("She ___ the door" → opened·closed·locked…).
//   그래서 첫 글자와 우리말 뜻을 단서로 준다 — 그 둘이 붙으면 답이 하나로 좁혀진다.
//   단서 없이 내면 채점이 갈리고, 그건 문항이 아니라 함정이다.

import { candidateAt, type GrammarRule } from './grammar-choice'
import { isPrintablePassage } from './csat-format'

/** 빈칸 표시 — 초등 철자 완성(`elementary.ts`)의 `_` 와 구분해 길게 쓴다. */
const BLANK = '_____'

/**
 * 빈칸으로 지울 낱말의 길이.
 *
 * 3자 이하는 첫 글자만 줘도 사실상 답이 보이고(`the`·`and`), 12자를 넘으면
 * 중등 학습자가 철자를 통째로 쓰기 어려워 채점이 철자 시험이 된다.
 */
export const BLANK_WORD_LEN = { min: 4, max: 12 } as const

/** 문장 길이 — 너무 짧으면 문맥이 없어 답이 안 좁혀지고, 너무 길면 중등 지문이 아니다. */
export const MIDDLE_SENTENCE_WORDS = { min: 6, max: 25 } as const

export interface MiddleShortItem {
  kind: 'blank_word' | 'grammar_fix'
  /** 학습자에게 보이는 물음 — 한국어. */
  promptKo: string
  /** 문제 문장. 빈칸이거나, 한 낱말이 틀리게 바뀌어 있다. */
  stem: string
  /** 단서. 빈칸은 첫 글자 + 우리말 뜻, 어법은 없다(찾는 것이 과제다). */
  hint: string | null
  /** 정답 문자열. 채점은 이것과의 비교다. */
  answerText: string
  /** 앞 문장 — 우리말 해석이 없으므로 문맥이 그 자리를 대신한다. */
  context: string | null
}

/** 붙은 부호를 뗀 순수 낱말. */
function bare(token: string): string {
  return token.replace(/[^A-Za-z']/g, '')
}

/**
 * 빈칸으로 쓸 수 없는 낱말 — **기능어**.
 *
 * 기능어는 문법이 자리를 정해 주므로 문맥만으로 맞힐 수 있고, 반대로 같은 자리에
 * 다른 기능어도 들어가는 일이 잦다(`in`/`on`/`at`). 어느 쪽이든 어휘 문항이 아니다.
 * 목록이지 규칙이 아니라서 짧게 유지한다 — 길어지면 근거 없는 취향이 된다.
 */
const FUNCTION_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'if', 'of', 'to', 'in', 'on', 'at', 'by', 'for',
  'with', 'from', 'as', 'that', 'this', 'these', 'those', 'is', 'are', 'was', 'were',
  'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'not', 'it', 'its',
  'he', 'she', 'they', 'them', 'his', 'her', 'their', 'we', 'you', 'i', 'there', 'here',
])

/** 문장으로 받아들일 수 있는가 — 두 유형이 함께 쓰는 문턱. */
function usableSentence(sentence: string): string[] | null {
  const s = sentence.trim()
  if (!s || !isPrintablePassage(s)) return null
  if (!/[.!?]$/.test(s)) return null
  const tokens = s.split(/\s+/).filter(Boolean)
  if (tokens.length < MIDDLE_SENTENCE_WORDS.min || tokens.length > MIDDLE_SENTENCE_WORDS.max) {
    return null
  }
  return tokens
}

/**
 * 빈칸 문항을 만든다. 조건을 못 맞추면 **null**.
 *
 * @param sentence 원문 문장.
 * @param context 바로 앞 문장. 없으면 null.
 * @param meaningOf 낱말의 우리말 뜻. 사전에 없으면 null — 그 낱말은 쓰지 않는다.
 *   (모듈을 순수하게 두려고 사전을 주입받는다. `elementary.ts` 와 같은 방식이다.)
 * @param isHintUnique 이 낱말의 단서(첫 글자 + 뜻)가 사전에서 **이 낱말 하나만** 가리키는가.
 *
 * ── `isHintUnique` 를 나중에 붙인 이유 (실측 2026-08-22) ─────────────
 * 처음엔 "첫 글자 + 우리말 뜻이면 답이 하나로 좁혀진다" 를 **주장만 하고 재지 않았다.**
 * 재 보니 생성된 18,114문항 중 **1,790건(9.88%)** 이 확정되지 않았다:
 *   `exploration` 의 단서 "e… (탐험)" 은 다른 e- 낱말도 가리킨다.
 *   `about` 의 단서 "a… (~에 관하여)" 도 마찬가지다.
 * 학습자가 맞는 답을 써도 틀렸다고 채점된다 — 단답의 가장 나쁜 실패다.
 *
 * 같은 저장소에 선례가 있었다: `elementary.ts` 의 `buildSpellBlank` 는 `c_t` 가
 * cat·cot·cut 을 다 받는 것을 **사전으로 세어** 거른다. 확인할 수 있는 것을 확인 안 하고
 * 주장으로 두면 안 된다. 그래서 이 인자는 **선택이 아니라 필수**다 —
 * 선택으로 두면 다음 호출자가 빠뜨려 결함이 되살아난다.
 */
export function buildBlankWord(
  sentence: string,
  context: string | null,
  meaningOf: (word: string) => string | null,
  isHintUnique: (word: string, meaning: string) => boolean,
): MiddleShortItem | null {
  const tokens = usableSentence(sentence)
  if (!tokens) return null

  // 같은 낱말이 두 번 나오면 어느 자리를 지웠는지와 무관하게 **다른 자리도 답이 된다.**
  // 그러면 학습자가 맞게 써도 위치가 달라 틀린 것으로 채점될 수 있다.
  const counts = new Map<string, number>()
  for (const t of tokens) {
    const k = bare(t).toLowerCase()
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1)
  }

  // 지울 자리를 결정론으로 훑는다 — 같은 문장이면 늘 같은 문항이 나온다(멱등).
  const order = Array.from({ length: tokens.length }, (_, i) => i)
  const start = hash(sentence) % tokens.length
  for (let k = 0; k < order.length; k++) {
    const at = order[(start + k) % order.length]!
    const token = tokens[at]!
    const word = bare(token)
    const lower = word.toLowerCase()

    if (!/^[A-Za-z][A-Za-z'-]*$/.test(word)) continue
    if (word.length < BLANK_WORD_LEN.min || word.length > BLANK_WORD_LEN.max) continue
    if (FUNCTION_WORDS.has(lower)) continue
    if ((counts.get(lower) ?? 0) > 1) continue
    // 첫 낱말을 지우면 첫 글자 단서가 대문자라 품사·고유명사가 드러난다.
    if (at === 0) continue
    // 대문자로 시작하면 고유명사일 공산이 크다 — 뜻으로 좁혀지지 않는다.
    if (/^[A-Z]/.test(word)) continue

    const meaning = meaningOf(lower)
    if (!meaning) continue
    // 단서가 이 낱말 하나를 가리키지 못하면 채점이 갈린다 — 다음 자리를 본다.
    if (!isHintUnique(lower, meaning)) continue

    // 붙은 부호는 남긴다 — 부호까지 지우면 문장이 어색해지고 답과 무관한 힌트가 사라진다.
    const suffix = token.slice(token.indexOf(word) + word.length)
    const blanked = [...tokens]
    blanked[at] = BLANK + suffix

    return {
      kind: 'blank_word',
      promptKo: '문맥과 뜻에 맞게 빈칸에 알맞은 낱말을 쓰시오.',
      stem: blanked.join(' '),
      hint: `${word[0]!.toLowerCase()}… (${meaning})`,
      answerText: lower,
      context,
    }
  }
  return null
}

/**
 * 어법 고쳐 쓰기 문항을 만든다. 조건을 못 맞추면 **null**.
 *
 * ── `grammar-choice.ts` 와 무엇이 다른가 ────────────────────────────
 * 같은 규칙으로 같은 자리를 망가뜨린다. **다른 것은 묻는 방식**이다:
 *   어법 선택(수능 29번)  지문에 밑줄 다섯 → 틀린 것 **고르기**(객관식)
 *   어법 고쳐 쓰기(중등)   문장 하나 → 틀린 것 **찾아 고쳐 쓰기**(단답)
 * 그래서 규칙 판정은 재구현하지 않고 `candidateAt` 을 그대로 쓴다 —
 * 재구현하면 두 유형의 판정이 조용히 갈라진다.
 *
 * ⚠️ **망가뜨릴 자리가 정확히 하나일 때만** 낸다. 둘 이상이면 학습자가 다른 쪽을
 *   고쳐도 맞는 답인데 채점은 틀렸다고 한다 — 문항이 아니라 함정이 된다.
 */
export function buildGrammarFix(
  sentence: string,
  context: string | null,
): (MiddleShortItem & { rule: GrammarRule }) | null {
  const tokens = usableSentence(sentence)
  if (!tokens) return null

  const candidates = []
  for (let ti = 0; ti < tokens.length; ti++) {
    const c = candidateAt(tokens, ti, 0)
    if (c) candidates.push(c)
  }
  // 하나뿐일 때만. 없으면 만들 수 없고, 여럿이면 정답이 갈린다.
  if (candidates.length !== 1) return null

  const c = candidates[0]!
  const broken = [...tokens]
  broken[c.tokenIdx] = c.broken

  return {
    kind: 'grammar_fix',
    promptKo: '어법상 틀린 낱말을 찾아 바르게 고쳐 쓰시오.',
    stem: broken.join(' '),
    hint: null,
    answerText: bare(c.token),
    context,
    rule: c.rule,
  }
}

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
