// scripts/csat/prose-gate.mjs
//
// **수치 대역을 통과해도 산문이 아닌 것을 걸러 낸다.** 두 자(corpus-window-yield ·
// discourse-band)가 공유한다 — 자마다 따로 두면 같은 것을 다르게 재게 된다.
//
// ── 왜 필요한가 (실측 2026-08-30) ─────────────────────────────────────
// PLOS 글의 첫 in-band 창이 지문이 아니라 **인용 서지 블록**이었다:
//   "Citation: Suthar AB, Bärnighausen T (2017) … PLoS Med 14(12): e1002469.
//    https://doi.org/… Published: December 12, 2017 This is an open access article…"
//   낱말 155 · 문장당 22.1 · 낱말길이 5.10 — 기출 대역 셋을 전부 만족한다.
//   DOI·저자명이 **긴 낱말**로 세어지고 서지 블록이 **긴 문장**이 되기 때문이다.
//
// 즉 대역은 필요조건이지 충분조건이 아니다. 이 게이트가 없으면 수확량이 부풀려지고,
// 그 숫자로 "소스가 충분하다" 는 결론을 내리게 된다.
//
// ⚠️ 이 게이트가 걸러 내는 것은 **산문이 아닌 것**뿐이다. 산문이면서 문항이 안 되는 글은
//   여기서 안 걸린다 — 그건 `discourse-band.mjs` 소관이다.

const NON_PROSE = [
  /https?:\/\//i,
  /\bdoi\.org\b|\bdoi:\s*10\./i,
  /\bCitation:\s/,
  /\bPublished:\s/,
  /\bCopyright:\s|\ball copyright\b|\bopen access article\b/i,
  /\bReceived:\s|\bAccepted:\s/,
  /\bFunding:\s|\bCompeting interests:\s|\bData Availability\b/i,
  /\bPLoS\b|\bPLOS\s(?:ONE|Med|Biol|Genet)\b/,
  /\be\d{6,}\b/, // PLOS 논문번호 e1002469
]

/**
 * @param text  창 원문
 * @param words 그 창의 낱말 배열 (호출부가 이미 갖고 있으므로 다시 안 자른다)
 */
export function looksLikeProse(text, words) {
  for (const re of NON_PROSE) if (re.test(text)) return false
  // 아주 긴 토큰(URL 잔재·식별자)과 숫자 과다는 산문이 아니다.
  if (words.some((w) => w.length > 24)) return false
  const digits = (text.match(/\d/g) ?? []).length
  if (digits / Math.max(1, text.length) > 0.05) return false
  // 대문자 약어·이니셜이 과하면 저자 목록이다 (예: "Suthar AB, Bärnighausen T").
  const initials = (text.match(/\b[A-Z]{1,3}\b/g) ?? []).length
  if (initials / Math.max(1, words.length) > 0.08) return false
  return true
}
