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
    // 인용 부호 · 대시 · 괄호가 조각 앞뒤에 붙어 남으면 지문에서 영영 못 찾는다(2026-10-11 실측: 평가원 오답
    // 「지문에서 못 찾음」 401 중 다수가 `…hours.'` · `decision' —` 꼴). 말줄임표로 끊은 인용은 조각마다 따로 찾는다.
    for (const part of m[0].split(/\.{3}|…/)) {
      const s = part.trim().replace(/^[\s'"‘’“”(\-–—]+/, '').replace(/[\s,.;:'"‘’“”)\-–—]+$/, '')
      if (s.length >= FRAG_MIN) out.push(s)
    }
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
  if (lq.length >= FRAG_MIN && findQuote(passage, lq)) return { quote: lq, from: 'tempt', lure: true }
  // ④ 짧은 인용 어구 — 어법 · 어휘 · 안내문 해설은 근거를 'family ties' 처럼 20자 미만 어구로 댄다(2026-10-11 실측
  //    평가원 오답 261). 낱말 하나는 아무 데나 칠하므로 쓰지 않고, **따옴표로 묶은 두 낱말 이상**이 지문에
  //    **낱말 경계로 딱 한 번** 나올 때만 쓴다 — 두 번 이상이면 어느 자리인지 모르니 붙이지 않는다.
  const short = shortQuoted(ch.how_to_reject).find((q) => uniqueIn(passage, q, findQuote))
  if (short) return { quote: short, from: 'reject' }
  const short2 = shortQuoted(ch.why_tempting).find((q) => uniqueIn(passage, q, findQuote))
  if (short2) return { quote: short2, from: 'tempt' }
  return null
}

/** 따옴표 안의 짧은 영어 어구(두 낱말 이상 · 8자 이상 · FRAG_MIN 미만) — 긴 것부터 */
export function shortQuoted(text) {
  const out = []
  for (const m of String(text ?? '').matchAll(/['‘"“]([A-Za-z](?:[A-Za-z -]|['’](?=[A-Za-z]))*[A-Za-z])['’"”](?![A-Za-z])/g)) {
    const s = m[1].trim()
    if (s.length >= 8 && s.length < FRAG_MIN && /\s/.test(s)) out.push(s)
  }
  return [...new Set(out)].sort((a, b) => b.length - a.length)
}

/** 지문에 낱말 경계로 딱 한 번 나오는가 */
function uniqueIn(passage, q, findQuote) {
  const hit = findQuote(passage, q)
  if (!hit) return false
  const isWord = (c) => !!c && /[A-Za-z]/.test(c)
  if (isWord(passage[hit.start - 1]) || isWord(passage[hit.end])) return false
  return !findQuote(passage, q, hit.end)
}
