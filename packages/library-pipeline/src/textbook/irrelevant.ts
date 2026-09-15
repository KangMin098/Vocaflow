// packages/library-pipeline/src/textbook/irrelevant.ts
//
// **흐름 무관 문장 고르기 (수능 35번).** 결정론이고 LLM 을 쓰지 않는다.
//
// ── 수능 실제 형식 ───────────────────────────────────────────────────
// 도입문(주제문)이 주어지고 그 뒤 다섯 문장에 ①~⑤ 가 붙는다. 그중 하나는 글의 흐름과
// 무관하다. 답은 그 하나.
//
// ── 왜 결정론으로 되는가 ─────────────────────────────────────────────
// **다른 글의 문장을 끼워 넣으면 그것이 곧 정답이다.** 원문이 정답 키인 DCP 와 같은 구조다.
// 만들 때 어느 문장이 남의 것인지 우리가 알고 있으므로 채점이 확정된다.
//
// ── 이 방식의 한계 (숨기지 않는다) ───────────────────────────────────
// 실제 수능의 무관 문장은 **주제는 같은데 논지가 어긋난** 문장이라, 남의 글에서 통째로
// 가져온 문장보다 훨씬 까다롭다. 우리 방식은 그보다 쉽다. 그래서 두 가지를 건다:
//
//   ① **겉모습으로 못 고르게 한다** — 무관 문장의 낱말 수를 본문 문장들의 범위 안으로 맞춘다.
//      혼자 짧거나 길면 읽지 않고도 찍힌다.
//   ② **가장 그럴듯한 것을 고른다** — 후보 중 본문과 어휘가 가장 많이 겹치는 것을 쓴다.
//      단, **본문 어느 문장보다도 덜 겹쳐야 한다**(`overlapGap`). 안 그러면 진짜 본문 문장이
//      더 동떨어져 보여 답이 둘이 된다.
//
// 그리고 본문 문장 중 하나라도 아예 안 겹치면(`minNative === 0`) **문항을 만들지 않는다** —
// 그 문단은 원래 결속이 약해서 무엇을 넣어도 답이 갈린다.

import { CSAT_ITEM_WORDS } from './compose-unit'
import { isPrintablePassage } from './csat-format'
import { contentWords, FLAT_RARITY, topicalBar, type Rarity } from './explain'

/** ①~⑤ — 수능과 같은 다섯 자리. */
export const IRRELEVANT_SLOTS = 5

/**
 * 무관 문장이 본문과 **최소한 이만큼은 붙어 있어야 한다.**
 *
 * ── 왜 0 이면 안 되는가 (2026-08-21 실측에서 드러남) ────────────────
 * 처음엔 "본문 어느 문장보다 덜 붙어 있을 것" 만 걸었다. 그런데 본문 최소 결속도의
 * **중앙값이 1** 이라, 통과하는 후보는 사실상 **결속도 0**, 즉 한 낱말도 안 겹치는
 * 문장뿐이었다. 실제로 뽑힌 것이 이랬다:
 *
 *     주제: 덴마크에서 스톤헨지 형태의 목재 원형 유구 발견
 *     ⑤ During 2007, Russell Lissack formed his side project group Pin Me Down …
 *
 * 읽지 않고도 고른다. `overlapGap` 은 1 이라 "어려운 문항" 이라고 말하고 있었지만
 * 그 숫자가 재던 것은 난이도가 아니었다 — **Cycle 2 의 해설 커버리지와 같은 함정**이다.
 *
 * 실제 수능의 무관 문장은 **주제는 같은데 논지가 어긋난** 문장이다. 그러려면 낱말이
 * 조금은 겹쳐야 한다. 그래서 하한을 1 로 둔다.
 *
 * ⚠️ 여기서 `MIN_NATIVE_COHESION = 2` 가 **따라 나온다** — 짐작이 아니라 산술이다.
 *   무관 문장이 1 이상이고 본문 어느 문장보다도 작아야 하므로 본문 최소는 2 이상이어야 한다.
 */
export const MIN_FOREIGN_COHESION = 1

/** 위 식에서 따라 나오는 값. 이 미만인 문단은 무엇을 넣어도 답이 갈린다. */
export const MIN_NATIVE_COHESION = MIN_FOREIGN_COHESION + 1

/** 도입문 1 + 본문 4 = 원문에서 다섯 문장이 필요하다(다섯째 자리는 남의 문장이 채운다). */
export const IRRELEVANT_SOURCE_SENTENCES = IRRELEVANT_SLOTS

/** 다른 글에서 가져온 문장 후보. */
export interface ForeignSentence {
  text: string
  /** 어느 글에서 왔는지 — 검수와 각주에 쓴다. 같은 글이 섞이지 않게 막는 열쇠이기도 하다. */
  ref: string
}

export interface IrrelevantItem {
  kind: 'irrelevant'
  intro: string
  /** ①~⑤ 다섯 문장. 그중 하나가 남의 글에서 왔다. */
  sentences: string[]
  /** 정답 번호 1~5. */
  answer: number
  foreign: ForeignSentence
  /**
   * 본문 최소 결속도 − 무관 문장 결속도.
   *
   * **클수록 쉬운 문항이다.** 검수자가 난이도를 볼 수 있게 같이 내보낸다.
   */
  overlapGap: number
}

// 희소도 판정은 `explain.ts` 에 있다 — `contentWords` 와 같은 자리에 둬야 눈금이 어긋나지
// 않는다. 해설(`explain`)도 어휘 사슬에 같은 문턱을 쓰므로 정의가 둘이면 반드시 갈린다.
export type { Rarity }
export { topicalBar }

/**
 * 한 문장이 나머지 글과 얼마나 붙어 있는가 — **주제를 지시하는 낱말**의 공유 개수.
 *
 * ── 왜 그냥 내용어를 세면 안 되는가 (2026-08-21 실측) ───────────────
 * 처음엔 내용어 공유 개수를 셌다. 그랬더니 이런 문항이 통과했다:
 *
 *     주제: 덴마크에서 스톤헨지 형태의 목재 원형 유구 발견
 *     ⑤ During 2007, Russell Lissack formed his side project group Pin Me Down …
 *
 * 이 문장은 `group` 과 `formed` 를 본문과 공유해 결속도 2 를 받았다. 두 낱말 다
 * **아무 글에나 나오는 낱말**이다. 어휘 겹침은 주제 근접성을 재지 못한다.
 *
 * 그래서 문턱(`bar`) 이상으로 희귀한 낱말만 센다. 문턱은 **그 문단 자신의 중앙 희소도**라
 * 바깥에서 가져온 숫자가 아니다 — 글마다 스스로 눈금을 정한다.
 */
export function cohesionWith(
  sentence: string,
  rest: string,
  rarity: Rarity = FLAT_RARITY,
  bar = 0,
): number {
  const restWords = contentWords(rest)
  let n = 0
  for (const w of contentWords(sentence)) if (restWords.has(w) && rarity(w) >= bar) n++
  return n
}

function words(s: string): number {
  return s.split(/\s+/).filter(Boolean).length
}

/**
 * 흐름 무관 문항을 만든다. 조건을 못 맞추면 **null** — 억지로 만들지 않는다.
 *
 * **문단 안에서 연속 다섯 문장 창을 앞에서부터 옮겨 가며 시도한다.**
 * 앞 다섯 문장으로 되면 그것을 쓰므로 이미 만들어 둔 문항은 바뀌지 않는다.
 *
 * ── 왜 창을 옮기는가 (실측 2026-09-06 · V2) ─────────────────────────
 * 앞 다섯 문장만 보던 때 V2 재고가 **문단 693개에 문항 4개**였다. 게이트별로 세 보니
 * 탈락의 73%(508문단)가 한 자리였다 — **본문 결속 약함**(`minNative < 2`). 후보가
 * 없어서가 아니었다("맞는 후보 없음" 0). 초등 밴드의 글은 짧고 낱말이 흔해서
 * 앞 다섯 문장이 주제어를 공유하지 못하는 일이 잦은데, **같은 문단 뒤쪽 다섯 문장은
 * 공유하는 경우가 있다.** 창을 옮기니 만들 수 있는 문단이 4 → **17** 이 됐다.
 *
 * 게이트를 낮춰서 늘린 것이 아니다 — 게이트는 그대로 두고 **보는 자리를 넓혔다.**
 *
 * @param paragraph 원문 문단의 문장들. 그 안의 연속 다섯 문장을 쓴다.
 * @param candidates 다른 글의 문장 후보. `ref` 가 같은 글이면 자동으로 걸러진다.
 * @param selfRef 이 문단이 속한 글 — 후보에서 자기 글을 빼기 위해 받는다.
 */
export function buildIrrelevant(
  paragraph: ReadonlyArray<string>,
  candidates: ReadonlyArray<ForeignSentence>,
  selfRef: string,
  rarity: Rarity = FLAT_RARITY,
): IrrelevantItem | null {
  if (paragraph.length < IRRELEVANT_SOURCE_SENTENCES) return null
  for (let start = 0; start + IRRELEVANT_SOURCE_SENTENCES <= paragraph.length; start++) {
    const item = buildFromWindow(
      paragraph.slice(start, start + IRRELEVANT_SOURCE_SENTENCES),
      candidates,
      selfRef,
      rarity,
    )
    if (item) return item
  }
  return null
}

/** 정확히 다섯 문장으로 한 문항을 만든다. `buildIrrelevant` 가 창마다 부른다. */
function buildFromWindow(
  used: ReadonlyArray<string>,
  candidates: ReadonlyArray<ForeignSentence>,
  selfRef: string,
  rarity: Rarity,
): IrrelevantItem | null {
  if (!isPrintablePassage(used.join(' '))) return null

  const intro = used[0]!
  const natives = used.slice(1) // 4개
  // 이 글이 스스로 정하는 눈금 — 흔한 낱말의 겹침은 세지 않는다.
  const bar = topicalBar(used.join(' '), rarity)

  // 본문 문장 각각이 "나머지" 와 얼마나 붙어 있는가. 가장 약한 것이 기준선이다.
  const nativeCohesion = natives.map((s, i) =>
    cohesionWith(s, [intro, ...natives.filter((_, j) => j !== i)].join(' '), rarity, bar),
  )
  const minNative = Math.min(...nativeCohesion)
  // 본문에 이미 동떨어진 문장이 있으면 답이 갈린다 — 만들지 않는다.
  // 하한이 2 인 이유는 `MIN_FOREIGN_COHESION` 주석 참조(산술로 따라 나온다).
  if (minNative < MIN_NATIVE_COHESION) return null

  const shape = { min: Math.min(...natives.map(words)), max: Math.max(...natives.map(words)) }
  const context = used.join(' ')

  // 겉모습이 맞고, 본문 어느 문장보다 덜 붙어 있는 후보만.
  const eligible = candidates
    .filter((c) => c.ref !== selfRef)
    .filter((c) => isPrintablePassage(c.text))
    .filter((c) => words(c.text) >= shape.min && words(c.text) <= shape.max)
    .map((c) => ({ c, cohesion: cohesionWith(c.text, context, rarity, bar) }))
    // 본문 어느 문장보다 덜 붙어 있되, **아주 딴 얘기여서도 안 된다**.
    .filter((x) => x.cohesion < minNative && x.cohesion >= MIN_FOREIGN_COHESION)

  if (!eligible.length) return null
  // 가장 그럴듯한 것 = 겹침이 최대인 것. 동점이면 문자열 순으로 — 멱등해야 한다.
  eligible.sort((a, b) => b.cohesion - a.cohesion || (a.c.text < b.c.text ? -1 : 1))
  const chosen = eligible[0]!

  // 자리는 내용에서 결정론으로 — 같은 문단은 늘 같은 자리에 답이 온다.
  const at = hash(intro + chosen.c.text) % IRRELEVANT_SLOTS
  const sentences = [...natives]
  sentences.splice(at, 0, chosen.c.text)

  // ── 만든 다음 스스로 검사한다 ─────────────────────────────────────
  // 고르는 동안의 눈금(`bar`)은 본문 다섯 문장에서 나왔지만, **학습자가 보는 것은 무관
  // 문장까지 들어간 여섯 문장**이다. 그 문장이 희귀어를 들여오면 눈금이 움직이고, 움직인
  // 눈금에서는 정답이 유일 최소가 아닐 수 있다. 실측에서 48개 중 2개가 그랬다.
  // 그래서 **완성본 기준으로 다시 재고**, 답이 갈리면 만들지 않는다.
  const finalBar = topicalBar([intro, ...sentences].join(' '), rarity)
  const finalCohesion = sentences.map((s, i) =>
    cohesionWith(s, [intro, ...sentences.filter((_, j) => j !== i)].join(' '), rarity, finalBar),
  )
  const minimum = Math.min(...finalCohesion)
  if (finalCohesion[at] !== minimum) return null
  if (finalCohesion.filter((c) => c === minimum).length > 1) return null

  // 지문 규격도 **완성본 기준으로** 본다. 본문 다섯 문장이 규격 안이어도 무관 문장이
  // 들어가면 넘칠 수 있다 — 실측 45개 중 5개가 그랬다. 교재에 못 실을 것은 만들지 않는다.
  const passageWords = [intro, ...sentences].join(' ').split(/\s+/).filter(Boolean).length
  if (passageWords < CSAT_ITEM_WORDS.min || passageWords > CSAT_ITEM_WORDS.max) return null

  return {
    kind: 'irrelevant',
    intro,
    sentences,
    answer: at + 1,
    foreign: chosen.c,
    overlapGap: minNative - chosen.cohesion,
  }
}

/** 결정론 해시 — 같은 재료면 늘 같은 문항이 나와야 한다(멱등). */
function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
