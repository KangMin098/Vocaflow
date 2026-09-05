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
