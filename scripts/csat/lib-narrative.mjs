// scripts/csat/lib-narrative.mjs
//
// **인물이 나오는 글인가** — 서사를 겨냥해 수확할 때 쓰는 잣대.
//
// ── 왜 필요한가 (실측 2026-09-06) ───────────────────────────────────
// V7 권에서 `mood`(심경)·`long_reference`(장문 지칭) 두 유형이 계속 0 이었다. 문항을
// 못 만든 것이 아니라 **그 문항이 설 지문이 재고에 없었다.** 상위 밴드(V5+) 재고
// 17,900편에서 인물 대명사가 하나라도 있는 글을 세 보니:
//
//   plos      13,514편 중 **37편** (0.3%)
//   futurity   2,653편 중    75편
//   elife        287편 중  **0편**
//   original      79편 중    51편   ← 창작 지문
//
// 상위 밴드가 논문과 보도자료로 채워져 있어 **사람이 나오는 글이 사실상 없다.**
// 소재 균형(`topic-gap`)은 이미 찼다고 나오는데, 소재가 아니라 **글의 결**이 문제였다.
//
// ── 문턱은 이미 만든 문항에서 가져왔다 ──────────────────────────────
// 짐작으로 정하지 않으려고, 지문을 가진 기존 문항의 인물 대명사 비율을 쟀다:
//
//   long_reference  39편 — 최소 **0.0382** · 중앙 0.0687 · 최대 0.1037
//   mood            45편 — 최소 0.0051 · 중앙 0.0450 · 최대 0.1050
//   implication     35편 — 전부 **0.0000**
//
// 장문 지칭은 대명사 다섯이 같은 인물을 가리켜야 하므로 가장 빡빡하다. 그 최솟값
// 아래로는 그 유형이 아예 안 선다. 그래서 **0.03** 을 문턱으로 둔다.
//
// ⚠️ `implication` 은 이 잣대와 **무관하다** — 35편 전부 0 이다. 그 유형이 요구하는 것은
//   인물이 아니라 **이 글 안에서만 뜻이 서는 구절**(비유)이라, 다른 잣대가 필요하다.
//   여기서 함께 재려 하면 안 된다.

/** 인물을 가리키는 대명사. 1인칭·2인칭은 설명문에도 흔해 넣지 않는다. */
const PEOPLE = new Set(['he', 'she', 'his', 'her', 'him', 'hers', 'himself', 'herself'])

/** 인물 대명사가 전체 낱말에서 차지하는 비율. */
export function peopleRatio(text) {
  const toks = String(text ?? '').split(/\s+/).filter(Boolean)
  if (!toks.length) return 0
  let n = 0
  for (const w of String(text ?? '').toLowerCase().split(/[^a-z]+/)) {
    if (PEOPLE.has(w)) n++
  }
  return n / toks.length
}

/**
 * 장문 지칭이 설 수 있는 최소 인물 밀도. 기존 39편의 **실측 최솟값 0.0382** 아래에
 * 여유를 둔 값이다 — 문턱을 실측보다 높이면 만들 수 있던 글까지 버린다.
 */
export const NARRATIVE_FLOOR = 0.03

/** 서사로 볼 만한가. */
export function looksNarrative(text) {
  return peopleRatio(text) >= NARRATIVE_FLOOR
}
