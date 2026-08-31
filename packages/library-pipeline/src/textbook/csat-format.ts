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
 *
 * ── 날짜 규칙 정정 2026-08-30 ────────────────────────────────────────
 * 처음 쓴 날짜 규칙은 **우연히** 동작하고 있었다. 온전한 달 이름 중 세 글자인 것은
 * `May` 뿐이라(`Apr\b` 는 "April" 에 안 걸린다), 학술지 앞장을 잡아낸 것은 그 앞장에
 * **5월 날짜가 우연히 있었을 때뿐**이었다. 그래서 규칙이 두 방향으로 다 틀려 있었다:
 *
 *   넓게 틀림 — 산문 속 날짜를 껍데기로 셌다
 *                "the May 18, 1980, eruption of Mount St. Helens" · 인물 생몰년
 *   좁게 틀림 — 5월이 없는 학술지 앞장을 통째로 놓쳤다
 *                "Received: December 17, 2024; Accepted: November 18, 2025"
 *
 * 원글 24,738편으로 옛 규칙과 새 규칙을 대조했다(다른 규칙이 이미 잡는 것은 빼고 —
 * 그것들은 판정이 갈리지 않는다): **새로 잡는 것 14,603편**(표본 전부 PLOS 앞장) ·
 * **놓아 주는 것 37편**(표본 전부 정상 산문). 그래서 날짜 자체가 아니라 **앞장 라벨**을
 * 본다. 약어 꼴 날짜 도장은 그대로 두되 `May` 만 뺐다 — 약어인지 온전한 달 이름인지
 * 구별할 수 없고, 구별 못 하는 것을 근거로 지문을 버리면 안 된다.
 */
const ARTICLE_CHROME = [
  /\b\d+\s*Min\s*Read\b/i,                                    // 읽기시간 머리말
  /\bCredits?:\s/i,                                            // 크레딧 라벨
  /\bImage credit\b|\bPhoto:\s/i,
  /\b(?:Received|Accepted|Submitted|Revised|Published)\s*:\s*[A-Z][a-z]+\s+\d{1,2},\s*\d{4}\b/, // 학술지 앞장
  /\bCopyright:\s*©/,                                          // 학술지 저작권 라벨
  /\b(?:Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)\s+\d{1,2},\s*\d{4}\b/, // 약어 날짜 도장 (May 제외)
  /(?:^|\s)Q\s+(?:What|How|Why|When|Who|Where)\b/,             // Q&A 표지
  /\b(?:Close|Read More|Share|Download|Print)\b\s+[A-Z]/,      // 캡션·버튼 나열
]

/** 기사 껍데기 자국이 있는가. */
export function hasArticleChrome(text: string): boolean {
  return ARTICLE_CHROME.some((re) => re.test(text))
}

/** 용어풀이·구분선 같은 비산문 자국이 있는가. */
/**
 * 학술 논문의 **절 이름 줄**. 원문에서는 자기 줄에 홀로 서 있다.
 *
 *     Abstract
 *     The coexistence of diverse microbial communities…
 *
 * 문장으로 자른 뒤 공백으로 다시 이으면 이렇게 붙는다:
 *
 *     "Abstract The coexistence of diverse microbial communities…"
 *
 * 실측 2026-08-31 — 절 이름이 붙은 문항 **28,652개**(V6 20,050 · V7 5,700 · V5 2,881).
 * 학술 소스가 없는 1~4단은 0이다.
 */
const SECTION_LABELS = [
  'Abstract', 'Introduction', 'Background', 'Methods', 'Method',
  'Materials and Methods', 'Results', 'Discussion', 'Conclusions', 'Conclusion',
  'Objectives', 'Objective', 'Aims', 'Aim', 'Findings', 'Significance',
  'Summary', 'Highlights', 'Keywords',
]

// ⚠️ **버리지 않고 지운다.** 절 이름이 있다고 지문을 버리면 상위 밴드 재고가 통째로 날아간다
//   (같은 규칙으로 원글을 거르면 24,738편 중 18,225편이 걸린다 — 실측).
//
// ⚠️ **문장을 여는 자리에서만** 지운다. 앞이 글 머리이거나 문장 끝 부호여야 하고,
//   뒤는 대문자로 시작하는 낱말이어야 한다. 그래서 "the Introduction Section" 처럼
//   문장 안에 든 낱말은 건드리지 않고, "Results were mixed" 도 뒤가 소문자라 남는다.
const SECTION_LABEL_RE = new RegExp(
  `(^|[.!?]\\s+)(?:${SECTION_LABELS.join('|')})\\s+(?=[A-Z])`,
  'g',
)

/** 홀로 선 절 이름을 떼어 낸다. 지문 자체는 그대로 남는다. */
export function stripSectionLabels(text: string): string {
  const s = String(text ?? '')
  if (!s) return s
  // 연달아 붙은 경우가 있다 — "Abstract Background The importance…".
  let out = s
  for (let i = 0; i < 3; i += 1) {
    const next = out.replace(SECTION_LABEL_RE, '$1')
    if (next === out) break
    out = next
  }
  return out.trim()
}


/**
 * 원문 뒤에 **글머리가 통째로 다시 붙어 있는 것**을 떼어 낸다.
 *
 * 학술 소스 수집기가 초록을 본문 앞과 뒤에 두 번 담는다. 순환 없는 측정(2026-08-31):
 * 원글 3,000편 표본 중 **1,048편(34.9%)** 이 첫 200자를 본문 뒤에서 그대로 반복한다.
 * 그 구간에서 자른 지문은 학습자가 **같은 문단을 두 번 읽게** 된다 —
 * V7 조판 지문 54개 중 7개(13%)가 그랬다.
 *
 * ⚠️ **꼬리가 글머리의 반복일 때만** 자른다. 자를 자리 뒤의 글이 이 지문의 **접두사와
 *   글자 그대로 같아야** 한다(`text.startsWith(tail)`). 새 내용이 이어지면 손대지 않는다 —
 *   "비슷해 보인다" 로 자르면 멀쩡한 뒷문단이 사라지고, 그건 조판물에서 안 보인다.
 */
export function dropRepeatedTail(text: string): string {
  const s = String(text ?? '').trim()
  if (s.length < 300) return s
  // 첫 문장을 자른다 — 너무 짧으면 우연히 겹치고, 너무 길면 못 찾는다.
  const m = /^[\s\S]{40,400}?[.!?](?=\s|$)/.exec(s)
  if (!m) return s
  const head = m[0]
  const idx = s.indexOf(head, head.length)
  if (idx <= 0) return s
  const tail = s.slice(idx).trim()
  if (!tail || !s.startsWith(tail)) return s
  return s.slice(0, idx).trim()
}


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
