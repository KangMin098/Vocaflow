// apps/web/src/lib/text-extract/tokenize.ts
//
// 영문 텍스트 → 단어 토큰 추출 (client-side).
// /text/new 입력 → extract_vocabulary_for_user RPC 호출용.
//
// 규칙:
//   1. 소문자 변환
//   2. 알파벳·apostrophe만 유지 (숫자/기호 제거)
//   3. 단어 분리 (공백 + 구두점)
//   4. 길이 2 이상 (한 글자 'a','i' 제외 — shared_dictionary entry 거의 없음)
//   5. dedupe (Set)
//   6. limit cap (서버 부담 회피)

const MAX_UNIQUE = 1000

/** stopwords — 추출 가치 거의 없음 (가장 빈번한 기능어) */
const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'can',
  'may', 'might', 'must', 'shall', 'of', 'to', 'in', 'on', 'at', 'by', 'for', 'with',
  'from', 'as', 'into', 'about', 'over', 'under', 'this', 'that', 'these', 'those',
  'i', 'me', 'my', 'we', 'us', 'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her',
  'it', 'its', 'they', 'them', 'their', 'who', 'whom', 'what', 'which', 'where', 'when',
  'why', 'how', 'so', 'if', 'then', 'than', 'just', 'not', 'no', 'yes',
])

export interface TokenizationResult {
  /** 추출된 unique words (소문자, sorted) */
  words: string[]
  /** 입력 텍스트 전체 단어 수 (raw, dedup 전) */
  totalWords: number
  /** unique words 수 (dedup 후, stopwords 제외 전) */
  uniqueRaw: number
  /** stopword 제거 후 최종 unique 수 */
  uniqueFinal: number
}

/**
 * 영문 텍스트 토큰화 — extract_vocabulary_for_user RPC 입력용.
 */
export function tokenizeText(text: string): TokenizationResult {
  if (!text || text.trim().length === 0) {
    return { words: [], totalWords: 0, uniqueRaw: 0, uniqueFinal: 0 }
  }

  // 1. 소문자 + 알파벳/apostrophe만 유지
  //    (예: "Hello, world! It's 2024." → "hello world it's")
  const cleaned = text.toLowerCase().replace(/[^a-z\s']/g, ' ')

  // 2. 공백 분리
  const raw = cleaned.split(/\s+/).filter((w) => w.length >= 2)
  const totalWords = raw.length

  // 3. apostrophe 단순화 ("it's" → "it"), 빈 토큰 제거
  const normalized = raw
    .map((w) => w.replace(/^'+|'+$/g, ''))
    .map((w) => (w.includes("'") ? w.split("'")[0] : w))
    .filter((w) => w.length >= 2 && /^[a-z]+$/.test(w))

  // 4. unique
  const uniqueSet = new Set(normalized)
  const uniqueRaw = uniqueSet.size

  // 5. stopwords 제거
  const filtered = Array.from(uniqueSet).filter((w) => !STOPWORDS.has(w))

  // 6. cap + sort
  const capped = filtered.sort().slice(0, MAX_UNIQUE)

  return {
    words: capped,
    totalWords,
    uniqueRaw,
    uniqueFinal: capped.length,
  }
}
