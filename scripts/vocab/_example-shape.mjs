// scripts/vocab/_example-shape.mjs
//
// `shared_dictionary.senses[].examples` 의 **모양을 흡수하는 한 곳.**
//
// ⚠️ 원소가 두 모양이다 — 문자열 **5,116** 개와 `{ en: '…' }` 객체 **89** 개
//    (실측 2026-08-30, 발행 카탈로그 기준). 어느 쪽이 옳다고 정하지 않고 **읽을 때 흡수**한다:
//    데이터를 고치려면 5,205 행을 건드려야 하는데, 그건 번역을 채우는 일과 별개의 결정이고
//    잘못되면 예문 자체가 날아간다.
//
// 문자열만 가정하면 그 89 개는 `[object Object]` 로 번역되거나 조용히 빠진다.
// **export 와 import 가 반드시 같은 함수를 써야** 짝이 어긋나지 않는다 — 그래서 여기 둔다.

/** 예문 한 개의 문장 텍스트. 모양을 모르면 빈 문자열(호출부가 걸러낸다). */
export function exampleText(x) {
  if (typeof x === 'string') return x
  if (x && typeof x === 'object' && typeof x.en === 'string') return x.en
  return ''
}

/** 예문 배열 → 문장 배열. 빈 것은 뺀다. */
export function exampleTexts(list) {
  return (Array.isArray(list) ? list : [])
    .map(exampleText)
    .filter((s) => s.trim().length > 0)
}
