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
 * 덩어리가 여는 **되받이 표지** — 앞에 무엇이 와야 하는지를 **지문만으로** 말해 준다.
 *
 * ── 왜 생겼나 (3인 검수 1·2회차 실측 2026-09-13) ────────────────────
 * 오답 배제가 예외 없이 `— 원문의 이음매와 다르다` 로 끝났다. 그 진술은 **참이지만**
 * (원문이 정답 키다) 학습자는 원문을 못 본다 — 검수자 셋이 독립적으로 「순환 논증」이라
 * 적었고, 순서 유형이 **전량** 그 지적을 받았다.
 *
 * 참인데 쓸모없는 근거를 **검증 가능한 근거**로 바꾼다: `These maps` 로 여는 덩어리는
 * `maps` 를 처음 내놓는 덩어리 뒤에 와야 하고, 그것은 지문을 보면 확인된다.
 *
 * ⚠️ **지시사·정관사만 본다.** 연결어(`However`·`Therefore`)는 앞에 무엇이 오는지를
 *   낱말로 가리키지 않아 지문만으로 검증할 수 없다 — 그걸 근거로 쓰면 또 추론이 된다.
 *   대명사(`He`·`They`)도 받는 이름을 특정할 수 없으면 쓰지 않는다.
 */
interface Anaphor {
  /** 해설에 그대로 인용할 표지(`These maps` · `The blaze`). */
  marker: string
  /** 되받는 낱말. 다른 덩어리에 있으면 순서가 확정된다. 대명사면 `null`(이름으로 찾는다). */
  noun: string | null
}

export function opensWithAnaphor(sentence: string): Anaphor | null {
  const s = String(sentence ?? '').replace(/\s+/g, ' ').trim()
  const m = s.match(/^(This|That|These|Those|The)\s+([A-Za-z][A-Za-z'-]{2,})/)
  if (m) return { marker: `${m[1]} ${m[2]}`, noun: m[2]! }
  // 대명사로 여는 덩어리 — 받는 **이름**을 다른 덩어리에서 찾을 수 있으면 근거가 된다.
  //   실측 2026-09-13: 지시사·정관사만 보던 동안 근거가 붙은 순서 문항이 **5.2%** 뿐이었다.
  //   표본을 보니 `He's trying to…` 로 여는 덩어리가 흔했고, 받는 이름(`Matt`)이
  //   다른 덩어리에 **그대로 인쇄돼 있었다** — 지문만 보고 확인되는 근거를 버리고 있었다.
  const pro = s.match(/^(He|She|They|His|Her|Their)\b/)
  if (pro) return { marker: pro[1]!, noun: null }
  return null
}

/**
 * 그 글이 내놓는 **이름**들 — 문장 첫머리가 아닌 대문자 낱말.
 *
 * ⚠️ 문장 첫 낱말은 빼야 한다(대문자인 것이 이름이라서가 아니라 문장이 시작해서다).
 *   흔한 기능어도 뺀다 — `The`·`But` 이 문장 중간에 오는 일이 있다.
 */
export function properNamesIn(text: string): string[] {
  const out = new Set<string>()
  for (const sentence of String(text ?? '').split(/(?<=[.!?])\s+/)) {
    const tokens = sentence.trim().split(/\s+/)
    for (let i = 1; i < tokens.length; i += 1) {
      const t = tokens[i]!.replace(/[^A-Za-z'-]/g, '')
      if (t.length < 3 || !/^[A-Z][a-z'-]+$/.test(t)) continue
      if (NOT_A_NAME.has(t.toLowerCase())) continue
      out.add(t)
    }
  }
  return [...out]
}

/** 대문자로 시작해도 이름이 아닌 것 — 요일·달·흔한 문두어. */
const NOT_A_NAME = new Set([
  'the', 'but', 'and', 'for', 'yet', 'however', 'therefore', 'meanwhile', 'instead',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'january', 'february', 'march', 'april', 'june', 'july', 'august',
  'september', 'october', 'november', 'december', 'english',
])

/** 그 글이 이 낱말을 내놓았는가 — 단수·복수를 함께 본다(`maps` 는 `map` 도 받는다). */
export function mentionsNoun(text: string, noun: string): boolean {
  const w = String(noun ?? '').toLowerCase().replace(/[^a-z'-]/g, '')
  if (w.length < 3) return false
  const forms = new Set([w])
  if (w.endsWith('ies')) forms.add(`${w.slice(0, -3)}y`)
  if (w.endsWith('es')) forms.add(w.slice(0, -2))
  if (w.endsWith('s')) forms.add(w.slice(0, -1))
  else forms.add(`${w}s`)
  const body = String(text ?? '').toLowerCase()
  for (const f of forms) {
    const esc = f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (new RegExp(`(^|[^a-z])${esc}([^a-z]|$)`).test(body)) return true
  }
  return false
}

/** 「(X)는 (Y) 뒤에 와야 한다」 — 지문에서 읽어 낸 순서 제약. */
interface OrderConstraint {
  label: 'A' | 'B' | 'C'
  marker: string
  /** 그 낱말을 처음 내놓는 자리. `null` 이면 도입문이다. */
  after: 'A' | 'B' | 'C' | null
  /** 대명사가 이름을 받는 경우인가 — 해설 문구가 달라진다. */
  byName: boolean
}

/**
 * 되받이 표지로 순서 제약을 읽어 낸다.
 *
 * ⚠️ **내놓는 자리가 하나일 때만 쓴다.** 여러 덩어리가 같은 낱말을 쓰면 어느 쪽을
 *   받는지 알 수 없고, 그때 하나를 고르면 그것이 추론이다. 모르면 **안 쓴다**.
 */
export function readOrderConstraints(item: CsatOrderItem): OrderConstraint[] {
  const out: OrderConstraint[] = []
  for (const b of item.blocks) {
    const first = b.sentences[0]
    if (!first) continue
    const a = opensWithAnaphor(first)
    if (!a) continue
    const own = b.sentences.join(' ')
    const sources: ('A' | 'B' | 'C' | null)[] = []
    if (a.noun) {
      // 자기 덩어리 안에서 이미 내놓았으면 앞을 볼 필요가 없다.
      if (mentionsNoun(b.sentences.slice(1).join(' '), a.noun)) continue
      if (mentionsNoun(item.intro, a.noun)) sources.push(null)
      for (const other of item.blocks) {
        if (other.label === b.label) continue
        if (mentionsNoun(other.sentences.join(' '), a.noun)) sources.push(other.label)
      }
    } else {
      // 대명사 — **이름이 자기 안에 있으면** 앞을 볼 필요가 없다(그 덩어리가 내놓는다).
      if (properNamesIn(own).length) continue
      if (properNamesIn(item.intro).length) sources.push(null)
      for (const other of item.blocks) {
        if (other.label === b.label) continue
        if (properNamesIn(other.sentences.join(' ')).length) sources.push(other.label)
      }
    }
    if (sources.length !== 1) continue
    out.push({ label: b.label, marker: a.marker, after: sources[0]!, byName: a.noun === null })
  }
  return out
}

/** 그 답지가 제약을 어기는가 — 어기면 어긴 제약을 돌려준다. */
function violated(choice: ReadonlyArray<'A' | 'B' | 'C'>, cs: OrderConstraint[]): OrderConstraint | null {
  for (const c of cs) {
    if (c.after === null) continue // 도입문은 늘 맨 앞이라 어길 수 없다
    const at = choice.indexOf(c.label)
    const src = choice.indexOf(c.after)
    if (at < 0 || src < 0) continue
    if (at < src) return c
  }
  return null
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

  // ── 정답 쪽 근거 — **지문에서 읽어 낸 것** ────────────────────────
  // 되받이 표지가 있으면 그것이 왜 그 순서인지를 지문만으로 말해 준다.
  //
  // ⚠️ **정답이 어기는 제약은 버린다.** 원문 순서가 정답 키이므로, 우리가 읽어 낸 제약이
  //   정답과 어긋나면 **틀린 것은 원문이 아니라 우리 읽기다**(같은 낱말이 우연히 겹쳤거나,
  //   `The …` 가 되받이가 아니라 총칭이었거나). 그대로 두면 해설이 정답을 반박한다.
  const constraints = readOrderConstraints(item).filter((c) => !violated(answer, [c]))
  for (const c of constraints) {
    if (c.after === null) continue
    optional.unshift(
      c.byName
        ? `(${c.label})는 "${c.marker}" 로 시작하므로 그 사람의 이름을 내놓는 (${c.after}) 뒤에 온다.`
        : `(${c.label})는 "${c.marker}" 로 시작하므로 그 말을 처음 내놓는 (${c.after}) 뒤에 온다.`,
    )
  }

  // ── 오답 배제 ─────────────────────────────────────────────────────
  //
  // ⚠️ **`원문의 이음매와 다르다` 를 쓰지 않는다** (3인 검수 1·2회차). 그 진술은 참이지만
  //   (원문이 정답 키다) 학습자는 원문을 못 본다 — 순서 유형이 **전량** 「순환 논증」으로
  //   지적받았다. 근거로 쓸 수 있는 것은 **지문 안에 있는 것**뿐이다.
  //
  // 그래서 두 갈래로 적는다:
  //   · 되받이 제약을 **어기는** 답지 → 어긴 이유를 낱말로 짚는다(검증 가능하다)
  //   · 제약을 못 읽은 답지 → 그 답지가 만드는 이음매만 **사실로** 보인다.
  //     이유를 못 대면 **안 대는 것**이 지어내는 것보다 낫다.
  const reasoned: string[] = []
  const bare: string[] = []
  for (const [idx, choice] of item.choices.entries()) {
    if (idx === item.answer - 1) continue
    const bad = violated(choice, constraints)
    if (bad && bad.after) {
      reasoned.push(
        `${CIRCLED[idx]} 는 (${bad.label})를 (${bad.after})보다 앞에 두는데, ` +
          `(${bad.label})는 "${bad.marker}" 로 열려 ${bad.byName ? '가리킬 사람이' : '가리킬 것이'} 아직 없다`,
      )
      continue
    }
    const at = choice.findIndex((l, i) => l !== answer[i])
    if (at < 0) continue
    const leftLabel = at === 0 ? null : choice[at - 1]!
    const left = leftLabel ? byLabel.get(leftLabel) : null
    const right = byLabel.get(choice[at]!)
    if (!right?.length) continue
    const leftText = left?.length ? `(${leftLabel})의 끝` : '도입문'
    bare.push(`${CIRCLED[idx]} 는 ${leftText} 다음에 (${choice[at]})의 "${head(right[0]!, 35)}" 를 붙인다`)
  }
  // **근거 있는 것을 먼저** 넣고, **예산 안에서 들어갈 만큼** 담는다.
  //
  // ⚠️ 앞판은 `slice(0, 2)` 로 둘만 넣었고 검수가 「넷 중 둘만 다룬다」고 지적했다.
  //   그렇다고 전부 이어 붙이면 안 된다 — `assemble` 은 `closing` **전체**를 예산으로
  //   미리 떼어 두므로, 길어지면 **해설이 통째로 null 이 된다**(있던 해설이 사라진다).
  //   그래서 여기서 담을 만큼만 정한다: 근거 있는 것부터, 규격(473자) 안에서.
  const lead = [...must].join(' ').replace(/\s+/g, ' ').trim()
  const picked: string[] = []
  for (const w of [...reasoned, ...bare]) {
    const candidate = `반면 ${[...picked, w].join('; ')}.`
    if (lead.length + 1 + candidate.length > EXPLANATION_CHARS.max) break
    picked.push(w)
  }
  const closing = picked.length ? [`반면 ${picked.join('; ')}.`] : []
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
