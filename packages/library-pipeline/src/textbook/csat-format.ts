// packages/library-pipeline/src/textbook/csat-format.ts
//
// **DCP 문항을 수능 인쇄 형식으로 바꾼다.** 저장 형식도 학습 화면도 건드리지 않는다.
//
// ── 왜 변환인가 ──────────────────────────────────────────────────────
// DCP 의 저장 형식(`presented` · `remaining`)은 화면(`DcpItems.tsx`)과 채점
// RPC(`grade_dcp_item`)의 계약이다. 교재를 위해 그 스키마를 바꾸면 이미 돌고 있는
// 구문 연습이 깨진다. **같은 재료를 다르게 인쇄하면 된다.**
//
// ── 수능 실제 형식 ───────────────────────────────────────────────────
//
//   글의 순서   도입문이 주어지고 (A)(B)(C) 세 덩어리를 배열한다.
//               답지는 5개 — (A)-(B)-(C) 원순서는 빠진다(그게 답이면 문제가 안 된다).
//
//   문장 삽입   지문 문장 사이 ①~⑤ 다섯 자리 중 하나를 고른다.
//               ①은 **첫 문장 뒤**다 — 글 맨 앞에 넣는 선택지는 없다.
//
// ── 삽입은 6문장 문단에서만 정확히 맞는다 ────────────────────────────
// DCP 는 문단에서 문장 1개를 빼는데, 뺄 수 있는 위치가 1..n-1 이다(첫 문장은 도입이라
// 안 뺀다). n=6 이면 남은 5문장 뒤에 자리가 5곳 생기고 제거 위치 1~5 가 ①~⑤ 에 그대로
// 대응한다. **n=4·5 는 자리가 3·4곳이라 수능 형식이 아니다** — 교재에서는 뺀다.
//
//   실측(2026-08-21): 적격 문단 379개 중 4문장 160 · 5문장 122 · **6문장 97**.
//
// ⚠️ 이 제약을 지키지 않으면 자리 수가 문항마다 달라지고, 학습자는 실전에서 만나는
//   ①~⑤ 대신 ①~③ 을 연습하게 된다. 형식이 다르면 연습 효과가 반감된다.

/** 수능 순서 문항 — 도입문 + (A)(B)(C) + 5지선다. */
export interface CsatOrderItem {
  kind: 'order'
  intro: string
  blocks: { label: 'A' | 'B' | 'C'; sentences: string[] }[]
  /** 답지 5개. 각각 라벨 배열(예: ['A','C','B']). 수능처럼 원순서는 빠진다. */
  choices: Array<Array<'A' | 'B' | 'C'>>
  /** 정답 번호 (1~5). */
  answer: number
}

/** 수능 삽입 문항 — 지문 + ①~⑤. */
export interface CsatInsertItem {
  kind: 'insert'
  /** 넣을 문장. */
  sentence: string
  /** 지문 문장들. 각 문장 뒤에 자리 번호가 붙는다 — `slots[i]` 는 `body[i]` 뒤. */
  body: string[]
  /** 자리 번호 1~5. */
  slots: number[]
  answer: number
}

/** 삽입 문항이 수능 형식(①~⑤)이 되려면 지문에 남아야 하는 문장 수. */
export const CSAT_INSERT_BODY_SENTENCES = 5

/**
 * 순서 문항으로 바꾼다.
 *
 * `presented[k] = 원문[source_order[k]]` 이므로 원문 순서를 먼저 복원한다.
 * 그다음 첫 문장을 도입으로 떼고, 나머지를 세 덩어리로 나눠 라벨을 섞는다.
 */
export function toCsatOrder(
  presented: ReadonlyArray<string>,
  sourceOrder: ReadonlyArray<number>,
): CsatOrderItem | null {
  const n = presented.length
  if (n < 4 || n !== sourceOrder.length) return null

  // 원문 복원 — 원문[i] 는 presented 에서 sourceOrder 가 i 인 자리에 있다.
  const original: string[] = new Array(n)
  for (let k = 0; k < n; k++) original[sourceOrder[k]!] = presented[k]!
  if (original.some((s) => s === undefined)) return null

  const intro = original[0]!
  const rest = original.slice(1)

  // 세 덩어리로 나눈다 — 앞쪽 덩어리가 더 길게(4→1,1,1 / 5→2,1,1 / 6→2,2,1).
  const sizes = splitIntoThree(rest.length)
  if (!sizes) return null
  const chunks: string[][] = []
  let at = 0
  for (const size of sizes) {
    chunks.push(rest.slice(at, at + size))
    at += size
  }

  // 라벨을 섞는다 — 원문 순서가 (A)(B)(C) 이면 문제가 성립하지 않는다.
  //   결정론이어야 같은 지문이 늘 같은 문항이 된다(멱등). 그래서 내용으로 seed 를 만든다.
  const rot = 1 + (hash(intro + rest.join('')) % 5) // 1~5 — 항등(0) 제외
  const perms = ORDER_PERMS // 5개, (A)(B)(C) 원순서 없음
  const answerPerm = perms[rot - 1]!

  // answerPerm 이 "정답 배열" 이다. 즉 라벨 L 이 answerPerm 의 i 번째면 chunks[i] 가 L 이다.
  const blocks: CsatOrderItem['blocks'] = []
  for (const label of ['A', 'B', 'C'] as const) {
    const pos = answerPerm.indexOf(label)
    blocks.push({ label, sentences: chunks[pos]! })
  }

  return {
    kind: 'order',
    intro,
    blocks,
    choices: perms.map((p) => [...p]),
    answer: rot,
  }
}

/**
 * 삽입 문항으로 바꾼다. **자리가 5곳이 아니면 null** — 교재에 실을 수 없다.
 */
export function toCsatInsert(
  remaining: ReadonlyArray<string>,
  insertSentence: string,
  position: number,
): CsatInsertItem | null {
  if (remaining.length !== CSAT_INSERT_BODY_SENTENCES) return null
  // position 은 원문에서 제거된 인덱스(1..n-1). n=6 이므로 1~5 가 그대로 ①~⑤ 다.
  if (position < 1 || position > CSAT_INSERT_BODY_SENTENCES) return null
  return {
    kind: 'insert',
    sentence: insertSentence,
    body: [...remaining],
    slots: [1, 2, 3, 4, 5],
    answer: position,
  }
}

/** 수능 답지 5개 — 3! 순열에서 원순서 (A)(B)(C) 를 뺀 것. 실제 시험지와 같은 나열이다. */
export const ORDER_PERMS: ReadonlyArray<ReadonlyArray<'A' | 'B' | 'C'>> = [
  ['A', 'C', 'B'],
  ['B', 'A', 'C'],
  ['B', 'C', 'A'],
  ['C', 'A', 'B'],
  ['C', 'B', 'A'],
]

/** n 문장을 세 덩어리로. 앞쪽이 더 길다 — 논지 전개상 도입 뒤가 두껍다. */
export function splitIntoThree(n: number): [number, number, number] | null {
  if (n < 3) return null
  const base = Math.floor(n / 3)
  const extra = n % 3
  return [base + (extra > 0 ? 1 : 0), base + (extra > 1 ? 1 : 0), base]
}

/** 결정론 해시 — 같은 지문이면 늘 같은 문항이 나와야 한다(멱등). */
function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
