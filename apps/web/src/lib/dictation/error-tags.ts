// apps/web/src/lib/dictation/error-tags.ts
//
// 오류 태그 — 세션을 넘어 **누적되는** 안정 어휘.
//
// analyzer.ts 의 ErrorPattern 과 역할이 다르다:
//   · ErrorPattern = 이 문장에서 방금 무슨 일이 있었나 (세션 내 1회성 설명)
//   · ErrorTag     = DB `dictation_attempts.error_tags` 에 쌓여 2주치를 합산하는 좌표
//
// 왜 태그를 따로 두나:
//   "성장하고 있다"는 느낌은 정확도 숫자가 아니라 **약점이 줄어드는 것**에서 온다.
//   그러려면 오늘의 실수와 2주 전 실수를 같은 이름으로 불러야 한다. 설명 문장은
//   상황마다 달라도 되지만 태그는 고정이어야 누적이 가능하다.
//
// 태그는 학습자가 스스로 고칠 수 있는 단위로만 나눈다 — 'phonetic/syntactic' 같은
// 언어학 범주는 학습자가 뭘 해야 할지 알려주지 않는다.

import type { WordResult } from './types'
import { levenshteinDistance } from './scoring'

export type ErrorTag =
  /** a / an / the 누락 — 약하게 발음되어 가장 많이 놓치는 것 */
  | 'article'
  /** -s / -ed / -ing 어미 누락·오기 */
  | 'inflection'
  /** it's ↔ its, don't ↔ do not 등 축약 처리 */
  | 'contraction'
  /** 전치사·조동사·대명사 등 기능어 누락 */
  | 'function-word'
  /** 소리는 잡았으나 철자가 틀림 */
  | 'spelling'
  /** their/there, to/too 등 동음 혼동 */
  | 'homophone'
  /** 어순 뒤바뀜 */
  | 'word-order'
  /** 문장 뒷부분이 통째로 날아감 = 청취 폭 한계 */
  | 'tail-drop'
  /** 이 문장의 타깃(내 복습 단어)을 못 씀 */
  | 'missed-target'

export interface ErrorTagMeta {
  label: string
  /** 학습자에게 무엇을 하라고 말할 것인가 — 비난 아닌 처방(§철학3) */
  coach: string
}

export const ERROR_TAG_META: Record<ErrorTag, ErrorTagMeta> = {
  article: {
    label: '관사',
    coach: 'a·an·the 는 거의 들리지 않게 지나갑니다. 명사 앞을 한 박자 의심해 보세요.',
  },
  inflection: {
    label: '어미 -s/-ed',
    coach: '어미는 문장 끝 자음에 묻힙니다. 시제와 수를 문맥으로 되짚어 보세요.',
  },
  contraction: {
    label: '축약형',
    coach: "it's 와 its, we're 와 were 는 소리가 겹칩니다. 문장 구조로 갈라집니다.",
  },
  'function-word': {
    label: '기능어',
    coach: '전치사·조동사는 약하게 발음됩니다. 내용어 사이의 빈틈을 다시 들어보세요.',
  },
  spelling: {
    label: '철자',
    coach: '소리는 정확히 잡았습니다. 철자만 한 번 더 확인하면 됩니다.',
  },
  homophone: {
    label: '동음 혼동',
    coach: '소리가 같은 단어입니다. 이 자리에 문법적으로 무엇이 와야 하는지로 갈라집니다.',
  },
  'word-order': {
    label: '어순',
    coach: '단어는 다 잡았는데 자리만 바뀌었습니다. 덩어리로 기억해 보세요.',
  },
  'tail-drop': {
    label: '문장 뒷부분',
    coach: '뒷부분이 통째로 비었습니다. 문장이 조금 길었어요 — 한 번 더 들어도 괜찮습니다.',
  },
  'missed-target': {
    label: '오늘의 단어',
    coach: '이 문장이 훈련하려던 단어입니다. 복습 큐에 다시 올려두었어요.',
  },
}

const ARTICLES = new Set(['a', 'an', 'the'])

/** 내용어가 아닌 것 — 누락돼도 의미는 남지만 받아쓰기에선 놓치기 쉬운 부류. */
const FUNCTION_WORDS = new Set([
  'of', 'to', 'in', 'for', 'on', 'at', 'by', 'with', 'from', 'as', 'into', 'about',
  'over', 'after', 'before', 'through', 'up', 'out', 'off', 'down', 'than', 'that',
  'is', 'are', 'was', 'were', 'be', 'been', 'am', 'do', 'does', 'did', 'has', 'have',
  'had', 'will', 'would', 'can', 'could', 'should', 'may', 'might', 'must', 'shall',
  'and', 'or', 'but', 'so', 'if', 'it', 'he', 'she', 'they', 'we', 'you', 'i', 'his',
  'her', 'its', 'their', 'our', 'your', 'my', 'them', 'him', 'us', 'me',
])

const HOMOPHONE_PAIRS: Record<string, string[]> = {
  their: ['there', "they're", 'theyre'],
  there: ['their', "they're", 'theyre'],
  "they're": ['their', 'there'],
  your: ["you're", 'youre'],
  "you're": ['your'],
  its: ["it's", 'its'],
  "it's": ['its'],
  to: ['too', 'two'],
  too: ['to', 'two'],
  two: ['to', 'too'],
  hear: ['here'],
  here: ['hear'],
  buy: ['by', 'bye'],
  by: ['buy', 'bye'],
  weather: ['whether'],
  whether: ['weather'],
  through: ['threw'],
  threw: ['through'],
  no: ['know'],
  know: ['no'],
  write: ['right'],
  right: ['write'],
  piece: ['peace'],
  peace: ['piece'],
}

function isHomophonePair(expected: string, actual: string): boolean {
  const e = expected.toLowerCase().replace(/[^a-z']/g, '')
  const a = actual.toLowerCase().replace(/[^a-z']/g, '')
  return (HOMOPHONE_PAIRS[e] ?? []).includes(a)
}

function hasContraction(s: string): boolean {
  return /\b\w+'(s|t|re|ve|ll|d|m)\b/i.test(s)
}

/** expected 에 어미를 더하면 actual 이 되는가 (= 어미만 빠뜨림). */
function isInflectionMiss(expected: string, actual: string): boolean {
  const e = expected.toLowerCase().replace(/[^a-z]/g, '')
  const a = actual.toLowerCase().replace(/[^a-z]/g, '')
  if (!e || !a || e === a) return false
  for (const suffix of ['s', 'es', 'ed', 'd', 'ing', 'ies', 'ied']) {
    if (e === a + suffix || a === e + suffix) return true
    if (e.endsWith(suffix) && levenshteinDistance(e.slice(0, -suffix.length), a) === 0) return true
  }
  return false
}

export interface TagInput {
  wordResults: WordResult[]
  expected: string
  actual: string
  /** 못 맞춘 타깃 단어가 있으면 missed-target */
  missedTargets?: string[]
}

/**
 * 한 문항의 오류 태그 집합. 같은 태그는 한 번만 (빈도는 행 수로 센다 —
 * 한 문장에서 관사를 3개 놓쳤다고 약점이 3배로 심한 건 아니다).
 */
export function deriveErrorTags(input: TagInput): ErrorTag[] {
  const tags = new Set<ErrorTag>()
  const { wordResults, expected, actual } = input

  if ((input.missedTargets?.length ?? 0) > 0) tags.add('missed-target')

  // 뒷부분 통째 누락 — 마지막 30% 구간이 전부 missing 이면 청취 폭 문제로 본다.
  const tailStart = Math.floor(wordResults.length * 0.7)
  const tail = wordResults.slice(tailStart)
  if (
    wordResults.length >= 8 &&
    tail.length >= 3 &&
    tail.every((w) => w.status === 'missing')
  ) {
    tags.add('tail-drop')
  }

  for (const w of wordResults) {
    const exp = w.expected.toLowerCase().replace(/[^a-z']/g, '')
    if (!exp) continue

    if (w.status === 'missing') {
      if (ARTICLES.has(exp)) tags.add('article')
      else if (FUNCTION_WORDS.has(exp)) tags.add('function-word')
      continue
    }

    if (w.status === 'correct') continue

    if (w.actual && isHomophonePair(w.expected, w.actual)) {
      tags.add('homophone')
      continue
    }
    if (w.actual && isInflectionMiss(w.expected, w.actual)) {
      tags.add('inflection')
      continue
    }
    if (
      w.actual &&
      (hasContraction(w.expected) || hasContraction(w.actual)) &&
      w.expected.toLowerCase() !== w.actual.toLowerCase()
    ) {
      tags.add('contraction')
      continue
    }
    if (w.status === 'misspelled') tags.add('spelling')
  }

  // 어순 — 단어 집합은 같은데 순서만 다르면 wrong/extra/missing 이 섞여 나온다.
  const bag = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z\s']/g, '')
      .split(/\s+/)
      .filter(Boolean)
      .sort()
      .join(' ')
  if (
    !tags.has('word-order') &&
    expected.trim() &&
    actual.trim() &&
    expected.trim().toLowerCase() !== actual.trim().toLowerCase() &&
    bag(expected) === bag(actual)
  ) {
    tags.add('word-order')
  }

  return [...tags]
}

export function tagLabel(tag: string): string {
  return ERROR_TAG_META[tag as ErrorTag]?.label ?? tag
}

export function tagCoach(tag: string): string {
  return ERROR_TAG_META[tag as ErrorTag]?.coach ?? ''
}
