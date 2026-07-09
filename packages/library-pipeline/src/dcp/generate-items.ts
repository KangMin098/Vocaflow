// packages/library-pipeline/src/dcp/generate-items.ts
// CTP DCP T2 — 결정론 문항 생성 (order/insert). 런타임 LLM 0 · 원문 = 정답 키.
//
// order  : 4~6문장 문단의 문장 순서를 셔플 → 학습자가 원래 순서 복원. 정답=원래 순서.
// insert : 문단에서 중간 문장 1개 제거 → 학습자가 삽입 위치 선택. 정답=제거 위치.
//
// 결정론: seed(ref+문단idx) 기반 재현 가능 셔플 → 같은 콘텐츠는 항상 같은 문항(멱등).
//   LLM 미사용 = 모호성 리스크 0. 문단 적격 필터(문장수·앵커·fragment)로 저품질 배제.

export type DcpItemType = 'order' | 'insert'

export interface DcpItem {
  type: DcpItemType
  paragraph_idx: number
  /** order: {presented: string[]} / insert: {remaining: string[], insert_sentence: string, gap_count: number} */
  payload: Record<string, unknown>
  /** order: {source_order: number[]} (presented[k]의 원본 인덱스) / insert: {position: number} */
  answer_key: Record<string, unknown>
}

/** 문단 분할(빈 줄 기준). */
function splitParagraphs(content: string): string[] {
  return content
    .split(/\n\s*\n+/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length > 0)
}

/** 문장 분할(종결부호 뒤 공백 · lookbehind 로 부호 유지). */
function splitSentences(paragraph: string): string[] {
  return paragraph
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

function wordCount(s: string): number {
  return s.split(/\s+/).filter(Boolean).length
}

// 앵커 불명확(첫 문장이 대명사/접속사) — 순서 복원 단서 부족 → 배제.
const ANCHOR_BAD =
  /^(it|this|that|these|those|they|he|she|his|her|its|their|but|and|so|however|therefore|thus|hence|also|then|moreover|furthermore)\b/i

// 인용·라이선스·URL·캡션 보일러플레이트 — 산문 아님 → 배제.
const BOILERPLATE =
  /\b(cited as|retrieved from|published online|licensed under|creative ?commons|ourworldindata|https?:\/\/|www\.|doi:|all rights reserved|figure \d|table \d|source:|data source|see chart|image credit)\b/i

/** 문단 적격 — 4~6문장 · 각 문장 6단어+ · 첫 문장 앵커 양호 · 보일러플레이트 아님. */
function isEligible(sentences: string[]): boolean {
  if (sentences.length < 4 || sentences.length > 6) return false
  if (sentences.some((s) => wordCount(s) < 6)) return false
  if (ANCHOR_BAD.test(sentences[0]!)) return false
  if (BOILERPLATE.test(sentences.join(' '))) return false
  return true
}

// ── 결정론 PRNG (재현 셔플) ──
function hashSeed(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
/** Fisher-Yates 결정론 셔플 → 인덱스 순열. 항등(원래 순서)이면 인접 swap 으로 보정. */
function shuffledIndices(n: number, seed: string): number[] {
  const rng = mulberry32(hashSeed(seed))
  const idx = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[idx[i], idx[j]] = [idx[j]!, idx[i]!]
  }
  if (idx.every((v, i) => v === i)) {
    ;[idx[0], idx[1]] = [idx[1]!, idx[0]!]
  }
  return idx
}

/**
 * 텍스트 → DCP order/insert 문항 배열 (적격 문단만). 결정론(seed=ref).
 * @param content 기사/챕터 본문
 * @param ref     source_id (seed — 멱등 보장)
 */
export function generateDcpItems(content: string, ref: string): DcpItem[] {
  const paragraphs = splitParagraphs(content)
  const items: DcpItem[] = []

  paragraphs.forEach((para, pIdx) => {
    const sentences = splitSentences(para)
    if (!isEligible(sentences)) return
    const n = sentences.length

    // order — presented[k] = sentences[perm[k]] (셔플 순). 정답 = source_order(각 presented 의 원본 인덱스).
    const perm = shuffledIndices(n, `${ref}:${pIdx}:order`)
    items.push({
      type: 'order',
      paragraph_idx: pIdx,
      payload: { presented: perm.map((i) => sentences[i]!) },
      answer_key: { source_order: perm },
    })

    // insert — 중간 문장(1..n-1) 1개 제거. 정답 = 제거 위치.
    const removeIdx = 1 + (hashSeed(`${ref}:${pIdx}:insert`) % (n - 1))
    const remaining = sentences.filter((_, i) => i !== removeIdx)
    items.push({
      type: 'insert',
      paragraph_idx: pIdx,
      payload: {
        remaining,
        insert_sentence: sentences[removeIdx]!,
        gap_count: n, // 삽입 가능 위치 0..n-1
      },
      answer_key: { position: removeIdx },
    })
  })

  return items
}
