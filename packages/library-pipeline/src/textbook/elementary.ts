// packages/library-pipeline/src/textbook/elementary.ts
//
// **초등 문항 3종 — 파닉스(운율) · 낱말 뜻 · 철자 완성.** 결정론이고 **지문이 필요 없다.**
//
// ── 왜 이 셋인가 ─────────────────────────────────────────────────────
// 초등은 소리·낱말 단위라 지문이 없거나 한두 문장이다(`school-types.ts`). 그래서 수능 유형
// (순서·삽입)을 그대로 적용하던 동안 초중급 재고가 0으로 보였다 — 재료가 없던 게 아니라
// **유형을 잘못 적용**하고 있었다.
//
// ── 어휘 목록은 교육과정이다 (실측 2026-08-21) ───────────────────────
// Dolch 사이트워드 대신 **2022 개정 교육과정 기본어휘 별표**를 쓴다. `shared_dictionary` 의
// `list_tags` 에 이미 들어 있고(`kcurr2022_1` 초등 808 · `_2` 중등 1,211 · `_0` 고등 1,006),
// 국내 학습 환경이 목표이므로 미국 목록보다 이쪽이 맞다.
//
//     초등 808개 중 — `meaning_ko` 808(100%) · `rhyme_key` 807 · `ipa` 807 · 운율 무리 446개
//
// ── 운율 데이터가 파닉스 교재 그대로다 ───────────────────────────────
// `rhyme_key` 는 강세 모음부터의 각운이라 **소리는 같은데 철자가 다른 것**까지 한 무리로 묶인다:
//
//     -eɪk   bake · break · cake · lake · make · steak · take · wake
//     -ɔl    all · ball · baseball · call · fall · small · tall · wall
//
// 파닉스가 가르치려는 것이 정확히 이것이다 — 철자가 아니라 **소리**로 묶는 것.

// ── 이 문항들은 DB 에 저장하지 않는다 ────────────────────────────────
// `csat_dcp_items` 는 **글에 매인 표**다 — 유일키가 `(kind, ref_id, type, paragraph_idx)` 이고
// `ref_id` 는 글의 UUID 다. 초등 3종은 **낱말에서 나오지 글에서 나오지 않는다.**
//
// 억지로 넣으려면 가짜 `ref_id` 를 만들어야 하고, 그러면 "이 문항은 어느 글의 것인가" 라는
// 표의 뜻이 깨진다. 게다가 이 문항들은 **사전의 순수 함수**라 저장할 필요가 없다 —
// 같은 사전이면 늘 같은 문항이 나오고(멱등), 사전이 바뀌면 저장본이 오히려 낡는다.
// 교재를 짤 때 그 자리에서 만든다.

/** 초등 문항이 필요로 하는 낱말 정보. 순수 함수로 두려고 주입받는다. */
export interface ElementaryWord {
  word: string
  /** 한국어 뜻. 교육과정 어휘는 100% 채워져 있다. */
  meaningKo: string
  /** 각운 열쇠 — 강세 모음부터. 없으면 파닉스 문항에 못 쓴다. */
  rhymeKey: string | null
  /** 같은 뜻으로 쓰이는 낱말 — 오답으로 쓰면 답이 둘이 된다. */
  synonyms?: readonly string[]
}

/** 초등은 4지선다가 보통이다. 수능 5지선다와 다르다. */
export const ELEMENTARY_CHOICES = 4

const LABELS = ['①', '②', '③', '④'] as const

export interface ElementaryItem {
  // 'listen_choose' 는 별도 파일(`listen-choose.ts`)이지만 같은 문항 모양을 쓴다 —
  // 초등 보기 4개·정답 번호·단답 자리가 같아서다. 유형 이름만 여기 함께 둔다.
  kind: 'rhyme' | 'word_meaning' | 'spell_blank' | 'listen_choose'
  /** 학습자에게 보이는 물음 — 한국어. */
  promptKo: string
  /** 물음의 주인공(낱말 또는 빈칸 꼴). */
  stem: string
  /** 보기. 철자 완성은 보기가 없다(단답). */
  choices: { label: string; text: string }[]
  /** 정답 번호(보기가 있을 때) 또는 0. */
  answer: number
  /** 단답 정답 — 철자 완성에서 쓴다. */
  answerText: string
}

// ── ① 파닉스 — 운율 맞추기 ──────────────────────────────────────────

/**
 * 굴절·파생으로 이어진 낱말인가 — 한쪽이 다른 쪽을 통째로 품으면 운율 문제가 안 된다.
 *
 * `make`/`makes` 는 소리가 같지만 학습자는 **소리를 듣지 않고 철자를 보고** 고른다.
 */
function shareStem(a: string, b: string): boolean {
  const [s, l] = a.length <= b.length ? [a, b] : [b, a]
  return l.startsWith(s) || l.endsWith(s)
}

/** 끝 철자 n 글자. 오답이 제시어와 끝이 같으면 소리가 달라도 라임처럼 보인다. */
function tail(word: string, n = 2): string {
  return word.slice(-n)
}

/**
 * 운율 문항을 만든다 — "제시어와 소리가 같은 낱말 고르기".
 *
 * @param prompt 제시어.
 * @param pool 보기를 뽑을 낱말들(제시어와 같은 밴드).
 */
export function buildRhyme(prompt: ElementaryWord, pool: readonly ElementaryWord[]): ElementaryItem | null {
  if (!prompt.rhymeKey) return null

  const rhymes = pool.filter(
    (w) =>
      w.word !== prompt.word &&
      w.rhymeKey === prompt.rhymeKey &&
      // 굴절·파생은 안 된다 — 소리가 아니라 철자로 풀린다.
      !shareStem(w.word, prompt.word),
  )
  if (!rhymes.length) return null

  // 결정론으로 고른다 — 같은 제시어는 늘 같은 문항이 된다.
  const seed = hash(prompt.word)
  const answerWord = rhymes[seed % rhymes.length]!

  // **겉모습으로 못 고르게 한다.** 제시어가 `afternoon` 인데 오답이 `map` 이면 읽지 않고도
  // 배제된다. 길이 범위는 **제시어와 정답이 이루는 구간**이라 밖에서 가져온 숫자가 아니다 —
  // `irrelevant.ts` 가 무관 문장의 낱말 수를 본문 범위에 맞추는 것과 같은 규칙이다.
  const lo = Math.min(prompt.word.length, answerWord.word.length)
  const hi = Math.max(prompt.word.length, answerWord.word.length)

  const others = pool.filter(
    (w) =>
      w.word !== prompt.word &&
      w.word !== answerWord.word &&
      w.rhymeKey !== null &&
      w.rhymeKey !== prompt.rhymeKey &&
      !shareStem(w.word, prompt.word) &&
      w.word.length >= lo &&
      w.word.length <= hi &&
      // 끝 철자가 같으면 소리가 달라도 라임처럼 보인다 — 초등에는 부당한 함정이다.
      tail(w.word) !== tail(prompt.word),
  )
  if (others.length < ELEMENTARY_CHOICES - 1) return null

  const distractors = pickDeterministic(others, ELEMENTARY_CHOICES - 1, prompt.word)
  if (distractors.length < ELEMENTARY_CHOICES - 1) return null

  const texts = [answerWord.word, ...distractors.map((d) => d.word)]
  const at = seed % ELEMENTARY_CHOICES
  const ordered = rotate(texts, at)

  // ── 만든 다음 스스로 검사한다 ─────────────────────────────────────
  // 보기 중 제시어와 소리가 같은 것은 **정확히 하나**여야 한다.
  const keyOf = new Map(pool.map((w) => [w.word, w.rhymeKey]))
  const matching = ordered.filter((t) => keyOf.get(t) === prompt.rhymeKey)
  if (matching.length !== 1) return null

  return {
    kind: 'rhyme',
    promptKo: `다음 중 "${prompt.word}" 와 소리가 같은 낱말은?`,
    stem: prompt.word,
    choices: ordered.map((t, i) => ({ label: LABELS[i]!, text: t })),
    answer: ordered.indexOf(answerWord.word) + 1,
    answerText: answerWord.word,
  }
}

// ── ② 낱말 뜻 고르기 ────────────────────────────────────────────────

/** 뜻의 첫 갈래만 — 교재 보기에 여러 뜻을 다 실으면 길어서 못 읽는다. */
export function firstSense(meaningKo: string): string {
  return meaningKo.split(/[;,·/]|\s\d[.)]/)[0]!.trim()
}

/**
 * 뜻 고르기 문항 — "낱말의 뜻은?".
 *
 * 오답 뜻이 정답과 겹치면 답이 둘이 된다. 그래서 **유의어와 뜻 문자열 겹침**을 둘 다 막는다.
 */
export function buildWordMeaning(
  prompt: ElementaryWord,
  pool: readonly ElementaryWord[],
): ElementaryItem | null {
  const answer = firstSense(prompt.meaningKo)
  if (!answer) return null
  const synonyms = new Set((prompt.synonyms ?? []).map((s) => s.toLowerCase()))

  const others = pool.filter((w) => {
    if (w.word === prompt.word) return false
    if (synonyms.has(w.word.toLowerCase())) return false
    const sense = firstSense(w.meaningKo)
    if (!sense || sense === answer) return false
    // 한쪽이 다른 쪽을 품으면 학습자 눈에는 같은 뜻이다("사과" vs "사과나무").
    if (sense.includes(answer) || answer.includes(sense)) return false
    return true
  })
  if (others.length < ELEMENTARY_CHOICES - 1) return null

  const distractors = pickDeterministic(others, ELEMENTARY_CHOICES - 1, prompt.word)
  if (distractors.length < ELEMENTARY_CHOICES - 1) return null
  const senses = distractors.map((d) => firstSense(d.meaningKo))
  // 오답끼리 같은 뜻이면 보기가 셋으로 줄어든 것과 같다.
  if (new Set(senses).size !== senses.length) return null

  const texts = [answer, ...senses]
  const ordered = rotate(texts, hash(prompt.word) % ELEMENTARY_CHOICES)

  return {
    kind: 'word_meaning',
    promptKo: `"${prompt.word}" 의 뜻은?`,
    stem: prompt.word,
    choices: ordered.map((t, i) => ({ label: LABELS[i]!, text: t })),
    answer: ordered.indexOf(answer) + 1,
    answerText: answer,
  }
}

// ── ③ 철자 완성 ─────────────────────────────────────────────────────

/** 빈칸 표시. */
const BLANK = '_'

/**
 * 철자 완성 문항 — 글자 하나를 지우고 채우게 한다.
 *
 * ── 정답이 하나인지 사전으로 확인한다 ───────────────────────────────
 * `c _ t` 는 cat · cot · cut 이 다 되므로 문제가 되지 않는다. 그런데 이건 **확인할 수 있다** —
 * 사전 47,591 낱말 중 그 꼴에 맞는 것이 몇 개인지 세면 된다. 하나일 때만 문항으로 낸다.
 *
 * @param prompt 답이 될 낱말.
 * @param dictionary 사전 전체(같은 길이 낱말만 걸러 넣어도 된다).
 */
export function buildSpellBlank(
  prompt: ElementaryWord,
  dictionary: ReadonlySet<string>,
): ElementaryItem | null {
  const w = prompt.word.toLowerCase()
  if (!/^[a-z]{3,8}$/.test(w)) return null
  const meaning = firstSense(prompt.meaningKo)
  if (!meaning) return null

  // 첫 글자와 마지막 글자는 남긴다 — 초등 학습자가 낱말을 붙잡을 자리가 있어야 한다.
  const positions = Array.from({ length: w.length - 2 }, (_, i) => i + 1)
  if (!positions.length) return null

  // 지울 자리를 결정론으로 훑으며 **정답이 하나로 확정되는 첫 자리**를 쓴다.
  const start = hash(w) % positions.length
  for (let k = 0; k < positions.length; k++) {
    const at = positions[(start + k) % positions.length]!
    const pattern = w.slice(0, at) + BLANK + w.slice(at + 1)
    if (countMatching(pattern, dictionary) !== 1) continue
    return {
      kind: 'spell_blank',
      promptKo: `뜻을 보고 빈칸을 채우세요 — ${meaning}`,
      stem: pattern.split('').join(' '),
      choices: [],
      answer: 0,
      answerText: w,
    }
  }
  return null
}

/** 빈칸 꼴에 맞는 사전 낱말 수. */
export function countMatching(pattern: string, dictionary: ReadonlySet<string>): number {
  const at = pattern.indexOf(BLANK)
  if (at < 0) return dictionary.has(pattern) ? 1 : 0
  let n = 0
  for (let c = 97; c <= 122; c++) {
    const candidate = pattern.slice(0, at) + String.fromCharCode(c) + pattern.slice(at + 1)
    if (dictionary.has(candidate)) n++
  }
  return n
}

// ── 공통 ────────────────────────────────────────────────────────────

/** 결정론으로 n 개를 고른다 — 같은 seed 면 늘 같은 것들. */
export function pickDeterministic<T extends { word: string }>(
  items: readonly T[],
  n: number,
  seed: string,
): T[] {
  return [...items]
    .map((x) => ({ x, k: hash(`${seed}#${x.word}`) }))
    .sort((a, b) => a.k - b.k || (a.x.word < b.x.word ? -1 : 1))
    .slice(0, n)
    .map((v) => v.x)
}

/** 정답이 늘 첫 자리에 오지 않도록 돌린다. */
function rotate<T>(items: readonly T[], by: number): T[] {
  const n = items.length
  const k = ((by % n) + n) % n
  return [...items.slice(n - k), ...items.slice(0, n - k)]
}

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
