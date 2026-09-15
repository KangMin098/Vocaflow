// scripts/csat/lib-analyst-markers.mjs
//
// **분석자 작업 로그 표지 — 정본.**
//
// 유형 리포트의 `answer_locus_pattern` 은 드레인 청크마다 덧붙어 쌓인다. 그래서 그 안에
// 분석자끼리 하는 말이 그대로 남는다 — 「앞선 청크의 관찰 ①은 이 청크에서는 성립하지 않는다」
// 「── 2026-09-04 갱신」 「confirmed_at 에 두 번째 자리를 적어야 했다」.
// 그 글이 학습자 화면 `/csat/<유형>` 에 그대로 나간다.
//
// export(뽑을 몫 고르기)와 import(게이트)가 **같은 목록**을 봐야 한다. 갈리면 뽑아 놓고
// 못 올리거나, 안 뽑은 것을 올리게 된다. 그래서 이 파일 하나에 둔다.
//
// 앱 쪽 사본은 `apps/web/src/lib/csat/guide-fold.ts` 의 `detectAnalystMeta` 이고,
// 둘이 어긋나면 `guide-fold.test.ts` 의 정합 검사가 깨진다.
//
// 표지는 **애매하지 않은 것만** 쓴다. 「재확인된다」·「성립하지 않는다」 같은 말은 학습자용
// 서술에도 정당하게 나오므로 세지 않는다 — 오탐 하나가 멀쩡한 글을 다시 쓰게 만든다.

export const ANALYST_MARKERS = [
  ['청크', /청크/],
  ['관찰 번호', /관찰\s*[①②③④⑤]/],
  ['날짜 갱신 표시', /\d{4}-\d{2}-\d{2}\s*갱신/],
  ['내부 필드명', /confirmed_at|answer_locus\.|_PROMPT/],
  ['배치 지시', /이번 회차분|다음 배치|앞선 배치/],
]

/** 발견된 표지 이름들 (없으면 빈 배열) */
export function detectAnalystMeta(text) {
  if (!text) return []
  return ANALYST_MARKERS.filter(([, re]) => re.test(text)).map(([name]) => name)
}

/** 서술에 인용된 문항 id 집합 — 재작성이 없던 근거를 만들어 내지 않았는지 대조하는 데 쓴다 */
export function citedItemIds(text) {
  if (!text) return new Set()
  return new Set((text.match(/M?\d{4}[AB]?#\d+/g) ?? []))
}

/** 따옴표·공백 표기 차이를 지운다 — 곡선 따옴표 하나 때문에 「지어냈다」로 몰리면 안 된다 */
const normalize = (s) =>
  (s ?? '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .toLowerCase()

/**
 * 한국어 서술 안에 박힌 **영어 토막**(두 낱말 이상 연속).
 *
 * 이 유형 서술의 알맹이는 표지어다 — `Thus` · `in other words` · `not A but B`. 그런데
 * 재작성이 원본에 없던 표지어를 **그럴듯해서** 보태는 일이 실제로 있었다(실측 2026-09-05:
 * 13유형 중 3건 — 「이유절 — too close 처럼」 · 「For example 로 열린 문장」 ·
 * 「error · assumption · myth · commonly believed」). 문항 id 대조로는 안 걸린다.
 *
 * 학습자는 이 목록을 시험장에서 그대로 찾는다. 기출에 없던 표지를 찾게 만들면 시간을 잃는다.
 * 그래서 **원본에 없는 영어 토막은 게이트가 막는다** — 원본에 있는 꼴 그대로 쓰면 통과한다
 * (「It is critical/crucial that」을 둘로 쪼개지 말고 원본대로 두면 된다).
 */
export function foreignFragments(text) {
  const found = text?.match(/[A-Za-z][A-Za-z'’-]*(?:\s+[A-Za-z][A-Za-z'’-]*)+/g) ?? []
  return [...new Set(found.map((s) => s.trim()).filter((s) => s.length > 4))]
}

/** 재작성이 새로 만들어 낸 영어 토막 (없으면 빈 배열) */
export function inventedFragments(before, after) {
  const src = normalize(before)
  return foreignFragments(after).filter((f) => !src.includes(normalize(f)))
}
