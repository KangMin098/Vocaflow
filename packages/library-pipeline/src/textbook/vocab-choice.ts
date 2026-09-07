// packages/library-pipeline/src/textbook/vocab-choice.ts
//
// **문맥에 맞지 않는 낱말 고르기 (수능 30번).** 결정론이고 LLM 을 쓰지 않는다.
//
// ── 수능 실제 형식 ───────────────────────────────────────────────────
// 지문의 낱말 다섯에 밑줄이 있고 (A)~(E) 가 붙는다. 그중 하나가 문맥에 어긋난다.
//
// ── 왜 결정론으로 되는가, 그리고 어디가 함정인가 ─────────────────────
// 반대말로 바꿔 놓으면 우리가 답을 안다. 문제는 **바꾼 낱말이 정말 "틀려 보이는가"** 다.
// 문장 하나만 놓고 보면 반대말도 대개 자연스럽다 — `increase` 를 `decrease` 로 바꿔도
// 그 문장은 멀쩡하다. 틀렸다는 것은 **글의 나머지와 어긋날 때만** 드러난다.
//
// 그래서 하나를 건다: **바꿀 낱말은 글 안에서 두 번 이상 나와야 한다.**
// 한 자리만 반대말로 바꾸면 나머지 자리에 원래 낱말이 그대로 남아, 지문 안에
// `decrease … increase … increase` 가 공존한다. 학습자는 **읽으면 찾을 수 있고**,
// 우리는 그 사실을 문자열로 확인할 수 있다.
//
// ── 굴절형은 건드리지 않는다 ─────────────────────────────────────────
// 사전의 반대말은 표제어다. `increases` 를 `decrease` 로 바꾸면 수일치가 깨지고,
// 그러면 학습자는 뜻이 아니라 **문법이 이상해서** 고른다 — 어휘 문항이 어법 문항이 된다.
// 그래서 토큰이 표제어와 **정확히 같을 때만** 바꾼다.
//
// ── 재료 실측 (2026-08-21) ───────────────────────────────────────────
// `shared_dictionary` 47,591 낱말 중 반대말이 있는 것 15,764(33.1%). 그런데 이 값은
// V11(17,981개 · 21.0%)이 끌어내린 것이고 **대상 밴드는 훨씬 낫다**:
//
//     V1 54.7% · V2 44.5% · V3 45.5% · V4 51.0% · V5 43.9%
//     V6 41.5% · V7 46.6% · V8 38.2% · V9 40.8% · V10 33.8% · V11 21.0%

import { CSAT_ITEM_WORDS } from './compose-unit'
import { isPrintablePassage, selectPassageWindow } from './csat-format'

/** 사전에서 필요한 것만. 순수 함수로 두려고 주입받는다. */
export interface VocabLexicon {
  /** 표제어의 반대말들. 없으면 빈 배열. */
  antonymsOf(word: string): string[]
  /** 품사. 모르면 null. */
  posOf(word: string): string | null
}

/** 밑줄 다섯 — 수능과 같다. */
export const VOCAB_UNDERLINES = 5

/** 낱말이 글 안에서 최소 몇 번 나와야 바꿀 수 있는가. */
//
// **2 인 이유는 산술이다** — 한 자리를 바꾸고도 원래 낱말이 최소 한 번은 남아야
// 지문 안에서 모순이 보인다. 1 이면 바뀐 낱말만 남아 어긋난 데가 없다.
export const MIN_CHAIN_OCCURRENCES = 2

export interface Underline {
  /** 몇 번째 문장인가. */
  sentenceIdx: number
  /** 화면에 보이는 낱말 — 정답 자리에서는 **반대말**이다. */
  word: string
  label: string
}

export interface VocabChoiceItem {
  kind: 'vocab_choice'
  /** 지문 문장들. 정답 자리의 낱말은 이미 반대말로 바뀌어 있다. */
  sentences: string[]
  underlines: Underline[]
  /** 정답 번호 1~5. */
  answer: number
  /** 원래 낱말 — 해설과 검수용. */
  original: string
}

const LABELS = ['①', '②', '③', '④', '⑤'] as const

/** 밑줄 후보에서 뺄 낱말 — 기능어는 문맥 어휘가 아니다. */
const FUNCTION_WORDS = new Set(
  (
    'about above after again against along among around because before below beneath beside between ' +
    'beyond could during either every from have having however inside instead into might must neither ' +
    'other rather same should since some such than that their there these this those through ' +
    'toward under until upon were what when where which while whose will with within without would'
  ).split(' '),
)

/**
 * 글을 낱말로 쪼갠다 — **이 정의 하나만 쓴다.**
 *
 * ⚠️ 빈도를 셀 때와 완성본을 검사할 때 쪼개는 방식이 다르면 앞뒤가 어긋난다. 실제로
 *   생성기는 `well-known` 을 한 낱말로 보고 검사 쪽은 `well` 로 봐서 실측이 갈렸다.
 *   하이픈은 낱말 경계로 친다 — 읽는 사람도 그렇게 읽는다.
 */
function wordsOf(text: string): string[] {
  return text.toLowerCase().match(/[a-z][a-z']*/g) ?? []
}

/** 낱말 토큰만 — 붙은 부호를 떼고 소문자로. */
function normalize(token: string): string {
  return token.toLowerCase().replace(/[^a-z'-]/g, '')
}

/**
 * 밑줄을 걸 만한 낱말인가 — 내용어이고, 굴절되지 않은 표제어 꼴이다.
 *
 * 하이픈이 든 낱말(`well-known`)은 받지 않는다. 그 일부만 반대말로 바꾸면 복합어가
 * 깨지고, 학습자는 뜻이 아니라 **낱말이 이상해서** 고른다.
 */
function isCandidateToken(token: string): boolean {
  const w = normalize(token)
  return w.length >= 5 && !FUNCTION_WORDS.has(w) && /^[a-z][a-z']*$/.test(w)
}

/** 원래 낱말의 대소문자를 반대말에 옮긴다 — 문장 첫머리가 소문자로 내려가면 안 된다. */
function matchCase(original: string, replacement: string): string {
  if (/^[A-Z]/.test(original)) return replacement.charAt(0).toUpperCase() + replacement.slice(1)
  return replacement
}

/**
 * 어휘 문항을 만든다. 조건을 못 맞추면 **null** — 억지로 만들지 않는다.
 *
 * @param sentences 지문 문장들.
 * @param lex 사전.
 */
export function buildVocabChoice(
  paragraph: ReadonlyArray<string>,
  lex: VocabLexicon,
): VocabChoiceItem | null {
  if (paragraph.length < VOCAB_UNDERLINES) return null
  // 인용 잔해·용어풀이가 섞인 문단은 교재에 실을 수 없다.
  if (!isPrintablePassage(paragraph.join(' '))) return null
  // **문단을 통째로 쓰지 않는다.** 규격(90~200어)에 맞는 연속 구간을 잘라 쓴다 —
  // 실측에서 어휘 문항의 58.2% 가 규격 밖이었고, 그 재고는 조판에서 통째로 버려졌다.
  const sentences = selectPassageWindow(paragraph, CSAT_ITEM_WORDS, VOCAB_UNDERLINES)
  if (!sentences) return null

  // 글 전체의 낱말 빈도 — 사슬을 찾는 데 쓴다.
  const freq = new Map<string, number>()
  for (const s of sentences) for (const w of wordsOf(s)) freq.set(w, (freq.get(w) ?? 0) + 1)

  // 밑줄 후보 — 문장의 **모든** 내용어를 본다.
  //
  // ⚠️ 처음엔 문장마다 첫 내용어만 후보로 잡았다. 그랬더니 바꿀 낱말이 문장 중간에 있는
  //   흔한 경우가 통째로 빠졌다(실측 fixture 의 `expensive` 가 그랬다). 후보는 넓게 잡고,
  //   **밑줄을 고를 때** 한 문장에 하나씩만 걸어 촘촘해지지 않게 한다.
  const all: { sentenceIdx: number; tokenIdx: number; token: string }[] = []
  for (let si = 0; si < sentences.length; si++) {
    const tokens = sentences[si]!.split(/\s+/)
    for (let ti = 0; ti < tokens.length; ti++) {
      if (isCandidateToken(tokens[ti]!)) all.push({ sentenceIdx: si, tokenIdx: ti, token: tokens[ti]! })
    }
  }

  // 바꿀 자리 — 사슬을 이루고(두 번 이상), 표제어 꼴이며, 같은 품사의 반대말이 있고,
  // 그 반대말이 글에 아직 없어야 한다(있으면 어느 쪽이 어긋난 것인지 갈린다).
  const swappable = all
    .map((c) => {
      const w = normalize(c.token)
      if ((freq.get(w) ?? 0) < MIN_CHAIN_OCCURRENCES) return null
      const pos = lex.posOf(w)
      for (const ant of lex.antonymsOf(w)) {
        // **한 낱말짜리만.** 사전에는 `give up` 같은 구가 섞여 있는데, 그것을 토큰 하나에
        // 끼워 넣으면 지문에 `giveup` 이 인쇄된다. 교재에서는 그냥 오탈자다.
        if (!/^[A-Za-z][A-Za-z'-]*$/.test(ant.trim())) continue
        const a = normalize(ant)
        if (!a || a === w) continue
        if (freq.has(a)) continue
        const antPos = lex.posOf(a)
        if (pos && antPos && pos !== antPos) continue
        return { ...c, word: w, antonym: a }
      }
      return null
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  if (!swappable.length) return null

  // ── 정답 번호를 먼저 고르고, 그 번호를 만들 수 있는 낱말을 고른다 ─
  //
  // ⚠️ 처음엔 낱말을 먼저 고르고 번호가 따라오게 뒀다. 그랬더니 **①이 현저히 적었다**
  //   (실측 138·256·278·215·208 · χ²=52.7, 임계 9.5). 밑줄이 문장마다 하나씩이라 번호가 곧
  //   문장 순서인데, **첫 문장에 바꿀 만한 낱말이 있을 확률이 낮기** 때문이다.
  //   번호가 쏠리면 학습자는 읽지 않고 찍는다.
  //
  // 두 번 헛짚었다. ① "가까운 문장에서 고르기" 는 ②를 50.9%로 만들었고,
  // ② "오답을 앞뒤에서 몇 개 가져올지만 정하기" 는 χ²를 52.7→38.7 로 줄였을 뿐이다 —
  // **다섯 문장짜리 문단에서는 번호가 하나로 강제되기 때문**이다(앞 k개·뒤 4−k개가 고정).
  //
  // 그래서 순서를 뒤집는다. **번호를 먼저 정하고**, 그 번호가 나오게 하는 낱말 중에서 고른다.
  // 후보가 아니라 **번호를 균등하게** 뽑는 것이 요점이다 — 후보 수로 뽑으면 다시 쏠린다.
  const seed = hash(sentences.join(' '))
  const need = VOCAB_UNDERLINES - 1

  /** 이 낱말을 바꾸면 나올 수 있는 정답 번호들. */
  const ranksFor = (c: { sentenceIdx: number }): number[] => {
    const pool = sentences
      .map((_, si) => (si === c.sentenceIdx ? null : all.find((x) => x.sentenceIdx === si) ?? null))
      .filter((x): x is NonNullable<typeof x> => x !== null)
    const nBefore = pool.filter((d) => d.sentenceIdx < c.sentenceIdx).length
    const nAfter = pool.filter((d) => d.sentenceIdx > c.sentenceIdx).length
    const out: number[] = []
    for (let r = 1; r <= VOCAB_UNDERLINES; r++) {
      if (r - 1 <= nBefore && need - (r - 1) <= nAfter) out.push(r)
    }
    return out
  }

  const byRank = new Map<number, typeof swappable>()
  for (const c of swappable) {
    for (const r of ranksFor(c)) byRank.set(r, [...(byRank.get(r) ?? []), c])
  }
  const availableRanks = [...byRank.keys()].sort((a, b) => a - b)
  if (!availableRanks.length) return null
  const rank = availableRanks[seed % availableRanks.length]!
  const forRank = byRank.get(rank)!
  const chosen = forRank[seed % forRank.length]!

  const decoyPool = sentences
    .map((_, si) => (si === chosen.sentenceIdx ? null : all.find((c) => c.sentenceIdx === si) ?? null))
    .filter((x): x is NonNullable<typeof x> => x !== null)
  const decoysBefore = decoyPool.filter((d) => d.sentenceIdx < chosen.sentenceIdx)
  const decoysAfter = decoyPool.filter((d) => d.sentenceIdx > chosen.sentenceIdx)

  const picked = [
    ...spread(decoysBefore, rank - 1),
    chosen,
    ...spread(decoysAfter, need - (rank - 1)),
  ].sort((a, b) => a.sentenceIdx - b.sentenceIdx || a.tokenIdx - b.tokenIdx)
  if (picked.length !== VOCAB_UNDERLINES) return null

  // 그 자리 한 곳만 반대말로 바꾼다. 나머지 자리의 원래 낱말은 그대로 남는다 —
  // 그 남은 것이 모순을 보이게 하는 근거다.
  const out = [...sentences]
  const tokens = out[chosen.sentenceIdx]!.split(/\s+/)
  const before = tokens[chosen.tokenIdx]!
  // 붙어 있던 부호는 지킨다(`increase,` → `decrease,`).
  tokens[chosen.tokenIdx] = before.replace(
    /[A-Za-z][A-Za-z'-]*/,
    matchCase(before, chosen.antonym),
  )
  out[chosen.sentenceIdx] = tokens.join(' ')

  const underlines: Underline[] = picked.map((p, i) => ({
    sentenceIdx: p.sentenceIdx,
    word:
      p.sentenceIdx === chosen.sentenceIdx && p.tokenIdx === chosen.tokenIdx
        ? matchCase(before, chosen.antonym)
        : p.token,
    label: LABELS[i]!,
  }))
  const answer = picked.findIndex(
    (p) => p.sentenceIdx === chosen.sentenceIdx && p.tokenIdx === chosen.tokenIdx,
  )
  if (answer < 0) return null

  // ── 만든 다음 스스로 검사한다 ─────────────────────────────────────
  // 이 유형이 성립하는 조건은 **완성본에서** 확인해야 한다. 고르는 동안의 빈도표는
  // 바꾸기 전 지문의 것이라, 바꾼 뒤에 무엇이 몇 번 나오는지는 다시 세야 안다.
  // 실측에서 1,312개 중 1개가 이 검사에 걸렸다.
  const body = out.join(' ')
  if (countWord(body, chosen.antonym) !== 1) return null
  // 원래 낱말이 남아 있어야 모순이 보인다.
  if (countWord(body, chosen.word) < 1) return null

  return {
    kind: 'vocab_choice',
    sentences: out,
    underlines,
    answer: answer + 1,
    original: chosen.word,
  }
}

/** 목록에서 n 개를 **고르게** 뽑는다 — 앞뒤로 몰리면 밑줄이 한 곳에 뭉친다. */
export function spread<T>(items: readonly T[], n: number): T[] {
  if (n <= 0) return []
  if (items.length <= n) return [...items]
  const out: T[] = []
  for (let k = 0; k < n; k++) out.push(items[Math.round((k * (items.length - 1)) / (n - 1 || 1))]!)
  return out
}

/** 낱말이 글에 몇 번 나오는가 — `cheap` 이 `cheaper` 를 세지 않는다. */
export function countWord(text: string, word: string): number {
  return wordsOf(text).filter((w) => w === word.toLowerCase()).length
}

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
