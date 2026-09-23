// scripts/csat/lib-chop.mjs
//
// **책 본문을 지문 크기 조각으로 자른다 — 버리지 않고.**
//
// ── 왜 따로 떼어 냈나 (2026-09-24 실측) ───────────────────────────────
// `harvest-gutenberg.mjs` 안에 있던 `chop()` 이 **본문의 54.9% 를 조용히 버리고
// 있었다.** 12권 1,312,273어를 원문째 받아 사유별로 가른 결과(잔여 0어, 100% 설명됨):
//
//   남긴 것              592,357어  45.1%
//   340어 넘는 문단      279,780어  21.3%   ← `if (w > hi) continue` — 쪼개지 않고 버렸다
//   400어 넘긴 묶음      401,152어  30.6%   ← 창을 넘기면 버퍼를 **그냥 비웠다**
//   비산문(80자 이하)     37,758어   2.9%   ← 표·목차·시행·대사. 이건 버리는 게 맞다
//   마지막 꼬리            1,226어   0.1%   ← 루프가 끝나도 buf 를 안 내보냈다
//
// 앞의 둘이 문제다. **둘 다 「자를 자리를 못 찾았다」는 이유로 글을 버린다.**
// 그런데 340어짜리 문단은 쪼개면 되고, 400어를 넘긴 묶음은 마지막 조각을 **다음
// 묶음으로 넘기면** 된다. 버릴 이유가 없다.
//
// 더 나쁜 것은 **무엇이 버려졌는가**다. 340어를 넘는 긴 문단은 1900년대 논설·철학·
// 역사서의 전형이다 — 즉 이 저장소가 가장 아쉬워하는 **논증 밀도가 높은 산문**이
// 계통적으로 빠졌다. 책마다 편차가 크다(0.5% ~ 39.3%).
//
// ── 고친 것 ──────────────────────────────────────────────────────────
//   ① 긴 문단은 **문장 경계에서** 쪼갠다(낱말 수로 자르지 않는다 — 문장 평균이 망가진다)
//   ② 창을 넘길 것 같으면 **먼저 내보내고** 그 조각을 다음 묶음의 시작으로 쓴다
//   ③ 마지막 꼬리도 하한을 넘으면 내보낸다
//   ④ 창을 인자로 받는다 — 300~400 하나로 고정돼 있어서 **다른 유형을 낼 수 없었다**
//
// ⚠️ **문장 중간에서는 여전히 안 자른다.** 문장을 쪼개면 그 조각의 문장 평균이 망가져
//   소스의 성질이 아니라 **자르는 방식**을 재게 된다(§45: 정제기가 빈 줄을 삼켰을 때
//   조각이 73 → 5 로 무너진 것과 같은 함정).
//
// ⚠️ 이 모듈은 **손실을 세어 돌려준다**(`losses`). 조용히 버리면 다음 사람이 같은 것을
//   다시 발견하게 된다 — 실제로 그랬다.

/** 낱말 수 — 저장소 공통 계산(한 글자 낱말은 안 센다). */
export function countWords(s) {
  return (s.match(/[A-Za-z][A-Za-z'-]*/g) ?? []).length
}

/** 문장 경계. 약어(`e.g.` · `Mr.`)를 쪼개지 않도록 **대문자가 뒤따를 때만** 나눈다. */
export function splitSentences(text) {
  return text
    .split(/(?<=[.!?]["')\]]?)\s+(?=["'(\[]?[A-Z])/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * 긴 문단을 `max` 이하 조각으로 **문장 경계에서** 쪼갠다.
 * 한 문장이 혼자 `max` 를 넘으면 그 문장은 쪼개지 않고 그대로 둔다 — 문장을 자르느니
 * 창을 한 번 넘기는 편이 낫다(호출부가 그 조각을 걸러 낸다).
 */
export function splitLongParagraph(para, max) {
  if (countWords(para) <= max) return [para]
  const out = []
  let buf = []
  let n = 0
  for (const s of splitSentences(para)) {
    const w = countWords(s)
    if (n && n + w > max) {
      out.push(buf.join(' '))
      buf = []
      n = 0
    }
    buf.push(s)
    n += w
  }
  if (buf.length) out.push(buf.join(' '))
  return out
}

/** 산문 문단인가 — 표·목차·시행·대사 토막을 뺀다. */
export function isProseParagraph(p) {
  return p.length > 80 && /[.!?]/.test(p)
}

/**
 * 본문을 `[lo, max]` 창의 조각으로 자른다.
 *
 * @param {string} body    정제된 본문
 * @param {object} opts
 * @param {number} opts.lo   하한 — 이만큼 모이면 내보낸다
 * @param {number} opts.max  상한 — 절대 넘기지 않는다
 * @returns {{ spans: string[], losses: Record<string, number> }}
 *   `losses` 는 **버린 낱말 수**를 사유별로 센다. 합이 0이 아니면 그만큼 사라진 것이다.
 */
export function chopToWindow(body, { lo = 300, max = 400 } = {}) {
  const all = body.split(/\n\s*\n/).map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean)
  const losses = { notProse: 0, tooShortTail: 0, oversizeSentence: 0 }

  // **문단이 아니라 문장을 채운다.** 문단 단위로 채우면 「다음 문단을 넣으면 창을 넘고,
  // 안 넣으면 하한에 못 미친다」는 자리에서 통째로 버리게 된다 — 옛 코드가 본문의
  // 30.6% 를 잃은 자리이고, 문단 단위로 고쳐도 그 자리는 그대로 남았다(회귀가 잡았다).
  // 문장 경계는 안전하다: 문장을 쪼개지 않으므로 조각의 문장 평균이 안 망가진다.
  const sentences = []
  for (const p of all) {
    if (!isProseParagraph(p)) { losses.notProse += countWords(p); continue }
    for (const s of splitSentences(p)) sentences.push(s)
  }

  const spans = []
  let buf = []
  let n = 0
  const flush = () => {
    if (!buf.length) return
    if (n >= lo && n <= max) spans.push(buf.join(' '))
    else losses.tooShortTail += n
    buf = []
    n = 0
  }

  for (const s of sentences) {
    const w = countWords(s)
    // 문장 하나가 혼자 창보다 길다 — 문장은 쪼개지 않으므로 이 문장은 못 담는다.
    if (w > max) { losses.oversizeSentence += w; continue }
    // 담으면 넘친다 → **먼저 내보내고** 이 문장은 다음 묶음의 시작으로 쓴다.
    if (n + w > max) flush()
    buf.push(s)
    n += w
    if (n >= lo) flush()
  }
  flush() // 꼬리도 내보낸다 — 하한에 못 미치면 losses 에 잡힌다

  return { spans, losses }
}
