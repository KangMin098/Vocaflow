// apps/web/src/lib/textbook/shelf-copy.ts
//
// 매대 문안의 **자르기 규칙** — 순수 함수.
//
// ⚠️ `server-only`/`react.cache` 금지 — 클라이언트 컴포넌트와 vitest 가 함께 쓴다
//    (`shelf.ts` 와 같은 이유).
//
// ── 왜 생겼나 (실측 2026-09-01) ─────────────────────────────────────
// 매대 사용성을 실제 브라우저로 처음 재 봤더니 **첫 화면에 보이는 상품이 0권**이었다
// (`scripts/textbook/shelf-ux-probe.mjs` — 상업 기준선 NE능률은 3권). 원인 중 하나가
// 카드마다 `rationale` 전문(두세 문장)을 앞면에 인쇄한 것이다. 그 글은 **고른 뒤에**
// 읽을 것이지 고르기 전에 훑을 것이 아니다.
//
// 그래서 앞면에는 **첫 문장만**(태그라인), 나머지는 '이 권은 무엇을 시키나요' 안으로 넣는다.
// 자르는 규칙을 화면에 인라인으로 적지 않고 여기 두는 이유는, 앞면과 뒷면이 **같은 규칙**으로
// 갈라져야 문장이 사라지거나 두 번 나오지 않기 때문이다 — 테스트가 그 둘의 합을 검사한다.

/** 강조 표기(`**`)를 뗀다. 매대는 마크다운을 렌더하지 않는다. */
function plain(text: string): string {
  return text.replace(/\*\*/g, '')
}

/**
 * 첫 문장 = **태그라인**. 이 권이 무엇을 시키는지 한 줄로 말한다.
 *
 * 마침표까지 자른다. 마침표가 없으면 전체가 태그라인이다 — 잘라서 없애지 않는다.
 * ⚠️ 소수점·줄임표를 문장 끝으로 읽지 않도록 **마침표 뒤가 공백이거나 끝**일 때만 끊는다.
 *    ('90~200어' 같은 값이 본문에 들어오면 어이없는 자리에서 잘린다.)
 */
export function taglineOf(rationale: string): string {
  const text = plain(rationale).trim()
  const m = text.match(/^(.+?)\.(\s|$)/)
  return (m ? m[1] : text).trim()
}

/**
 * 태그라인을 뺀 **나머지** — 펼쳤을 때 읽는 글.
 *
 * 나머지가 없으면 빈 문자열이다(화면은 그 줄을 아예 내지 않는다).
 * `taglineOf` 와 합치면 원문(강조 표기만 뗀)이 되어야 한다 — 테스트가 그것을 강제한다.
 */
export function detailOf(rationale: string): string {
  const text = plain(rationale).trim()
  const tag = taglineOf(rationale)
  if (text === tag) return ''
  return text.slice(tag.length).replace(/^\.\s*/, '').trim()
}
