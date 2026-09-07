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

// 학술 인용 잔해 — 논문 본문의 `[12]` 에서 링크 텍스트만 사라지면 `[]` 가 남는다.
//   실측 2026-08-21: 저장된 문항 758개 중 **64개(8.4%)** 에 있었고 **전부 PLOS** 였다.
//   교재에 그대로 인쇄되면 학습자가 무엇인지 알 수 없고, 순서·삽입 판단에도 방해가 된다.
//   실물: "[] trained the model using a sample set and 71 features"
//
// ⚠️ 논문을 어휘 난이도로 가르려다 실패했다 — 고난도 어휘(V9+·미등재) 비율이
//   plos 13.6%(최소 8.4) · wikipedia 23.5% · nasa 9.9% · usgs 8.7% 로 분포가 겹친다.
//   확실히 잡히는 것은 이 패턴 하나뿐이다.
const CITATION_RESIDUE = /\[\s*\]|\[\s*\d+\s*[,\-–]?\s*\d*\s*\]/

/**
 * 삽입 문항이 받을 수 있는 문단 문장 수.
 *
 * ⚠️ 순서(order)는 4~6문장이어야 한다 — 도입문 1 + (A)(B)(C) 세 덩어리다.
 *   그런데 **삽입은 지문이 길어도 자리만 5곳이면 된다**(실제 수능 지문이 6~8문장).
 *   같은 상한을 쓰는 동안 7문장 이상 문단을 통째로 버렸고, 그게 재고 병목이었다.
 *   길이 규격(90~200어)에 드는 것만 세도: V5 +14단원 · V6 +9단원 ·
 *   **V4 +7단원(지금 0단원)**.
 */
// ⚠️ 하한은 **4 그대로** 둔다. 5로 올리면 4문장 문단의 삽입 문항이 사라지는데,
//   그건 교재에는 못 써도(자리 3곳) **학습 화면의 구문 연습에는 유효한 재고**다.
//   교재를 위해 이미 돌고 있는 기능을 깎지 않는다 — 교재 쪽에서만 5~9를 요구한다
//   (`CSAT_INSERT_BODY`). 여기서 늘리는 것은 상한뿐이다.
const INSERT_PARAGRAPH_SENTENCES = { min: 4, max: 10 } as const

/** 문단 적격 — 4~6문장 · 각 문장 6단어+ · 첫 문장 앵커 양호 · 보일러플레이트 아님. */
function isEligible(sentences: string[]): boolean {
  if (sentences.length < 4 || sentences.length > 6) return false
  if (sentences.some((s) => wordCount(s) < 6)) return false
  if (ANCHOR_BAD.test(sentences[0]!)) return false
  if (BOILERPLATE.test(sentences.join(' '))) return false
  if (CITATION_RESIDUE.test(sentences.join(' '))) return false
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
    const n = sentences.length
    // 유형마다 적격이 다르다 — 순서는 4~6문장, 삽입은 5~10문장.
    const orderOk = isEligible(sentences)
    const insertOk = isEligibleForInsert(sentences)
    if (!orderOk && !insertOk) return

    // order — presented[k] = sentences[perm[k]] (셔플 순). 정답 = source_order(각 presented 의 원본 인덱스).
    if (orderOk) {
      const perm = shuffledIndices(n, `${ref}:${pIdx}:order`)
      items.push({
        type: 'order',
        paragraph_idx: pIdx,
        payload: { presented: perm.map((i) => sentences[i]!) },
        answer_key: { source_order: perm },
      })
    }

    // insert — 중간 문장(1..n-1) 1개 제거. 정답 = 제거 위치.
    if (insertOk) {
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
    }
  })

  return items
}

/** 삽입 전용 적격 — 문장 수 상한만 다르고 나머지 조건은 같다. */
function isEligibleForInsert(sentences: string[]): boolean {
  const n = sentences.length
  if (n < INSERT_PARAGRAPH_SENTENCES.min || n > INSERT_PARAGRAPH_SENTENCES.max) return false
  if (sentences.some((s) => wordCount(s) < 6)) return false
  if (ANCHOR_BAD.test(sentences[0]!)) return false
  if (BOILERPLATE.test(sentences.join(' '))) return false
  if (CITATION_RESIDUE.test(sentences.join(' '))) return false
  return true
}

/** 문단별 적격 판정 사유 — 0문항이 나왔을 때 "왜" 를 말하기 위한 진단. */
export interface DcpParagraphDiagnosis {
  paragraph_idx: number
  sentences: number
  /** 둘 중 하나라도 나오는가. `order || insert`. */
  eligible: boolean
  /** 순서 문항이 나오는가 (4~6문장). */
  order: boolean
  /** 삽입 문항이 나오는가 (5~10문장). */
  insert: boolean
  reason: string | null
}

/**
 * `generateDcpItems` 가 왜 그 문항 수를 냈는지 설명한다.
 *
 * 왜 필요한가: 적격 필터가 조용해서, 문항 0건이 "콘텐츠가 안 맞음" 인지 "생성이 안 돌았음"
 * 인지 화면에서 구별되지 않았다. 규칙을 두 번 적으면 반드시 갈리므로 **같은 파일에서**
 * 같은 `isEligible` 을 불러 판정 사유만 덧붙인다.
 */
export function explainDcpEligibility(content: string): DcpParagraphDiagnosis[] {
  return splitParagraphs(content).map((para, paragraph_idx) => {
    const sentences = splitSentences(para)
    const n = sentences.length
    // ⚠️ 유형마다 적격이 다르다. 한쪽 기준으로만 설명하면 **진단이 실제와 어긋난다** —
    //   실제로 그렇게 어긋났고 회귀가 잡았다(문항 1개가 나오는데 "0개" 라고 설명했다).
    const order = isEligible(sentences)
    const insert = isEligibleForInsert(sentences)

    let reason: string | null = null
    if (!order && !insert) {
      if (n < 4) reason = `문장 ${n}개 — 순서는 4~6, 삽입은 5~10 필요`
      else if (n > 10) reason = `문장 ${n}개 — 삽입 상한 10 초과`
      else if (sentences.some((s) => wordCount(s) < 6))
        reason = `6단어 미만 문장 ${sentences.filter((s) => wordCount(s) < 6).length}개`
      else if (ANCHOR_BAD.test(sentences[0]!))
        reason = '첫 문장이 대명사·접속사로 시작 (복원 단서 부족)'
      else if (BOILERPLATE.test(sentences.join(' '))) reason = '보일러플레이트 (산문 아님)'
      else if (CITATION_RESIDUE.test(sentences.join(' '))) reason = '학술 인용 잔해'
    } else if (!order) {
      reason = `삽입만 — 문장 ${n}개라 순서(4~6)에는 안 맞는다`
    } else if (!insert) {
      reason = `순서만 — 문장 ${n}개라 삽입(5~10)에는 안 맞는다`
    }
    return { paragraph_idx, sentences: n, eligible: order || insert, order, insert, reason }
  })
}
