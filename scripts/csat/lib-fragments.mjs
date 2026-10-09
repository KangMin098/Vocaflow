// scripts/csat/lib-fragments.mjs
//
// 한국어 해설 산문에 박힌 영어 조각 — 골격 굽기(build-skeleton-data)와 끌리는 구절 드레인(lure-drain-*)이
// **같은 규칙**으로 「이 오답이 이미 지문 위치를 갖는가」를 판정하게 한 곳에 둔다.
// 낱말 하나는 지문 어디에나 있어 «아무 데나 칠하기» 가 되므로 구(句) 이상만 쓴다.

export const FRAG_MIN = 20
const FRAG = new RegExp(`[A-Za-z][A-Za-z0-9 ,.;:'"()\\-‘’“”–—]{${FRAG_MIN - 1},}`, 'g')

export function fragments(text) {
  const out = []
  for (const m of String(text ?? '').matchAll(FRAG)) {
    const s = m[0].trim().replace(/[\s,.;:]+$/, '')
    if (s.length >= FRAG_MIN) out.push(s)
  }
  return out.sort((a, b) => b.length - a.length)
}

/**
 * 오답 하나가 지문 위 자리를 찾는 순서 — ① 지우는 근거 ② 끌리는 이유 ③ 드레인이 채운 끌리는 구절(lure_quote).
 * 정답 선지는 ①만(`reject:n` 은 «버릴 것» 의 id 다). 못 찾으면 null.
 */
export function locateChoice(ch, passage, findQuote) {
  const fr = ch.how_to_reject ? fragments(ch.how_to_reject).find((f) => findQuote(passage, f)) : null
  if (fr) return { quote: fr, from: 'reject' }
  if (ch.verdict === 'correct') return null
  const fr2 = ch.why_tempting ? fragments(ch.why_tempting).find((f) => findQuote(passage, f)) : null
  if (fr2) return { quote: fr2, from: 'tempt' }
  const lq = typeof ch.lure_quote === 'string' ? ch.lure_quote.trim() : ''
  if (lq.length >= FRAG_MIN && findQuote(passage, lq)) return { quote: lq, from: 'tempt' }
  return null
}
