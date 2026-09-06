// packages/library-pipeline/src/textbook/item-gate.ts
//
// **집필한 문항이 적재될 자격이 있는가** — 드레인 3단계의 관문 한 벌.
//
// ── 왜 한 벌인가 (실측 2026-09-06) ──────────────────────────────────
// 이 규칙들은 `item-drain-import.mjs` 안에 인라인으로 있었고, DB 를 붙잡아야만 돌릴 수
// 있었다. 그래서 문항을 쓸 때마다 **손으로 자체 검사기를 새로 짰고, 그 검사기가 게이트와
// 다른 규칙을 썼다** — 실제로 "선택지 최소/최대 길이 비 ≥ 0.85" 라는 있지도 않은 규칙으로
// 요약 문항 넷을 헛되이 다시 썼다(진짜 규칙은 **정답 ÷ 오답 평균 0.8~1.25**).
//
// 사본을 두면 둘이 갈린다. 그래서 규칙을 여기 한 벌로 두고, **넣는 자(import)와 미리
// 재는 자(item-selfcheck)가 같은 것을 읽는다.** DB 가 필요 없는 순수 함수만 담는다.
//
// ⚠️ 여기 없는 검사가 둘 있다 — 둘 다 DB 를 봐야 한다:
//   · 이미 같은 (유형, 원글) 이 있는가 (재실행 안전)
//   · **정답 번호 쏠림** — 이번에 새로 넣는 것(`fresh`)만 봐야 하는데, 무엇이 새것인지는
//     DB 에 물어야 안다. 그래서 import 에 남긴다.

import { hasArticleChrome } from './csat-format'
import { itemWordSpec } from './compose-unit'
import { EXPLANATION_MENTIONS_WRONG, EXPLANATION_QUOTES_SOURCE } from './explain-items'

/** 선택지 하나의 최소 길이. "yes" 같은 것을 막는다. */
export const MIN_CHOICE = 8

/**
 * **길이 단서 차단** — 정답이 오답보다 길면 지문을 안 읽고도 풀린다.
 *
 * 실측(2026-08-21, 첫 파일럿 64문항): 정답이 최장인 비율이 우연(20%)의 세 배였다.
 *   main_point **16/16 = 100%**(정답이 평균보다 19자 김) · topic 68.8% · blank 50%
 * 요지 문항은 **가장 긴 것을 고르면 다 맞았다.** 그건 문항이 아니다.
 *
 * 두 겹으로 막는다:
 *   ① 문항 단위 — 정답이 오답 **평균**의 1.25배를 넘거나 0.8배 미만이면 그 문항을 버린다.
 *   ② 배치 단위 — 정답이 **유일한** 최장(또는 최단)인 비율이 40% 를 넘으면 적재를 거부한다.
 *
 * ⚠️ 문항 단위로 "정답이 유일한 최장" 을 버리지는 **않는다.** 5지선다에서 정답이 최장일
 *   확률은 원래 20% 라, 문항마다 버리면 멀쩡한 문항의 5분의 1을 버린다. 그건 배치 비율로
 *   봐야 하는 것이고 ②가 그 자리다.
 */
export const ANSWER_LEN_RATIO = 1.25
export const ANSWER_LEN_RATIO_MIN = 0.8
export const LONGEST_ANSWER_MAX = 0.4
/** 근거의 최소 길이. 빈 근거는 검수할 수 없다. */
export const MIN_RATIONALE = 20

/** 선택지 비교용 정규화 — 대소문자·구두점·공백 차이는 "다른 선택지" 가 아니다. */
export const normChoice = (s: unknown): string =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, ' ')
    .trim()

/** 드레인 청크가 채워진 뒤의 한 줄. 유형마다 쓰는 칸이 다르다. */
export interface DrainItemRow {
  article_id?: string | null
  source_title?: string | null
  choices?: unknown
  answer?: unknown
  passage?: string | null
  /** 장문 어휘는 낱말 하나를 바꿔 놓은 지문이 학습자가 보는 판이다. */
  passage_edited?: string | null
  rationale_ko?: string | null
  summary_sentence?: string | null
  underline?: string | null
  swapped?: { to?: string | null } | null
}

export interface ItemGateVerdict {
  ok: boolean
  /** 통과하지 못한 이유. 통과했으면 없다. */
  reason?: string
  /** 다듬은 값 — 통과했을 때 그대로 적재에 쓴다. */
  choices: string[]
  answer: number
  passage: string
}

/** 빈 줄로 가른 문단 수. 장문은 넷이어야 한다. */
const parasCount = (t: string): number => t.split(/\n\s*\n+/).filter((s) => s.trim()).length

/**
 * 문항 하나가 적재될 자격이 있는가.
 *
 * `band` 를 **반드시** 넘긴다 — 안 넘기면 초등 몫도 고등 창(90~200어)으로 재서 집필 몫을
 * 뽑을 때·권을 조립할 때와 다른 자가 된다(같은 결함이 이 저장소에서 다섯 번 났다).
 */
export function checkDrainItem(r: DrainItemRow, type: string, band: number): ItemGateVerdict {
  const choices = Array.isArray(r.choices) ? r.choices.map((c) => String(c ?? '').trim()) : []
  const answer = Number(r.answer)
  const passage = String(r.passage_edited ?? r.passage ?? '').trim()
  const words = passage.split(/\s+/).filter(Boolean).length
  const spec = itemWordSpec(type, band)
  const no = (reason: string): ItemGateVerdict => ({ ok: false, reason, choices, answer, passage })

  if (!r.article_id) return no('article_id 가 없다')
  if (choices.length !== 5) return no(`선택지가 ${choices.length}개 — 다섯이어야 한다`)
  if (choices.some((c) => c.length < MIN_CHOICE)) return no('너무 짧은 선택지가 있다')
  if (new Set(choices.map(normChoice)).size !== 5)
    return no('**선택지가 서로 겹친다 — 답이 둘이 된다**')
  if (!Number.isInteger(answer) || answer < 1 || answer > 5)
    return no(`정답 번호가 ${String(r.answer)} — 1~5 여야 한다`)
  if (String(r.rationale_ko ?? '').trim().length < MIN_RATIONALE)
    return no('근거가 비었거나 너무 짧다')
  // ⚠️ **해설은 길이만으로 충분하지 않다.** 시중 해설지는 절반이 지문의 영어를 그대로 따오고
  //   (49.7%) 절반이 왜 나머지가 아닌지 짚는다(53.6%). 그 둘이 학습자가 자기 오답을 스스로
  //   확인하는 장치다.
  if (!EXPLANATION_QUOTES_SOURCE.test(String(r.rationale_ko ?? '')))
    return no('근거에 지문의 영어를 인용하지 않았다 — 학습자가 본문에서 찾을 수 없다')
  if (!EXPLANATION_MENTIONS_WRONG.test(String(r.rationale_ko ?? '')))
    return no('근거가 왜 나머지가 아닌지 짚지 않았다 — "나머지"·"오답"·번호 중 하나로 명시할 것')
  if (!passage) return no('지문이 비었다')
  // ⚠️ **게이트는 뽑을 때가 아니라 넣을 때도 봐야 한다** — 청크 파일은 게이트보다 오래 산다.
  //   `isPrintablePassage` 가 아니라 `hasArticleChrome` 인 이유: 전자의 비산문 규칙에
  //   `_{4,}` 가 있어 빈칸 유형의 `____` 를 전부 껍데기로 센다.
  if (hasArticleChrome(String(r.passage ?? '')) || hasArticleChrome(passage))
    return no('기사 껍데기가 지문에 있다 — 게이트가 생기기 전에 채운 청크다')
  if (spec.max > 0 && (words < spec.min || words > spec.max))
    return no(`지문이 ${words}어 — 규격 ${spec.min}~${spec.max}어 밖이라 인쇄할 수 없다`)

  // 유형별 추가 조건 — 없으면 문항이 성립하지 않는다.
  if (type === 'blank' && !passage.includes('____'))
    return no('빈칸 유형인데 지문에 `____` 가 없다')
  if (type === 'summary' && !/\(A\)[\s\S]*\(B\)/.test(String(r.summary_sentence ?? '')))
    return no('요약 유형인데 `(A)`·`(B)` 가 든 요약문이 없다')
  if (type === 'implication' && !passage.includes(String(r.underline ?? '\0')))
    return no('함의 유형인데 밑줄 구절이 지문에 그대로 있지 않다')
  // ── 장문 묶음(43~45) ────────────────────────────────────────────────
  if (type.startsWith('long_') && parasCount(passage) !== 4)
    return no(`장문인데 문단이 ${parasCount(passage)}개 — 넷이어야 (A)(B)(C)(D) 가 선다`)
  if (type === 'long_order' && choices.some((c) => (c.match(/\([B-D]\)/g) ?? []).length !== 3))
    return no('순서 유형인데 (B)(C)(D) 세 토막이 아닌 선택지가 있다 — 형식이 단서가 된다')
  if (type === 'long_reference' && choices.some((c) => !passage.includes(c)))
    return no('지칭 유형인데 지문에 그대로 없는 구절이 있다 — 학습자가 찾을 수 없다')
  if (type === 'long_vocab' && choices.some((c) => !passage.includes(c)))
    return no('어휘 유형인데 지문에 그대로 없는 구절이 있다 — passage_edited 를 안 냈거나 구절을 다듬었다')
  if (type === 'long_vocab' && !String(choices[answer - 1] ?? '').includes(String(r.swapped?.to ?? ' ')))
    return no('어휘 유형인데 정답 구절에 바꾼 낱말이 없다')

  // 길이 단서 — 정답이 오답 **평균**보다 눈에 띄게 길거나 짧으면 읽지 않고도 풀린다.
  // 정답 번호는 위에서 이미 1~5 로 막혔고 선택지도 다섯인 것이 확인됐다 —
  // 그래도 인덱스 접근이라 컴파일러에는 `undefined` 로 보인다. 값으로 받아 둔다.
  const answerLen = (choices[answer - 1] ?? '').length
  const others = choices.filter((_, i) => i !== answer - 1).map((c) => c.length)
  const ratio = answerLen / (others.reduce((a, b) => a + b, 0) / others.length)
  if (ratio > ANSWER_LEN_RATIO)
    return no(`정답이 오답 평균의 ${ratio.toFixed(2)}배 — 길이만 보고 풀린다`)
  if (ratio < ANSWER_LEN_RATIO_MIN)
    return no(`정답이 오답 평균의 ${ratio.toFixed(2)}배로 짧다 — 짧은 것만 골라도 풀린다`)

  return { ok: true, choices, answer, passage }
}

export interface LengthBias {
  n: number
  /** 정답이 **유일한** 최장인 문항 수. 공동 최장은 고르는 근거가 못 되므로 안 센다. */
  longest: number
  shortest: number
  /** 둘 중 큰 쪽의 비율. `LONGEST_ANSWER_MAX` 를 넘으면 배치를 거부한다. */
  worst: number
  /** 배치가 여덟 건 미만이면 비율이 뜻을 갖지 못한다 — 그때는 문항 단위 관문만 남는다. */
  enough: boolean
}

/**
 * 배치 단위 길이 편향. 문항마다 임계를 넘지 않아도 **한쪽으로 쏠려 있으면** 학습자는
 * 그 규칙을 배운다.
 *
 * ⚠️ **양쪽을 다 본다.** 정답이 눈에 띄게 짧아도 "제일 짧은 게 정답" 이라는 단서가 된다.
 */
export function answerLengthBias(items: { choices: string[]; answer: number }[]): LengthBias {
  const n = items.length
  const extreme = (pick: (l: number[]) => number) =>
    items.filter((r) => {
      const lens = r.choices.map((c) => c.length)
      // 정답 번호가 범위 밖인 줄은 이미 `checkDrainItem` 이 막는다 — 여기서는 세지 않는다.
      const answerLen = r.choices[r.answer - 1]?.length
      if (answerLen === undefined || !lens.length) return false
      const target = pick(lens)
      return answerLen === target && lens.filter((v) => v === target).length === 1
    }).length
  const longest = n ? extreme((l) => Math.max(...l)) : 0
  const shortest = n ? extreme((l) => Math.min(...l)) : 0
  return { n, longest, shortest, worst: n ? Math.max(longest, shortest) / n : 0, enough: n >= 8 }
}
