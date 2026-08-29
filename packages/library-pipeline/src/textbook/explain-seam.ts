// packages/library-pipeline/src/textbook/explain-seam.ts
//
// **이음매 해설 — 순서·삽입. 원문이 정답 키라서 결정론으로 참이다.**
//
// ── 왜 이게 필요한가 (실측 2026-08-30) ──────────────────────────────
// `explain.ts` 는 지문 표면의 단서(연결어·지시어·대명사·어휘 사슬)가 **정답 쪽에
// 유일하게 많을 때만** 해설을 쓴다. 그래서 실측 커버리지가 낮다:
//
//   order   1,532 중 저장 237 · 규칙이 쓸 수 있음 85  → 1,179 가 빈다
//   insert  1,748 중 저장 226 · 규칙이 쓸 수 있음 41  →   434 가 빈다 (교재용 701 기준)
//
// 그 문턱은 옳다 — 단서가 오답을 더 가리키는 경우가 34.4% 라서, 단서만으로 "왜" 를
// 쓰면 **틀린 해설**이 나온다.
//
// 그런데 이 두 유형에는 다른 종류의 확실한 사실이 있다: **원문 그 자체**다.
// 순서 문항의 정답은 원래 글의 순서이고, 삽입 문항의 정답은 원래 문장이 있던 자리다.
// 그러므로 다음은 **추론이 아니라 인용**이다:
//
//   · 정답이 만드는 이음매 — "(C)의 끝 X" 다음에 "(A)의 첫 Y" 가 온다
//   · 오답이 만드는 이음매 — ①을 고르면 X 자리에 Z 가 붙는다
//
// 오답 배제도 지어내지 않는다. **오답이 실제로 만드는 이음매를 보여 줄 뿐**이고,
// 그것이 원문과 다르다는 사실은 정의상 참이다. 학습자는 자기 답의 이음매를
// 정답의 이음매와 나란히 놓고 확인할 수 있다 — 그게 순서·삽입 오답 노트가 하는 일이다.
//
// ⚠️ 이 해설은 "왜 그렇게 이어지는가" 를 말하지 않는다. 그건 읽어야 안다.
//   그래서 `writer` 를 따로 달아 두고(`order_seam`·`insert_seam`), 나중에 배치 해설이
//   오면 그쪽이 이긴다(`explain-fill.mjs` 의 덮어쓰기 규칙).

import { type CsatInsertItem, type CsatOrderItem, hasCitationResidue } from './csat-format'
import { EXPLANATION_CHARS, type ItemExplanation } from './explain-items'

const CIRCLED = ['①', '②', '③', '④', '⑤'] as const

/** 문장 끝 조각 — 이음매의 왼쪽. 너무 길면 뒤에서 자른다. */
function tail(sentence: string, limit = 60): string {
  const s = sentence.replace(/\s+/g, ' ').trim()
  if (s.length <= limit) return s
  const cut = s.slice(s.length - limit)
  const sp = cut.indexOf(' ')
  return `…${sp > 0 ? cut.slice(sp + 1) : cut}`
}

/** 문장 앞 조각 — 이음매의 오른쪽. */
function head(sentence: string, limit = 60): string {
  const s = sentence.replace(/\s+/g, ' ').trim()
  if (s.length <= limit) return s
  const cut = s.slice(0, limit)
  const sp = cut.lastIndexOf(' ')
  return `${sp > 0 ? cut.slice(0, sp) : cut}…`
}

/**
 * 길이 예산 안에서 조립한다 — **꼭 들어갈 것 먼저.**
 *
 * 그냥 이어 붙이고 끝에서 자르면 마지막에 오는 오답 배제가 통째로 날아간다.
 * 실제로 그랬다(회귀가 잡았다). 중간 이음매는 있으면 좋고 없어도 되는 것이라
 * 예산이 남을 때만 넣는다.
 */
function assemble(
  lead: string[],
  optional: string[],
  closing: string[],
  writer: string,
): ItemExplanation | null {
  const join = (xs: string[]) => xs.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
  // 오답 배제(closing)는 맨 끝에 오지만 **자리를 먼저 떼어 둔다** — 그러지 않으면
  // 중간 이음매가 예산을 다 쓰고 오답 배제가 잘려 나간다(회귀가 잡았다).
  const reserved = join(closing).length
  let body = join(lead)
  if (body.length + reserved > EXPLANATION_CHARS.max) return null
  for (const opt of optional) {
    const next = join([body, opt])
    if (next.length + reserved > EXPLANATION_CHARS.max) break
    body = next
  }
  const text = join([body, ...closing])
  if (text.length < EXPLANATION_CHARS.min) return null
  return {
    ko: text,
    hasWrongOption: /[①②③④⑤]/.test(text),
    hasCitation: /[A-Za-z]{4,}[^가-힣]{0,3}[A-Za-z]{4,}/.test(text),
    writer,
  }
}

/**
 * 순서 문항 — 정답이 만드는 이음매를 인용하고, 오답이 만드는 첫 어긋난 이음매를 보인다.
 *
 * 오답은 **첫 번째로 갈라지는 자리**만 짚는다. 다섯 답지의 이음매를 다 적으면
 * 시장 규격(p90 473자)을 넘고, 학습자가 볼 곳도 흐려진다.
 */
export function explainOrderSeam(item: CsatOrderItem): ItemExplanation | null {
  const answer = item.choices[item.answer - 1]
  if (!answer || answer.length < 2) return null
  const byLabel = new Map(item.blocks.map((b) => [b.label, b.sentences]))
  const first = byLabel.get(answer[0]!)
  if (!first?.length) return null

  const must: string[] = []
  must.push(`정답은 ${CIRCLED[item.answer - 1]} ${answer.map((l) => `(${l})`).join('-')} 다.`)
  must.push(`도입문이 "${tail(item.intro, 45)}" 로 끝나고 (${answer[0]})의 첫 문장 "${head(first[0]!, 45)}" 이 그 뒤를 잇는다.`)

  // 정답이 만드는 나머지 이음매 — 예산이 남을 때만 넣는다.
  const optional: string[] = []
  for (let i = 0; i < answer.length - 1; i += 1) {
    const left = byLabel.get(answer[i]!)
    const right = byLabel.get(answer[i + 1]!)
    if (!left?.length || !right?.length) continue
    optional.push(`(${answer[i]})의 끝 "${tail(left[left.length - 1]!, 40)}" → (${answer[i + 1]})의 첫 "${head(right[0]!, 40)}".`)
  }

  // 오답 — 첫 갈림만. 실제로 그 답지가 만드는 이음매를 보여 준다(참인 진술이다).
  const wrong: string[] = []
  for (const [idx, choice] of item.choices.entries()) {
    if (idx === item.answer - 1) continue
    const at = choice.findIndex((l, i) => l !== answer[i])
    if (at < 0) continue
    const leftLabel = at === 0 ? null : choice[at - 1]!
    const left = leftLabel ? byLabel.get(leftLabel) : null
    const right = byLabel.get(choice[at]!)
    if (!right?.length) continue
    const leftText = left?.length ? `(${leftLabel})의 끝` : '도입문'
    wrong.push(`${CIRCLED[idx]} 는 ${leftText} 다음에 (${choice[at]})의 "${head(right[0]!, 35)}" 를 붙인다`)
  }
  // 오답 배제는 맨 끝에 오되 자리는 먼저 확보한다.
  const closing = wrong.length
    ? [`반면 ${wrong.slice(0, 2).join('; ')} — 원문의 이음매와 다르다.`]
    : []
  return assemble(must, optional, closing, 'order_seam')
}

/**
 * 삽입 문항 — 문장이 실제로 있던 자리를 앞뒤 문장으로 보이고,
 * 오답 자리가 무엇을 갈라놓는지 보인다.
 */
export function explainInsertSeam(item: CsatInsertItem): ItemExplanation | null {
  const answerSlot = item.slots[item.answer - 1]
  if (!answerSlot) return null
  const before = item.body[answerSlot - 1]
  const after = item.body[answerSlot]
  if (!before) return null

  const must: string[] = []
  must.push(`정답은 ${CIRCLED[item.answer - 1]} 다 — 주어진 문장은 원래 "${tail(before, 45)}" 뒤에 있었다.`)
  const optional: string[] = []
  if (after) {
    optional.push(`거기 넣으면 "${tail(before, 30)}" → "${head(item.sentence, 45)}" → "${head(after, 30)}" 로 이어진다.`)
  } else {
    optional.push(`글의 마지막 자리이므로 "${head(item.sentence, 45)}" 가 끝을 맺는다.`)
  }

  // 오답 자리 둘만 — 그 자리가 원래 붙어 있던 두 문장을 갈라놓는다는 사실을 보인다.
  const wrong: string[] = []
  for (const [idx, slot] of item.slots.entries()) {
    if (idx === item.answer - 1) continue
    const b = item.body[slot - 1]
    const a = item.body[slot]
    if (!b || !a) continue
    wrong.push(`${CIRCLED[idx]} 는 "${tail(b, 28)}" 와 "${head(a, 28)}" 사이를 가른다`)
  }
  // 오답 배제는 맨 끝에 오되 자리는 먼저 확보한다 — 위 order 와 같은 이유.
  const closing = wrong.length
    ? [`${wrong.slice(0, 2).join('; ')} — 원문에서 이 둘은 붙어 있다.`]
    : []
  return assemble(must, optional, closing, 'insert_seam')
}

/**
 * **짧은 삽입 문항** — 자리가 5곳이 안 되는 것.
 *
 * `toCsatInsert` 는 자리 5곳을 요구해 null 을 준다. 그건 **인쇄 규격**이다.
 * 그런데 실측 1,748건 중 **1,047건이 3~4문장**이고, 이건 실수가 아니라 설계다 —
 * 생성기 주석이 "교재에는 못 써도 학습 화면의 구문 연습에는 유효한 재고" 라고 적어 두었다.
 * 그 화면(`DcpPlayer`)은 자리 수에 상관없이 정답 위치를 보여 주는데 **해설은 없었다.**
 *
 * 그래서 인쇄 규격을 우회하되 **나머지 안전장치는 그대로 건다** —
 * 인용 잔해가 있거나 자리가 범위를 벗어나면 쓰지 않는다.
 */
export function explainShortInsertSeam(
  remaining: ReadonlyArray<string>,
  insertSentence: string,
  position: number,
): ItemExplanation | null {
  const n = remaining.length
  if (n < 2) return null
  if (!Number.isInteger(position) || position < 1 || position > n) return null
  if (hasCitationResidue(`${remaining.join(' ')} ${insertSentence}`)) return null
  return explainInsertSeam({
    kind: 'insert',
    sentence: insertSentence,
    body: [...remaining],
    // 자리는 문장 수만큼 — 화면에서 실제로 고를 수 있는 자리와 같다.
    slots: Array.from({ length: n }, (_, i) => i + 1),
    answer: position,
  })
}
