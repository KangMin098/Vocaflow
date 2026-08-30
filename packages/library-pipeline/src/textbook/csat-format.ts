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

/**
 * 학술 인용 잔해 — 교재 지문에 그대로 인쇄되면 안 되는 흔적.
 *
 * ── 실측 2026-08-21 ─────────────────────────────────────────────────
 * 문항 758개 중 **64개(8.4%)** 에 이런 잔해가 있었고 **전부 PLOS**(논문)였다.
 * 실물:
 *
 *     [넣을 문장] [] trained the model using a sample set and 71 features
 *
 * `[]` 는 논문의 `[12]` 같은 인용 번호에서 링크 텍스트만 사라진 자국이다(62건).
 * 나머지는 `[3]` 형태(2건)와 연도 괄호다.
 *
 * ⚠️ **어휘 난이도로는 논문을 못 가른다.** 고난도 어휘(V9+·미등재) 비율을 재 봤더니
 *   plos 13.6%(최소 8.4) 인데 wikipedia 23.5% · nasa 9.9% · usgs 8.7% 로 **분포가 겹친다.**
 *   지표를 세우려다 실측으로 기각했다. 확실히 잡히는 것은 이 패턴 하나뿐이다.
 */
const CITATION_RESIDUE = /\[\s*\]|\[\s*\d+\s*[,\-–]?\s*\d*\s*\]/

/** 인용 잔해가 있으면 교재에 실을 수 없다. */
export function hasCitationResidue(text: string): boolean {
  return CITATION_RESIDUE.test(text)
}

/**
 * 산문이 아닌 자국 — 교재 지문으로 실을 수 없는 것.
 *
 * ── 실측 2026-08-21 ─────────────────────────────────────────────────
 * 어법 문항 표본을 눈으로 보다 발견했다. VOA Learning English 기사 끝에는 **용어풀이**가
 * 본문과 같은 문단으로 붙어 있다:
 *
 *     _____________________________________________________ stimulate – v.
 *     to make (something) more active implant – n.
 *
 * `generate-items.ts` 의 DCP 는 이런 보일러플레이트를 오래전부터 걸렀는데,
 * 나중에 만든 유형들(흐름무관·어휘·어법)이 그 필터를 안 물려받았다. 규칙이 한 파일에만
 * 있으면 다음에 만드는 사람이 또 빠뜨린다 — 그래서 인쇄 가능 판정을 여기 모은다.
 */
const NON_PROSE = /_{4,}|[–—-]\s*(?:v|n|adj|adv|prep|conj|pron)\.\s/i

/**
 * **기사 껍데기** — 본문이 아니라 웹 기사에 붙어 오는 것.
 *
 * ── 실측 2026-08-30 ─────────────────────────────────────────────────
 * 빈칸 드레인 청크(8편)를 직접 채우다 **3편이 문항이 안 되는 것**을 발견했다. 그래서
 * V5 대기열 전체를 재 봤다 — 창을 통과한 3,215편 중 `isPrintablePassage` 는 98.6%를
 * 통과시키는데, 실제로는 이런 것들이 그대로 들어와 있었다:
 *
 *   날짜 도장        160편 (5.0%)  "Aug 03, 2026"
 *   읽기시간 머리말   143편 (4.4%)  "5 Min Read"
 *   Q&A 표지        108편 (3.4%)  "Q What is lenacapavir … A Lenacapavir is …"
 *   크레딧            48편 (1.5%)  "Credits: NASA"
 *   캡션 나열         10편 (0.3%)  "Close Meeting a Crucial Need"
 *
 * 용어풀이(VOA)를 막은 것과 **같은 종류의 자국**이다 — 그때도 "표본을 눈으로 보다
 * 발견" 했고, 이번에도 그랬다. 규칙을 여기 모아 두는 이유가 그것이다.
 *
 * ⚠️ 본문에 정상적으로 나올 수 있는 표현은 넣지 않았다. 예컨대 `Q4`(분기)나
 *   문장 안의 `credit` 은 걸리지 않는다 — 대문자 라벨 꼴만 본다.
 */
const ARTICLE_CHROME = [
  /\b\d+\s*Min\s*Read\b/i,                                    // 읽기시간 머리말
  /\bCredits?:\s/i,                                            // 크레딧 라벨
  /\bImage credit\b|\bPhoto:\s/i,
  /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2},\s*\d{4}\b/, // 날짜 도장
  /(?:^|\s)Q\s+(?:What|How|Why|When|Who|Where)\b/,             // Q&A 표지
  /\b(?:Close|Read More|Share|Download|Print)\b\s+[A-Z]/,      // 캡션·버튼 나열
]

/** 기사 껍데기 자국이 있는가. */
export function hasArticleChrome(text: string): boolean {
  return ARTICLE_CHROME.some((re) => re.test(text))
}

/** 용어풀이·구분선 같은 비산문 자국이 있는가. */
export function hasNonProse(text: string): boolean {
  return NON_PROSE.test(text) || hasArticleChrome(text)
}

/** 교재 지문으로 인쇄할 수 있는가 — 인용 잔해도 비산문 자국도 없어야 한다. */
export function isPrintablePassage(text: string): boolean {
  return !hasCitationResidue(text) && !hasNonProse(text)
}

/**
 * 문단에서 **규격에 맞는 연속 구간**을 잘라 낸다.
 *
 * ── 왜 필요한가 (2026-08-21 실측) ───────────────────────────────────
 * 문단을 통째로 지문으로 썼더니 **1,936문항이 규격 밖**이었다 —
 * 어법 78.6% · 어휘 58.2% · 순서 41.4% · 삽입 39.5%. 수능 지문은 90~200어인데
 * 우리 문단은 그보다 길다. 조판 단계에서 걸러지긴 하지만, 그러면 **재고 숫자가
 * 계속 거짓말을 한다** — 어법은 580개가 아니라 124개였다.
 *
 * 문단 전체를 버리는 대신 **연속한 문장 몇 개**를 잘라 쓴다. 잘라도 글은 이어진다.
 *
 * 창은 **가장 이른 자리부터** 찾는다 — 결정론이어야 같은 문단이 늘 같은 지문을 준다.
 * 문장 수 하한을 두는 이유는 유형마다 밑줄·자리 수가 정해져 있기 때문이다.
 *
 * @returns 맞는 구간이 없으면 null.
 */
export function selectPassageWindow(
  sentences: ReadonlyArray<string>,
  spec: { min: number; max: number },
  minSentences: number,
): string[] | null {
  const counts = sentences.map((s) => s.split(/\s+/).filter(Boolean).length)
  let best: { start: number; end: number; words: number } | null = null
  for (let start = 0; start < sentences.length; start++) {
    let words = 0
    for (let end = start; end < sentences.length; end++) {
      words += counts[end]!
      if (words > spec.max) break
      const n = end - start + 1
      if (n < minSentences || words < spec.min) continue
      // 가장 이른 시작 · 그중 가장 긴 구간(문장이 많을수록 밑줄을 퍼뜨릴 자리가 많다).
      if (!best || n > best.end - best.start + 1) best = { start, end, words }
    }
    if (best) break // 가장 이른 시작에서 찾았으면 거기서 끝낸다 — 멱등해야 한다.
  }
  return best ? sentences.slice(best.start, best.end + 1) : null
}

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

/**
 * 삽입 문항 지문의 문장 수 범위.
 *
 * ── 2026-08-21 확장 ─────────────────────────────────────────────────
 * 처음엔 **정확히 5문장**만 받았다. 자리가 문장마다 하나씩 생겨 5곳이 되기 때문이다.
 * 그런데 **실제 수능 지문은 6~8문장이고 자리는 그중 5곳**이다 — 문장마다 번호가
 * 붙지 않는다.
 *
 * 5문장 고정이 얼마나 비쌌는지 재 봤다. `isEligible` 이 7문장 이상 문단을 통째로
 * 버리고 있었는데, 그중 길이 규격(90~200어)에 드는 것만 세도:
 *
 *   V4  새 삽입 원글 15 → **+7단원** (지금은 0단원)
 *   V5  새 삽입 원글 29 → **+14단원**
 *   V6  새 삽입 원글 19 → **+9단원**
 *
 * 19단원 → **42단원**. 1권 미달이 2권으로 바뀐다.
 */
export const CSAT_INSERT_BODY = { min: 5, max: 9 } as const

/** 수능 답지 자리 수 — ①~⑤. 지문이 길어도 자리는 다섯이다. */
export const CSAT_INSERT_SLOTS = 5

/** @deprecated `CSAT_INSERT_BODY.min` 을 쓸 것. 남겨 둔 이유는 회귀가 참조하기 때문. */
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
  // 인용 잔해가 있으면 교재에 실을 수 없다 — 변환 자체를 막는다.
  if (hasCitationResidue(presented.join(' '))) return null

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
  const n = remaining.length
  if (n < CSAT_INSERT_BODY.min || n > CSAT_INSERT_BODY.max) return null
  if (hasCitationResidue(remaining.join(' ') + ' ' + insertSentence)) return null
  // position 은 원문에서 뺀 문장의 자리다(1..n). "remaining[position-1] 뒤" 를 뜻한다.
  if (position < 1 || position > n) return null
  const slots = pickSlots(n, position)
  return {
    kind: 'insert',
    sentence: insertSentence,
    body: [...remaining],
    slots,
    answer: slots.indexOf(position) + 1,
  }
}

/**
 * 자리 5곳을 고른다 — **정답을 반드시 포함**하고 나머지는 지문에 고르게 퍼뜨린다.
 *
 * 정답만 외따로 떨어져 있으면 위치만 보고 찍을 수 있으므로, 후보를 균등 간격으로
 * 잡은 뒤 정답을 끼워 넣는다. 결정론이라 같은 지문은 늘 같은 자리를 얻는다.
 */
export function pickSlots(bodySentences: number, answer: number): number[] {
  const picked = new Set<number>([answer])
  for (let k = 0; k < CSAT_INSERT_SLOTS && picked.size < CSAT_INSERT_SLOTS; k++) {
    picked.add(1 + Math.round((k * (bodySentences - 1)) / (CSAT_INSERT_SLOTS - 1)))
  }
  for (let i = 1; i <= bodySentences && picked.size < CSAT_INSERT_SLOTS; i++) picked.add(i)
  return [...picked].sort((a, b) => a - b)
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
