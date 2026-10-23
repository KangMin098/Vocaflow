// scripts/csat/lib-body-suspect.mjs
//
// 코퍼스 지문 의심 판정(build-corpus 의 `body_suspect` → `csat_items.body_ok`). 회귀 테스트를 위해
// build-corpus.mjs 에서 그대로 옮겼다(내용 변경은 R-SUMMARY 의 ④ 한 곳뿐).

/** 빈칸이 지문 안에 있어야 하는 유형 — 빈칸 위치가 곧 정답 근거다 */
export const BLANK_TYPES = new Set(['R-BLANK', 'R-BLANK2', 'R-SUMMARY', 'X-BLANK', 'X-BLANK2'])

/**
 * **선지가 지문 안에 기호로 박히는 유형.** 여기서는 지문에 ①~⑤ 가 있는 것이 정상이다.
 * 실측(2026-09-02): R-INSERT 52/52 · R-GRAMMAR 30/30 · R-CHART 28/30 · R-IRRELEVANT 26/28.
 */
export const SYMBOL_CHOICE_TYPES = new Set([
  'R-INSERT', 'R-ORDER', 'R-IRRELEVANT', 'R-GRAMMAR', 'R-VOCAB', 'R-CHART', 'R-REFER',
  'X-ORDER', 'X-REFER', 'X-VOCAB',
])

/**
 * **지문을 믿어도 되는가.** 넷 중 하나라도 걸리면 드레인이 원문 블록을 함께 싣는다.
 *
 *   ① 한글이 남았다 — 발문 꼬리·각주·옆 단이 섞였다
 *   ② 홀로 선 마침표(` . `) — 옆 단 조각이 문장 사이로 들어왔다
 *      (실측 2023#34: `it is not that . I that the realities…`)
 *   ③ 한 글자짜리 낱말이 a·A·I 가 아니다 — 단 자르기가 낱말 가운데를 지났다
 *      (실측 M2306#31: `computer r artist`)
 *   ④ 빈칸 유형인데 빈칸 표시가 없다 — 빈칸이 빈 줄로 와서 위치가 사라졌다
 *      (실측 M2309#34: `may have to order to` — 빈칸과 `in` 이 함께 증발)
 *
 * ④가 가장 중요하다. 빈칸추론은 **빈칸 위치가 정답 근거**라, 위치를 모르면 분석이
 * 성립하지 않는데도 지문은 멀쩡해 보인다. 사람 눈에 안 띄는 실패라 기계가 잡아야 한다.
 */
export function suspectBody(passage, typeId) {
  if (!passage) return false
  if ((passage.match(/[가-힣]/g) ?? []).length >= 4) return true
  if (/\s\.\s/.test(passage)) return true
  if (/(?:^|\s)(?![aAI](?:$|\s))[A-Za-z](?=$|\s)/.test(passage)) return true
  //    요약문은 (A)·(B) 글자가 빈칸 자리다 — 학평 코퍼스는 `______` 를 지우므로(build-corpus 「빈칸 복원」)
  //    두 글자가 모두 남아 있으면 위치가 살아 있다(2026-10-24 실측: 학평 요약문 101건이 이 규칙에만 걸렸다).
  if (BLANK_TYPES.has(typeId) && !passage.includes('______') && !(typeId === 'R-SUMMARY' && /\(A\)/.test(passage) && /\(B\)/.test(passage))) return true
  // ⑤ 지문 안에 **다른 문항의 번호**가 박혀 있다 — 단이 안 갈린 페이지에서 두 문항이 한 줄에
  //    붙어 같은 블록을 쓰게 된 것이다(실측: M2306 의 `37.        39.` 한 줄 → 37·39 지문 동일).
  if (/(?:^|\s)\d{1,2}\.\s+[A-Z]/.test(passage)) return true
  // ⑥ **선지 기호가 지문에 있는데 그럴 유형이 아니다.**
  //    삽입·순서·어법·어휘·도표·무관은 ①~⑤ 가 본문에 박히는 것이 설계다. 그 밖의 유형에서
  //    기호가 지문에 있으면 선지 블록이 지문 꼬리에 뭉개진 것이다 — 이때 `choices` 는
  //    비어 있지 않아서 `body_ok` 가 true 로 남는다(실측 2016#31: 선지 5개가 지문 끝에 붙어
  //    있었는데 딱지가 안 붙어 원문 블록이 안 실렸다. 서브에이전트가 손으로 복원해야 했다).
  if (!SYMBOL_CHOICE_TYPES.has(typeId) && /[①②③④⑤]/.test(passage)) return true
  // ⑨ **지문이 기능어로 끝난다** — `…and` · `…of the` · `…trying to` · `…was so`.
  //    영어 문단은 기능어로 끝나지 않는다. 끝났다면 그 자리에서 잘린 것이다.
  //    「마침표가 없다」로 재면 144건이 걸리는데 대부분 쪽번호·각주·서명 줄이라 못 쓴다(오탐 88).
  //    기능어 목록으로 좁히면 **13건 · 오탐 0** 이다(2026-09-02 전수 확인). 좁은 자가 쓰인다.
  if (TRUNCATED_TAIL.test(passage.trim())) return true
  return false
}

/** 영어 문단이 여기서 끝날 리 없는 낱말들 — 끝났다면 잘린 것이다 */
export const TRUNCATED_TAIL =
  /\b(?:a|an|the|of|to|in|on|at|for|with|and|or|but|that|which|is|are|was|were|be|been|as|by|from|it|its|their|his|her|this|these|those|not|has|have|had|can|will|would|should|could|may|might|than|then|when|while|because|if|so|such|into|about|over|under|between|through)\s*$/i
