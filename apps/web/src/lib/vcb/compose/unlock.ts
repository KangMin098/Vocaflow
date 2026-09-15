// apps/web/src/lib/vcb/compose/unlock.ts
//
// 콘텐츠 해금 최적화 — 이 플랫폼만 만들 수 있는 단어장의 알고리즘 (U1 `unlock` · U2 `recycle`).
//
// 왜 지면 단어장이 이것을 못 하나:
//   ① 어떤 단어가 그 책에서 몇 번 나오는가 는 책마다 다르고
//   ② 학습자가 이미 아는 단어 는 사람마다 다르고
//   ③ 한 단어를 더 배웠을 때 문장이 몇 개 더 읽히는가 는 ①②의 함수다.
//   인쇄 시점에 목차를 확정해야 하는 매체는 ②를 알 수 없다 — 구조상 불가다.
//
// 두 목표를 구분한다 (섞으면 우위 주장이 흐려진다):
//   · **토큰 커버리지** — 가산적이다. 그러므로 그 코퍼스 안에서는 빈도 내림차순이 곧 최적이고,
//     우위는 "일반 빈도(NGSL)" 대비로만 발생한다.
//   · **문장 해금** — 가산적이지 않다(집합 덮기). 문장은 그 안의 미지어가 **전부** 풀려야 읽힌다.
//     그래서 한계 이득 탐욕이 빈도순을 실제로 이긴다. 이것이 U1 의 정량 근거다.

import type { CandidateWord } from './types'

// ── 토큰 커버리지 ───────────────────────────────────────────────────

export interface CoverageResult {
  tokens_total: number
  tokens_covered: number
  achieved: number
  /** 목표에 도달하는 데 쓴 단어 수 */
  words_used: number
  /** 목표 미달 시 true — 코퍼스에 없는 어휘까지 다 넣어도 못 넘는 경우 */
  exhausted: boolean
}

const freqOf = (c: CandidateWord): number => Math.max(0, c.corpus_freq ?? 0)

/** 코퍼스 총 토큰 — 기지 어휘까지 포함해야 커버리지 분모가 정직해진다. */
export function totalTokens(population: CandidateWord[]): number {
  let sum = 0
  for (const c of population) sum += freqOf(c)
  return sum
}

/**
 * 목표 커버리지까지 필요한 최소 단어를 고른다.
 *
 * 기지 어휘(`knownWords`)는 분자에 이미 들어간다 — "이미 아는 만큼은 이미 읽힌다" 가
 * 학습자가 체감하는 출발점이기 때문이다. 여기서 뽑는 것은 **추가로 배울 것**뿐이다.
 */
export function greedyTokenCoverage(
  population: CandidateWord[],
  opts: { target: number; knownWords?: Set<string>; maxWords?: number },
): { picked: CandidateWord[]; coverage: CoverageResult } {
  const known = opts.knownWords ?? new Set<string>()
  const total = totalTokens(population)

  let covered = 0
  const learnable: CandidateWord[] = []
  for (const c of population) {
    if (known.has(c.word.toLowerCase())) covered += freqOf(c)
    else learnable.push(c)
  }

  // 가산 목표이므로 한계 이득 = 빈도. 정렬 한 번이 곧 탐욕이다.
  learnable.sort((a, b) => freqOf(b) - freqOf(a) || a.word.localeCompare(b.word))

  const picked: CandidateWord[] = []
  const cap = opts.maxWords ?? learnable.length
  for (const c of learnable) {
    if (total > 0 && covered / total >= opts.target) break
    if (picked.length >= cap) break
    picked.push(c)
    covered += freqOf(c)
  }

  const achieved = total > 0 ? covered / total : 0
  return {
    picked,
    coverage: {
      tokens_total: total,
      tokens_covered: covered,
      achieved,
      words_used: picked.length,
      exhausted: achieved < opts.target,
    },
  }
}

// ── 문장 해금 (집합 덮기) ───────────────────────────────────────────

export interface SentenceUnit {
  id: string
  /** 이 문장에 등장하는 후보 단어(정규화 소문자) */
  words: string[]
  chapter: number | null
}

/** 문장 하나를 후보 단어로 환원할 때 무시할 최소 길이 — 기능어는 이미 후보에 없다. */
const MIN_TOKEN_LEN = 2

function tokenize(sentence: string): string[] {
  return sentence
    .toLowerCase()
    .split(/[^a-z'-]+/)
    .filter((t) => t.length >= MIN_TOKEN_LEN)
}

/**
 * 후보들이 들고 온 코퍼스 문장으로 문장×단어 인접 구조를 만든다.
 *
 * `library_book_vocabularies.first_sentence` 는 단어당 한 문장이지만 문장은 여러 단어에
 * 공유되므로, 같은 문장이 여러 후보에서 반복 등장한다 — 그 중복이 곧 인접 정보다.
 */
export function buildSentenceIndex(candidates: CandidateWord[]): SentenceUnit[] {
  const vocab = new Set(candidates.map((c) => c.word.toLowerCase()))
  const byText = new Map<string, SentenceUnit>()

  for (const c of candidates) {
    const s = c.corpus_sentence
    if (!s || s.trim().length === 0) continue
    const key = s.trim()
    if (byText.has(key)) continue
    const words = [...new Set(tokenize(key))].filter((t) => vocab.has(t))
    if (words.length === 0) continue
    byText.set(key, {
      id: `s${byText.size}`,
      words,
      chapter: c.corpus_chapter ?? null,
    })
  }

  return [...byText.values()]
}

export interface UnlockPick {
  word: string
  /** 이 단어를 넣은 순간 새로 읽히게 된 문장 수 */
  sentences_unlocked: number
  /** 누적 해금 문장 수 */
  cumulative: number
  candidate: CandidateWord
}

export interface UnlockPlan {
  picks: UnlockPick[]
  sentences_total: number
  sentences_unlocked: number
  /** 아무것도 배우지 않았을 때 이미 읽히는 문장 (기지 어휘만으로) */
  baseline_unlocked: number
}

/**
 * 문장 해금 탐욕 — 한 단어를 더 배웠을 때 **완전히 읽히게 되는 문장 수**가 최대인 것을 고른다.
 *
 * 구현 노트: 문장별 미해결 단어 수(`remaining`)를 들고 있다가, 단어를 고를 때 그 단어가 속한
 * 문장들의 `remaining` 을 1 줄인다. 0 이 되는 순간 그 문장이 해금된다. 그래서 후보 하나의
 * 이득은 "내가 마지막 조각인 문장 수" 이고, 이것이 빈도와 다른 값이 되는 이유다 —
 * 흔한 단어라도 그 문장의 다른 미지어가 남아 있으면 이득이 0 이다.
 */
export function greedySentenceUnlock(
  candidates: CandidateWord[],
  sentences: SentenceUnit[],
  opts: { budget: number; knownWords?: Set<string> },
): UnlockPlan {
  const known = new Set([...(opts.knownWords ?? [])].map((w) => w.toLowerCase()))
  const byWord = new Map<string, CandidateWord>()
  for (const c of candidates) byWord.set(c.word.toLowerCase(), c)

  const remaining = new Map<string, number>()
  const sentencesOfWord = new Map<string, string[]>()
  const sentenceById = new Map<string, SentenceUnit>()

  for (const s of sentences) {
    sentenceById.set(s.id, s)
    const unknown = s.words.filter((w) => !known.has(w))
    remaining.set(s.id, unknown.length)
    for (const w of unknown) {
      const list = sentencesOfWord.get(w)
      if (list) list.push(s.id)
      else sentencesOfWord.set(w, [s.id])
    }
  }

  let unlocked = 0
  for (const [, n] of remaining) if (n === 0) unlocked += 1
  const baseline = unlocked

  // 이득이 0 인 단어도 언젠가 마지막 조각이 되므로 후보에서 빼지 않는다.
  // 동률은 코퍼스 빈도로 깬다 — 같은 해금 수면 더 자주 보이는 단어가 낫다.
  const pool = [...byWord.keys()].filter((w) => !known.has(w))
  const picks: UnlockPick[] = []
  const taken = new Set<string>()

  const gainOf = (w: string): number => {
    let gain = 0
    for (const sid of sentencesOfWord.get(w) ?? []) {
      if (remaining.get(sid) === 1) gain += 1
    }
    return gain
  }

  while (picks.length < opts.budget && taken.size < pool.length) {
    let best: string | null = null
    let bestGain = -1
    let bestFreq = -1

    for (const w of pool) {
      if (taken.has(w)) continue
      const gain = gainOf(w)
      const freq = freqOf(byWord.get(w)!)
      if (gain > bestGain || (gain === bestGain && freq > bestFreq)) {
        best = w
        bestGain = gain
        bestFreq = freq
      }
    }

    if (best === null) break

    taken.add(best)
    for (const sid of sentencesOfWord.get(best) ?? []) {
      const left = remaining.get(sid) ?? 0
      if (left > 0) {
        remaining.set(sid, left - 1)
        if (left - 1 === 0) unlocked += 1
      }
    }

    picks.push({
      word: byWord.get(best)!.word,
      sentences_unlocked: bestGain,
      cumulative: unlocked,
      candidate: byWord.get(best)!,
    })
  }

  return {
    picks,
    sentences_total: sentences.length,
    sentences_unlocked: unlocked,
    baseline_unlocked: baseline,
  }
}

/**
 * 같은 단어 수를 일반 빈도순으로 골랐을 때의 해금 문장 수 — U1 우위 주장의 대조군.
 *
 * 대조군은 **일반 빈도(frequency_rank)** 여야 한다. 코퍼스 빈도로 대조하면
 * "가산 목표에서는 빈도순이 곧 최적" 이라는 사실 때문에 우위가 사라지고,
 * 그것을 숨긴 채 우위를 주장하면 거짓이 된다.
 */
export function baselineSentenceUnlock(
  candidates: CandidateWord[],
  sentences: SentenceUnit[],
  opts: { budget: number; knownWords?: Set<string>; by?: 'frequency_rank' | 'corpus_freq' },
): { picked: string[]; sentences_unlocked: number } {
  const known = new Set([...(opts.knownWords ?? [])].map((w) => w.toLowerCase()))
  const by = opts.by ?? 'frequency_rank'

  const pool = candidates.filter((c) => !known.has(c.word.toLowerCase()))
  const sorted = [...pool].sort((a, b) => {
    if (by === 'corpus_freq') return freqOf(b) - freqOf(a)
    const ra = a.frequency_rank ?? Number.MAX_SAFE_INTEGER
    const rb = b.frequency_rank ?? Number.MAX_SAFE_INTEGER
    return ra - rb || freqOf(b) - freqOf(a)
  })

  const picked = sorted.slice(0, opts.budget).map((c) => c.word.toLowerCase())
  const learned = new Set([...known, ...picked])

  let unlocked = 0
  for (const s of sentences) {
    if (s.words.every((w) => learned.has(w))) unlocked += 1
  }

  return { picked, sentences_unlocked: unlocked }
}

// ── U2 recycle — 향후 재등장 ────────────────────────────────────────

/**
 * 학습 후 자연 노출이 보장되는 단어를 우선한다.
 *
 * `LEARNING_FRAMEWORK.md` 의 `ENCOUNTERS_FLOOR = 8` 을 인공 반복이 아니라 읽기로 채우는
 * 유일한 방법이 이것이다 — 앞으로 읽을 챕터에 다시 나오는 단어부터 배우는 것.
 * `future_encounters` 는 코퍼스 해석기가 채운다(현재 챕터 이후 등장 횟수).
 */
export function rankByRecycle(candidates: CandidateWord[]): CandidateWord[] {
  return [...candidates].sort((a, b) => {
    const fa = a.future_encounters ?? 0
    const fb = b.future_encounters ?? 0
    if (fb !== fa) return fb - fa
    return freqOf(b) - freqOf(a) || a.word.localeCompare(b.word)
  })
}

/** recycle 세트의 지표 — 선택 단어의 평균 향후 재등장. 대조군은 빈도순 같은 개수. */
export function recycleStats(
  picked: CandidateWord[],
  population: CandidateWord[],
): { picked_mean: number; baseline_mean: number; population_mean: number } {
  const mean = (xs: CandidateWord[]): number =>
    xs.length === 0 ? 0 : xs.reduce((s, c) => s + (c.future_encounters ?? 0), 0) / xs.length

  const baseline = [...population]
    .sort((a, b) => {
      const ra = a.frequency_rank ?? Number.MAX_SAFE_INTEGER
      const rb = b.frequency_rank ?? Number.MAX_SAFE_INTEGER
      return ra - rb
    })
    .slice(0, picked.length)

  return {
    picked_mean: mean(picked),
    baseline_mean: mean(baseline),
    population_mean: mean(population),
  }
}
